import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const npcPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  image_url: z.string().nullish(),
  battle_bg_url: z.string().nullish(),
  music_url: z.string().nullish(),
  description: z.string().max(2000).nullish(),
  hp_max: z.number().int().min(1).max(100000),
  xp: z.number().int().min(0).max(100000),
  energy_max: z.number().int().min(1).max(100000),
  reward_xp: z.number().int().min(0).max(1000000).optional(),
  reward_ryo: z.number().int().min(0).max(10000000).optional(),
  avg_damage: z.number().int().min(0).max(100000).optional(),
  crit_chance: z.number().int().min(0).max(100).optional(),
  crit_multiplier: z.number().min(1).max(10).optional(),
  defense: z.number().int().min(0).max(90).optional(),
  max_hit_percent: z.number().int().min(10).max(100).optional(),
  drop_table: z.array(z.object({
    item_id: z.string().uuid(),
    qty: z.number().int().min(1).max(99).default(1),
    chance: z.number().min(0).max(100), // percentual
  })).optional(),
  kind: z.enum(["aggressive","shop","reward","learning"]).optional(),
  dialog_intro: z.string().max(4000).nullish(),
  dialog_outro: z.string().max(4000).nullish(),
  required_mission_id: z.string().uuid().nullish(),
  shop_items: z.array(z.object({
    item_id: z.string().uuid(),
    price: z.number().int().min(0).max(10_000_000),
    stock: z.number().int().min(-1).max(9999).default(-1),
  })).optional(),
  reward_items: z.array(z.object({
    item_id: z.string().uuid(),
    qty: z.number().int().min(1).max(99).default(1),
  })).optional(),
  reward_cooldown_hours: z.number().int().min(0).max(24 * 30).optional(),
  tutorial_blocks: z.array(z.object({
    id: z.string().min(1).max(64),
    kind: z.enum(["text","image"]),
    text: z.string().max(20_000).nullish(),
    image_url: z.string().nullish(),
  })).optional(),
  learning_min_read_seconds: z.number().int().min(5).max(3600).optional(),
  linked_minigame_id: z.string().uuid().nullish(),
});

export const upsertNpc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => npcPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("npcs").upsert(data as any).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteNpc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("npcs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setNpcSkills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    npc_id: z.string().uuid(),
    skill_ids: z.array(z.string().uuid()),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("npc_skills").delete().eq("npc_id", data.npc_id);
    if (data.skill_ids.length) {
      const rows = data.skill_ids.map((skill_id) => ({ npc_id: data.npc_id, skill_id }));
      const { error } = await supabaseAdmin.from("npc_skills").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setLocationNpcs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    location_id: z.string().uuid(),
    npc_ids: z.array(z.string().uuid()),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("location_npcs").delete().eq("location_id", data.location_id);
    if (data.npc_ids.length) {
      const rows = data.npc_ids.map((npc_id) => ({ location_id: data.location_id, npc_id }));
      const { error } = await supabaseAdmin.from("location_npcs").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateLocationDangerZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    is_danger_zone: z.boolean(),
    spawn_chance: z.number().int().min(0).max(100),
    spawn_tick_seconds: z.number().int().min(10).max(3600),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("locations").update({
      is_danger_zone: data.is_danger_zone,
      spawn_chance: data.spawn_chance,
      spawn_tick_seconds: data.spawn_tick_seconds,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const npcTemplateStats = z.object({
  hp_max: z.number().int().min(1).max(1_000_000),
  energy_max: z.number().int().min(1).max(1_000_000),
  xp: z.number().int().min(0).max(1_000_000),
  avg_damage: z.number().int().min(0).max(1_000_000),
  crit_chance: z.number().int().min(0).max(100),
  crit_multiplier: z.number().min(1).max(10),
  reward_xp: z.number().int().min(0).max(1_000_000),
  reward_ryo: z.number().int().min(0).max(10_000_000),
});

export const applyNpcTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    target: z.enum(["all", "one"]),
    npc_id: z.string().uuid().nullish(),
    only_aggressive: z.boolean().default(true),
    stats: npcTemplateStats,
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("npcs").update(data.stats as any);
    if (data.target === "one") {
      if (!data.npc_id) throw new Error("npc_id obrigatório");
      q = q.eq("id", data.npc_id);
    } else if (data.only_aggressive) {
      q = q.eq("kind", "aggressive");
    }
    const { data: rows, error } = await q.select("id");
    if (error) throw new Error(error.message);
    return { ok: true, updated: rows?.length ?? 0 };
  });

export const listNpcsBasic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("npcs").select("id,name,kind").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });