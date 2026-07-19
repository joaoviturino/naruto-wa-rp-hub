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
const itemType = z.enum(["consumable","tool","material","armor_helmet","armor_vest","armor_pants","armor_boots","weapon","weapon_primary","weapon_secondary"]);
const villageEnum = z.enum(["konoha","suna","kiri","kumo","iwa","ame","kusa","taki","oto","yuki","hoshi","nomad"]);
const elementEnum = z.enum(["katon","suiton","fuuton","doton","raiton"]);
const skillClassEnum = z.enum([
  "genjutsu","ninjutsu","taijutsu","shinjutsu","selos_de_mao","armadilha","boujutsu","bukijutsu","bunshinjutsu",
  "doujutsu","fluxo_de_chakra","formacao","estilo_de_luta","fuuinjutsu","gijutsu","hiden","juinjutsu",
  "jujutsu","jutsu_basico","kaijutsu","kekkaijutsu","kekkei_genkai","kekkei_moura","kekkei_touta",
  "kenjutsu","kinjutsu","kinkojutsu","konbijutsu","kugutsujutsu","kyuuinjutsu","ninjutsu_espaco_tempo",
  "ninjutsu_medico","nintaijutsu","saiseijutsu","senjutsu","shurikenjutsu","tansakujutsu",
  "tenseijutsu","tonjutsu","yuugoujutsu",
]);

/** Proficiências por classe: cada classe tem Nível e Maestria em letras (E→S). */
const proficiencyEntry = z.object({
  nivel: skillRank.nullable().optional(),
  maestria: skillRank.nullable().optional(),
});
const proficienciesMap = z.record(skillClassEnum, proficiencyEntry);

/** Efeito reutilizável de restauração de energia (itens consumíveis e habilidades suplementares). */
const restoreEffect = z.object({
  pool: z.enum(["hp","ef","em","chakra","all"]),
  mode: z.enum(["flat","percent"]),
  amount: z.number().min(0).max(100000),
}).nullable().optional();
const metaSchema = z.object({
  restore: restoreEffect,
  recipe: z.array(z.object({
    item_id: z.string().uuid(),
    qty: z.number().int().min(1).max(999),
  })).nullable().optional(),
}).partial().passthrough().nullable().optional();

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
    // Limpa também as credenciais persistidas para forçar novo QR na próxima conexão.
    await supabaseAdmin.from("bot_auth_state").delete().eq("session_id", "default");
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

/** Restaura energias (ef/em/chakra) do personagem ao máximo derivado do xp. */
export const restoreEnergies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ character_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c, error: cErr } = await supabaseAdmin.from("characters").select("xp").eq("id", data.character_id).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Personagem não encontrado.");
    const xp = c.xp ?? 0;
    const half = Math.floor(xp / 2);
    const patch = { ef_current: half, em_current: xp - half, chakra_current: xp };
    const { error } = await supabaseAdmin.from("characters").update(patch).eq("id", data.character_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "restore_energies", target: data.character_id, meta: patch });
    return { ok: true, ...patch };
  });

/* ---------- PARTIES (admin) ---------- */

export const listParties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: parties } = await supabaseAdmin
      .from("parties")
      .select("id,leader_id,created_at,leader:characters!parties_leader_id_fkey(id,nickname,avatar_url)")
      .order("created_at", { ascending: false });
    const { data: members } = await supabaseAdmin
      .from("party_members")
      .select("party_id,joined_at,character:characters(id,nickname,avatar_url)");
    const byParty = new Map<string, any[]>();
    (members ?? []).forEach((m: any) => {
      const arr = byParty.get(m.party_id) ?? [];
      arr.push(m);
      byParty.set(m.party_id, arr);
    });
    return (parties ?? []).map((p: any) => ({ ...p, members: byParty.get(p.id) ?? [] }));
  });

export const listPartyInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("party_invites")
      .select("id,party_id,status,created_at,from:characters!party_invites_from_character_id_fkey(id,nickname,avatar_url),to:characters!party_invites_to_character_id_fkey(id,nickname,avatar_url)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const deleteParty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ party_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("parties").delete().eq("id", data.party_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "delete_party", target: data.party_id, meta: {} });
    return { ok: true };
  });

export const deletePartyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ invite_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("party_invites").delete().eq("id", data.invite_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reset total: apaga todos os invites e todas as parties (cascata remove membros). */
export const resetAllParties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    scope: z.enum(["invites","parties","all"]).default("all"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.scope === "invites" || data.scope === "all") {
      const { error } = await supabaseAdmin.from("party_invites").delete().not("id", "is", null);
      if (error) throw new Error(error.message);
    }
    if (data.scope === "parties" || data.scope === "all") {
      const { error } = await supabaseAdmin.from("parties").delete().not("id", "is", null);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "reset_parties", target: null, meta: { scope: data.scope } });
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

/** Admin: redefine a senha de qualquer jogador (para casos de esquecimento). */
export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      new_password: z.string().min(6).max(72),
    }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "reset_password", target: data.user_id, meta: {} });
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
    proficiencies: proficienciesMap.optional(),
    inventory_bg_url: z.string().url().nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    banner_url: z.string().url().nullable().optional(),
    eyes_frame_url: z.string().url().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { character_id, ...patch } = data;
    // Enforce element proficiency limit by rank (server-side).
    if (patch.proficiencies) {
      const ELEMENT_LIMIT: Record<string, number> = {
        estudante: 1, genin: 1, chunin: 2, tokubetsu_jonin: 3,
        jonin: 4, anbu: 5, sannin: 5, kage: 5,
      };
      const ELS = ["katon","suiton","fuuton","doton","raiton"] as const;
      let rank = patch.rank as string | undefined;
      if (!rank) {
        const { data: cur } = await supabaseAdmin.from("characters").select("rank").eq("id", character_id).maybeSingle();
        rank = (cur as any)?.rank ?? "estudante";
      }
      const limit = ELEMENT_LIMIT[rank!] ?? 1;
      const count = ELS.reduce((n, k) => {
        const e: any = (patch.proficiencies as any)[k];
        return n + (e && (e.nivel || e.maestria) ? 1 : 0);
      }, 0);
      if (count > limit) {
        throw new Error(`Esta patente permite apenas ${limit} elemento(s). Recebido ${count}.`);
      }
    }
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
  req_class: skillClassEnum.nullable().optional(),
  req_nivel: skillRank.nullable().optional(),
  req_maestria: skillRank.nullable().optional(),
  req_mission_id: z.string().uuid().nullable().optional(),
  req_skill_id: z.string().uuid().nullable().optional(),
  stackable: z.boolean().optional(),
  stack_limit: z.number().int().min(1).nullable().optional(),
  meta: metaSchema,
});

export const upsertItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => itemPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("items").upsert(data as any);
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
  animation_url: z.string().url().nullable().optional(),
  animation_mode: z.enum(["projectile","front","overlay"]).nullable().optional(),
  sound_url: z.string().url().nullable().optional(),
  req_rank: ninjaRank.nullable().optional(),
  req_class: skillClassEnum.nullable().optional(),
  req_nivel: skillRank.nullable().optional(),
  req_maestria: skillRank.nullable().optional(),
  req_mission_id: z.string().uuid().nullable().optional(),
  req_prereq_skill_id: z.string().uuid().nullable().optional(),
  energy_type: z.enum(["ef","em","chakra"]).default("chakra"),
  base_cost: z.number().int().min(0).max(100000).default(0),
  cost_percent: z.number().int().min(1).max(100).default(20),
  bonus_speed: z.number().min(0).max(100).default(1),
  bonus_critical: z.number().min(0).max(100).default(1),
  bonus_energetic: z.number().min(0).max(100).default(1),
  cooldown_turns: z.number().int().min(0).max(50).default(0),
  is_defensive: z.boolean().default(false),
  defense_percent: z.number().int().min(0).max(100).default(50),
  accuracy: z.number().int().min(1).max(100).default(100),
  meta: metaSchema,
});

export const upsertSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => skillPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("skills").upsert(data as any);
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
    description: z.string().max(4000).nullable().optional(),
    category: z.enum(["daily","common","special"]).default("daily"),
    reward_xp: z.number().int().min(0).default(0),
    reward_ryo: z.number().int().min(0).default(0),
    objectives: z.array(z.object({
      id: z.string().min(1),
      type: z.string(),
      target_id: z.string().nullable().optional(),
      target_ref: z.string().nullable().optional(),
      count: z.number().int().min(1).max(9999).default(1),
      description: z.string().max(400).nullable().optional(),
    })).default([]),
    rewards: z.any().optional(),
    requirements: z.any().optional(),
    cooldown_hours: z.number().int().min(0).max(24 * 365).default(24),
    repeatable: z.boolean().default(true),
    active: z.boolean().default(true),
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

/** Presenteia (ou remove) Ryo de um personagem. Use valor negativo para descontar. */
export const giftRyo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    character_id: z.string().uuid(),
    amount: z.number().int().min(-10000000).max(10000000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("characters").select("ryo").eq("id", data.character_id).maybeSingle();
    if (!c) throw new Error("Personagem não encontrado.");
    const next = Math.max(0, Number(c.ryo ?? 0) + data.amount);
    await supabaseAdmin.from("characters").update({ ryo: next }).eq("id", data.character_id);
    await supabaseAdmin.from("audit_log").insert({ admin_id: context.userId, action: "gift_ryo", target: data.character_id, meta: { amount: data.amount, new_balance: next } });
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

/* ---------- RESET PLAYER PROGRESS ---------- */

const EMPTY_INV = {
  ninja_bag: [] as any[],
  secondary_slots: [] as any[],
  helmet_id: null as string | null,
  vest_id: null as string | null,
  pants_id: null as string | null,
  boots_id: null as string | null,
  primary_weapon_id: null as string | null,
  secondary_weapon_id: null as string | null,
  primary_weapon_durability: null as number | null,
  secondary_weapon_durability: null as number | null,
};

/** Zera XP e/ou inventário de um jogador específico. */
export const resetPlayerProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    character_id: z.string().uuid(),
    resetXp: z.boolean().default(true),
    resetInventory: z.boolean().default(true),
    resetRyo: z.boolean().default(false),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.resetXp) {
      await supabaseAdmin.from("characters").update({ xp: 0 }).eq("id", data.character_id);
    }
    if (data.resetRyo) {
      await supabaseAdmin.from("characters").update({ ryo: 0 }).eq("id", data.character_id);
    }
    if (data.resetInventory) {
      await supabaseAdmin.from("inventory").update(EMPTY_INV).eq("character_id", data.character_id);
    }
    await supabaseAdmin.from("audit_log").insert({
      admin_id: context.userId, action: "reset_player", target: data.character_id,
      meta: { xp: data.resetXp, inventory: data.resetInventory, ryo: data.resetRyo },
    });
    return { ok: true };
  });

/** Zera XP e/ou inventário de TODOS os jogadores. Operação destrutiva. */
export const resetAllPlayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    resetXp: z.boolean().default(true),
    resetInventory: z.boolean().default(true),
    resetRyo: z.boolean().default(false),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.resetXp && !data.resetInventory && !data.resetRyo) return { ok: true, affected: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let affected = 0;
    if (data.resetXp) {
      const { count } = await supabaseAdmin.from("characters").update({ xp: 0 }, { count: "exact" }).gt("xp", -1);
      affected = Math.max(affected, count ?? 0);
    }
    if (data.resetRyo) {
      const { count } = await supabaseAdmin.from("characters").update({ ryo: 0 }, { count: "exact" }).gt("ryo", -1);
      affected = Math.max(affected, count ?? 0);
    }
    if (data.resetInventory) {
      const { count } = await supabaseAdmin.from("inventory").update(EMPTY_INV, { count: "exact" }).not("character_id", "is", null);
      affected = Math.max(affected, count ?? 0);
    }
    await supabaseAdmin.from("audit_log").insert({
      admin_id: context.userId, action: "reset_all_players", target: null,
      meta: { xp: data.resetXp, inventory: data.resetInventory, ryo: data.resetRyo, affected },
    });
    return { ok: true, affected };
  });
/** Teletransporta todos os jogadores para um local (opcionalmente exceto admins). */
export const teleportAllPlayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    locationId: z.string().uuid(),
    excludeAdmins: z.boolean().optional().default(true),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: loc, error: lErr } = await supabaseAdmin.from("locations").select("id,name").eq("id", data.locationId).maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (!loc) throw new Error("Local não encontrado.");
    let excludedIds: string[] = [];
    if (data.excludeAdmins) {
      const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
      excludedIds = (admins ?? []).map((r: any) => r.user_id);
    }
    let q = supabaseAdmin.from("characters").update({
      current_location_id: data.locationId,
      location_entered_at: new Date().toISOString(),
      last_spawn_roll_at: null,
    }, { count: "exact" });
    if (excludedIds.length > 0) q = q.not("user_id", "in", `(${excludedIds.join(",")})`);
    else q = q.not("id", "is", null);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      admin_id: context.userId, action: "teleport_all", target: data.locationId,
      meta: { location_name: (loc as any).name, affected: count, exclude_admins: data.excludeAdmins },
    });
    return { ok: true, affected: count ?? 0 };
  });

/** Liga/desliga a trava global do chat local. */
export const setChatLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ locked: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("server_config").update({
      chat_locked: data.locked, updated_at: new Date().toISOString(),
    }).eq("id", "main");
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      admin_id: context.userId, action: "chat_lock", target: null, meta: { locked: data.locked },
    });
    return { ok: true };
  });

/**
 * Emite um prêmio global para todos os personagens.
 * kind = xp | ryo | skill | item. Cada personagem só recebe uma vez (idempotente).
 * Reexecutar aplica apenas a personagens que ainda não receberam (útil para novos jogadores).
 */
export const issueGlobalReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    reward_id: z.string().uuid().optional(),
    kind: z.enum(["xp","ryo","skill","item"]),
    amount: z.number().int().min(1).max(1_000_000).optional(),
    skill_id: z.string().uuid().optional(),
    item_id: z.string().uuid().optional(),
    note: z.string().max(200).optional(),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
    requirements: z.object({
      min_rank: z.string().optional(),
      min_xp: z.number().int().min(0).optional(),
      clan_id: z.string().uuid().nullable().optional(),
    }).partial().optional(),
    schedule_only: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validação por tipo.
    if ((data.kind === "xp" || data.kind === "ryo") && (!data.amount || data.amount <= 0)) {
      throw new Error("Informe uma quantidade válida.");
    }
    if (data.kind === "skill" && !data.skill_id) throw new Error("Selecione uma habilidade.");
    if (data.kind === "item" && !data.item_id) throw new Error("Selecione um item.");

    // Obtém/cria o registro do prêmio.
    let rewardId = data.reward_id ?? "";
    if (!rewardId) {
      const { data: created, error: cErr } = await supabaseAdmin.from("global_rewards").insert({
        kind: data.kind,
        amount: data.amount ?? null,
        skill_id: data.skill_id ?? null,
        item_id: data.item_id ?? null,
        note: data.note ?? null,
        created_by: context.userId,
        starts_at: data.starts_at ?? null,
        ends_at: data.ends_at ?? null,
        requirements: data.requirements ?? {},
        active: true,
      }).select("id").single();
      if (cErr) throw new Error(cErr.message);
      rewardId = (created as any).id as string;
    }

    // Modo agendado: cria o registro mas não aplica agora — o heartbeat dos jogadores elegíveis fará o claim.
    if (data.schedule_only) {
      await supabaseAdmin.from("audit_log").insert({
        admin_id: context.userId, action: "global_reward_scheduled", target: rewardId,
        meta: { kind: data.kind, starts_at: data.starts_at, ends_at: data.ends_at, requirements: data.requirements },
      });
      return { ok: true, reward_id: rewardId, scheduled: true, applied: 0, skipped: 0, total_targets: 0 };
    }

    // Personagens que ainda não receberam.
    const { data: chars, error: chErr } = await supabaseAdmin
      .from("characters").select("id, xp, ryo");
    if (chErr) throw new Error(chErr.message);
    const allChars = (chars ?? []) as { id: string; xp: number | null; ryo: number | null }[];

    const { data: claimedRows } = await supabaseAdmin
      .from("global_reward_claims").select("character_id").eq("reward_id", rewardId);
    const claimed = new Set(((claimedRows ?? []) as any[]).map((r) => r.character_id as string));
    const targets = allChars.filter((c) => !claimed.has(c.id));

    let applied = 0;
    let skipped = 0;

    for (const ch of targets) {
      try {
        if (data.kind === "xp") {
          const next = (ch.xp ?? 0) + (data.amount ?? 0);
          const { error } = await supabaseAdmin.from("characters").update({ xp: next }).eq("id", ch.id);
          if (error) throw error;
        } else if (data.kind === "ryo") {
          const next = (ch.ryo ?? 0) + (data.amount ?? 0);
          const { error } = await supabaseAdmin.from("characters").update({ ryo: next }).eq("id", ch.id);
          if (error) throw error;
        } else if (data.kind === "skill") {
          // Já possui? pula sem consumir claim (personagem ganha o registro do prêmio mesmo assim).
          const { data: has } = await supabaseAdmin.from("character_skills")
            .select("character_id").eq("character_id", ch.id).eq("skill_id", data.skill_id!).maybeSingle();
          if (!has) {
            const { error } = await supabaseAdmin.from("character_skills")
              .insert({ character_id: ch.id, skill_id: data.skill_id! });
            if (error) throw error;
          } else {
            skipped++;
          }
        } else if (data.kind === "item") {
          const { data: inv } = await supabaseAdmin.from("inventory")
            .select("ninja_bag").eq("character_id", ch.id).maybeSingle();
          if (!inv) { skipped++; continue; }
          const bag = (((inv as any).ninja_bag as any[]) ?? [])
            .filter((e: any) => e && e.item_id)
            .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
          const has = bag.some((e: any) => e.item_id === data.item_id);
          if (has) { skipped++; }
          else {
            bag.push({ item_id: data.item_id, qty: 1 });
            const { error } = await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", ch.id);
            if (error) throw error;
          }
        }
        // Marca como reivindicado (mesmo que "skipped" — o prêmio está registrado no histórico do personagem).
        await supabaseAdmin.from("global_reward_claims").insert({ reward_id: rewardId, character_id: ch.id });
        applied++;
      } catch (_e) {
        // Continua no próximo personagem.
      }
    }

    await supabaseAdmin.from("audit_log").insert({
      admin_id: context.userId, action: "global_reward", target: rewardId,
      meta: { kind: data.kind, applied, skipped, note: data.note ?? null },
    });
    return { ok: true, reward_id: rewardId, applied, skipped, total_targets: targets.length };
  });

/** Lista prêmios globais emitidos (histórico). */
export const listGlobalRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rewards, error } = await supabaseAdmin
      .from("global_rewards")
      .select("id, kind, amount, skill_id, item_id, note, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const list = (rewards ?? []) as any[];
    if (list.length === 0) return { rewards: [] };
    const ids = list.map((r) => r.id);
    const { data: claims } = await supabaseAdmin
      .from("global_reward_claims").select("reward_id").in("reward_id", ids);
    const counts: Record<string, number> = {};
    for (const c of (claims ?? []) as any[]) counts[c.reward_id] = (counts[c.reward_id] ?? 0) + 1;
    return { rewards: list.map((r) => ({ ...r, claim_count: counts[r.id] ?? 0 })) };
  });

/** Reaplica um prêmio já emitido a personagens que ainda não receberam (idempotente). */
export const reapplyGlobalReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ reward_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin
      .from("global_rewards").select("*").eq("id", data.reward_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("Prêmio não encontrado.");
    const rr = r as any;
    const { data: chars } = await supabaseAdmin.from("characters").select("id, xp, ryo");
    const allChars = (chars ?? []) as { id: string; xp: number | null; ryo: number | null }[];
    const { data: claimedRows } = await supabaseAdmin
      .from("global_reward_claims").select("character_id").eq("reward_id", rr.id);
    const claimed = new Set(((claimedRows ?? []) as any[]).map((c) => c.character_id as string));
    const targets = allChars.filter((c) => !claimed.has(c.id));
    let applied = 0, skipped = 0;
    for (const ch of targets) {
      try {
        if (rr.kind === "xp") {
          await supabaseAdmin.from("characters").update({ xp: (ch.xp ?? 0) + (rr.amount ?? 0) }).eq("id", ch.id);
        } else if (rr.kind === "ryo") {
          await supabaseAdmin.from("characters").update({ ryo: (ch.ryo ?? 0) + (rr.amount ?? 0) }).eq("id", ch.id);
        } else if (rr.kind === "skill") {
          const { data: has } = await supabaseAdmin.from("character_skills")
            .select("character_id").eq("character_id", ch.id).eq("skill_id", rr.skill_id).maybeSingle();
          if (!has) await supabaseAdmin.from("character_skills").insert({ character_id: ch.id, skill_id: rr.skill_id });
          else skipped++;
        } else if (rr.kind === "item") {
          const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", ch.id).maybeSingle();
          if (!inv) { skipped++; continue; }
          const bag = (((inv as any).ninja_bag as any[]) ?? [])
            .filter((e: any) => e && e.item_id)
            .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
          const has = bag.some((e: any) => e.item_id === rr.item_id);
          if (has) skipped++;
          else {
            bag.push({ item_id: rr.item_id, qty: 1 });
            await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", ch.id);
          }
        }
        await supabaseAdmin.from("global_reward_claims").insert({ reward_id: rr.id, character_id: ch.id });
        applied++;
      } catch { /* segue */ }
    }
    await supabaseAdmin.from("audit_log").insert({
      admin_id: context.userId, action: "global_reward_reapply", target: rr.id,
      meta: { kind: rr.kind, applied, skipped },
    });
    return { ok: true, reward_id: rr.id, applied, skipped, total_targets: targets.length };
  });

/** Apaga um prêmio global do histórico (não reverte aplicações). */
export const deleteGlobalReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ reward_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("global_rewards").delete().eq("id", data.reward_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- STARTER KIT (kit inicial dado a novos personagens) ---------- */

const starterKitSchema = z.object({
  xp: z.number().int().min(0).max(1_000_000).optional(),
  ryo: z.number().int().min(0).max(1_000_000_000).optional(),
  items: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(999) })).max(20).optional(),
  skills: z.array(z.string().uuid()).max(20).optional(),
});

export const saveStarterKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ kit: starterKitSchema }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("server_config").update({
      starter_kit: data.kit, updated_at: new Date().toISOString(),
    }).eq("id", "main");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Aplica o kit atual a um personagem específico (admin — usado no editor para retroativos). */
export const applyStarterKitToPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("server_config").select("starter_kit").eq("id", "main").maybeSingle();
    const kit = ((cfg as any)?.starter_kit ?? {}) as z.infer<typeof starterKitSchema>;
    await applyKitInternal(supabaseAdmin, data.character_id, kit);
    return { ok: true };
  });

// Util reutilizável (também importado por character.functions.ts).
export async function applyKitInternal(admin: any, characterId: string, kit: any) {
  if (!kit || typeof kit !== "object") return;
  const patch: any = {};
  if (typeof kit.xp === "number" && kit.xp > 0) {
    const { data: c } = await admin.from("characters").select("xp,ryo").eq("id", characterId).maybeSingle();
    patch.xp = ((c as any)?.xp ?? 0) + kit.xp;
    if (typeof kit.ryo === "number" && kit.ryo > 0) patch.ryo = ((c as any)?.ryo ?? 0) + kit.ryo;
  } else if (typeof kit.ryo === "number" && kit.ryo > 0) {
    const { data: c } = await admin.from("characters").select("ryo").eq("id", characterId).maybeSingle();
    patch.ryo = ((c as any)?.ryo ?? 0) + kit.ryo;
  }
  if (Object.keys(patch).length > 0) {
    await admin.from("characters").update(patch).eq("id", characterId);
  }
  if (Array.isArray(kit.items) && kit.items.length > 0) {
    const { data: inv } = await admin.from("inventory").select("ninja_bag").eq("character_id", characterId).maybeSingle();
    let bag = (((inv as any)?.ninja_bag as any[]) ?? [])
      .filter((e: any) => e && e.item_id)
      .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
    for (const it of kit.items) {
      const idx = bag.findIndex((e: any) => e.item_id === it.item_id);
      if (idx === -1) bag.push({ item_id: it.item_id, qty: it.qty });
      else bag[idx].qty += it.qty;
    }
    await admin.from("inventory").update({ ninja_bag: bag }).eq("character_id", characterId);
  }
  if (Array.isArray(kit.skills) && kit.skills.length > 0) {
    for (const sid of kit.skills) {
      const { data: has } = await admin.from("character_skills")
        .select("character_id").eq("character_id", characterId).eq("skill_id", sid).maybeSingle();
      if (!has) await admin.from("character_skills").insert({ character_id: characterId, skill_id: sid });
    }
  }
}
