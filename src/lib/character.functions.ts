import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const villageEnum = z.enum([
  "konoha","suna","kiri","kumo","iwa","ame","kusa","taki","oto","yuki","hoshi","nomad",
]);
const elementEnum = z.enum(["katon","suiton","fuuton","doton","raiton"]);

const NINJA_BAG_CAP = 20;
const SECONDARY_CAP = 10;
const capOf = (source: "ninja_bag" | "secondary_slots") =>
  source === "ninja_bag" ? NINJA_BAG_CAP : SECONDARY_CAP;

const SLOT_BY_TYPE: Record<string, string> = {
  armor_helmet: "helmet_id",
  armor_vest: "vest_id",
  armor_pants: "pants_id",
  armor_boots: "boots_id",
  weapon_primary: "primary_weapon_id",
  weapon_secondary: "secondary_weapon_id",
};

// Weighted random from clans of a village.
function pickWeighted<T extends { weight: number }>(rows: T[], rng = Math.random): T {
  const total = rows.reduce((s, r) => s + Math.max(1, r.weight), 0);
  let r = rng() * total;
  for (const row of rows) {
    r -= Math.max(1, row.weight);
    if (r <= 0) return row;
  }
  return rows[rows.length - 1];
}

/** Sortear um clã aleatório da vila (respeitando pesos). Consome 1 reroll se já houver personagem. */
export const rollClan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ village: villageEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: clans, error } = await context.supabase
      .from("clans")
      .select("id,name,village,rarity,element_bonus,description,weight")
      .eq("village", data.village);
    if (error) throw new Error(error.message);
    if (!clans || clans.length === 0) throw new Error("Nenhum clã disponível para esta vila.");
    const picked = pickWeighted(clans);
    return picked;
  });

/** Cria o personagem do jogador e enfileira mensagem de boas-vindas no WhatsApp. */
export const createCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nickname: z.string().trim().min(2).max(40),
        phone_e164: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Telefone inválido"),
        village: villageEnum,
        clan_id: z.string().uuid(),
        element_primary: elementEnum,
        age: z.number().int().min(8).max(120).optional(),
        appearance: z.string().max(2000).optional(),
        personality: z.string().max(2000).optional(),
        history: z.string().max(4000).optional(),
        bio: z.string().max(500).optional(),
        clan_rerolls_used: z.number().int().min(0).max(3).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const phone = data.phone_e164.startsWith("+") ? data.phone_e164 : `+${data.phone_e164}`;

    const { data: existing } = await context.supabase
      .from("characters").select("id").eq("user_id", context.userId).maybeSingle();
    if (existing) throw new Error("Você já criou um personagem.");

    const { data: char, error } = await context.supabase
      .from("characters")
      .insert({
        user_id: context.userId,
        nickname: data.nickname,
        phone_e164: phone,
        village: data.village,
        clan_id: data.clan_id,
        element_primary: data.element_primary,
        age: data.age,
        appearance: data.appearance,
        personality: data.personality,
        history: data.history,
        bio: data.bio,
        clan_rerolls_used: data.clan_rerolls_used,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("inventory").insert({ character_id: char.id });

    // Enqueue welcome — admin/service reads this queue via the bot.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("outbound_messages").insert({
      to_phone: phone,
      body: `🍥 *New Era Shinobi — Revolution*\n\nBem-vindo, ${data.nickname}! Sua ficha foi selada. A partir de agora, sua jornada como shinobi de ${data.village.toUpperCase()} acontece aqui neste chat.\n\nEnvie *!ajuda* para começar.`,
    });

    return { id: char.id };
  });

/** Atualiza campos livres da ficha (bio/aparência/personalidade/história/imagens). */
export const updateCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      appearance: z.string().max(2000).optional(),
      personality: z.string().max(2000).optional(),
      history: z.string().max(4000).optional(),
      bio: z.string().max(500).optional(),
      avatar_url: z.string().url().optional(),
      banner_url: z.string().url().optional(),
      inventory_bg_url: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("characters").update(data).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- INVENTORY ACTIONS (player-side) ---------- */

const bagSource = z.enum(["ninja_bag","secondary_slots"]).default("ninja_bag");

async function loadOwnInventory(context: { supabase: any; userId: string }) {
  const { data: char, error: cErr } = await context.supabase
    .from("characters").select("id,proficiencies").eq("user_id", context.userId).maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!char) throw new Error("Personagem não encontrado.");
  const { data: inv, error: iErr } = await context.supabase
    .from("inventory").select("*").eq("character_id", char.id).maybeSingle();
  if (iErr) throw new Error(iErr.message);
  if (!inv) throw new Error("Inventário não encontrado.");
  return { char, inv };
}

const SKILL_RANK_ORDER = ["E","D","C","B","A","S"] as const;
function rankGteE(r: string | null | undefined) {
  return typeof r === "string" && SKILL_RANK_ORDER.indexOf(r as any) >= 0;
}
export function weaponUnlocks(profs: any): { primary: boolean; secondary: boolean } {
  const k = (profs ?? {})?.kenjutsu ?? {};
  return { primary: rankGteE(k.nivel), secondary: rankGteE(k.maestria) };
}

function normalizeBag(raw: any): { item_id: string; qty: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e: any) => e && e.item_id)
    .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
}

function removeOneFromBag(bag: { item_id: string; qty: number }[], itemId: string) {
  const next = bag.map((e) => ({ ...e }));
  const idx = next.findIndex((e) => e.item_id === itemId);
  if (idx === -1) throw new Error("Item não está na bolsa.");
  next[idx].qty -= 1;
  if (next[idx].qty <= 0) next.splice(idx, 1);
  return next;
}

/** Adiciona qty unidades respeitando stackable/stack_limit; retorna nova bolsa. */
export function addToBag(
  bag: { item_id: string; qty: number }[],
  itemId: string,
  addQty: number,
  stackable: boolean,
  stackLimit: number | null,
) {
  const next = bag.map((e) => ({ ...e }));
  let remaining = addQty;
  if (stackable) {
    for (const e of next) {
      if (remaining <= 0) break;
      if (e.item_id !== itemId) continue;
      const room = stackLimit ? Math.max(0, stackLimit - e.qty) : remaining;
      const add = Math.min(room, remaining);
      e.qty += add; remaining -= add;
    }
    while (remaining > 0) {
      const take = stackLimit ? Math.min(stackLimit, remaining) : remaining;
      next.push({ item_id: itemId, qty: take });
      remaining -= take;
    }
  } else {
    for (let i = 0; i < addQty; i++) next.push({ item_id: itemId, qty: 1 });
  }
  return next;
}

/** Carrega slot_size/stackable/stack_limit de uma lista de itens (mapa por id). */
async function loadItemMeta(supabase: any, ids: string[]) {
  const uniq = Array.from(new Set(ids)).filter(Boolean);
  if (!uniq.length) return {} as Record<string, { slot_size: number; stackable: boolean; stack_limit: number | null; type: string }>;
  const { data } = await supabase.from("items").select("id,slot_size,stackable,stack_limit,type").in("id", uniq);
  const map: any = {};
  for (const r of (data ?? []) as any[]) {
    map[r.id] = {
      slot_size: Number(r.slot_size ?? 1),
      stackable: r.stackable !== false,
      stack_limit: r.stack_limit == null ? null : Number(r.stack_limit),
      type: r.type,
    };
  }
  return map;
}

function usedSlots(bag: { item_id: string; qty: number }[], meta: Record<string, { slot_size: number }>) {
  return bag.reduce((s, e) => s + (meta[e.item_id]?.slot_size ?? 1), 0);
}

/** Adiciona qty com verificação de capacidade. Retorna nova bolsa ou lança "Bolsa cheia". */
export async function addWithCapacity(
  supabase: any,
  bag: { item_id: string; qty: number }[],
  itemId: string,
  addQty: number,
  capacity: number,
) {
  const meta = await loadItemMeta(supabase, [...bag.map((e) => e.item_id), itemId]);
  const info = meta[itemId] ?? { slot_size: 1, stackable: true, stack_limit: null, type: "misc" };
  const next = addToBag(bag, itemId, addQty, info.stackable, info.stack_limit);
  if (usedSlots(next, meta) > capacity) {
    throw new Error("Bolsa cheia — sem espaço para este item.");
  }
  return next;
}

/** Equipa um item da bolsa em seu slot correspondente. */
export const equipItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ item_id: z.string().uuid(), source: bagSource }).parse(i))
  .handler(async ({ data, context }) => {
    const { char, inv } = await loadOwnInventory(context);
    const { data: item, error: itErr } = await context.supabase
      .from("items").select("id,type,name").eq("id", data.item_id).maybeSingle();
    if (itErr) throw new Error(itErr.message);
    if (!item) throw new Error("Item inexistente.");
    const slotCol = SLOT_BY_TYPE[item.type];
    if (!slotCol) throw new Error("Este item não pode ser equipado.");
    const unlocks = weaponUnlocks((char as any).proficiencies);
    if (item.type === "weapon_primary" && !unlocks.primary) throw new Error("Slot primário bloqueado. Requer Kenjutsu Nível E.");
    if (item.type === "weapon_secondary" && !unlocks.secondary) throw new Error("Slot secundário bloqueado. Requer Kenjutsu Maestria E.");

    let src = normalizeBag(inv[data.source]);
    src = removeOneFromBag(src, data.item_id);

    // Se já havia algo equipado, volta pra bolsa
    const previous: string | null = inv[slotCol] ?? null;
    let bag = data.source === "ninja_bag" ? src : normalizeBag(inv.ninja_bag);
    if (previous) bag = await addWithCapacity(context.supabase, bag, previous, 1, NINJA_BAG_CAP);

    const patch: any = { ninja_bag: bag };
    if (data.source === "secondary_slots") patch.secondary_slots = src;
    patch[slotCol] = data.item_id;
    const { error } = await context.supabase.from("inventory").update(patch).eq("character_id", char.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Desequipa o item de um slot e devolve para a bolsa. */
export const unequipItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    slot: z.enum(["helmet_id","vest_id","pants_id","boots_id","primary_weapon_id","secondary_weapon_id"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { char, inv } = await loadOwnInventory(context);
    const currentId: string | null = inv[data.slot] ?? null;
    if (!currentId) throw new Error("Slot vazio.");
    const bag = await addWithCapacity(context.supabase, normalizeBag(inv.ninja_bag), currentId, 1, NINJA_BAG_CAP);
    const patch: any = { ninja_bag: bag };
    patch[data.slot] = null;
    const { error } = await context.supabase.from("inventory").update(patch).eq("character_id", char.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Consome 1 unidade de um item consumível da bolsa. */
export const consumeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ item_id: z.string().uuid(), source: bagSource }).parse(i))
  .handler(async ({ data, context }) => {
    const { char, inv } = await loadOwnInventory(context);
    const { data: item } = await context.supabase.from("items").select("type,name,meta").eq("id", data.item_id).maybeSingle();
    if (!item) throw new Error("Item inexistente.");
    if (item.type !== "consumable") throw new Error("Este item não é consumível.");
    const src = removeOneFromBag(normalizeBag(inv[data.source]), data.item_id);
    const patch: any = { [data.source]: src };
    const { error } = await context.supabase.from("inventory").update(patch).eq("character_id", char.id);
    if (error) throw new Error(error.message);

    // Aplica restauro conforme meta.restore = { pool: "ef"|"em"|"chakra"|"all", mode: "flat"|"percent", amount }
    const restore = (item as any).meta?.restore as
      | { pool: "ef" | "em" | "chakra" | "all"; mode: "flat" | "percent"; amount: number }
      | null | undefined;
    let restored: Record<string, number> = {};
    if (restore && restore.amount > 0) {
      const { data: c } = await context.supabase
        .from("characters").select("xp,ef_current,em_current,chakra_current").eq("id", char.id).maybeSingle();
      if (c) {
        const xp = c.xp ?? 0;
        const efMax = Math.floor(xp / 2);
        const emMax = xp - efMax;
        const ckMax = xp;
        const efCur = c.ef_current ?? efMax;
        const emCur = c.em_current ?? emMax;
        const ckCur = c.chakra_current ?? ckMax;
        const pools: Array<"ef" | "em" | "chakra"> =
          restore.pool === "all" ? ["ef", "em", "chakra"] : [restore.pool];
        const maxOf = { ef: efMax, em: emMax, chakra: ckMax } as const;
        const curOf = { ef: efCur, em: emCur, chakra: ckCur } as const;
        const patch: any = {};
        for (const p of pools) {
          const gain = restore.mode === "percent"
            ? Math.round((maxOf[p] * restore.amount) / 100)
            : Math.round(restore.amount);
          const next = Math.min(maxOf[p], Math.max(0, curOf[p] + gain));
          patch[`${p === "chakra" ? "chakra" : p}_current`] = next;
          restored[p] = next - curOf[p];
        }
        if (Object.keys(patch).length > 0) {
          await context.supabase.from("characters").update(patch).eq("id", char.id);
        }
      }
    }
    return { ok: true, consumed: item.name, restored };
  });

/** Descarta 1 unidade de um item da bolsa. */
export const dropItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ item_id: z.string().uuid(), source: bagSource }).parse(i))
  .handler(async ({ data, context }) => {
    const { char, inv } = await loadOwnInventory(context);
    const src = removeOneFromBag(normalizeBag(inv[data.source]), data.item_id);
    const patch: any = { [data.source]: src };
    const { error } = await context.supabase.from("inventory").update(patch).eq("character_id", char.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Move 1 unidade entre bolsa ninja e slots secundários. */
export const moveItemBetweenBags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    item_id: z.string().uuid(),
    from: bagSource,
    to: bagSource,
  }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.from === data.to) throw new Error("Origem e destino iguais.");
    const { char, inv } = await loadOwnInventory(context);
    const src = removeOneFromBag(normalizeBag(inv[data.from]), data.item_id);
    const dst = await addWithCapacity(context.supabase, normalizeBag(inv[data.to]), data.item_id, 1, capOf(data.to));
    const patch: any = { [data.from]: src, [data.to]: dst };
    const { error } = await context.supabase.from("inventory").update(patch).eq("character_id", char.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });