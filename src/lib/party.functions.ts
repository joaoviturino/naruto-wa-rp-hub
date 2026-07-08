import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters").select("id,current_location_id,nickname").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data;
}

export const invitePartyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ to_character_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await myChar(context);
    if (me.id === data.to_character_id) throw new Error("Você não pode se convidar.");
    if (!me.current_location_id) throw new Error("Escolha um local primeiro.");

    const { data: target } = await context.supabase
      .from("characters").select("id,current_location_id,nickname").eq("id", data.to_character_id).maybeSingle();
    if (!target) throw new Error("Personagem alvo não encontrado.");
    if (target.current_location_id !== me.current_location_id) throw new Error("Você precisa estar no mesmo local do jogador.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Descobre / cria a party do convidante
    let partyId: string;
    const { data: existing } = await supabaseAdmin
      .from("party_members").select("party_id").eq("character_id", me.id).maybeSingle();
    if (existing) {
      partyId = existing.party_id;
      // Apenas o líder pode convidar
      const { data: party } = await supabaseAdmin.from("parties").select("leader_id").eq("id", partyId).maybeSingle();
      if (!party || party.leader_id !== me.id) throw new Error("Apenas o líder do time pode convidar novos membros.");
      // Cap de 3 slots (apenas membros preenchidos contam)
      const { count: memberCount } = await supabaseAdmin
        .from("party_members").select("*", { count: "exact", head: true }).eq("party_id", partyId);
      if ((memberCount ?? 0) >= 3) throw new Error("O time já está cheio (3 slots).");
    } else {
      const { data: p, error: pe } = await supabaseAdmin.from("parties").insert({ leader_id: me.id }).select("id").single();
      if (pe) throw new Error(pe.message);
      partyId = p.id;
      await supabaseAdmin.from("party_members").insert({ party_id: partyId, character_id: me.id });
    }

    // Alvo já em outra party?
    const { data: targetMembership } = await supabaseAdmin
      .from("party_members").select("party_id").eq("character_id", data.to_character_id).maybeSingle();
    if (targetMembership) throw new Error(`${target.nickname} já está em outro time.`);

    // Convite duplicado?
    const { data: dup } = await supabaseAdmin
      .from("party_invites").select("id").eq("party_id", partyId).eq("to_character_id", data.to_character_id).eq("status", "pending").maybeSingle();
    if (dup) throw new Error("Já existe um convite pendente para este jogador.");

    const { error } = await supabaseAdmin.from("party_invites").insert({
      party_id: partyId, from_character_id: me.id, to_character_id: data.to_character_id, status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondPartyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ invite_id: z.string().uuid(), accept: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await myChar(context);
    const { data: inv } = await context.supabase
      .from("party_invites").select("id,party_id,to_character_id,status").eq("id", data.invite_id).maybeSingle();
    if (!inv || inv.to_character_id !== me.id) throw new Error("Convite não encontrado.");
    if (inv.status !== "pending") throw new Error("Convite já respondido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("party_invites").update({ status: data.accept ? "accepted" : "rejected" }).eq("id", inv.id);
    if (data.accept) {
      // Verifica cap de 3 slots ainda válido
      const { count } = await supabaseAdmin
        .from("party_members").select("*", { count: "exact", head: true }).eq("party_id", inv.party_id);
      if ((count ?? 0) >= 3) throw new Error("O time já está cheio (3 slots).");
      // Se já está em outra party, remove antes
      await supabaseAdmin.from("party_members").delete().eq("character_id", me.id);
      const { error } = await supabaseAdmin.from("party_members").insert({ party_id: inv.party_id, character_id: me.id });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const leaveParty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await myChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mem } = await supabaseAdmin.from("party_members").select("party_id").eq("character_id", me.id).maybeSingle();
    if (!mem) return { ok: true };
    const { data: party } = await supabaseAdmin.from("parties").select("leader_id").eq("id", mem.party_id).maybeSingle();
    await supabaseAdmin.from("party_members").delete().eq("character_id", me.id);
    // Se o líder saiu, transfere para outro membro (ou apaga se ficar vazia)
    if (party?.leader_id === me.id) {
      const { data: next } = await supabaseAdmin
        .from("party_members").select("character_id").eq("party_id", mem.party_id).limit(1).maybeSingle();
      if (next) {
        await supabaseAdmin.from("parties").update({ leader_id: next.character_id }).eq("id", mem.party_id);
      }
    }
    const { count } = await supabaseAdmin.from("party_members").select("*", { count: "exact", head: true }).eq("party_id", mem.party_id);
    if (!count) await supabaseAdmin.from("parties").delete().eq("id", mem.party_id);
    return { ok: true };
  });