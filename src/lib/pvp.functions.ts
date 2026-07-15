import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
//  PvP — Duelo turno-a-turno visual (usa o motor do combate contra NPC).
//  Ao aceitar, criamos uma combat_sessions com mode='pvp' contendo os
//  dois times (desafiante + party × desafiado + party) e o chat local
//  vira o palco. Espectadores acompanham; os duelistas jogam.
// ============================================================

async function myChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters")
    .select("id,current_location_id,nickname,xp")
    .eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data;
}

// ------------------------ Desafiar ------------------------
export const challengeDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ opponent_character_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await myChar(context);
    if (me.id === data.opponent_character_id) throw new Error("Você não pode se desafiar.");
    if (!me.current_location_id) throw new Error("Escolha um local primeiro.");

    const { data: target } = await context.supabase.from("characters")
      .select("id,current_location_id").eq("id", data.opponent_character_id).maybeSingle();
    if (!target) throw new Error("Personagem alvo não encontrado.");
    if (target.current_location_id !== me.current_location_id) throw new Error("Vocês precisam estar no mesmo local.");

    // Bloqueia se já houver combate PvP ativo no local
    const { data: existingSess } = await context.supabase.from("combat_sessions")
      .select("id").eq("location_id", me.current_location_id).eq("mode", "pvp").eq("status", "active").maybeSingle();
    if (existingSess) throw new Error("Já existe um duelo em andamento neste local.");

    const { data: existingList } = await context.supabase.from("pvp_duels")
      .select("id,status,created_at,challenger_id,opponent_id")
      .in("status", ["pending", "active"])
      .or(`and(challenger_id.eq.${me.id},opponent_id.eq.${target.id}),and(challenger_id.eq.${target.id},opponent_id.eq.${me.id})`);
    const now = Date.now();
    for (const row of existingList ?? []) {
      if (row.status === "active") throw new Error("Vocês já estão em um duelo ativo.");
      if (now - new Date(row.created_at).getTime() > 120_000) {
        await context.supabase.from("pvp_duels").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", row.id);
        continue;
      }
      if (row.challenger_id === me.id) throw new Error("Você já tem um convite pendente para esse jogador.");
      throw new Error("Esse jogador já te desafiou. Responda ao convite pendente primeiro.");
    }

    const { data: inserted, error } = await context.supabase.from("pvp_duels").insert({
      challenger_id: me.id, opponent_id: target.id, location_id: me.current_location_id,
      status: "pending", turn_number: 0, state: {},
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { duel_id: inserted.id };
  });

// ------------------------ Cancelar convite ------------------------
export const cancelDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ duel_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await myChar(context);
    const { data: duel } = await context.supabase.from("pvp_duels").select("*").eq("id", data.duel_id).maybeSingle();
    if (!duel) throw new Error("Duelo não encontrado.");
    if (duel.status !== "pending") throw new Error("Só é possível cancelar antes de começar.");
    if (duel.challenger_id !== me.id) throw new Error("Apenas quem desafiou pode cancelar.");
    await context.supabase.from("pvp_duels").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", duel.id);
    return { ok: true };
  });

// ------------------------ Responder ------------------------
export const respondDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ duel_id: z.string().uuid(), accept: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await myChar(context);
    const { data: duel } = await context.supabase.from("pvp_duels").select("*").eq("id", data.duel_id).maybeSingle();
    if (!duel) throw new Error("Duelo não encontrado.");
    if (duel.opponent_id !== me.id) throw new Error("Apenas o desafiado pode responder.");
    if (duel.status !== "pending") throw new Error("Este duelo já foi respondido.");
    if (Date.now() - new Date(duel.created_at).getTime() > 120_000) {
      await context.supabase.from("pvp_duels").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", duel.id);
      throw new Error("Convite expirado.");
    }
    if (!data.accept) {
      await context.supabase.from("pvp_duels").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", duel.id);
      return { ok: true, accepted: false, combat_session_id: null as string | null };
    }

    const locId = duel.location_id as string | null;
    if (!locId) throw new Error("Local do duelo não definido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCharBuffs } = await import("./clan-tree.functions");

    // Bloqueia se já houver combate PvP ativo no local
    const { data: existingSess } = await supabaseAdmin.from("combat_sessions")
      .select("id").eq("location_id", locId).eq("mode", "pvp").eq("status", "active").maybeSingle();
    if (existingSess) throw new Error("Já existe um duelo em andamento neste local.");

    async function teamFor(charId: string): Promise<any[]> {
      const { data: base } = await supabaseAdmin.from("characters")
        .select("id,nickname,avatar_url,inventory_bg_url,xp,current_location_id,ef_current,em_current,chakra_current,hp_current").eq("id", charId).maybeSingle();
      if (!base) return [];
      const { data: pm } = await supabaseAdmin.from("party_members").select("party_id").eq("character_id", charId).maybeSingle();
      let partyId: string | null = pm ? (pm as any).party_id : null;
      if (!partyId) {
        const { data: led } = await supabaseAdmin.from("parties").select("id").eq("leader_id", charId).maybeSingle();
        if (led) partyId = (led as any).id;
      }
      if (!partyId) return [base];
      const { data: mems } = await supabaseAdmin.from("party_members")
        .select("character:characters(id,nickname,avatar_url,inventory_bg_url,xp,current_location_id,ef_current,em_current,chakra_current,hp_current)")
        .eq("party_id", partyId);
      const list = ((mems as any[]) ?? []).map((m: any) => m.character).filter(Boolean);
      if (!list.some((c: any) => c.id === charId)) list.unshift(base);
      return list.filter((c: any) => c.current_location_id === locId);
    }

    const teamA = await teamFor(duel.challenger_id);
    const teamB = await teamFor(duel.opponent_id);
    if (!teamA.some((c: any) => c.id === duel.challenger_id)) throw new Error("Desafiante saiu do local.");
    if (!teamB.some((c: any) => c.id === duel.opponent_id)) throw new Error("Você não está mais no local do duelo.");

    async function buildPlayer(c: any) {
      const xp = Number(c.xp ?? 0);
      const half = Math.floor(xp / 2);
      const buffs = await getCharBuffs(supabaseAdmin, c.id);
      const enBonus = Math.max(0, Number(buffs.energy_bonus ?? 0));
      const efMax = half + enBonus;
      const emMax = (xp - half) + enBonus;
      const chakraMax = xp + enBonus;
      const hpMax = Math.max(1, xp + Number(buffs.hp_bonus ?? 0));
      const hp = c.hp_current == null ? hpMax : Math.max(0, Math.min(hpMax, Number(c.hp_current)));
      return {
        character_id: c.id, nickname: c.nickname, avatar_url: c.avatar_url,
        inventory_bg_url: c.inventory_bg_url ?? null,
        image_url: c.inventory_bg_url ?? c.avatar_url ?? null,
        sprite_url: c.inventory_bg_url ?? null,
        hp, hp_max: hpMax,
        ef: c.ef_current == null ? efMax : Math.min(efMax, Number(c.ef_current)),
        em: c.em_current == null ? emMax : Math.min(emMax, Number(c.em_current)),
        chakra: c.chakra_current == null ? chakraMax : Math.min(chakraMax, Number(c.chakra_current)),
        ef_max: efMax, em_max: emMax, chakra_max: chakraMax,
        alive: hp > 0,
        cooldowns: {} as Record<string, number>,
      };
    }

    const sideA = await Promise.all(teamA.map(buildPlayer));
    const sideB = await Promise.all(teamB.map(buildPlayer));

    // Cenário/música vêm do LOCAL (não mais do NPC/grupo).
    const { data: locRow } = await supabaseAdmin
      .from("locations").select("battle_bg_url,music_url").eq("id", locId).maybeSingle();
    const location_bg_url = (locRow as any)?.battle_bg_url ?? null;
    const location_music_url = (locRow as any)?.music_url ?? null;

    const state = {
      mode: "pvp" as const,
      side_a: sideA, side_b: sideB,
      side_a_ids: sideA.map((p) => p.character_id),
      side_b_ids: sideB.map((p) => p.character_id),
      active_side: "a" as const,
      active_idx: 0,
      duel_id: duel.id as string,
      location_bg_url,
      location_music_url,
    };

    const { data: session, error: sErr } = await supabaseAdmin.from("combat_sessions").insert({
      location_id: locId, npc_id: null, mode: "pvp", status: "active", state, log: [], turn: "player",
    }).select("id").single();
    if (sErr) throw new Error(sErr.message);

    const parts = [...sideA, ...sideB].map((p) => ({ session_id: session.id, character_id: p.character_id }));
    await supabaseAdmin.from("combat_participants").insert(parts);

    await context.supabase.from("pvp_duels").update({
      status: "active", started_at: new Date().toISOString(),
      turn_number: 1, current_turn_character_id: duel.challenger_id,
      state, combat_session_id: session.id,
    }).eq("id", duel.id);

    return { ok: true, accepted: true, combat_session_id: session.id as string };
  });

// ------------------------ Deprecated (mantido só para compat de import) ------------------------
export const submitTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    throw new Error("Duelos agora acontecem no combate visual do chat local.");
  });