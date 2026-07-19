import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Move o personagem do usuário atual para um local conectado ao atual (ou qualquer, se ainda não tem local). */
export const moveCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ locationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char, error: cErr } = await context.supabase
      .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!char) throw new Error("Você ainda não tem personagem.");

    if (char.current_location_id && char.current_location_id !== data.locationId) {
      // valida que o destino é conectado ao atual
      const a = char.current_location_id < data.locationId ? char.current_location_id : data.locationId;
      const b = char.current_location_id < data.locationId ? data.locationId : char.current_location_id;
      const { data: conn } = await context.supabase
        .from("location_connections").select("id").eq("a_id", a).eq("b_id", b).maybeSingle();
      if (!conn) throw new Error("Este local não é acessível a partir da sua posição atual.");
    }
    // Se este personagem está em um duelo PvP ativo, sair do local implica desistência.
    try {
      const { data: parts } = await context.supabase
        .from("combat_participants").select("session_id").eq("character_id", char.id);
      const sessIds = (parts ?? []).map((p: any) => p.session_id);
      if (sessIds.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sessions } = await supabaseAdmin
          .from("combat_sessions").select("id,status,state").in("id", sessIds).eq("status", "active");
        for (const s of sessions ?? []) {
          if ((s as any).state?.mode === "pvp") {
            const { pvpForfeitOnLeave } = await import("@/lib/combat.functions");
            await pvpForfeitOnLeave(supabaseAdmin, s.id, char.id);
          }
        }
      }
    } catch {}
    const { error } = await context.supabase
      .from("characters").update({
        current_location_id: data.locationId,
        location_entered_at: new Date().toISOString(),
        last_spawn_roll_at: null,
      }).eq("id", char.id);
    if (error) throw new Error(error.message);
    // Anúncio público de chegada no chat local do destino.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: c } = await supabaseAdmin
        .from("characters").select("nickname").eq("id", char.id).maybeSingle();
      const nick = (c as any)?.nickname ?? "Alguém";
      await supabaseAdmin.from("location_messages").insert({
        location_id: data.locationId,
        character_id: char.id,
        content: `❕️ ${nick} chegou aqui.`,
      });
    } catch (e) {
      console.error("[move] falha ao anunciar chegada", e);
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { bumpMissionProgress } = await import("@/lib/missions.functions");
      await bumpMissionProgress(supabaseAdmin, char.id, { type: "reach_location", location_id: data.locationId });
    } catch {}
    return { ok: true };
  });

export const sendLocationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    locationId: z.string().uuid(),
    content: z.string().max(2000).default(""),
    imageUrl: z.string().url().nullish(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (!data.content.trim() && !data.imageUrl) throw new Error("Escreva algo ou anexe uma imagem.");
    const { data: char } = await context.supabase
      .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    if (char.current_location_id !== data.locationId) throw new Error("Você não está neste local.");
    // Trava global do chat (admins ignoram).
    try {
      const { data: cfg } = await context.supabase.from("server_config").select("chat_locked").eq("id", "main").maybeSingle();
      if ((cfg as any)?.chat_locked) {
        const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
        const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
        if (!isAdmin) throw new Error("O chat foi trancado pelos administradores.");
      }
    } catch (e: any) { if (e?.message?.startsWith("O chat foi trancado")) throw e; }
    // Bloqueio durante viagem em andamento
    try {
      const { data: t } = await context.supabase
        .from("travel_sessions").select("id,arrives_at").eq("character_id", char.id).eq("status", "traveling").maybeSingle();
      if (t && new Date((t as any).arrives_at).getTime() > Date.now()) {
        throw new Error("Você está viajando agora — aguarde chegar ao destino.");
      }
    } catch (e: any) { if (e?.message?.startsWith("Você está viajando")) throw e; }
    // Chat travado quando há duelo PvP ativo no local (mesmo para espectadores).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: active } = await supabaseAdmin
        .from("combat_sessions").select("id,state,location_id,status").eq("location_id", data.locationId).eq("status", "active");
      const pvpHere = (active ?? []).find((s: any) => s.state?.mode === "pvp");
      if (pvpHere) throw new Error("Um duelo está em andamento neste local. O chat está temporariamente travado.");
    } catch (e: any) {
      if (e?.message?.startsWith("Um duelo")) throw e;
    }
    const { data: msg, error } = await context.supabase
      .from("location_messages")
      .insert({ location_id: data.locationId, character_id: char.id, content: data.content.trim(), image_url: data.imageUrl ?? null })
      .select("id").single();
    if (error) throw new Error(error.message);
    // Dispara respostas de NPCs de IA presentes no local (best-effort).
    try {
      const { respondNpcsInLocation } = await import("@/lib/npc-ai.functions");
      await (respondNpcsInLocation as any)({ data: { locationId: data.locationId, triggerMessageId: msg.id } });
    } catch (e) {
      console.error("[npc-ai trigger]", e);
    }
    return { id: msg.id };
  });

export const togglePinMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: msg, error: mErr } = await context.supabase
      .from("location_messages")
      .select("id,is_pinned,character_id,characters!inner(user_id)")
      .eq("id", data.messageId).maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!msg) throw new Error("Mensagem não encontrada.");
    const ownerUserId = (msg as any).characters?.user_id as string | undefined;
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (ownerUserId !== context.userId && !isAdmin) throw new Error("Sem permissão para marcar esta mensagem.");
    const { error } = await context.supabase
      .from("location_messages").update({ is_pinned: !(msg as any).is_pinned }).eq("id", data.messageId);
    if (error) throw new Error(error.message);
    return { pinned: !(msg as any).is_pinned };
  });