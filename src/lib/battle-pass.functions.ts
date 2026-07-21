import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function getActiveCharacter(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("characters").select("id, ryo, xp").eq("user_id", context.userId).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Personagem não encontrado.");
  return data;
}

// ---------- LIST ----------
export const listSeasons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("battle_pass_seasons").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- UPSERT SEASON ----------
const seasonPayload = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(2000).nullable().optional(),
  banner_url: z.string().url().nullable().optional(),
  starts_at: z.string().min(1),
  ends_at: z.string().nullable().optional(),
  xp_per_tier: z.number().int().min(1),
  tiers_count: z.number().int().min(1).max(200),
  premium_cost: z.number().int().min(0),
  active: z.boolean().default(false),
});

export const upsertSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => seasonPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // If setting active=true, deactivate other seasons first
    if (data.active) {
      await supabaseAdmin.from("battle_pass_seasons").update({ active: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const payload = { ...data, ends_at: data.ends_at || null };
    if (data.id) {
      const { error } = await supabaseAdmin.from("battle_pass_seasons").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("battle_pass_seasons").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("battle_pass_seasons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- REWARDS ----------
export const listRewards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ season_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("battle_pass_rewards")
      .select("*, item:items(id,name,image_url)")
      .eq("season_id", data.season_id)
      .order("tier", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const rewardPayload = z.object({
  id: z.string().uuid().optional(),
  season_id: z.string().uuid(),
  tier: z.number().int().min(1).max(200),
  track: z.enum(["free","premium"]),
  reward_type: z.enum(["item","ryo","xp","title"]),
  item_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  title: z.string().max(80).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
});

export const upsertReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => rewardPayload.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data };
    if (payload.reward_type !== "item") payload.item_id = null;
    if (payload.reward_type !== "title") payload.title = null;
    // Upsert on (season_id, tier, track)
    const { error } = await supabaseAdmin.from("battle_pass_rewards").upsert(payload, { onConflict: "season_id,tier,track" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("battle_pass_rewards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PLAYER VIEW ----------
export const getMyBattlePass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const char = await getActiveCharacter(context);
    const { data: season, error: sErr } = await context.supabase
      .from("battle_pass_seasons").select("*").eq("active", true).limit(1).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!season) return { season: null, character: char };
    const [{ data: rewards }, { data: progress }, { data: claims }] = await Promise.all([
      context.supabase.from("battle_pass_rewards").select("*, item:items(id,name,image_url)").eq("season_id", season.id).order("tier"),
      context.supabase.from("battle_pass_progress").select("*").eq("season_id", season.id).eq("character_id", char.id).maybeSingle(),
      context.supabase.from("battle_pass_claims").select("tier,track").eq("season_id", season.id).eq("character_id", char.id),
    ]);
    return {
      season,
      character: char,
      rewards: rewards ?? [],
      progress: progress ?? { xp: 0, is_premium: false },
      claims: claims ?? [],
    };
  });

// ---------- BUY PREMIUM ----------
export const buyBattlePassPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const char = await getActiveCharacter(context);
    const { data: season, error: sErr } = await context.supabase.from("battle_pass_seasons").select("*").eq("active", true).limit(1).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!season) throw new Error("Nenhuma temporada ativa.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prog } = await supabaseAdmin.from("battle_pass_progress").select("*").eq("season_id", season.id).eq("character_id", char.id).maybeSingle();
    if (prog?.is_premium) throw new Error("Você já tem o Premium desta temporada.");
    if ((char.ryo ?? 0) < season.premium_cost) throw new Error(`Ryō insuficiente. Necessário: ${season.premium_cost}.`);
    await supabaseAdmin.from("characters").update({ ryo: (char.ryo ?? 0) - season.premium_cost }).eq("id", char.id);
    if (prog) {
      await supabaseAdmin.from("battle_pass_progress").update({ is_premium: true }).eq("id", prog.id);
    } else {
      await supabaseAdmin.from("battle_pass_progress").insert({ character_id: char.id, season_id: season.id, xp: 0, is_premium: true });
    }
    return { ok: true };
  });

// ---------- CLAIM REWARD ----------
export const claimBattlePassReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tier: z.number().int().min(1), track: z.enum(["free","premium"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const char = await getActiveCharacter(context);
    const { data: season, error: sErr } = await context.supabase.from("battle_pass_seasons").select("*").eq("active", true).limit(1).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!season) throw new Error("Nenhuma temporada ativa.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: prog }, { data: reward }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("battle_pass_progress").select("*").eq("season_id", season.id).eq("character_id", char.id).maybeSingle(),
      supabaseAdmin.from("battle_pass_rewards").select("*").eq("season_id", season.id).eq("tier", data.tier).eq("track", data.track).maybeSingle(),
      supabaseAdmin.from("battle_pass_claims").select("tier").eq("season_id", season.id).eq("character_id", char.id).eq("tier", data.tier).eq("track", data.track).maybeSingle(),
    ]);
    if (!reward) throw new Error("Recompensa não encontrada.");
    if (existing) throw new Error("Você já resgatou esta recompensa.");
    const currentTier = Math.floor(((prog?.xp ?? 0)) / season.xp_per_tier);
    if (data.tier > currentTier) throw new Error("Você ainda não atingiu esse nível.");
    if (data.track === "premium" && !prog?.is_premium) throw new Error("Precisa do Premium para resgatar esta recompensa.");

    // Apply reward
    if (reward.reward_type === "ryo") {
      await supabaseAdmin.from("characters").update({ ryo: (char.ryo ?? 0) + (reward.quantity ?? 0) }).eq("id", char.id);
    } else if (reward.reward_type === "xp") {
      await supabaseAdmin.from("characters").update({ xp: (char.xp ?? 0) + (reward.quantity ?? 0) }).eq("id", char.id);
    } else if (reward.reward_type === "item" && reward.item_id) {
      // Insert into inventory
      await supabaseAdmin.from("inventory").insert({ character_id: char.id, item_id: reward.item_id, quantity: reward.quantity ?? 1 } as any);
    }
    // title reward: store in claims as-is (client can render)
    await supabaseAdmin.from("battle_pass_claims").insert({ character_id: char.id, season_id: season.id, tier: data.tier, track: data.track } as any);
    return { ok: true };
  });

// ---------- ADMIN GRANT XP ----------
export const grantBattlePassXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid(), amount: z.number().int() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: season } = await supabaseAdmin.from("battle_pass_seasons").select("id").eq("active", true).limit(1).maybeSingle();
    if (!season) throw new Error("Nenhuma temporada ativa.");
    const { data: prog } = await supabaseAdmin.from("battle_pass_progress").select("*")
      .eq("season_id", season.id).eq("character_id", data.character_id).maybeSingle();
    if (prog) {
      await supabaseAdmin.from("battle_pass_progress").update({ xp: Math.max(0, (prog.xp ?? 0) + data.amount) }).eq("id", prog.id);
    } else {
      await supabaseAdmin.from("battle_pass_progress").insert({ character_id: data.character_id, season_id: season.id, xp: Math.max(0, data.amount) } as any);
    }
    return { ok: true };
  });