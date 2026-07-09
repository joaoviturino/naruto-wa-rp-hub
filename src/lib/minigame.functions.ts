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
}).default({});

const configSchema = z.object({
  duration_seconds: z.number().int().min(15).max(600).default(60),
  spots: z.number().int().min(3).max(40).default(12),
  target_score: z.number().int().min(1).max(40).default(8),
}).default({ duration_seconds: 60, spots: 12, target_score: 8 });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9_-]+$/, "slug inválido"),
  kind: z.enum(["cleanup"]).default("cleanup"),
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
    const now = Date.now();
    const minigames = (games ?? []).map((g: any) => {
      const last = lastByGame.get(g.id);
      const cdMs = (g.cooldown_hours ?? 0) * 3600 * 1000;
      const next = last ? new Date(last).getTime() + cdMs : 0;
      const remaining = last ? Math.max(0, next - now) : 0;
      return { ...g, cooldown_remaining_ms: remaining, next_available_at: last ? new Date(next).toISOString() : null };
    });
    return { minigames, character_id: char.id, location_id: char.current_location_id };
  });

/** Cria um run pendente (para telemetria). Verifica cooldown. */
export const startMinigameRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ minigame_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Sem personagem.");
    const { data: game } = await context.supabase.from("minigames").select("*").eq("id", data.minigame_id).maybeSingle();
    if (!game) throw new Error("Minigame não encontrado.");
    // Verifica cooldown
    const { data: last } = await context.supabase
      .from("minigame_runs").select("completed_at").eq("character_id", char.id).eq("minigame_id", data.minigame_id)
      .not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.completed_at && (game.cooldown_hours ?? 0) > 0) {
      const next = new Date(last.completed_at).getTime() + (game.cooldown_hours * 3600 * 1000);
      if (next > Date.now()) throw new Error("Missão em recarga. Volte mais tarde.");
    }
    const insertRow: any = {
      character_id: char.id,
      minigame_id: data.minigame_id,
      location_id: char.current_location_id,
    };
    const { data: row, error } = await context.supabase.from("minigame_runs").insert(insertRow).select("id").single();
    if (error) throw new Error(error.message);
    return { run_id: row.id, game };
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
    }

    await supabaseAdmin.from("minigame_runs").update({
      score: data.score, success: data.success, rewards_applied: applied, completed_at: new Date().toISOString(),
    }).eq("id", data.run_id);

    return { ok: true, rewards: applied };
  });