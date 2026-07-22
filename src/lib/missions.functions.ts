import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { levelFromXp, DEFAULT_LEVEL_CONFIG } from "@/lib/level";
function computeLevel(xp: number, cfg?: { base_xp: number; growth_factor: number; max_level: number }) {
  return levelFromXp(xp ?? 0, cfg ?? DEFAULT_LEVEL_CONFIG);
}

// ------- Types shared with UI -------
export type ObjectiveType =
  | "kill_npc" | "kill_npc_kind" | "kill_npc_group"
  | "complete_minigame" | "read_book"
  | "reach_location" | "learn_skill"
  | "craft_item" | "collect_item"
  | "reach_rank" | "reach_level" | "reach_proficiency"
  | "pvp_win" | "talk_npc" | "custom";

export const OBJECTIVE_TYPES: { value: ObjectiveType; label: string; needs: "npc"|"npc_group"|"npc_kind"|"minigame"|"book"|"location"|"skill"|"item"|"rank"|"level"|"proficiency"|"none" }[] = [
  { value: "kill_npc",           label: "Derrotar NPC específico",          needs: "npc" },
  { value: "kill_npc_kind",      label: "Derrotar NPC por tipo",             needs: "npc_kind" },
  { value: "kill_npc_group",     label: "Derrotar grupo de NPCs",            needs: "npc_group" },
  { value: "complete_minigame",  label: "Completar minigame",                needs: "minigame" },
  { value: "read_book",          label: "Ler livro",                          needs: "book" },
  { value: "reach_location",     label: "Chegar a um local",                 needs: "location" },
  { value: "learn_skill",        label: "Aprender habilidade",               needs: "skill" },
  { value: "craft_item",         label: "Fabricar item",                     needs: "item" },
  { value: "collect_item",       label: "Coletar item",                      needs: "item" },
  { value: "reach_rank",         label: "Atingir patente",                   needs: "rank" },
  { value: "reach_level",        label: "Atingir nível",                     needs: "level" },
  { value: "reach_proficiency",  label: "Atingir proficiência",              needs: "proficiency" },
  { value: "pvp_win",            label: "Vencer duelo PvP",                  needs: "none" },
  { value: "talk_npc",           label: "Falar com NPC",                     needs: "npc" },
  { value: "custom",             label: "Personalizado (marcação manual)",   needs: "none" },
];

const objective = z.object({
  id: z.string().min(1),
  type: z.enum([
    "kill_npc","kill_npc_kind","kill_npc_group",
    "complete_minigame","read_book",
    "reach_location","learn_skill",
    "craft_item","collect_item",
    "reach_rank","reach_level","reach_proficiency",
    "pvp_win","talk_npc","custom",
  ]),
  target_id: z.string().nullable().optional(),
  target_ref: z.string().nullable().optional(),
  count: z.number().int().min(1).max(9999).default(1),
  description: z.string().max(400).nullable().optional(),
});

const rewardsSchema = z.object({
  xp: z.number().int().min(0).default(0),
  ryo: z.number().int().min(0).default(0),
  items: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(999) })).default([]),
  skill_ids: z.array(z.string().uuid()).default([]),
  proficiency_grants: z.array(z.object({
    skill_class: z.string(),
    nivel: z.enum(["E","D","C","B","A","S"]).nullable().optional(),
    maestria: z.enum(["E","D","C","B","A","S"]).nullable().optional(),
  })).default([]),
}).partial();

const requirementsSchema = z.object({
  min_rank: z.string().nullable().optional(),
  min_level: z.number().int().min(0).nullable().optional(),
  previous_mission_id: z.string().uuid().nullable().optional(),
}).partial();

export const missionInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  rank: z.enum(["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"]).default("genin"),
  description: z.string().max(4000).nullable().optional(),
  category: z.enum(["daily","common","special"]).default("daily"),
  reward_xp: z.number().int().min(0).default(0),
  reward_ryo: z.number().int().min(0).default(0),
  objectives: z.array(objective).default([]),
  rewards: rewardsSchema.default({}),
  requirements: requirementsSchema.default({}),
  cooldown_hours: z.number().int().min(0).max(24 * 365).default(24),
  repeatable: z.boolean().default(true),
  active: z.boolean().default(true),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function assertAdminOrMod(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_admin_or_mod", { _user_id: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const RANK_ORDER = ["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"];
function rankIdx(r?: string | null) { return r ? RANK_ORDER.indexOf(r) : -1; }
const SKILL_RANKS = ["E","D","C","B","A","S"];
function skillRankIdx(r?: string | null) { return r ? SKILL_RANKS.indexOf(r) : -1; }

/** Recompute derived progress values (rank/level/prof/collect) from live character state. */
export function computeDerivedProgress(mission: any, char: any, inventory: any[], level: number, persisted: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...persisted };
  const baseline: Record<string, number> = ((persisted as any)?.__baseline ?? {}) as any;
  const objs: any[] = Array.isArray(mission.objectives) ? mission.objectives : [];
  for (const o of objs) {
    if (o.type === "reach_rank") {
      const target = rankIdx(o.target_ref);
      const now = rankIdx(char?.rank);
      const b = Number(baseline[o.id] ?? -1);
      out[o.id] = (now >= target && b < target) ? o.count : 0;
    } else if (o.type === "reach_level") {
      const target = Number(o.target_ref ?? 0);
      const b = Number(baseline[o.id] ?? -1);
      out[o.id] = (level >= target && b < target) ? o.count : 0;
    } else if (o.type === "reach_proficiency") {
      const [cls, rank] = String(o.target_ref ?? "").split("|");
      const p = ((char?.proficiencies ?? {}) as any)[cls] ?? {};
      const best = Math.max(skillRankIdx(p.nivel), skillRankIdx(p.maestria));
      const target = skillRankIdx(rank);
      const b = Number(baseline[o.id] ?? -1);
      out[o.id] = (best >= target && b < target) ? o.count : 0;
    } else if (o.type === "collect_item") {
      const target = o.target_id;
      const totalInBag = inventory.filter((e) => e?.item_id === target).reduce((n, e) => n + Number(e.qty ?? 1), 0);
      const b = Number(baseline[o.id] ?? 0);
      const gained = Math.max(0, totalInBag - b);
      out[o.id] = Math.min(gained, o.count);
    }
  }
  return out;
}

/** Snapshot do estado do personagem no momento do aceite — usado como linha de base
 *  para objetivos "state-based" (collect_item, reach_rank/level/prof) para impedir
 *  que a missão conte progresso já existente antes do aceite. */
export function snapshotMissionBaseline(mission: any, char: any, inventory: any[], level: number): Record<string, number> {
  const base: Record<string, number> = {};
  const objs: any[] = Array.isArray(mission.objectives) ? mission.objectives : [];
  for (const o of objs) {
    if (o.type === "collect_item") {
      const target = o.target_id;
      base[o.id] = inventory.filter((e: any) => e?.item_id === target).reduce((n: number, e: any) => n + Number(e.qty ?? 1), 0);
    } else if (o.type === "reach_rank") {
      base[o.id] = rankIdx(char?.rank);
    } else if (o.type === "reach_level") {
      base[o.id] = Number(level ?? 0);
    } else if (o.type === "reach_proficiency") {
      const [cls] = String(o.target_ref ?? "").split("|");
      const p = ((char?.proficiencies ?? {}) as any)[cls] ?? {};
      base[o.id] = Math.max(skillRankIdx(p.nivel), skillRankIdx(p.maestria));
    }
  }
  return base;
}

export function isComplete(mission: any, progress: Record<string, number>) {
  const objs: any[] = Array.isArray(mission.objectives) ? mission.objectives : [];
  if (!objs.length) return false;
  return objs.every((o) => Number(progress[o.id] ?? 0) >= Number(o.count ?? 1));
}

export function isAccepted(progress: any): boolean {
  return !!(progress && progress.__accepted === true);
}

async function meetsRequirements(supa: any, char: any, level: number, req: any): Promise<{ ok: boolean; reason?: string }> {
  const r = req ?? {};
  if (r.min_rank && rankIdx(char?.rank) < rankIdx(r.min_rank)) return { ok: false, reason: `Requer patente ${r.min_rank}` };
  if (r.min_level && level < Number(r.min_level)) return { ok: false, reason: `Requer nível ${r.min_level}` };
  if (r.previous_mission_id) {
    const { data } = await supa.from("character_missions").select("status").eq("character_id", char.id).eq("mission_id", r.previous_mission_id).maybeSingle();
    if (!data || data.status !== "claimed") return { ok: false, reason: "Missão anterior não concluída" };
  }
  return { ok: true };
}

/* -------- LIST -------- */
export const listMyMissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,xp,rank,proficiencies").eq("user_id", context.userId).maybeSingle();
    if (!char) return { missions: [] };
    const { data: lvlCfg } = await context.supabase.from("level_config").select("*").limit(1).maybeSingle();
    const level = computeLevel(char.xp ?? 0, lvlCfg ? { base_xp: lvlCfg.base_xp, growth_factor: lvlCfg.growth_factor, max_level: lvlCfg.max_level } : undefined);
    const [{ data: missions }, { data: cms }, { data: inv }] = await Promise.all([
      context.supabase.from("missions").select("*").eq("active", true).order("category").order("rank"),
      context.supabase.from("character_missions").select("*").eq("character_id", char.id),
      context.supabase.from("inventory").select("ninja_bag").eq("character_id", char.id).maybeSingle(),
    ]);
    const bag = (Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag : []) as any[];
    const byId = new Map(((cms as any[]) ?? []).map((r) => [r.mission_id, r]));
    // Missões oferecidas por NPC só aparecem depois que o jogador aceita.
    const { data: giverRows } = await context.supabase.from("npcs").select("offer_mission_id").not("offer_mission_id", "is", null);
    const npcOffered = new Set(((giverRows as any[]) ?? []).map((r) => r.offer_mission_id));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out = [];
    for (const m of (missions ?? []) as any[]) {
      if (npcOffered.has(m.id) && !byId.has(m.id)) continue;
      const req = await meetsRequirements(context.supabase, char, level, m.requirements);
      let cm = byId.get(m.id);
      // Garante existência de cmRow + baseline para missões não-npc (auto-início ao aparecer),
      // e completa baseline em rows antigas que não o tinham.
      if (req.ok) {
        const hasBaseline = !!((cm?.progress ?? {}) as any)?.__baseline;
        if (!cm && !npcOffered.has(m.id)) {
          const baseline = snapshotMissionBaseline(m, char, bag, level);
          const progress = { __baseline: baseline } as any;
          await supabaseAdmin.from("character_missions").insert({
            character_id: char.id, mission_id: m.id, status: "active", progress,
          });
          cm = { character_id: char.id, mission_id: m.id, status: "active", progress, started_at: new Date().toISOString() } as any;
        } else if (cm && !hasBaseline) {
          const baseline = snapshotMissionBaseline(m, char, bag, level);
          const progress = { ...((cm.progress ?? {}) as any), __baseline: baseline } as any;
          await supabaseAdmin.from("character_missions").update({ progress }).eq("character_id", char.id).eq("mission_id", m.id);
          cm = { ...cm, progress };
        }
      }
      const persisted = (cm?.progress ?? {}) as Record<string, number>;
      const progress = computeDerivedProgress(m, char, bag, level, persisted);
      const complete = isComplete(m, progress);
      const accepted = isAccepted(persisted);
      let effectiveStatus: "locked" | "active" | "completed" | "claimed" | "cooldown" = "active";
      if (!req.ok) effectiveStatus = "locked";
      else if (cm?.status === "claimed") {
        if (!m.repeatable) effectiveStatus = "claimed";
        else {
          const nextAt = new Date(cm.claimed_at ?? cm.completed_at ?? cm.started_at).getTime() + Number(m.cooldown_hours ?? 24) * 3600_000;
          effectiveStatus = Date.now() < nextAt ? "cooldown" : "active";
        }
      } else if (complete && accepted) effectiveStatus = "completed";
      else if (cm?.status === "completed" && accepted) effectiveStatus = "completed";
      out.push({
        ...m, progress, status: effectiveStatus, accepted,
        cooldown_until: cm?.claimed_at ? new Date(new Date(cm.claimed_at).getTime() + Number(m.cooldown_hours ?? 24) * 3600_000).toISOString() : null,
        requirement_reason: req.ok ? null : req.reason,
      });
    }
    return { missions: out, character_id: char.id };
  });

/* -------- CLAIM -------- */
/** Aceite explícito (para missões não-NPC listadas em DailyMissionsPanel). */
export const acceptMissionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ mission_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: char } = await context.supabase
      .from("characters").select("id,xp,rank,proficiencies").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: m } = await supabaseAdmin.from("missions").select("*").eq("id", data.mission_id).maybeSingle();
    if (!m || !m.active) throw new Error("Missão indisponível.");
    const { data: lvlCfg } = await context.supabase.from("level_config").select("*").limit(1).maybeSingle();
    const level = computeLevel(char.xp ?? 0, lvlCfg ? { base_xp: lvlCfg.base_xp, growth_factor: lvlCfg.growth_factor, max_level: lvlCfg.max_level } : undefined);
    const { data: inv } = await context.supabase.from("inventory").select("ninja_bag").eq("character_id", char.id).maybeSingle();
    const bag = (Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag : []) as any[];
    const { data: existing } = await supabaseAdmin.from("character_missions").select("*").eq("character_id", char.id).eq("mission_id", m.id).maybeSingle();
    const prevProgress = (existing?.progress ?? {}) as any;
    const alreadyAccepted = isAccepted(prevProgress);
    const isRestart = existing?.status === "claimed"; // repeatable reaceite após claim

    // Idempotência: só (re)captura baseline quando é o primeiro aceite ou um restart de missão repetível.
    // Se já foi aceita e ainda está ativa, mantém baseline/timestamp originais — nada de "renascer completa".
    if (existing && alreadyAccepted && !isRestart) {
      return { ok: true, already: true };
    }

    const baseline = snapshotMissionBaseline(m, char, bag, level);
    const nowIso = new Date().toISOString();
    const nextProgress: any = isRestart
      ? { __baseline: baseline, __accepted: true, __accepted_at: nowIso } // restart limpa contadores
      : { ...prevProgress, __baseline: baseline, __accepted: true, __accepted_at: nowIso };

    if (existing) {
      await supabaseAdmin.from("character_missions")
        .update({
          progress: nextProgress,
          status: isRestart ? "active" : existing.status,
          claimed_at: isRestart ? null : existing.claimed_at,
          started_at: isRestart ? nowIso : (existing as any).started_at ?? nowIso,
        })
        .eq("character_id", char.id).eq("mission_id", m.id);
      return { ok: true, restarted: isRestart };
    }
    await supabaseAdmin.from("character_missions").insert({
      character_id: char.id, mission_id: m.id, status: "active", progress: nextProgress,
    });
    return { ok: true };
  });

export const claimMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ mission_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: char } = await context.supabase
      .from("characters").select("id,xp,ryo,rank,proficiencies").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: m } = await supabaseAdmin.from("missions").select("*").eq("id", data.mission_id).maybeSingle();
    if (!m || !m.active) throw new Error("Missão indisponível.");
    const { data: cmRow } = await supabaseAdmin.from("character_missions").select("*").eq("character_id", char.id).eq("mission_id", m.id).maybeSingle();
    if (!cmRow) throw new Error("Você precisa aceitar/iniciar essa missão antes.");
    if (!isAccepted(cmRow.progress)) throw new Error("Aceite a missão antes de reivindicar a recompensa.");
    if (cmRow.status !== "active" && cmRow.status !== "completed") {
      // 'claimed' cai no cooldown abaixo; qualquer outro estado é inválido.
      if (cmRow.status !== "claimed") throw new Error("Missão não está ativa.");
    }
    const { data: lvlCfg } = await context.supabase.from("level_config").select("*").limit(1).maybeSingle();
    const level = computeLevel(char.xp ?? 0, lvlCfg ? { base_xp: lvlCfg.base_xp, growth_factor: lvlCfg.growth_factor, max_level: lvlCfg.max_level } : undefined);
    const { data: inv } = await context.supabase.from("inventory").select("ninja_bag").eq("character_id", char.id).maybeSingle();
    const bag = (Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag : []) as any[];
    const persisted = (cmRow?.progress ?? {}) as Record<string, number>;
    const progress = computeDerivedProgress(m, char, bag, level, persisted);
    if (!isComplete(m, progress)) throw new Error("Objetivos incompletos.");
    // Cooldown
    const expectedStatus = cmRow.status; // "active" | "completed" | "claimed"
    if (cmRow?.status === "claimed") {
      if (!m.repeatable) throw new Error("Missão já concluída.");
      const nextAt = new Date(cmRow.claimed_at ?? cmRow.started_at).getTime() + Number(m.cooldown_hours ?? 24) * 3600_000;
      if (Date.now() < nextAt) throw new Error("Ainda em cooldown.");
    }
    // 🔒 Anti-race: tenta "travar" a linha antes de conceder recompensas.
    // A UPDATE condicional exige status inalterado desde a leitura E __accepted=true no JSONB.
    // Se outra requisição concorrente já mudou o status (ex.: duplo-clique / requests paralelos),
    // esta atualização não retorna linha e abortamos sem creditar nada.
    const nowIso = new Date().toISOString();
    const { data: locked, error: lockErr } = await supabaseAdmin
      .from("character_missions")
      .update({ status: "claimed", completed_at: nowIso, claimed_at: nowIso, progress })
      .eq("character_id", char.id)
      .eq("mission_id", m.id)
      .eq("status", expectedStatus)
      .filter("progress->>__accepted", "eq", "true")
      .select("mission_id")
      .maybeSingle();
    if (lockErr) throw new Error(lockErr.message);
    if (!locked) throw new Error("Recompensa já reivindicada ou missão em conflito. Recarregue e tente novamente.");

    // Apply rewards (a partir daqui, temos posse exclusiva do claim)
    const r = (m.rewards ?? {}) as any;
    const patch: any = {};
    const totalXp = Number(m.reward_xp ?? 0) + Number(r.xp ?? 0);
    const totalRyo = Number(m.reward_ryo ?? 0) + Number(r.ryo ?? 0);
    if (totalXp) patch.xp = Number(char.xp ?? 0) + totalXp;
    if (totalRyo) patch.ryo = Number(char.ryo ?? 0) + totalRyo;
    if (Array.isArray(r.proficiency_grants) && r.proficiency_grants.length) {
      const profs = { ...((char.proficiencies as any) ?? {}) } as Record<string, any>;
      for (const g of r.proficiency_grants) {
        const cur = profs[g.skill_class] ?? {};
        const nivel = skillRankIdx(g.nivel) > skillRankIdx(cur.nivel) ? g.nivel : cur.nivel;
        const maestria = skillRankIdx(g.maestria) > skillRankIdx(cur.maestria) ? g.maestria : cur.maestria;
        profs[g.skill_class] = { nivel: nivel ?? null, maestria: maestria ?? null };
      }
      patch.proficiencies = profs;
    }
    if (Object.keys(patch).length) await supabaseAdmin.from("characters").update(patch).eq("id", char.id);
    if (Array.isArray(r.skill_ids) && r.skill_ids.length) {
      const rows = r.skill_ids.map((sid: string) => ({ character_id: char.id, skill_id: sid }));
      await supabaseAdmin.from("character_skills").upsert(rows, { onConflict: "character_id,skill_id" });
    }
    if (Array.isArray(r.items) && r.items.length) {
      const nb = bag.map((e: any) => ({ item_id: e.item_id, qty: Number(e.qty ?? 1) }));
      for (const it of r.items) {
        const idx = nb.findIndex((b: any) => b.item_id === it.item_id);
        if (idx >= 0) nb[idx].qty += Number(it.qty ?? 1); else nb.push({ item_id: it.item_id, qty: Number(it.qty ?? 1) });
      }
      await supabaseAdmin.from("inventory").update({ ninja_bag: nb }).eq("character_id", char.id);
    }
    // status/claimed_at já persistidos pelo lock atômico acima.
    return { ok: true, applied: { xp: totalXp, ryo: totalRyo, items: r.items ?? [], skill_ids: r.skill_ids ?? [], proficiency_grants: r.proficiency_grants ?? [] } };
  });

/* -------- ADMIN: manual mark objective (for 'custom') -------- */
export const adminMarkObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    character_id: z.string().uuid(),
    mission_id: z.string().uuid(),
    objective_id: z.string().min(1),
    value: z.number().int().min(0).max(9999),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("character_missions").select("*").eq("character_id", data.character_id).eq("mission_id", data.mission_id).maybeSingle();
    const progress = { ...(existing?.progress ?? {}) as any, [data.objective_id]: data.value };
    if (existing) await supabaseAdmin.from("character_missions").update({ progress }).eq("character_id", data.character_id).eq("mission_id", data.mission_id);
    else await supabaseAdmin.from("character_missions").insert({ character_id: data.character_id, mission_id: data.mission_id, progress, status: "active" });
    return { ok: true };
  });

/* -------- INTERNAL: increment progress based on an event.
   Exported as a server-only helper (no `createServerFn`), called from other .functions modules. -------- */
export type MissionEvent =
  | { type: "kill_npc"; npc_id: string; npc_kind?: string | null; group_id?: string | null }
  | { type: "complete_minigame"; minigame_id: string; kind?: string | null }
  | { type: "read_book"; book_id: string }
  | { type: "reach_location"; location_id: string }
  | { type: "learn_skill"; skill_id: string }
  | { type: "craft_item"; item_id: string }
  | { type: "pvp_win" }
  | { type: "talk_npc"; npc_id: string };

export async function bumpMissionProgress(supabaseAdmin: any, characterId: string, event: MissionEvent) {
  const { data: missions } = await supabaseAdmin.from("missions").select("id,objectives,active").eq("active", true);
  if (!missions?.length) return;
  const missionIds = missions.map((m: any) => m.id);
  const { data: rows } = await supabaseAdmin.from("character_missions").select("*").eq("character_id", characterId).in("mission_id", missionIds);
  const byMission = new Map<string, any>(((rows as any[]) ?? []).map((r) => [r.mission_id, r]));
  // NPCs oferecem quais missões — usadas para não auto-criar linhas antes do aceite.
  const { data: giverRows } = await supabaseAdmin.from("npcs").select("offer_mission_id").not("offer_mission_id", "is", null);
  const npcOffered = new Set(((giverRows as any[]) ?? []).map((r: any) => r.offer_mission_id));
  for (const m of missions as any[]) {
    const objs: any[] = Array.isArray(m.objectives) ? m.objectives : [];
    let touched = false;
    const cm = byMission.get(m.id);
    // Skip if claimed and not in cooldown-reset window (we let claim handle repeats)
    if (cm?.status === "claimed") continue;
    // Missões oferecidas por NPC não avançam sem aceite.
    if (!cm && npcOffered.has(m.id)) continue;
    const progress: Record<string, number> = { ...((cm?.progress ?? {}) as any) };
    for (const o of objs) {
      const cap = Number(o.count ?? 1);
      const cur = Number(progress[o.id] ?? 0);
      if (cur >= cap) continue;
      let match = false;
      switch (event.type) {
        case "kill_npc":
          if (o.type === "kill_npc" && o.target_id === event.npc_id) match = true;
          if (o.type === "kill_npc_kind" && o.target_ref === event.npc_kind) match = true;
          if (o.type === "kill_npc_group" && event.group_id && o.target_id === event.group_id) match = true;
          break;
        case "complete_minigame":
          if (o.type === "complete_minigame" && (o.target_id === event.minigame_id || o.target_ref === event.kind)) match = true;
          break;
        case "read_book":
          if (o.type === "read_book" && o.target_id === event.book_id) match = true;
          break;
        case "reach_location":
          if (o.type === "reach_location" && o.target_id === event.location_id) match = true;
          break;
        case "learn_skill":
          if (o.type === "learn_skill" && o.target_id === event.skill_id) match = true;
          break;
        case "craft_item":
          if (o.type === "craft_item" && o.target_id === event.item_id) match = true;
          break;
        case "pvp_win":
          if (o.type === "pvp_win") match = true;
          break;
        case "talk_npc":
          if (o.type === "talk_npc" && o.target_id === event.npc_id) match = true;
          break;
      }
      if (match) {
        progress[o.id] = Math.min(cap, cur + 1);
        touched = true;
      }
    }
    if (touched) {
      if (cm) {
        await supabaseAdmin.from("character_missions").update({ progress }).eq("character_id", characterId).eq("mission_id", m.id);
      } else {
        // Ao criar a linha por causa de um evento, também grava um baseline zerado
        // para os objetivos state-based (o personagem já pode ter itens/rank suficiente).
        const { data: charRow } = await supabaseAdmin.from("characters").select("id,xp,rank,proficiencies").eq("id", characterId).maybeSingle();
        const { data: invRow } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", characterId).maybeSingle();
        const { data: lvlCfg } = await supabaseAdmin.from("level_config").select("*").limit(1).maybeSingle();
        const level = computeLevel(charRow?.xp ?? 0, lvlCfg ? { base_xp: lvlCfg.base_xp, growth_factor: lvlCfg.growth_factor, max_level: lvlCfg.max_level } : undefined);
        const bag = (Array.isArray(invRow?.ninja_bag) ? invRow!.ninja_bag : []) as any[];
        (progress as any).__baseline = snapshotMissionBaseline(m, charRow, bag, level);
        await supabaseAdmin.from("character_missions").insert({ character_id: characterId, mission_id: m.id, progress, status: "active" });
      }
    }
  }
}

/** Server-fn wrapper so client code (rare) can trigger from a safe place. */
export const bumpMyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    event: z.any(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase.from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await bumpMissionProgress(supabaseAdmin, char.id, data.event as MissionEvent);
    return { ok: true };
  });

/* -------- HISTORY -------- */
export const listMissionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let charId = data.character_id;
    if (!charId) {
      const { data: c } = await context.supabase.from("characters").select("id").eq("user_id", context.userId).maybeSingle();
      charId = c?.id;
    }
    if (!charId) return { history: [] };
    const { data: rows } = await context.supabase
      .from("character_missions")
      .select("mission_id,status,started_at,completed_at,claimed_at,progress")
      .eq("character_id", charId)
      .order("started_at", { ascending: false });
    const list = (rows ?? []) as any[];
    if (list.length === 0) return { history: [] };
    const missionIds = list.map((r) => r.mission_id);
    const [{ data: missions }, { data: npcs }] = await Promise.all([
      context.supabase.from("missions").select("id,name,category,rank,cooldown_hours,repeatable").in("id", missionIds),
      context.supabase.from("npcs").select("id,name,offer_mission_id").in("offer_mission_id", missionIds),
    ]);
    const mById = new Map(((missions as any[]) ?? []).map((m) => [m.id, m]));
    const npcByMission = new Map(((npcs as any[]) ?? []).map((n) => [n.offer_mission_id, n]));
    const history = list.map((r) => {
      const m = mById.get(r.mission_id);
      const npc = npcByMission.get(r.mission_id);
      let displayStatus: "active" | "completed" | "claimed" | "cooldown" = r.status;
      if (r.status === "claimed" && m?.repeatable) {
        const nextAt = new Date(r.claimed_at ?? r.completed_at ?? r.started_at).getTime() + Number(m?.cooldown_hours ?? 24) * 3600_000;
        if (Date.now() < nextAt) displayStatus = "cooldown";
      }
      return {
        mission_id: r.mission_id,
        mission_name: m?.name ?? "Missão removida",
        category: m?.category ?? null,
        rank: m?.rank ?? null,
        npc_name: npc?.name ?? null,
        status: displayStatus,
        started_at: r.started_at,
        completed_at: r.status === "active" ? null : r.completed_at,
        claimed_at: r.claimed_at,
      };
    });
    return { history };
  });
