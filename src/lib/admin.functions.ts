import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const ninjaRank = z.enum(["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"]);
const skillRank = z.enum(["E","D","C","B","A","S"]);
const profKind = z.enum(["kenjutsu","shurikenjutsu","taijutsu","ninjutsu","genjutsu","fuinjutsu","iryo"]);
const skillClassification = z.enum(["ofensivo","defensivo","suplementar"]);
const skillRange = z.enum(["curto","medio","longo"]);
const itemType = z.enum(["consumable","tool","armor_helmet","armor_vest","armor_pants","armor_boots","weapon_primary","weapon_secondary"]);
const villageEnum = z.enum(["konoha","suna","kiri","kumo","iwa","ame","kusa","taki","oto","yuki","hoshi","nomad"]);
const elementEnum = z.enum(["katon","suiton","fuuton","doton","raiton"]);

/** Send a test message via the bot queue. */
export const enqueueMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ to_phone: z.string().min(6), body: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.to_phone.startsWith("+") ? data.to_phone : `+${data.to_phone}`;
    const { error } = await supabaseAdmin.from("outbound_messages").insert({ to_phone: phone, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reset bot session (forces bot to reconnect). */
export const resetBotSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bot_sessions").upsert({ id: "default", status: "disconnected", qr: null, phone: null });
    return { ok: true };
  });

/** Request a fresh QR code from the bot service. */
export const requestBotQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bot_sessions").upsert({
      id: "default",
      status: "connecting",
      qr: `__REQUEST_QR__:${Date.now()}`,
      phone: null,
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/** Grant / revoke roles, adjust xp. */
export const setUserXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ character_id: z.string().uuid(), xp: z.number().int().min(0) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("characters").update({ xp: data.xp }).eq("id", data.character_id);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "set_xp", target: data.character_id, meta: { xp: data.xp } });
    return { ok: true };
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["admin","user"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").upsert({ user_id: data.user_id, role: data.role });
    return { ok: true };
  });

/* ---------- PLAYER EDIT ---------- */

export const updatePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    character_id: z.string().uuid(),
    xp: z.number().int().min(0).optional(),
    rank: ninjaRank.optional(),
    village: villageEnum.optional(),
    clan_id: z.string().uuid().nullable().optional(),
    element_primary: elementEnum.optional(),
    proficiencies: z.record(profKind, z.number().int().min(0).max(100)).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { character_id, ...patch } = data;
    const { error } = await supabaseAdmin.from("characters").update(patch).eq("id", character_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "update_player", target: character_id, meta: patch });
    return { ok: true };
  });

export const grantSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid(), skill_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("character_skills").upsert({ character_id: data.character_id, skill_id: data.skill_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid(), skill_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("character_skills").delete().eq("character_id", data.character_id).eq("skill_id", data.skill_id);
    return { ok: true };
  });

export const grantItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid(), item_id: z.string().uuid(), slot: z.enum(["ninja_bag","secondary_slots"]).default("ninja_bag") }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag,secondary_slots").eq("character_id", data.character_id).maybeSingle();
    if (!inv) throw new Error("Inventário não encontrado.");
    const current = ((inv as any)[data.slot] as any[]) ?? [];
    // Ambos os slots (bolsa e secundários) usam o mesmo shape { item_id, qty }.
    const next = current
      .filter((e: any) => e && e.item_id)
      .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
    const idx = next.findIndex((e: any) => e.item_id === data.item_id);
    if (idx === -1) next.push({ item_id: data.item_id, qty: 1 });
    else next[idx].qty += 1;
    const patch: any = { [data.slot]: next };
    await supabaseAdmin.from("inventory").update(patch).eq("character_id", data.character_id);
    return { ok: true };
  });

export const revokeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid(), index: z.number().int().min(0), slot: z.enum(["ninja_bag","secondary_slots"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag,secondary_slots").eq("character_id", data.character_id).maybeSingle();
    if (!inv) throw new Error("Inventário não encontrado.");
    // Trata como lista {item_id, qty}: reduz qty; se chegar a 0, remove.
    const current = (((inv as any)[data.slot] as any[]) ?? [])
      .filter((e: any) => e && e.item_id)
      .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
    if (data.index >= 0 && data.index < current.length) {
      current[data.index].qty -= 1;
      if (current[data.index].qty <= 0) current.splice(data.index, 1);
    }
    const patch: any = { [data.slot]: current };
    await supabaseAdmin.from("inventory").update(patch).eq("character_id", data.character_id);
    return { ok: true };
  });

export const completeMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid(), mission_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("character_missions").upsert({ character_id: data.character_id, mission_id: data.mission_id });
    return { ok: true };
  });

export const uncompleteMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid(), mission_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("character_missions").delete().eq("character_id", data.character_id).eq("mission_id", data.mission_id);
    return { ok: true };
  });

/* ---------- ITEMS CRUD ---------- */

const itemPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  type: itemType,
  rank: skillRank,
  slot_size: z.number().int().min(1).max(20).default(1),
  durability: z.number().int().min(0).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  req_rank: ninjaRank.nullable().optional(),
  req_proficiency_kind: profKind.nullable().optional(),
  req_proficiency_level: z.number().int().min(0).max(100).nullable().optional(),
  req_mission_id: z.string().uuid().nullable().optional(),
  req_skill_id: z.string().uuid().nullable().optional(),
});

export const upsertItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => itemPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("items").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("items").delete().eq("id", data.id);
    return { ok: true };
  });

/* ---------- SKILLS CRUD ---------- */

const skillPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  rank: skillRank,
  classification: skillClassification.nullable().optional(),
  skill_class: z.string().max(60).nullable().optional(),
  range: skillRange.nullable().optional(),
  element: elementEnum.nullable().optional(),
  type: z.string().max(60).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  clan_id: z.string().uuid().nullable().optional(),
  req_rank: ninjaRank.nullable().optional(),
  req_proficiency_kind: profKind.nullable().optional(),
  req_proficiency_level: z.number().int().min(0).max(100).nullable().optional(),
  req_mission_id: z.string().uuid().nullable().optional(),
  req_prereq_skill_id: z.string().uuid().nullable().optional(),
});

export const upsertSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => skillPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("skills").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("skills").delete().eq("id", data.id);
    return { ok: true };
  });

/* ---------- MISSIONS CRUD ---------- */

export const upsertMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    rank: ninjaRank.default("genin"),
    description: z.string().max(2000).nullable().optional(),
    reward_xp: z.number().int().min(0).default(0),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("missions").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("missions").delete().eq("id", data.id);
    return { ok: true };
  });

/* ---------- CLAN SKILL TREE ---------- */

export const setClanTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    clan_id: z.string().uuid(),
    skill_ids: z.array(z.string().uuid()),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("clan_skills").delete().eq("clan_id", data.clan_id);
    if (data.skill_ids.length > 0) {
      const rows = data.skill_ids.map((skill_id, idx) => ({ clan_id: data.clan_id, skill_id, position: idx }));
      const { error } = await supabaseAdmin.from("clan_skills").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ---------- ADMIN MANAGEMENT ---------- */

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,email,created_at").order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid(), role: z.enum(["admin","user"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId && data.role === "admin") {
      throw new Error("Você não pode remover seu próprio admin.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    return { ok: true };
  });

/* ---------- UPLOAD SIGNED URL ---------- */

export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    bucket: z.enum(["items","skills"]),
    path: z.string().min(1).max(200),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from(data.bucket).createSignedUploadUrl(data.path, { upsert: true });
    if (error) throw new Error(error.message);
    // 1-year signed read URL
    const { data: read } = await supabaseAdmin.storage.from(data.bucket).createSignedUrl(data.path, 60 * 60 * 24 * 365);
    return { uploadUrl: signed.signedUrl, token: signed.token, path: signed.path, readUrl: read?.signedUrl ?? null };
  });