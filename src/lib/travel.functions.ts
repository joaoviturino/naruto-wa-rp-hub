import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { shortestPathDistance } from "@/lib/location-graph";

const BASE_SECONDS_PER_NODE = 30;
const SUB_SECONDS_PER_NODE = 5;

/** Retorna true se `from` e `to` são sublocais do mesmo pai (ou parent/child). */
function isSublocationMove(
  from: { id: string; parent_id: string | null },
  to: { id: string; parent_id: string | null },
): boolean {
  if (from.parent_id && to.parent_id && from.parent_id === to.parent_id) return true;
  if (from.parent_id === to.id) return true;
  if (to.parent_id === from.id) return true;
  return false;
}

/** Retorna a viagem em andamento do usuário atual (se houver). */
export const getMyTravel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) return { travel: null };
    const { data } = await context.supabase
      .from("travel_sessions")
      .select("id,character_id,from_location_id,to_location_id,mount_id,started_at,arrives_at,status")
      .eq("character_id", char.id).eq("status", "traveling")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    return { travel: data ?? null };
  });

/** Lista as montarias possuídas pelo personagem atual. */
export const listMyMounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) return { mounts: [] };
    const { data } = await context.supabase
      .from("character_mounts")
      .select("mount:mounts(id,name,image_url,description,rank,speed_multiplier)")
      .eq("character_id", char.id);
    return { mounts: ((data as any[]) ?? []).map((r) => r.mount).filter(Boolean) };
  });

/** Inicia uma viagem até um local. Calcula duração e persiste sessão. */
export const travelTo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    toLocationId: z.string().uuid(),
    mountId: z.string().uuid().nullish(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    if (!char.current_location_id) throw new Error("Escolha um local inicial pelo mapa antes de viajar.");
    if (char.current_location_id === data.toLocationId) throw new Error("Você já está neste local.");

    const { data: existing } = await context.supabase
      .from("travel_sessions").select("id").eq("character_id", char.id).eq("status", "traveling").maybeSingle();
    if (existing) throw new Error("Você já está viajando.");

    // Bloqueia se estiver em combate ativo
    const { data: parts } = await context.supabase
      .from("combat_participants").select("session_id").eq("character_id", char.id);
    const sessIds = ((parts as any[]) ?? []).map((p) => p.session_id);
    if (sessIds.length > 0) {
      const { data: active } = await context.supabase
        .from("combat_sessions").select("id").in("id", sessIds).eq("status", "active");
      if ((active ?? []).length > 0) throw new Error("Não é possível viajar durante um combate.");
    }

    const { data: conns } = await context.supabase.from("location_connections").select("a_id,b_id");
    const dist = shortestPathDistance(((conns as any[]) ?? []), char.current_location_id, data.toLocationId);
    if (dist < 0) throw new Error("Não há caminho até esse local.");

    // Sublocal: viagem instantânea/rápida entre sublocais do mesmo pai.
    const { data: pair } = await context.supabase
      .from("locations").select("id,parent_id")
      .in("id", [char.current_location_id, data.toLocationId]);
    const fromLoc = (pair ?? []).find((l: any) => l.id === char.current_location_id) ?? null;
    const toLoc = (pair ?? []).find((l: any) => l.id === data.toLocationId) ?? null;
    const subMove = !!(fromLoc && toLoc && isSublocationMove(fromLoc as any, toLoc as any));
    const perNode = subMove ? SUB_SECONDS_PER_NODE : BASE_SECONDS_PER_NODE;

    let multiplier = 1;
    let mountId: string | null = null;
    if (data.mountId) {
      const { data: cm } = await context.supabase
        .from("character_mounts").select("mount:mounts(id,speed_multiplier)")
        .eq("character_id", char.id).eq("mount_id", data.mountId).maybeSingle();
      const m = (cm as any)?.mount;
      if (!m) throw new Error("Você não possui essa montaria.");
      mountId = m.id;
      multiplier = Math.max(0.1, Math.min(1, Number(m.speed_multiplier) || 0.5));
    }
    const totalSeconds = Math.max(3, Math.round((dist * perNode) * multiplier));
    const now = new Date();
    const arrives = new Date(now.getTime() + totalSeconds * 1000);

    const { data: created, error } = await context.supabase
      .from("travel_sessions").insert({
        character_id: char.id,
        from_location_id: char.current_location_id,
        to_location_id: data.toLocationId,
        mount_id: mountId,
        started_at: now.toISOString(),
        arrives_at: arrives.toISOString(),
        status: "traveling",
      }).select("id,started_at,arrives_at").single();
    if (error) throw new Error(error.message);
    return { travel: { ...created, to_location_id: data.toLocationId, mount_id: mountId, total_seconds: totalSeconds, distance: dist } };
  });

/** Conclui a viagem se o tempo já venceu — idempotente. */
export const completeTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ travelId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: t } = await context.supabase
      .from("travel_sessions").select("id,character_id,to_location_id,arrives_at,status")
      .eq("id", data.travelId).maybeSingle();
    if (!t || (t as any).character_id !== char.id) throw new Error("Viagem não encontrada.");
    if ((t as any).status !== "traveling") return { ok: true, alreadyDone: true };
    if (new Date((t as any).arrives_at).getTime() > Date.now()) {
      throw new Error("A viagem ainda não terminou.");
    }
    // Marca a sessão como concluída e move o personagem
    await context.supabase.from("travel_sessions").update({ status: "arrived" }).eq("id", data.travelId).eq("status", "traveling");
    await context.supabase.from("characters").update({
      current_location_id: (t as any).to_location_id,
      location_entered_at: new Date().toISOString(),
      last_spawn_roll_at: null,
    }).eq("id", char.id);
    return { ok: true };
  });

/** Cancela uma viagem em andamento — o personagem permanece na origem. */
export const cancelTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ travelId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { error } = await context.supabase
      .from("travel_sessions").update({ status: "cancelled" })
      .eq("id", data.travelId).eq("character_id", char.id).eq("status", "traveling");
    if (error) throw new Error(error.message);
    return { ok: true };
  });