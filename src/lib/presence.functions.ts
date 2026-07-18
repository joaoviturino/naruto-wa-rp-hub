import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Heartbeat: player pings every ~30s so admin can see who's online and where. */
export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ status: z.enum(["idle", "combat", "travel", "chat"]).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase
      .from("characters")
      .select("id, current_location_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!char) return { ok: false, reason: "no_character" };

    const now = new Date().toISOString();
    await context.supabase.from("character_presence").upsert({
      character_id: (char as any).id,
      user_id: context.userId,
      current_location_id: (char as any).current_location_id,
      status: data.status ?? "idle",
      last_seen: now,
      updated_at: now,
    });

    // Auto-claim de recompensas globais elegíveis (agendamento + requisitos).
    const { data: fullChar } = await context.supabase
      .from("characters").select("id,rank,xp,clan_id").eq("id", (char as any).id).maybeSingle();
    if (!fullChar) return { ok: true, claimed: [] };

    const { data: rewards } = await context.supabase
      .from("global_rewards")
      .select("id,kind,amount,skill_id,item_id,note,starts_at,ends_at,requirements,active");
    const activeRewards = ((rewards ?? []) as any[]).filter((r) => {
      if (r.active === false) return false;
      if (r.starts_at && new Date(r.starts_at).getTime() > Date.now()) return false;
      if (r.ends_at && new Date(r.ends_at).getTime() < Date.now()) return false;
      const req = r.requirements ?? {};
      const RANK_ORDER = ["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"];
      if (req.min_rank) {
        if (RANK_ORDER.indexOf((fullChar as any).rank) < RANK_ORDER.indexOf(req.min_rank)) return false;
      }
      if (req.min_xp != null && ((fullChar as any).xp ?? 0) < req.min_xp) return false;
      if (req.clan_id && (fullChar as any).clan_id !== req.clan_id) return false;
      return true;
    });
    if (activeRewards.length === 0) return { ok: true, claimed: [] };

    const ids = activeRewards.map((r) => r.id);
    const { data: claimedRows } = await context.supabase
      .from("global_reward_claims").select("reward_id,seen")
      .eq("character_id", (fullChar as any).id).in("reward_id", ids);
    const alreadyClaimed = new Set(((claimedRows ?? []) as any[]).map((c) => c.reward_id));
    const pending = activeRewards.filter((r) => !alreadyClaimed.has(r.id));
    if (pending.length === 0) {
      // Também retorna claims não vistos (para exibir popup em outra sessão).
      const unseen = ((claimedRows ?? []) as any[]).filter((c) => c.seen === false);
      if (unseen.length === 0) return { ok: true, claimed: [] };
      const unseenRewards = activeRewards.filter((r) => unseen.some((u) => u.reward_id === r.id));
      return { ok: true, claimed: unseenRewards };
    }

    // Aplicar. Usa admin client para transpor RLS estrita.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const applied: any[] = [];
    for (const r of pending) {
      try {
        if (r.kind === "xp") {
          await supabaseAdmin.from("characters").update({ xp: ((fullChar as any).xp ?? 0) + (r.amount ?? 0) }).eq("id", (fullChar as any).id);
        } else if (r.kind === "ryo") {
          const { data: cc } = await supabaseAdmin.from("characters").select("ryo").eq("id", (fullChar as any).id).maybeSingle();
          const cur = (cc as any)?.ryo ?? 0;
          await supabaseAdmin.from("characters").update({ ryo: cur + (r.amount ?? 0) }).eq("id", (fullChar as any).id);
        } else if (r.kind === "skill" && r.skill_id) {
          const { data: has } = await supabaseAdmin.from("character_skills")
            .select("character_id").eq("character_id", (fullChar as any).id).eq("skill_id", r.skill_id).maybeSingle();
          if (!has) await supabaseAdmin.from("character_skills").insert({ character_id: (fullChar as any).id, skill_id: r.skill_id });
        } else if (r.kind === "item" && r.item_id) {
          const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", (fullChar as any).id).maybeSingle();
          const bag = (((inv as any)?.ninja_bag as any[]) ?? [])
            .filter((e: any) => e && e.item_id)
            .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
          const has = bag.some((e: any) => e.item_id === r.item_id);
          if (!has) {
            bag.push({ item_id: r.item_id, qty: 1 });
            await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", (fullChar as any).id);
          }
        }
        await supabaseAdmin.from("global_reward_claims").insert({ reward_id: r.id, character_id: (fullChar as any).id, seen: false });
        applied.push(r);
      } catch { /* segue */ }
    }
    return { ok: true, claimed: applied };
  });

/** Marca uma lista de claims como vistos (para não mostrar o popup de novo). */
export const markRewardsSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ reward_ids: z.array(z.string().uuid()).min(1).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: char } = await context.supabase.from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (!char) throw new Error("Personagem não encontrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("global_reward_claims")
      .update({ seen: true })
      .eq("character_id", (char as any).id)
      .in("reward_id", data.reward_ids);
    return { ok: true };
  });

/** Admin — visão geral em tempo real. */
export const adminPresenceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("character_presence")
      .select("character_id,current_location_id,status,last_seen,character:characters!character_presence_character_id_fkey(id,nickname,avatar_url,rank,village),location:locations!character_presence_current_location_id_fkey(id,name,image_url,map_x,map_y)")
      .gte("last_seen", cutoff)
      .order("last_seen", { ascending: false });
    const players = (rows ?? []) as any[];
    const perLocation: Record<string, { location_id: string; name: string; count: number }> = {};
    for (const p of players) {
      const loc = p.location;
      if (!loc) continue;
      perLocation[loc.id] = perLocation[loc.id] ?? { location_id: loc.id, name: loc.name, count: 0 };
      perLocation[loc.id].count += 1;
    }
    const inCombat = players.filter((p) => p.status === "combat").length;
    const inTravel = players.filter((p) => p.status === "travel").length;
    return {
      total: players.length,
      in_combat: inCombat,
      in_travel: inTravel,
      per_location: Object.values(perLocation).sort((a, b) => b.count - a.count),
      players,
    };
  });

/** Admin — teleporta um único jogador a um local. */
export const adminTeleportPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ character_id: z.string().uuid(), location_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("characters")
      .update({ current_location_id: data.location_id, location_entered_at: new Date().toISOString() })
      .eq("id", data.character_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      admin_id: context.userId, action: "teleport_player",
      target: data.character_id, meta: { location_id: data.location_id },
    });
    return { ok: true };
  });

/** Lista pública de jogadores online (últimos 2 min). Retorna dados mínimos e não-sensíveis. */
export const listOnlinePlayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: rows } = await context.supabase
      .from("character_presence")
      .select("character_id,status,last_seen,character:characters!character_presence_character_id_fkey(id,nickname,avatar_url,rank),location:locations!character_presence_current_location_id_fkey(id,name)")
      .gte("last_seen", cutoff)
      .order("last_seen", { ascending: false });
    const players = (rows ?? []) as any[];
    return { total: players.length, players };
  });
