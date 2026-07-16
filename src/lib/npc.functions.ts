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
  drop_table: z.array(z.object({
    item_id: z.string().uuid(),
    qty: z.number().int().min(1).max(99).default(1),
    chance: z.number().min(0).max(100), // percentual
  })).optional(),
  kind: z.enum(["aggressive","shop","reward","learning","object","dialogue","buyer"]).optional(),
  dialog_intro: z.string().max(4000).nullish(),
  dialog_outro: z.string().max(4000).nullish(),
  required_mission_id: z.string().uuid().nullish(),
  offer_mission_id: z.string().uuid().nullish(),
  shop_items: z.array(z.object({
    item_id: z.string().uuid(),
    price: z.number().int().min(0).max(10_000_000),
    stock: z.number().int().min(-1).max(9999).default(-1),
  })).optional(),
  buy_items: z.array(z.object({
    item_id: z.string().uuid(),
    price: z.number().int().min(0).max(10_000_000),
    max_per_day: z.number().int().min(-1).max(9999).default(-1),
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

export const setLocationSpawnGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    location_id: z.string().uuid(),
    group_ids: z.array(z.string().uuid()),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("locations")
      .update({ spawn_group_ids: data.group_ids })
      .eq("id", data.location_id);
    if (error) throw new Error(error.message);
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
// ============ NPC GROUPS ============

/** Lista todos os grupos com seus membros. */
export const listNpcGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: groups, error: gErr }, { data: mems, error: mErr }] = await Promise.all([
      supabaseAdmin.from("npc_groups").select("*").order("name"),
      supabaseAdmin.from("npc_group_members").select("group_id,npc_id,weight"),
    ]);
    if (gErr) throw new Error(gErr.message);
    if (mErr) throw new Error(mErr.message);
    return { groups: groups ?? [], members: mems ?? [] };
  });

/** Cria ou atualiza um grupo (nome/descrição). */
export const upsertNpcGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(80),
    description: z.string().max(500).nullish(),
    battle_bg_url: z.string().nullish(),
    music_url: z.string().nullish(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin.from("npc_groups")
        .update({ name: data.name, description: data.description ?? null, battle_bg_url: data.battle_bg_url ?? null, music_url: data.music_url ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("npc_groups")
      .insert({ name: data.name, description: data.description ?? null, battle_bg_url: data.battle_bg_url ?? null, music_url: data.music_url ?? null })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Remove um grupo (membros são apagados por cascade). */
export const deleteNpcGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("npc_group_members").delete().eq("group_id", data.id);
    const { error } = await supabaseAdmin.from("npc_groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Substitui os membros do grupo. Cada linha traz npc_id + weight (peso do sorteio). */
export const setNpcGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    group_id: z.string().uuid(),
    members: z.array(z.object({
      npc_id: z.string().uuid(),
      weight: z.number().int().min(1).max(99).default(1),
    })).max(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("npc_group_members").delete().eq("group_id", data.group_id);
    if (data.members.length) {
      const rows = data.members.map((m) => ({ group_id: data.group_id, npc_id: m.npc_id, weight: m.weight }));
      const { error } = await supabaseAdmin.from("npc_group_members").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
