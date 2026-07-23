import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["lider", "vice", "anciao", "elite", "membro"] as const;
export type ClanRole = (typeof ROLES)[number];

async function isAdminOrMod(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_admin_or_mod", { _user_id: context.userId });
  return !!data;
}

/** Lista membros do clã do caller (ou de qualquer clã se admin/mod passar clan_id). */
export const getClanMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clan_id: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let clanId = data.clan_id ?? null;
    if (!clanId) {
      const { data: me } = await context.supabase
        .from("characters").select("clan_id").eq("user_id", context.userId).maybeSingle();
      clanId = me?.clan_id ?? null;
    }
    if (!clanId) return { clan: null, members: [], my_role: null, is_leader: false, can_manage: false };

    const [{ data: clan }, { data: members }, { data: mine }] = await Promise.all([
      context.supabase.from("clans").select("id,name,village").eq("id", clanId).maybeSingle(),
      context.supabase.from("characters")
        .select("id,user_id,nickname,rank,xp,avatar_url,clan_role")
        .eq("clan_id", clanId).order("clan_role", { ascending: true }).order("xp", { ascending: false }),
      context.supabase.from("characters")
        .select("id,clan_id,clan_role").eq("user_id", context.userId).maybeSingle(),
    ]);

    const adminMod = await isAdminOrMod(context);
    const isLeader = mine?.clan_id === clanId && mine?.clan_role === "lider";
    return {
      clan, members: members ?? [],
      my_id: mine?.id ?? null,
      my_role: mine?.clan_id === clanId ? mine?.clan_role ?? null : null,
      is_leader: isLeader,
      can_manage: isLeader || adminMod,
      is_admin_mod: adminMod,
    };
  });

/** Líder define papel de outro membro (não pode criar/remover 'lider'). Admin/mod pode qualquer papel. */
export const setClanRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ character_id: z.string().uuid(), role: z.enum(ROLES) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: target } = await context.supabase
      .from("characters").select("id,clan_id,clan_role,user_id").eq("id", data.character_id).maybeSingle();
    if (!target?.clan_id) throw new Error("Personagem não pertence a um clã.");

    const adminMod = await isAdminOrMod(context);
    const { data: me } = await context.supabase
      .from("characters").select("id,clan_id,clan_role").eq("user_id", context.userId).maybeSingle();
    const isLeader = me?.clan_id === target.clan_id && me?.clan_role === "lider";

    if (!adminMod && !isLeader) throw new Error("Sem permissão.");
    if (!adminMod) {
      if (data.role === "lider") throw new Error("Apenas um admin pode transferir a liderança.");
      if (target.clan_role === "lider") throw new Error("Você não pode rebaixar o líder.");
      if (target.id === me?.id) throw new Error("Você não pode alterar seu próprio papel.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Transferência de liderança: rebaixa o antigo líder para 'vice'.
    if (data.role === "lider") {
      const { data: current } = await supabaseAdmin.from("characters")
        .select("id").eq("clan_id", target.clan_id).eq("clan_role", "lider").maybeSingle();
      if (current?.id && current.id !== target.id) {
        await supabaseAdmin.from("characters").update({ clan_role: "vice" }).eq("id", current.id);
      }
    }
    const { error } = await supabaseAdmin.from("characters")
      .update({ clan_role: data.role }).eq("id", data.character_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Expulsa membro do clã. Líder pode expulsar qualquer não-líder; admin/mod pode expulsar qualquer um. */
export const kickFromClan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ character_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: target } = await context.supabase
      .from("characters").select("id,clan_id,clan_role").eq("id", data.character_id).maybeSingle();
    if (!target?.clan_id) throw new Error("Personagem não pertence a um clã.");

    const adminMod = await isAdminOrMod(context);
    const { data: me } = await context.supabase
      .from("characters").select("id,clan_id,clan_role").eq("user_id", context.userId).maybeSingle();
    const isLeader = me?.clan_id === target.clan_id && me?.clan_role === "lider";

    if (!adminMod && !isLeader) throw new Error("Sem permissão.");
    if (target.clan_role === "lider" && !adminMod) throw new Error("Você não pode expulsar o líder.");
    if (target.id === me?.id) throw new Error("Você não pode se expulsar. Use 'Sair do clã'.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("characters")
      .update({ clan_id: null, clan_role: "membro" }).eq("id", data.character_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Membro sai voluntariamente do próprio clã. Líder não pode sair sem transferir antes. */
export const leaveClan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: me } = await context.supabase
      .from("characters").select("id,clan_id,clan_role").eq("user_id", context.userId).maybeSingle();
    if (!me?.clan_id) throw new Error("Você não está em um clã.");
    if (me.clan_role === "lider") throw new Error("Transfira a liderança antes de sair.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("characters")
      .update({ clan_id: null, clan_role: "membro" }).eq("id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ADMIN: define o líder de um clã (transferindo a liderança se já houver um). */
export const adminSetClanLeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ clan_id: z.string().uuid(), character_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isAdminOrMod(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("characters")
      .select("id,clan_id").eq("id", data.character_id).maybeSingle();
    if (!target) throw new Error("Personagem inexistente.");
    if (target.clan_id !== data.clan_id) {
      await supabaseAdmin.from("characters").update({ clan_id: data.clan_id }).eq("id", data.character_id);
    }
    const { data: current } = await supabaseAdmin.from("characters")
      .select("id").eq("clan_id", data.clan_id).eq("clan_role", "lider").maybeSingle();
    if (current?.id && current.id !== data.character_id) {
      await supabaseAdmin.from("characters").update({ clan_role: "vice" }).eq("id", current.id);
    }
    const { error } = await supabaseAdmin.from("characters")
      .update({ clan_role: "lider" }).eq("id", data.character_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const CLAN_ROLE_META: Record<ClanRole, { label: string; color: string; order: number }> = {
  lider:  { label: "Líder",       color: "text-amber-400",   order: 0 },
  vice:   { label: "Vice-líder",  color: "text-orange-300",  order: 1 },
  anciao: { label: "Ancião",      color: "text-purple-300",  order: 2 },
  elite:  { label: "Elite",       color: "text-emerald-300", order: 3 },
  membro: { label: "Membro",      color: "text-slate-300",   order: 4 },
};