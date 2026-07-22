import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function loadMyChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters").select("id,current_location_id").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data;
}

/** Admin: cria/atualiza baú de um NPC comprador. */
export const upsertNpcChest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    npc_id: z.string().uuid(),
    capacity: z.number().int().min(1).max(10_000).default(100),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: npc } = await supabaseAdmin.from("npcs").select("kind").eq("id", data.npc_id).maybeSingle();
    if (!npc || (npc as any).kind !== "buyer") throw new Error("Baús só são vinculados a NPCs compradores.");
    const { data: existing } = await supabaseAdmin.from("npc_chests").select("id").eq("npc_id", data.npc_id).maybeSingle();
    if (existing) {
      await supabaseAdmin.from("npc_chests").update({ capacity: data.capacity }).eq("id", (existing as any).id);
      return { id: (existing as any).id };
    }
    const { data: row, error } = await supabaseAdmin.from("npc_chests")
      .insert({ npc_id: data.npc_id, capacity: data.capacity }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Admin: remove baú (e todas as permissões). */
export const deleteNpcChest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ chest_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("npc_chests").delete().eq("id", data.chest_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: substitui a lista de dono + autorizados de um baú. */
export const setChestPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    chest_id: z.string().uuid(),
    owner_character_id: z.string().uuid().nullish(),
    authorized_character_ids: z.array(z.string().uuid()).default([]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("chest_permissions").delete().eq("chest_id", data.chest_id);
    const rows: any[] = [];
    if (data.owner_character_id) rows.push({ chest_id: data.chest_id, character_id: data.owner_character_id, is_owner: true });
    for (const cid of data.authorized_character_ids) {
      if (cid === data.owner_character_id) continue;
      rows.push({ chest_id: data.chest_id, character_id: cid, is_owner: false });
    }
    if (rows.length) {
      const { error } = await supabaseAdmin.from("chest_permissions").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Admin: lista todos os baús com dono/autorizados (para o admin panel). */
export const adminListChests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrMod(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: chests } = await supabaseAdmin.from("npc_chests")
      .select("id,npc_id,capacity,contents,npc:npcs(id,name,kind)");
    const { data: perms } = await supabaseAdmin.from("chest_permissions")
      .select("chest_id,character_id,is_owner,character:characters(id,nickname)");
    return { chests: chests ?? [], permissions: perms ?? [] };
  });

/** Player: baús a que ele tem acesso e que estão no local atual (para exibir botão "Acessar baú"). */
export const listMyAccessibleChestsHere = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await loadMyChar(context);
    if (!me.current_location_id) return { chests: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // NPCs no local
    const { data: ln } = await supabaseAdmin.from("location_npcs")
      .select("npc_id").eq("location_id", me.current_location_id);
    const npcIds = ((ln as any[]) ?? []).map((r) => r.npc_id);
    if (!npcIds.length) return { chests: [] };
    // Baús desses NPCs
    const { data: chests } = await supabaseAdmin.from("npc_chests")
      .select("id,npc_id,capacity,contents,npc:npcs(id,name)").in("npc_id", npcIds);
    if (!chests?.length) return { chests: [] };
    // Filtra pelas permissões do meu personagem
    const chestIds = chests.map((c: any) => c.id);
    const { data: perms } = await supabaseAdmin.from("chest_permissions")
      .select("chest_id,is_owner").eq("character_id", me.id).in("chest_id", chestIds);
    const permMap = new Map<string, boolean>();
    for (const p of (perms as any[]) ?? []) permMap.set(p.chest_id, !!p.is_owner);
    const accessible = chests
      .filter((c: any) => permMap.has(c.id))
      .map((c: any) => ({ ...c, is_owner: permMap.get(c.id) }));
    return { chests: accessible };
  });

/** Player: retira uma quantidade de item do baú para a bolsa (presencial no NPC). */
export const withdrawFromChest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    chest_id: z.string().uuid(),
    item_id: z.string().uuid(),
    qty: z.number().int().min(1).max(999),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Precisa estar no mesmo local do NPC
    const { data: chest } = await supabaseAdmin.from("npc_chests")
      .select("id,npc_id,contents,capacity").eq("id", data.chest_id).maybeSingle();
    if (!chest) throw new Error("Baú não encontrado.");
    const { data: ln } = await supabaseAdmin.from("location_npcs")
      .select("npc_id").eq("location_id", me.current_location_id).eq("npc_id", (chest as any).npc_id).maybeSingle();
    if (!ln) throw new Error("Você precisa estar no mesmo local do NPC.");
    // Permissão
    const { data: perm } = await supabaseAdmin.from("chest_permissions")
      .select("id").eq("chest_id", data.chest_id).eq("character_id", me.id).maybeSingle();
    if (!perm) throw new Error("Você não tem acesso a este baú.");
    // Retira do baú
    const contents = (Array.isArray((chest as any).contents) ? (chest as any).contents : []) as Array<{ item_id: string; qty: number }>;
    const idx = contents.findIndex((e) => e.item_id === data.item_id);
    if (idx < 0 || contents[idx].qty < data.qty) throw new Error("Estoque insuficiente no baú.");
    contents[idx].qty -= data.qty;
    const nextContents = contents.filter((e) => e.qty > 0);
    // Adiciona à bolsa (capacidade 20 slots)
    const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", me.id).maybeSingle();
    const bag = ((inv?.ninja_bag as any[]) ?? []).map((e: any) => ({ item_id: e.item_id, qty: Number(e.qty ?? 1) }));
    const existingBagIdx = bag.findIndex((b) => b.item_id === data.item_id);
    if (existingBagIdx >= 0) {
      bag[existingBagIdx].qty += data.qty;
    } else {
      if (bag.length >= 20) throw new Error("Bolsa ninja cheia.");
      bag.push({ item_id: data.item_id, qty: data.qty });
    }
    await supabaseAdmin.from("npc_chests").update({ contents: nextContents }).eq("id", data.chest_id);
    await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", me.id);
    return { ok: true };
  });

/** Verifica se o caller possui permissão em algum baú vinculado a esse NPC (usado para bloquear venda). */
export async function callerHasAnyChestPermissionForNpc(
  supabaseAdmin: any, characterId: string, npcId: string,
): Promise<boolean> {
  const { data: chest } = await supabaseAdmin.from("npc_chests").select("id").eq("npc_id", npcId).maybeSingle();
  if (!chest) return false;
  const { data: perm } = await supabaseAdmin.from("chest_permissions")
    .select("id").eq("chest_id", (chest as any).id).eq("character_id", characterId).maybeSingle();
  return !!perm;
}
