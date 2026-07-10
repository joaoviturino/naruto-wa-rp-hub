import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addWithCapacity } from "./character.functions";

const NINJA_BAG_CAP = 20;

async function loadMyChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters").select("id,nickname,ryo,xp,current_location_id").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data;
}

async function assertNpcHere(context: any, npcId: string) {
  const me = await loadMyChar(context);
  if (!me.current_location_id) throw new Error("Você não está em local nenhum.");
  const { data } = await context.supabase
    .from("location_npcs").select("npc_id").eq("location_id", me.current_location_id).eq("npc_id", npcId).maybeSingle();
  if (!data) throw new Error("Este NPC não está neste local.");
  return me;
}

/** Lista NPCs de loja/recompensa presentes no local do personagem. */
export const listLocationInteractNpcs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await loadMyChar(context);
    if (!me.current_location_id) return { npcs: [] as any[] };
    const { data } = await context.supabase
      .from("location_npcs")
      .select("npc:npcs(id,name,image_url,kind,dialog_intro,dialog_outro,shop_items,reward_items,reward_xp,reward_ryo,reward_cooldown_hours)")
      .eq("location_id", me.current_location_id);
    const list = ((data as any[]) ?? []).map((r) => r.npc).filter((n: any) => n && n.kind !== "aggressive");
    // Enriquece reward com cooldown remaining
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const n of list) {
      if (n.kind === "reward") {
        const { data: last } = await supabaseAdmin
          .from("character_npc_rewards").select("claimed_at")
          .eq("character_id", me.id).eq("npc_id", n.id)
          .order("claimed_at", { ascending: false }).limit(1).maybeSingle();
        const hours = Number(n.reward_cooldown_hours ?? 24);
        const nextAt = last ? new Date(last.claimed_at).getTime() + hours * 3600_000 : 0;
        n.cooldown_remaining_ms = Math.max(0, nextAt - Date.now());
      }
    }
    return { npcs: list };
  });

/** Compra 1 unidade de um item do NPC de loja. */
export const buyFromShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    npc_id: z.string().uuid(),
    item_id: z.string().uuid(),
    qty: z.number().int().min(1).max(50).default(1),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await assertNpcHere(context, data.npc_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: npc } = await supabaseAdmin.from("npcs").select("kind,shop_items").eq("id", data.npc_id).maybeSingle();
    if (!npc || npc.kind !== "shop") throw new Error("Este NPC não é um vendedor.");
    const items = (Array.isArray(npc.shop_items) ? npc.shop_items : []) as any[];
    const idx = items.findIndex((s) => s.item_id === data.item_id);
    if (idx < 0) throw new Error("Item não está à venda.");
    const entry = items[idx];
    const totalCost = Number(entry.price) * data.qty;
    if (Number(me.ryo ?? 0) < totalCost) throw new Error(`Ryo insuficiente. Preço: ${totalCost}.`);
    if (Number(entry.stock) !== -1 && Number(entry.stock) < data.qty) throw new Error("Estoque insuficiente.");

    // Debita ryo
    await supabaseAdmin.from("characters").update({ ryo: Number(me.ryo ?? 0) - totalCost }).eq("id", me.id);
    // Atualiza estoque se limitado
    if (Number(entry.stock) !== -1) {
      items[idx] = { ...entry, stock: Number(entry.stock) - data.qty };
      await supabaseAdmin.from("npcs").update({ shop_items: items }).eq("id", data.npc_id);
    }
    // Adiciona à bolsa
    const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", me.id).maybeSingle();
    const bag = (Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag : []).map((e: any) => ({ item_id: e.item_id, qty: Number(e.qty ?? 1) }));
    let nextBag;
    try {
      nextBag = await addWithCapacity(supabaseAdmin, bag, data.item_id, data.qty, NINJA_BAG_CAP);
    } catch (e: any) {
      throw new Error(e?.message ?? "Bolsa cheia.");
    }
    await supabaseAdmin.from("inventory").update({ ninja_bag: nextBag }).eq("character_id", me.id);
    return { ok: true, spent: totalCost };
  });

/** Reivindica recompensa de um NPC de recompensa (respeita cooldown). */
export const claimNpcReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ npc_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await assertNpcHere(context, data.npc_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: npc } = await supabaseAdmin.from("npcs")
      .select("kind,reward_items,reward_xp,reward_ryo,reward_cooldown_hours,name").eq("id", data.npc_id).maybeSingle();
    if (!npc || npc.kind !== "reward") throw new Error("Este NPC não concede recompensas.");

    const hours = Number(npc.reward_cooldown_hours ?? 24);
    if (hours > 0) {
      const { data: last } = await supabaseAdmin
        .from("character_npc_rewards").select("claimed_at")
        .eq("character_id", me.id).eq("npc_id", data.npc_id)
        .order("claimed_at", { ascending: false }).limit(1).maybeSingle();
      if (last) {
        const remaining = new Date(last.claimed_at).getTime() + hours * 3600_000 - Date.now();
        if (remaining > 0) {
          const h = Math.ceil(remaining / 3600_000);
          throw new Error(`Volte em ${h}h para receber novamente.`);
        }
      }
    }

    const rItems = (Array.isArray(npc.reward_items) ? npc.reward_items : []) as any[];
    if (rItems.length) {
      const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", me.id).maybeSingle();
      let bag = (Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag : []).map((e: any) => ({ item_id: e.item_id, qty: Number(e.qty ?? 1) }));
      for (const r of rItems) {
        bag = await addWithCapacity(supabaseAdmin, bag, r.item_id, Number(r.qty ?? 1), NINJA_BAG_CAP);
      }
      await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", me.id);
    }
    const xp = Number(npc.reward_xp ?? 0);
    const ryo = Number(npc.reward_ryo ?? 0);
    if (xp > 0 || ryo > 0) {
      await supabaseAdmin.from("characters").update({
        xp: Number(me.xp ?? 0) + xp,
        ryo: Number(me.ryo ?? 0) + ryo,
      }).eq("id", me.id);
    }
    await supabaseAdmin.from("character_npc_rewards").insert({ character_id: me.id, npc_id: data.npc_id });
    return { ok: true, xp, ryo, items: rItems.length };
  });