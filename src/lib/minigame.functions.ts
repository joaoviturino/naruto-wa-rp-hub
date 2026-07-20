import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const rewardsSchema = z.object({
  xp: z.number().int().min(0).max(1_000_000).optional(),
  ryo: z.number().int().min(0).max(10_000_000).optional(),
  ef: z.number().int().min(0).max(100_000).optional(),
  em: z.number().int().min(0).max(100_000).optional(),
  chakra: z.number().int().min(0).max(100_000).optional(),
  items: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(99).default(1) })).optional(),
  proficiencies: z.array(z.object({
    skill_class: z.string().min(1).max(64),
    nivel: z.enum(["E", "D", "C", "B", "A", "S"]),
  })).optional(),
}).default({});

const cleanupConfigSchema = z.object({
  duration_seconds: z.number().int().min(15).max(600).default(60),
  spots: z.number().int().min(3).max(40).default(12),
  target_score: z.number().int().min(1).max(40).default(8),
}).default({ duration_seconds: 60, spots: 12, target_score: 8 });

const sequenceConfigSchema = z.object({
  duration_seconds: z.number().int().min(10).max(600).default(60),
  max_mistakes: z.number().int().min(0).max(10).default(2),
  background_url: z.string().nullish(),
  tiles: z.array(z.object({
    slot: z.number().int().min(0).max(15),
    image_url: z.string().min(1),
    correct: z.boolean().default(false),
    order: z.number().int().min(0).max(15).nullish(),
    description: z.string().max(300).nullish(),
  })).default([]),
}).default({ duration_seconds: 60, max_mistakes: 2, tiles: [] });

const forgeConfigSchema = z.object({
  duration_seconds: z.number().int().min(20).max(300).default(90),
  difficulty: z.number().int().min(1).max(5).default(2),
  hammer_hits: z.number().int().min(3).max(20).default(8),
  heat_target: z.number().int().min(20).max(95).default(70),
  temper_target: z.number().int().min(5).max(95).default(40),
  recipe_item_id: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional()),
  source: z.enum(["inventory","inventory_or_equipped"]).default("inventory"),
}).default({ duration_seconds: 90, difficulty: 2, hammer_hits: 8, heat_target: 70, temper_target: 40, source: "inventory" });

// Confecção reutiliza a estrutura da forja (mesmas fases mecânicas).
const tailoringConfigSchema = forgeConfigSchema;

const miningConfigSchema = z.object({
  node_hp: z.number().int().min(1).max(20).default(4),
  swing_cooldown_ms: z.number().int().min(150).max(5000).default(500),
  min_break_interval_ms: z.number().int().min(300).max(10000).default(800),
  xp_per_break: z.number().int().min(0).max(1000).default(1),
  required_items: z.array(z.object({
    item_id: z.string().uuid(),
    qty: z.number().int().min(1).max(99).default(1),
  })).default([]),
  drops: z.array(z.object({
    item_id: z.string().uuid(),
    chance: z.number().min(0).max(100).default(50),
    min_qty: z.number().int().min(1).max(99).default(1),
    max_qty: z.number().int().min(1).max(99).default(1),
  })).default([]),
}).default({ node_hp: 4, swing_cooldown_ms: 500, min_break_interval_ms: 800, xp_per_break: 1, required_items: [], drops: [] });

const kenjutsuConfigSchema = z.object({
  duration_seconds: z.number().int().min(15).max(600).default(60),
  target_score: z.number().int().min(1).max(500).default(20),
  max_missed: z.number().int().min(0).max(50).default(5),
  spawn_interval_ms: z.number().int().min(200).max(5000).default(1000),
  spawn_jitter_ms: z.number().int().min(0).max(3000).default(500),
  min_slice_speed: z.number().min(1).max(60).default(12),
  difficulty: z.number().int().min(1).max(5).default(2),
  gravity: z.number().min(0.05).max(2).default(0.35),
  bomb_chance: z.number().min(0).max(60).default(15),
  log_image_url: z.string().nullish(),
  bomb_image_url: z.string().nullish(),
  slice_sound_url: z.string().nullish(),
  bomb_sound_url: z.string().nullish(),
}).default({
  duration_seconds: 60, target_score: 20, max_missed: 5,
  spawn_interval_ms: 1000, spawn_jitter_ms: 500, min_slice_speed: 12,
  difficulty: 2, gravity: 0.35, bomb_chance: 15,
});

const kenjutsuDefenseConfigSchema = z.object({
  duration_seconds: z.number().int().min(15).max(600).default(60),
  target_score: z.number().int().min(1).max(500).default(15),
  max_missed: z.number().int().min(0).max(50).default(5),
  spawn_interval_ms: z.number().int().min(300).max(5000).default(1400),
  spawn_jitter_ms: z.number().int().min(0).max(3000).default(400),
  reaction_window_ms: z.number().int().min(300).max(5000).default(1200),
  difficulty: z.number().int().min(1).max(5).default(2),
  double_chance: z.number().min(0).max(100).default(15),
  feint_chance: z.number().min(0).max(100).default(10),
  projectile_chance: z.number().min(0).max(100).default(15),
  background_url: z.string().nullish(),
  hero_image_url: z.string().nullish(),
  dummy_image_url: z.string().nullish(),
  kunai_image_url: z.string().nullish(),
  shuriken_image_url: z.string().nullish(),
  clang_sound_url: z.string().nullish(),
  hit_sound_url: z.string().nullish(),
}).default({
  duration_seconds: 60, target_score: 15, max_missed: 5,
  spawn_interval_ms: 1400, spawn_jitter_ms: 400, reaction_window_ms: 1200,
  difficulty: 2, double_chance: 15, feint_chance: 10, projectile_chance: 15,
});

const kenjutsuKataConfigSchema = z.object({
  rounds: z.number().int().min(1).max(20).default(5),
  base_length: z.number().int().min(2).max(20).default(3),
  grow_per_round: z.number().int().min(0).max(5).default(1),
  demo_step_ms: z.number().int().min(200).max(3000).default(650),
  input_time_ms: z.number().int().min(500).max(20000).default(6000),
  max_mistakes: z.number().int().min(0).max(10).default(2),
  allow_diagonals: z.boolean().default(true),
  background_url: z.string().nullish(),
  sensei_image_url: z.string().nullish(),
  correct_sound_url: z.string().nullish(),
  wrong_sound_url: z.string().nullish(),
}).default({
  rounds: 5, base_length: 3, grow_per_round: 1,
  demo_step_ms: 650, input_time_ms: 6000, max_mistakes: 2, allow_diagonals: true,
});

const configSchema = z.any();

const ninjaRank = z.enum(["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"]);
const skillRankZ = z.enum(["E","D","C","B","A","S"]);
const requiredProfsSchema = z.array(z.object({
  skill_class: z.string().min(2).max(60),
  nivel: skillRankZ.nullish(),
  maestria: skillRankZ.nullish(),
})).default([]);
const rewardSkillsSchema = z.array(z.object({ skill_id: z.string().uuid() })).default([]);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9_-]+$/, "slug inválido"),
  kind: z.enum(["cleanup", "sequence", "forge", "tailoring", "mining", "logging", "kenjutsu", "kenjutsu_defense", "kenjutsu_kata"]).default("cleanup"),
  name: z.string().min(2).max(80),
  description: z.string().max(2000).nullish(),
  background_url: z.string().nullish(),
  tileset_url: z.string().nullish(),
  npc_portrait_url: z.string().nullish(),
  npc_name: z.string().max(80).nullish(),
  dialog_intro: z.string().max(4000).nullish(),
  dialog_outro: z.string().max(4000).nullish(),
  config: configSchema,
  rewards: rewardsSchema,
  cooldown_hours: z.number().int().min(0).max(168).default(24),
  active: z.boolean().default(true),
  one_time: z.boolean().default(false),
  required_rank: ninjaRank.nullish(),
  required_profs: requiredProfsSchema,
  reward_skills: rewardSkillsSchema,
  required_job_id: z.string().uuid().nullish(),
  job_required: z.boolean().default(true),
}).superRefine((data, ctx) => {
  const parser =
    data.kind === "sequence" ? sequenceConfigSchema :
    data.kind === "forge" ? forgeConfigSchema :
    data.kind === "tailoring" ? tailoringConfigSchema :
    data.kind === "mining" ? miningConfigSchema :
    data.kind === "logging" ? miningConfigSchema :
    data.kind === "kenjutsu" ? kenjutsuConfigSchema :
    data.kind === "kenjutsu_defense" ? kenjutsuDefenseConfigSchema :
    data.kind === "kenjutsu_kata" ? kenjutsuKataConfigSchema :
    cleanupConfigSchema;
  const r = parser.safeParse(data.config);
  if (!r.success) {
    r.error.issues.forEach((i) => ctx.addIssue({ ...i, path: ["config", ...(i.path ?? [])] }));
  } else {
    data.config = r.data as any;
  }
});

export const upsertMinigame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("minigames").upsert(data as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteMinigame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("minigames").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLocationMinigames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    location_id: z.string().uuid(),
    minigame_ids: z.array(z.string().uuid()),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("location_minigames").delete().eq("location_id", data.location_id);
    if (data.minigame_ids.length) {
      const rows = data.minigame_ids.map((minigame_id) => ({ location_id: data.location_id, minigame_id }));
      const { error } = await supabaseAdmin.from("location_minigames").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Retorna minigames disponíveis no local atual + cooldown restante para cada um. */
export const listMinigamesForMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
    if (!char?.current_location_id) return { minigames: [] };
    const { data: links } = await context.supabase
      .from("location_minigames").select("minigame_id").eq("location_id", char.current_location_id);
    const ids = (links ?? []).map((l: any) => l.minigame_id);
    if (!ids.length) return { minigames: [] };
    const { data: games } = await context.supabase
      .from("minigames").select("*").in("id", ids).eq("active", true);
    const { data: lastRuns } = await context.supabase
      .from("minigame_runs").select("minigame_id,completed_at")
      .eq("character_id", char.id).in("minigame_id", ids)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });
    const lastByGame = new Map<string, string>();
    (lastRuns ?? []).forEach((r: any) => { if (!lastByGame.has(r.minigame_id)) lastByGame.set(r.minigame_id, r.completed_at); });
    const successByGame = new Set<string>();
    {
      const { data: successRuns } = await context.supabase
        .from("minigame_runs").select("minigame_id").eq("character_id", char.id).in("minigame_id", ids).eq("success", true);
      (successRuns ?? []).forEach((r: any) => successByGame.add(r.minigame_id));
    }
    const now = Date.now();
    const minigames = (games ?? []).flatMap((g: any) => {
      if (g.one_time && successByGame.has(g.id)) return [];
      const last = lastByGame.get(g.id);
      const noCooldown = g.kind === "mining" || g.kind === "logging" || g.kind === "forge" || g.kind === "tailoring";
      const cdMs = noCooldown ? 0 : (g.cooldown_hours ?? 0) * 3600 * 1000;
      const next = last ? new Date(last).getTime() + cdMs : 0;
      const remaining = last && !noCooldown ? Math.max(0, next - now) : 0;
      return [{ ...g, cooldown_remaining_ms: remaining, next_available_at: last && !noCooldown ? new Date(next).toISOString() : null }];
    });
    return { minigames, character_id: char.id, location_id: char.current_location_id };
  });

const RANK_ORDER = ["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"] as const;
const SKILL_RANK_ORDER = ["E","D","C","B","A","S"] as const;
function rankGte(cur: string | null | undefined, req: string | null | undefined) {
  if (!req) return true;
  const a = RANK_ORDER.indexOf((cur as any) ?? "estudante");
  const b = RANK_ORDER.indexOf(req as any);
  return a >= b;
}
function skillRankGte(cur: string | null | undefined, req: string | null | undefined) {
  if (!req) return true;
  const a = SKILL_RANK_ORDER.indexOf((cur as any) ?? "E");
  const b = SKILL_RANK_ORDER.indexOf(req as any);
  return a >= 0 && a >= b;
}
function checkRequirements(character: any, req_rank: string | null, req_profs: any[]): string[] {
  const missing: string[] = [];
  if (req_rank && !rankGte(character.rank, req_rank)) missing.push(`Patente ${req_rank}`);
  const profs = (character.proficiencies ?? {}) as Record<string, { nivel?: string; maestria?: string }>;
  for (const p of req_profs ?? []) {
    const cur = profs[p.skill_class] ?? {};
    if (p.nivel && !skillRankGte(cur.nivel, p.nivel)) missing.push(`${p.skill_class} Nível ${p.nivel}`);
    if (p.maestria && !skillRankGte(cur.maestria, p.maestria)) missing.push(`${p.skill_class} Maestria ${p.maestria}`);
  }
  return missing;
}

/** Cria um run pendente (para telemetria). Verifica cooldown. */
export const startMinigameRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    minigame_id: z.string().uuid(),
    forge_selection: z.array(z.object({
      item_id: z.string().uuid(),
      qty: z.number().int().min(1).max(999),
    })).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,current_location_id,rank,proficiencies").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: game } = await context.supabase.from("minigames").select("*").eq("id", data.minigame_id).maybeSingle();
    if (!game) throw new Error("Minigame não encontrado.");
    if (game.one_time) {
      const { data: prev } = await context.supabase
        .from("minigame_runs").select("id").eq("character_id", char.id).eq("minigame_id", data.minigame_id).eq("success", true).limit(1).maybeSingle();
      if (prev) throw new Error("Este treino só pode ser feito uma única vez.");
    }
    const missing = checkRequirements(char, game.required_rank ?? null, (game.required_profs as any[]) ?? []);
    if (missing.length) throw new Error("Requisitos não atendidos: " + missing.join(", "));
    // Requisito de emprego: se marcado como obrigatório, precisa estar contratado (status=active).
    if (game.required_job_id && game.job_required !== false) {
      const { data: cj } = await context.supabase.from("character_jobs")
        .select("status").eq("character_id", char.id).eq("job_id", game.required_job_id).maybeSingle();
      if (!cj || (cj as any).status !== "active") {
        const { data: j } = await context.supabase.from("jobs").select("name").eq("id", game.required_job_id).maybeSingle();
        throw new Error(`Requer o emprego: ${(j as any)?.name ?? "?"}.`);
      }
    }
    // Verifica cooldown (mineração, lenhador, forja, confecção e kenjutsu não têm recarga — atividades contínuas/treino).
    const kind = game.kind as string;
    if (kind !== "mining" && kind !== "logging" && kind !== "forge" && kind !== "tailoring" && kind !== "kenjutsu" && kind !== "kenjutsu_defense" && kind !== "kenjutsu_kata") {
      const { data: last } = await context.supabase
        .from("minigame_runs").select("completed_at").eq("character_id", char.id).eq("minigame_id", data.minigame_id)
        .not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(1).maybeSingle();
      if (last?.completed_at && (game.cooldown_hours ?? 0) > 0) {
        const next = new Date(last.completed_at).getTime() + (game.cooldown_hours * 3600 * 1000);
        if (next > Date.now()) throw new Error("Missão em recarga. Volte mais tarde.");
      }
    }
    // Crafting (forge / tailoring): valida seleção do jogador + descobre item resultante
    let runContext: any = {};
    if ((game.kind as string) === "mining" || (game.kind as string) === "logging") {
      const cfg = (game.config ?? {}) as any;
      const req: Array<{ item_id: string; qty: number }> = Array.isArray(cfg.required_items) ? cfg.required_items : [];
      if (req.length) {
        const { data: inv } = await context.supabase
          .from("inventory").select("ninja_bag").eq("character_id", char.id).maybeSingle();
        const bag = ((inv?.ninja_bag as any[]) ?? []).filter((e: any) => e && e.item_id);
        const missingItems: string[] = [];
        for (const r of req) {
          const have = bag.filter((b: any) => b.item_id === r.item_id)
            .reduce((s: number, b: any) => s + (Number(b.qty) || 1), 0);
          if (have < r.qty) missingItems.push(r.item_id);
        }
        if (missingItems.length) {
          const { data: itemRows } = await context.supabase
            .from("items").select("id,name").in("id", missingItems);
          const names = (itemRows ?? []).map((i: any) => i.name).join(", ") || "itens obrigatórios";
          throw new Error("Você precisa carregar: " + names);
        }
      }
      runContext = { breaks: 0 };
    }
    if ((game.kind as string) === "forge" || (game.kind as string) === "tailoring") {
      const cfg = (game.config ?? {}) as any;
      const selection = (data.forge_selection ?? []).filter((s) => s.qty > 0);
      if (!selection.length) throw new Error("Selecione os materiais para a fabricação.");
      // Normaliza seleção (agrega mesmo item_id)
      const selMap = new Map<string, number>();
      for (const s of selection) selMap.set(s.item_id, (selMap.get(s.item_id) ?? 0) + s.qty);
      // Verifica materiais no inventário
      const { data: inv } = await context.supabase
        .from("inventory").select("ninja_bag").eq("character_id", char.id).maybeSingle();
      const bag = (((inv?.ninja_bag as any[]) ?? []).filter((e: any) => e && e.item_id));
      for (const [itemId, qty] of selMap.entries()) {
        const have = bag.filter((b: any) => b.item_id === itemId).reduce((s: number, b: any) => s + (Number(b.qty) || 1), 0);
        if (have < qty) throw new Error("Materiais insuficientes na bolsa ninja.");
      }
      // Procura item cujo meta.recipe bate exatamente com a seleção
      const { data: candidates } = await context.supabase
        .from("items").select("id,name,meta");
      const target = (candidates ?? []).find((it: any) => {
        const recipe = Array.isArray(it?.meta?.recipe) ? it.meta.recipe : [];
        if (!recipe.length) return false;
        const rMap = new Map<string, number>();
        for (const r of recipe) rMap.set(r.item_id, (rMap.get(r.item_id) ?? 0) + Number(r.qty || 0));
        if (rMap.size !== selMap.size) return false;
        for (const [k, v] of rMap.entries()) if (selMap.get(k) !== v) return false;
        return true;
      });
      if (!target) throw new Error("Nenhuma receita conhecida combina com esses materiais.");
      runContext = {
        forge_selection: Array.from(selMap.entries()).map(([item_id, qty]) => ({ item_id, qty })),
        target_item_id: target.id,
        target_item_name: target.name,
      };
    }
    const insertRow: any = {
      character_id: char.id,
      minigame_id: data.minigame_id,
      location_id: char.current_location_id,
      context: runContext,
    };
    const { data: row, error } = await context.supabase.from("minigame_runs").insert(insertRow).select("id").single();
    if (error) throw new Error(error.message);
    return { run_id: row.id, game, forge_target: runContext.target_item_id ? { id: runContext.target_item_id, name: runContext.target_item_name } : null };
  });

/** Finaliza um run e aplica recompensas. */
export const completeMinigameRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    run_id: z.string().uuid(),
    score: z.number().int().min(0).max(1000),
    success: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin.from("minigame_runs").select("*,characters(*),minigames(*)").eq("id", data.run_id).maybeSingle();
    if (!run) throw new Error("Run não encontrado.");
    if (run.characters.user_id !== context.userId) throw new Error("Forbidden");
    if (run.completed_at) return { ok: true, rewards: run.rewards_applied };

    const rewards = (run.minigames.rewards ?? {}) as any;
    const applied: any = {};
    if (data.success) {
      const patch: any = {};
      if (rewards.xp) { patch.xp = (run.characters.xp ?? 0) + rewards.xp; applied.xp = rewards.xp; }
      if (rewards.ryo) { patch.ryo = (run.characters.ryo ?? 0) + rewards.ryo; applied.ryo = rewards.ryo; }
      if (rewards.ef) { patch.ef_current = (run.characters.ef_current ?? 0) + rewards.ef; applied.ef = rewards.ef; }
      if (rewards.em) { patch.em_current = (run.characters.em_current ?? 0) + rewards.em; applied.em = rewards.em; }
      if (rewards.chakra) { patch.chakra_current = (run.characters.chakra_current ?? 0) + rewards.chakra; applied.chakra = rewards.chakra; }
      if (Object.keys(patch).length) await supabaseAdmin.from("characters").update(patch).eq("id", run.character_id);

      if (rewards.items?.length) {
        const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", run.character_id).maybeSingle();
        const bag = (((inv?.ninja_bag as any[]) ?? [])
          .filter((e: any) => e && e.item_id)
          .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 })));
        for (const it of rewards.items as Array<{ item_id: string; qty: number }>) {
          const idx = bag.findIndex((b) => b.item_id === it.item_id);
          if (idx === -1) bag.push({ item_id: it.item_id, qty: it.qty });
          else bag[idx].qty += it.qty;
        }
        await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", run.character_id);
        applied.items = rewards.items;
      }

      const skillRewards = (run.minigames.reward_skills as any[]) ?? [];
      if (skillRewards.length) {
        const skillIds = skillRewards.map((s: any) => s.skill_id).filter(Boolean);
        if (skillIds.length) {
          const rows = skillIds.map((sid: string) => ({ character_id: run.character_id, skill_id: sid }));
          await supabaseAdmin.from("character_skills").upsert(rows, { onConflict: "character_id,skill_id" });
          applied.skills = skillIds;
        }
      }

      // Proficiência: concede/eleva o rank do jogador na classe informada (só sobe, nunca desce).
      const profRewards = (rewards.proficiencies as Array<{ skill_class: string; nivel: string }>) ?? [];
      if (profRewards.length) {
        const ORDER = ["E", "D", "C", "B", "A", "S"];
        const curProf = ((run.characters.proficiencies as any) ?? {}) as Record<string, any>;
        const nextProf = { ...curProf };
        const grantedProf: Array<{ skill_class: string; nivel: string }> = [];
        for (const p of profRewards) {
          const entry = nextProf[p.skill_class];
          const curRank: string | null =
            entry && typeof entry === "object" && typeof entry.nivel === "string" ? entry.nivel : null;
          const curIdx = curRank ? ORDER.indexOf(curRank) : -1;
          const newIdx = ORDER.indexOf(p.nivel);
          if (newIdx > curIdx) {
            nextProf[p.skill_class] = { nivel: p.nivel, maestria: entry?.maestria ?? null };
            grantedProf.push(p);
          }
        }
        if (grantedProf.length) {
          await supabaseAdmin.from("characters").update({ proficiencies: nextProf }).eq("id", run.character_id);
          applied.proficiencies = grantedProf;
        }
      }

      // Crafting: consome materiais e entrega o item resultante
      const crafKind = run.minigames.kind as string;
      if (crafKind === "forge" || crafKind === "tailoring") {
        const ctx = (run.context ?? {}) as any;
        const selection: Array<{ item_id: string; qty: number }> =
          Array.isArray(ctx.forge_selection) ? ctx.forge_selection : [];
        const targetItemId: string | null = ctx.target_item_id ?? (run.minigames.config as any)?.recipe_item_id ?? null;
        if (targetItemId) {
          const { data: targetItem } = await supabaseAdmin
            .from("items").select("id,name,meta").eq("id", targetItemId).maybeSingle();
          // Fallback: se não houver seleção salva, usa a receita do próprio item (compat)
          const consumeList: Array<{ item_id: string; qty: number }> = selection.length
            ? selection
            : (Array.isArray((targetItem as any)?.meta?.recipe)
                ? ((targetItem as any).meta.recipe as Array<{ item_id: string; qty: number }>)
                : []);
          if (targetItem && consumeList.length) {
            const { data: inv } = await supabaseAdmin
              .from("inventory").select("ninja_bag").eq("character_id", run.character_id).maybeSingle();
            const bag: Array<{ item_id: string; qty: number }> = ((inv?.ninja_bag as any[]) ?? [])
              .filter((e: any) => e && e.item_id)
              .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
            // debit materials
            let ok = true;
            for (const r of consumeList) {
              let need = r.qty;
              for (const b of bag) {
                if (b.item_id !== r.item_id || need <= 0) continue;
                const take = Math.min(b.qty, need);
                b.qty -= take; need -= take;
              }
              if (need > 0) { ok = false; break; }
            }
            if (ok) {
              const cleaned = bag.filter((b) => b.qty > 0);
              // credit forged item (1x)
              const idx = cleaned.findIndex((b) => b.item_id === targetItem.id);
              if (idx === -1) cleaned.push({ item_id: targetItem.id, qty: 1 });
              else cleaned[idx].qty += 1;
              await supabaseAdmin.from("inventory").update({ ninja_bag: cleaned }).eq("character_id", run.character_id);
              applied.forged = { item_id: targetItem.id, name: targetItem.name };
              applied.consumed = consumeList;
            }
          }
        }
      }
    }

    await supabaseAdmin.from("minigame_runs").update({
      score: data.score, success: data.success, rewards_applied: applied, completed_at: new Date().toISOString(),
    }).eq("id", data.run_id);

    // Bump last_activity_at do emprego vinculado se o run teve sucesso.
    if (data.success && (run.minigames as any).required_job_id) {
      await supabaseAdmin.from("character_jobs")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("character_id", run.character_id)
        .eq("job_id", (run.minigames as any).required_job_id)
        .eq("status", "active");
    }

    // Missões — registrar conclusão de minigame e (se houver) fabricação.
    if (data.success) {
      try {
        const { bumpMissionProgress } = await import("@/lib/missions.functions");
        await bumpMissionProgress(supabaseAdmin, run.character_id, {
          type: "complete_minigame", minigame_id: run.minigame_id, kind: run.minigames.kind ?? null,
        });
        if (applied.forged?.item_id) {
          await bumpMissionProgress(supabaseAdmin, run.character_id, {
            type: "craft_item", item_id: applied.forged.item_id,
          });
        }
      } catch (e) { /* non-fatal */ }
    }

    return { ok: true, rewards: applied };
  });

/** Lista os passos de aprendizagem de um NPC com status por personagem. */
export const listNpcLearningSteps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ npc_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,rank,proficiencies").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: steps } = await context.supabase
      .from("npc_learning_steps")
      .select("id,minigame_id,position,required_rank,required_profs,minigame:minigames(id,name,kind,description,one_time,required_rank,required_profs,reward_skills)")
      .eq("npc_id", data.npc_id).order("position", { ascending: true });
    const arr = ((steps as any[]) ?? []).map((r) => ({ ...r, minigame: r.minigame }));
    const mgIds = arr.map((s) => s.minigame_id);
    let completedIds = new Set<string>();
    if (mgIds.length) {
      const { data: done } = await context.supabase
        .from("minigame_runs").select("minigame_id").eq("character_id", char.id).eq("success", true).in("minigame_id", mgIds);
      completedIds = new Set(((done as any[]) ?? []).map((r) => r.minigame_id));
    }
    let allowNextAvailable = true;
    const out = arr.map((s) => {
      const completed = completedIds.has(s.minigame_id);
      const stepReqs = checkRequirements(char, s.required_rank ?? s.minigame?.required_rank ?? null, (s.required_profs as any[]) ?? (s.minigame?.required_profs as any[]) ?? []);
      const status: "completed" | "available" | "locked" = completed
        ? "completed"
        : (allowNextAvailable && stepReqs.length === 0 ? "available" : "locked");
      if (!completed) allowNextAvailable = false; // apenas o primeiro pendente pode ficar disponível
      return {
        id: s.id, position: s.position, minigame_id: s.minigame_id,
        name: s.minigame?.name ?? "?", kind: s.minigame?.kind,
        one_time: !!s.minigame?.one_time,
        required_rank: s.required_rank ?? s.minigame?.required_rank ?? null,
        required_profs: s.required_profs ?? s.minigame?.required_profs ?? [],
        reward_skills: s.minigame?.reward_skills ?? [],
        status, blockers: status === "locked" && !completed ? stepReqs : [],
      };
    });
    return { steps: out };
  });

export const setNpcLearningSteps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    npc_id: z.string().uuid(),
    steps: z.array(z.object({
      minigame_id: z.string().uuid(),
      position: z.number().int().min(0).max(999),
      required_rank: ninjaRank.nullish(),
      required_profs: requiredProfsSchema,
    })),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("npc_learning_steps").delete().eq("npc_id", data.npc_id);
    if (data.steps.length) {
      const rows = data.steps.map((s) => ({ npc_id: data.npc_id, ...s }));
      const { error } = await supabaseAdmin.from("npc_learning_steps").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Mineração: registra a quebra de um nó e sorteia drops no servidor. */
export const mineNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ run_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin
      .from("minigame_runs")
      .select("id,character_id,context,completed_at,characters(user_id),minigames(kind,config)")
      .eq("id", data.run_id).maybeSingle();
    if (!run) throw new Error("Sessão de mineração inválida.");
    if ((run as any).characters.user_id !== context.userId) throw new Error("Forbidden");
    if (run.completed_at) throw new Error("Sessão já encerrada.");
    const game: any = (run as any).minigames;
    if (game?.kind !== "mining" && game?.kind !== "logging") throw new Error("Não é uma sessão de coleta.");
    const cfg = (game.config ?? {}) as any;
    const minMs = Math.max(300, Number(cfg.min_break_interval_ms) || 800);
    const ctxRun = (run.context ?? {}) as any;
    const lastAt = ctxRun.last_break_at ? new Date(ctxRun.last_break_at).getTime() : 0;
    if (lastAt && Date.now() - lastAt < minMs) throw new Error("Aguarde antes da próxima quebra.");

    // Requer itens (ex.: picareta) continuamente presentes
    const required: Array<{ item_id: string; qty: number }> = Array.isArray(cfg.required_items) ? cfg.required_items : [];
    const { data: inv } = await supabaseAdmin
      .from("inventory").select("ninja_bag").eq("character_id", run.character_id).maybeSingle();
    const bag: Array<{ item_id: string; qty: number; dur?: number | null }> = ((inv?.ninja_bag as any[]) ?? [])
      .filter((e: any) => e && e.item_id)
      .map((e: any) => ({
        item_id: e.item_id,
        qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1,
        dur: typeof e.dur === "number" ? e.dur : null,
      }));
    if (required.length) {
      for (const r of required) {
        const have = bag.filter((b) => b.item_id === r.item_id).reduce((s, b) => s + b.qty, 0);
        if (have < r.qty) throw new Error("Ferramenta necessária foi perdida.");
      }
    }

    // ============ DURABILIDADE (ferramentas do minigame) ============
    // Para cada required com item que tem durability > 0, decrementa 1 por golpe.
    // Uma quebra por golpe (não por break de nó): consome do tempo real.
    const brokenNow: Array<{ item_id: string; name: string }> = [];
    if (required.length) {
      const reqIds = Array.from(new Set(required.map((r) => r.item_id)));
      const { data: reqItems } = await supabaseAdmin
        .from("items").select("id,name,durability,image_url").in("id", reqIds);
      const reqInfo = new Map<string, { name: string; durability: number | null; image_url: string | null }>();
      (reqItems ?? []).forEach((i: any) => reqInfo.set(i.id, { name: i.name, durability: i.durability, image_url: i.image_url }));
      for (const r of required) {
        const info = reqInfo.get(r.item_id);
        const maxDur = info?.durability ?? 0;
        if (!maxDur || maxDur <= 0) continue; // sem durabilidade -> ignora
        // Pega a primeira entrada com essa item_id
        const entry = bag.find((b) => b.item_id === r.item_id && b.qty > 0);
        if (!entry) throw new Error(`Ferramenta quebrada: ${info?.name ?? "item obrigatório"}. Repare para continuar.`);
        if (entry.dur == null || entry.dur > maxDur) entry.dur = maxDur;
        entry.dur -= 1;
        if (entry.dur <= 0) {
          entry.qty -= 1;
          entry.dur = null;
          brokenNow.push({ item_id: r.item_id, name: info?.name ?? "Ferramenta" });
          // Se ainda houver estoque, próxima usa dur fresh no próximo golpe
          // Se qty=0, será removido no cleanup abaixo — próximo golpe lançará erro.
        }
      }
    }
    // Limpa entradas zeradas
    for (let i = bag.length - 1; i >= 0; i--) if (bag[i].qty <= 0) bag.splice(i, 1);

    // Rola drops
    const drops: Array<{ item_id: string; chance: number; min_qty: number; max_qty: number }> = Array.isArray(cfg.drops) ? cfg.drops : [];
    const rolled: Array<{ item_id: string; qty: number }> = [];
    for (const d of drops) {
      const chance = Math.max(0, Math.min(100, Number(d.chance) || 0));
      if (Math.random() * 100 < chance) {
        const min = Math.max(1, Number(d.min_qty) || 1);
        const max = Math.max(min, Number(d.max_qty) || min);
        const qty = min + Math.floor(Math.random() * (max - min + 1));
        rolled.push({ item_id: d.item_id, qty });
      }
    }

    // Credita drops
    if (rolled.length) {
      for (const it of rolled) {
        // Prefere empilhar em stack sem durabilidade
        const idx = bag.findIndex((b) => b.item_id === it.item_id && (b.dur == null));
        if (idx === -1) bag.push({ item_id: it.item_id, qty: it.qty });
        else bag[idx].qty += it.qty;
      }
    }
    // Sempre persiste bag (durabilidade + drops)
    await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", run.character_id);

    // XP por quebra
    const xpPerBreak = Math.max(0, Number(cfg.xp_per_break) || 0);
    if (xpPerBreak) {
      const { data: c } = await supabaseAdmin.from("characters").select("xp").eq("id", run.character_id).maybeSingle();
      await supabaseAdmin.from("characters").update({ xp: (c?.xp ?? 0) + xpPerBreak }).eq("id", run.character_id);
    }

    // Atualiza contexto da sessão
    const breaks = (Number(ctxRun.breaks) || 0) + 1;
    const nextCtx = { ...ctxRun, breaks, last_break_at: new Date().toISOString() };
    await supabaseAdmin.from("minigame_runs").update({ context: nextCtx, score: breaks }).eq("id", run.id);

    // Enriquece drops com nomes/imagens
    const ids = Array.from(new Set(rolled.map((r) => r.item_id)));
    const { data: itemRows } = ids.length
      ? await supabaseAdmin.from("items").select("id,name,image_url").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((itemRows ?? []).map((i: any) => [i.id, i]));
    // Snapshot das ferramentas atuais (para HUD)
    const toolIds = Array.from(new Set(required.map((r) => r.item_id)));
    let tools: Array<{ item_id: string; name: string; image_url: string | null; qty: number; dur: number | null; max: number | null }> = [];
    if (toolIds.length) {
      const { data: toolInfo } = await supabaseAdmin.from("items").select("id,name,image_url,durability").in("id", toolIds);
      tools = (toolInfo ?? []).map((i: any) => {
        const entry = bag.find((b) => b.item_id === i.id);
        return {
          item_id: i.id, name: i.name, image_url: i.image_url ?? null,
          qty: entry?.qty ?? 0,
          dur: entry?.dur ?? (entry && i.durability ? i.durability : null),
          max: i.durability ?? null,
        };
      });
    }
    return {
      drops: rolled.map((r) => ({
        item_id: r.item_id, qty: r.qty,
        name: byId.get(r.item_id)?.name ?? "?",
        image_url: byId.get(r.item_id)?.image_url ?? null,
      })),
      xp: xpPerBreak,
      breaks,
      next_at: Date.now() + minMs,
      tools,
      broken_now: brokenNow,
    };
  });

/** Repara todas as ferramentas requeridas de um minigame ativo, cobrando ryo. */
export const repairMinigameTools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ run_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin
      .from("minigame_runs")
      .select("id,character_id,characters(user_id,ryo),minigames(kind,config)")
      .eq("id", data.run_id).maybeSingle();
    if (!run) throw new Error("Sessão inválida.");
    if ((run as any).characters.user_id !== context.userId) throw new Error("Forbidden");
    const game: any = (run as any).minigames;
    const cfg = (game?.config ?? {}) as any;
    const required: Array<{ item_id: string; qty: number }> = Array.isArray(cfg.required_items) ? cfg.required_items : [];
    if (!required.length) throw new Error("Este minigame não usa ferramentas.");
    const reqIds = Array.from(new Set(required.map((r) => r.item_id)));
    const { data: reqItems } = await supabaseAdmin
      .from("items").select("id,name,durability").in("id", reqIds);
    const info = new Map<string, { name: string; durability: number | null }>();
    (reqItems ?? []).forEach((i: any) => info.set(i.id, { name: i.name, durability: i.durability }));

    const { data: inv } = await supabaseAdmin
      .from("inventory").select("ninja_bag").eq("character_id", run.character_id).maybeSingle();
    const bag: Array<{ item_id: string; qty: number; dur?: number | null }> = ((inv?.ninja_bag as any[]) ?? [])
      .filter((e: any) => e && e.item_id)
      .map((e: any) => ({
        item_id: e.item_id,
        qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1,
        dur: typeof e.dur === "number" ? e.dur : null,
      }));

    const costPerPoint = Math.max(1, Number(cfg.repair_cost_per_point) || 2);
    let totalCost = 0;
    const repaired: string[] = [];
    for (const r of required) {
      const it = info.get(r.item_id);
      const max = it?.durability ?? 0;
      if (!max) continue;
      for (const b of bag) {
        if (b.item_id !== r.item_id) continue;
        const cur = b.dur == null ? max : b.dur;
        const missing = Math.max(0, max - cur);
        if (missing > 0) {
          totalCost += missing * costPerPoint;
          b.dur = max;
          repaired.push(it?.name ?? "Ferramenta");
        }
      }
    }
    if (!totalCost) return { ok: true, cost: 0, repaired: [] };

    const currentRyo = Number((run as any).characters.ryo ?? 0);
    if (currentRyo < totalCost) throw new Error(`Ryo insuficiente. Necessário: ${totalCost}.`);

    await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", run.character_id);
    await supabaseAdmin.from("characters").update({ ryo: currentRyo - totalCost }).eq("id", run.character_id);
    return { ok: true, cost: totalCost, repaired };
  });