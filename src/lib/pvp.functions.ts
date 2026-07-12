import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
//  PvP — Duelo turno a turno com narrativa RP
// ============================================================

const POWER_BY_RANK: Record<string, number> = { E: 20, D: 35, C: 55, B: 80, A: 110, S: 150 };
const MAESTRIA_BONUS: Record<string, number> = { E: 0.05, D: 0.10, C: 0.20, B: 0.35, A: 0.50, S: 0.65 };
const CAP_PCT: Record<string, number> = { E: 0.35, D: 0.35, C: 0.35, B: 0.40, A: 0.40, S: 0.50 };

const PHYSICAL = new Set(["taijutsu","kenjutsu","shurikenjutsu","boujutsu","bukijutsu","nintaijutsu","estilo_de_luta","jujutsu"]);
const MENTAL = new Set(["genjutsu","doujutsu","juinjutsu","kaijutsu","tansakujutsu"]);

function inferCategory(skillClass: string | null): "fisico" | "mental" | "ninjutsu" {
  if (!skillClass) return "ninjutsu";
  if (PHYSICAL.has(skillClass)) return "fisico";
  if (MENTAL.has(skillClass)) return "mental";
  return "ninjutsu";
}

function energyKeyFor(cat: "fisico" | "mental" | "ninjutsu"): "ef" | "em" | "chakra" {
  return cat === "fisico" ? "ef" : cat === "mental" ? "em" : "chakra";
}

function baseHpFor(xp: number) { return Math.max(50, xp); }
function baseEnergyFor(xp: number) { return Math.max(100, Math.round(xp * 0.8)); }

type Side = {
  hp: number; hp_max: number;
  ef: number; em: number; chakra: number;
  ef_max: number; em_max: number; chakra_max: number;
  shield_pct: number;
  cooldowns: Record<string, number>;
};

function initSide(c: { xp: number; hp_current: number | null; ef_current: number | null; em_current: number | null; chakra_current: number | null }): Side {
  const hp_max = baseHpFor(c.xp);
  const e_max = baseEnergyFor(c.xp);
  return {
    hp: c.hp_current ?? hp_max, hp_max,
    ef: c.ef_current ?? e_max, em: c.em_current ?? e_max, chakra: c.chakra_current ?? e_max,
    ef_max: e_max, em_max: e_max, chakra_max: e_max,
    shield_pct: 0, cooldowns: {},
  };
}

async function myChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("characters").select("id,current_location_id,nickname,xp,hp_current,ef_current,em_current,chakra_current,proficiencies").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data;
}

function decCooldowns(side: Side) {
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(side.cooldowns)) if (v > 1) next[k] = v - 1;
  side.cooldowns = next;
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
      .select("id,current_location_id,nickname,xp,hp_current,ef_current,em_current,chakra_current").eq("id", data.opponent_character_id).maybeSingle();
    if (!target) throw new Error("Personagem alvo não encontrado.");
    if (target.current_location_id !== me.current_location_id) throw new Error("Vocês precisam estar no mesmo local.");

    // Bloqueia se já há duelo ativo/pendente entre eles
    const { data: existing } = await context.supabase.from("pvp_duels")
      .select("id,status")
      .in("status", ["pending", "active"])
      .or(`and(challenger_id.eq.${me.id},opponent_id.eq.${target.id}),and(challenger_id.eq.${target.id},opponent_id.eq.${me.id})`)
      .maybeSingle();
    if (existing) throw new Error("Já existe um duelo ativo ou pendente entre vocês.");

    const { data: inserted, error } = await context.supabase.from("pvp_duels").insert({
      challenger_id: me.id, opponent_id: target.id, location_id: me.current_location_id,
      status: "pending", turn_number: 0, state: {},
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { duel_id: inserted.id };
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

    if (!data.accept) {
      await context.supabase.from("pvp_duels").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", duel.id);
      return { ok: true, accepted: false };
    }

    // Carrega os dois personagens para iniciar o estado
    const { data: chars } = await context.supabase.from("characters")
      .select("id,xp,hp_current,ef_current,em_current,chakra_current").in("id", [duel.challenger_id, duel.opponent_id]);
    if (!chars || chars.length !== 2) throw new Error("Personagens não encontrados.");
    const ch = chars.find((c: any) => c.id === duel.challenger_id);
    const op = chars.find((c: any) => c.id === duel.opponent_id);
    if (!ch || !op) throw new Error("Personagens não encontrados.");

    const state = { challenger: initSide(ch), opponent: initSide(op) };
    const { error } = await context.supabase.from("pvp_duels").update({
      status: "active", started_at: new Date().toISOString(),
      current_turn_character_id: duel.challenger_id, turn_number: 1, state,
    }).eq("id", duel.id);
    if (error) throw new Error(error.message);
    return { ok: true, accepted: true };
  });

// ------------------------ Submeter turno ------------------------
const TurnSchema = z.object({
  duel_id: z.string().uuid(),
  action: z.enum(["attack", "defend", "pass", "forfeit"]),
  skill_id: z.string().uuid().optional().nullable(),
  energy_pct: z.number().int().min(1).max(100).optional().nullable(),
  narrative: z.string().min(20, "A narrativa precisa ter pelo menos 20 caracteres.").max(2000),
});

export const submitTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TurnSchema.parse(i))
  .handler(async ({ data, context }) => {
    const me = await myChar(context);
    const { data: duel } = await context.supabase.from("pvp_duels").select("*").eq("id", data.duel_id).maybeSingle();
    if (!duel) throw new Error("Duelo não encontrado.");
    if (duel.status !== "active") throw new Error("Duelo não está ativo.");
    if (duel.current_turn_character_id !== me.id) throw new Error("Não é o seu turno.");

    const isChallenger = duel.challenger_id === me.id;
    const state = duel.state as { challenger: Side; opponent: Side };
    const actor = isChallenger ? state.challenger : state.opponent;
    const target = isChallenger ? state.opponent : state.challenger;
    const targetId = isChallenger ? duel.opponent_id : duel.challenger_id;

    let damage = 0;
    let crit = false;
    let category: "fisico" | "mental" | "ninjutsu" | null = null;
    let usedSkillId: string | null = null;
    const effects: any = {};

    if (data.action === "forfeit") {
      const winnerId = targetId;
      await context.supabase.from("pvp_duels").update({ status: "finished", winner_id: winnerId, forfeit_by: me.id, ended_at: new Date().toISOString(), state }).eq("id", duel.id);
      await context.supabase.from("pvp_turns").insert({
        duel_id: duel.id, turn_number: duel.turn_number, actor_character_id: me.id, target_character_id: targetId,
        action: "forfeit", narrative: data.narrative, damage: 0, effects,
      });
      return { ok: true, finished: true, winner_id: winnerId };
    }

    if (data.action === "attack") {
      if (!data.skill_id) throw new Error("Escolha uma habilidade.");
      // Verifica posse
      const { data: owned } = await context.supabase.from("character_skills").select("skill_id").eq("character_id", me.id).eq("skill_id", data.skill_id).maybeSingle();
      if (!owned) throw new Error("Você não conhece essa habilidade.");
      const { data: skill } = await context.supabase.from("skills").select("*").eq("id", data.skill_id).maybeSingle();
      if (!skill) throw new Error("Habilidade não encontrada.");

      // Cooldown
      if ((actor.cooldowns[skill.id] ?? 0) > 0) throw new Error(`Habilidade em recarga (${actor.cooldowns[skill.id]} turnos).`);

      category = inferCategory(skill.skill_class);
      const eKey = energyKeyFor(category);
      const eMax = actor[`${eKey}_max` as const] as number;
      const eCur = actor[eKey] as number;
      const teto = Math.max(1, Math.min(100, skill.cost_percent ?? 20));
      const pct = Math.max(1, Math.min(teto, data.energy_pct ?? teto));
      const invest = Math.round(eMax * (pct / 100));
      if (eCur < invest) throw new Error(`Energia insuficiente (${eCur}/${invest}).`);

      // Proficiência de maestria do atacante para a classe da habilidade
      const profs = (me.proficiencies ?? {}) as Record<string, { nivel?: string; maestria?: string }>;
      const mLetter = skill.skill_class ? profs[skill.skill_class]?.maestria : undefined;
      const mBonus = mLetter ? (MAESTRIA_BONUS[mLetter] ?? 0) : 0;

      const power = (POWER_BY_RANK[skill.rank] ?? 20) * (pct / 100);
      const critChance = 0.05 + (skill.bonus_critical ?? 0) / 100;
      crit = Math.random() < critChance;
      const critMult = crit ? 1.75 : 1;
      const shield = target.shield_pct ?? 0;

      let raw = power * (1 + mBonus) * critMult * (1 - shield);
      const cap = target.hp_max * (CAP_PCT[skill.rank] ?? 0.35);
      damage = Math.max(1, Math.min(Math.round(raw), Math.round(cap)));

      // Aplica
      (actor as any)[eKey] = eCur - invest;
      target.hp = Math.max(0, target.hp - damage);
      target.shield_pct = 0; // shield é consumido no golpe
      actor.cooldowns[skill.id] = Math.max(1, skill.cooldown_turns ?? 1);
      usedSkillId = skill.id;
      effects.energy_invested = invest;
      effects.energy_key = eKey;
      effects.maestria_bonus = mBonus;
      effects.skill_name = skill.name;
      effects.animation_url = skill.animation_url;
      effects.sound_url = skill.sound_url;
    } else if (data.action === "defend") {
      // Recupera energias e ergue guarda
      actor.ef = Math.min(actor.ef_max, actor.ef + Math.round(actor.ef_max * 0.15));
      actor.em = Math.min(actor.em_max, actor.em + Math.round(actor.em_max * 0.15));
      actor.chakra = Math.min(actor.chakra_max, actor.chakra + Math.round(actor.chakra_max * 0.15));
      actor.shield_pct = 0.30;
      effects.recovered = 0.15;
      effects.shield_pct = actor.shield_pct;
    } else if (data.action === "pass") {
      effects.passed = true;
    }

    // Decrementa cooldowns do atacante ao final do turno
    decCooldowns(actor);

    // Persiste turno
    await context.supabase.from("pvp_turns").insert({
      duel_id: duel.id, turn_number: duel.turn_number, actor_character_id: me.id, target_character_id: targetId,
      action: data.action, skill_id: usedSkillId, category, energy_invested_pct: data.action === "attack" ? (data.energy_pct ?? null) : null,
      narrative: data.narrative, damage, crit, effects,
    });

    // Verifica fim
    if (target.hp <= 0) {
      await context.supabase.from("pvp_duels").update({
        status: "finished", winner_id: me.id, ended_at: new Date().toISOString(),
        state: isChallenger ? { challenger: actor, opponent: target } : { challenger: target, opponent: actor },
      }).eq("id", duel.id);
      return { ok: true, finished: true, winner_id: me.id, damage, crit };
    }

    // Passa o turno
    const nextState = isChallenger ? { challenger: actor, opponent: target } : { challenger: target, opponent: actor };
    await context.supabase.from("pvp_duels").update({
      turn_number: duel.turn_number + 1,
      current_turn_character_id: targetId,
      state: nextState,
    }).eq("id", duel.id);

    return { ok: true, finished: false, damage, crit };
  });

// ------------------------ Cancelar convite (pelo challenger) ------------------------
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