import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type BagEntry = { item_id: string; qty: number };
type Offer = { items: BagEntry[]; ryo: number };

const OfferSchema = z.object({
  items: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(9999) })).max(30),
  ryo: z.number().int().min(0).max(9_999_999),
});

async function loadMyChar(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("characters").select("id,current_location_id,ryo,nickname")
    .eq("user_id", ctx.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data as { id: string; current_location_id: string | null; ryo: number; nickname: string };
}

function normalizeBag(bag: BagEntry[] | null | undefined): BagEntry[] {
  const out: Record<string, number> = {};
  for (const it of bag ?? []) {
    if (!it?.item_id || !Number.isFinite(it.qty) || it.qty <= 0) continue;
    out[it.item_id] = (out[it.item_id] ?? 0) + Math.floor(it.qty);
  }
  return Object.entries(out).map(([item_id, qty]) => ({ item_id, qty }));
}

function subtractFromBag(bag: BagEntry[], items: BagEntry[]): BagEntry[] | null {
  const map = new Map<string, number>();
  for (const e of bag) map.set(e.item_id, (map.get(e.item_id) ?? 0) + e.qty);
  for (const it of items) {
    const cur = map.get(it.item_id) ?? 0;
    if (cur < it.qty) return null;
    map.set(it.item_id, cur - it.qty);
  }
  return Array.from(map.entries())
    .filter(([, q]) => q > 0)
    .map(([item_id, qty]) => ({ item_id, qty }));
}

function addToBag(bag: BagEntry[], items: BagEntry[]): BagEntry[] {
  const map = new Map<string, number>();
  for (const e of bag) map.set(e.item_id, (map.get(e.item_id) ?? 0) + e.qty);
  for (const it of items) map.set(it.item_id, (map.get(it.item_id) ?? 0) + it.qty);
  return Array.from(map.entries()).map(([item_id, qty]) => ({ item_id, qty }));
}

/** Convida outro jogador do MESMO local para trocar. */
export const initiateTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ partner_character_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    if (me.id === data.partner_character_id) throw new Error("Não é possível trocar consigo mesmo.");
    if (!me.current_location_id) throw new Error("Você precisa estar em um local.");

    const { data: partner, error: pe } = await context.supabase
      .from("characters").select("id,current_location_id,nickname")
      .eq("id", data.partner_character_id).maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!partner) throw new Error("Personagem não encontrado.");
    if (partner.current_location_id !== me.current_location_id) {
      throw new Error("Vocês precisam estar no mesmo local.");
    }

    // Impede troca duplicada
    const { data: active } = await context.supabase
      .from("trade_sessions").select("id")
      .in("status", ["pending", "active"])
      .or(`initiator_id.eq.${me.id},partner_id.eq.${me.id},initiator_id.eq.${partner.id},partner_id.eq.${partner.id}`)
      .limit(1);
    if (active && active.length > 0) throw new Error("Já existe uma troca ativa envolvendo um dos jogadores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin.from("server_config").select("trade_tax_percent").eq("id", "main").maybeSingle();
    const tax = Math.min(50, Math.max(0, (cfg as any)?.trade_tax_percent ?? 0));

    const { data: row, error } = await supabaseAdmin
      .from("trade_sessions").insert({
        initiator_id: me.id,
        partner_id: partner.id,
        location_id: me.current_location_id,
        tax_percent: tax,
      }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Parceiro aceita ou recusa o convite. */
export const respondTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ trade_id: z.string().uuid(), accept: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { data: t, error } = await context.supabase
      .from("trade_sessions").select("*").eq("id", data.trade_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) throw new Error("Troca não encontrada.");
    if (t.partner_id !== me.id) throw new Error("Apenas o convidado pode responder.");
    if (t.status !== "pending") throw new Error("Convite não está pendente.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("trade_sessions")
      .update({ status: data.accept ? "active" : "declined" })
      .eq("id", t.id);
    return { ok: true };
  });

/** Atualiza a oferta do próprio lado. Reseta ambas as confirmações. */
export const updateTradeOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ trade_id: z.string().uuid(), offer: OfferSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { data: t } = await context.supabase
      .from("trade_sessions").select("*").eq("id", data.trade_id).maybeSingle();
    if (!t) throw new Error("Troca não encontrada.");
    if (t.status !== "active") throw new Error("Troca não está ativa.");
    if (t.initiator_id !== me.id && t.partner_id !== me.id) throw new Error("Sem acesso.");

    const isInitiator = t.initiator_id === me.id;
    const cleaned: Offer = { items: normalizeBag(data.offer.items), ryo: Math.max(0, Math.floor(data.offer.ryo)) };

    // Valida posse do que está oferecendo
    if (cleaned.ryo > (me.ryo ?? 0)) throw new Error("Ryo insuficiente na sua oferta.");
    const { data: inv } = await context.supabase.from("inventory").select("ninja_bag").eq("character_id", me.id).maybeSingle();
    const bag: BagEntry[] = ((inv as any)?.ninja_bag ?? []) as BagEntry[];
    for (const it of cleaned.items) {
      const owned = bag.find((b) => b.item_id === it.item_id)?.qty ?? 0;
      if (owned < it.qty) throw new Error("Você não possui a quantidade oferecida de um dos itens.");
    }

    const patch: any = {
      initiator_confirmed: false,
      partner_confirmed: false,
    };
    if (isInitiator) patch.initiator_offer = cleaned;
    else patch.partner_offer = cleaned;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trade_sessions").update(patch).eq("id", t.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Confirma a troca do próprio lado. Quando ambos confirmam, executa o swap. */
export const confirmTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ trade_id: z.string().uuid(), confirm: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t } = await supabaseAdmin
      .from("trade_sessions").select("*").eq("id", data.trade_id).maybeSingle();
    if (!t) throw new Error("Troca não encontrada.");
    if (t.status !== "active") throw new Error("Troca não está ativa.");
    if (t.initiator_id !== me.id && t.partner_id !== me.id) throw new Error("Sem acesso.");
    const isInitiator = t.initiator_id === me.id;

    const patch: any = {};
    if (isInitiator) patch.initiator_confirmed = data.confirm;
    else patch.partner_confirmed = data.confirm;

    const bothConfirmed =
      (isInitiator ? data.confirm : t.initiator_confirmed) &&
      (isInitiator ? t.partner_confirmed : data.confirm);

    if (!bothConfirmed) {
      const { error } = await supabaseAdmin.from("trade_sessions").update(patch).eq("id", t.id);
      if (error) throw new Error(error.message);
      return { ok: true, completed: false };
    }

    // Executa swap
    const [iniRes, parRes] = await Promise.all([
      supabaseAdmin.from("characters").select("id,ryo,current_location_id").eq("id", t.initiator_id).single(),
      supabaseAdmin.from("characters").select("id,ryo,current_location_id").eq("id", t.partner_id).single(),
    ]);
    if (iniRes.error || parRes.error) throw new Error("Falha ao carregar jogadores.");
    const ini = iniRes.data as any;
    const par = parRes.data as any;
    if (ini.current_location_id !== par.current_location_id) {
      await supabaseAdmin.from("trade_sessions").update({
        status: "failed", fail_reason: "Jogadores em locais diferentes.",
      }).eq("id", t.id);
      throw new Error("Um dos jogadores saiu do local. Troca cancelada.");
    }

    const iniOffer = t.initiator_offer as Offer;
    const parOffer = t.partner_offer as Offer;
    if ((ini.ryo ?? 0) < iniOffer.ryo || (par.ryo ?? 0) < parOffer.ryo) {
      await supabaseAdmin.from("trade_sessions").update({ status: "failed", fail_reason: "Ryo insuficiente." }).eq("id", t.id);
      throw new Error("Ryo insuficiente em um dos lados.");
    }

    const [iniInvRes, parInvRes] = await Promise.all([
      supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", ini.id).single(),
      supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", par.id).single(),
    ]);
    if (iniInvRes.error || parInvRes.error) throw new Error("Falha ao carregar inventários.");
    const iniBag = normalizeBag(((iniInvRes.data as any).ninja_bag ?? []) as BagEntry[]);
    const parBag = normalizeBag(((parInvRes.data as any).ninja_bag ?? []) as BagEntry[]);

    const iniAfterSub = subtractFromBag(iniBag, iniOffer.items);
    const parAfterSub = subtractFromBag(parBag, parOffer.items);
    if (!iniAfterSub || !parAfterSub) {
      await supabaseAdmin.from("trade_sessions").update({ status: "failed", fail_reason: "Itens indisponíveis." }).eq("id", t.id);
      throw new Error("Um dos jogadores não possui mais os itens oferecidos.");
    }

    const iniFinal = addToBag(iniAfterSub, parOffer.items);
    const parFinal = addToBag(parAfterSub, iniOffer.items);

    const tax = Math.min(50, Math.max(0, t.tax_percent ?? 0));
    // Taxa incide sobre o ryo que CADA lado recebe
    const iniReceives = Math.floor(parOffer.ryo * (100 - tax) / 100);
    const parReceives = Math.floor(iniOffer.ryo * (100 - tax) / 100);

    const iniNewRyo = (ini.ryo ?? 0) - iniOffer.ryo + iniReceives;
    const parNewRyo = (par.ryo ?? 0) - parOffer.ryo + parReceives;

    const [u1, u2, u3, u4, u5] = await Promise.all([
      supabaseAdmin.from("inventory").update({ ninja_bag: iniFinal }).eq("character_id", ini.id),
      supabaseAdmin.from("inventory").update({ ninja_bag: parFinal }).eq("character_id", par.id),
      supabaseAdmin.from("characters").update({ ryo: iniNewRyo }).eq("id", ini.id),
      supabaseAdmin.from("characters").update({ ryo: parNewRyo }).eq("id", par.id),
      supabaseAdmin.from("trade_sessions").update({
        status: "completed",
        initiator_confirmed: true,
        partner_confirmed: true,
      }).eq("id", t.id),
    ]);
    for (const r of [u1, u2, u3, u4, u5]) if (r.error) throw new Error(r.error.message);

    return { ok: true, completed: true };
  });

/** Cancela a troca (qualquer participante). */
export const cancelTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ trade_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { data: t } = await context.supabase.from("trade_sessions").select("*").eq("id", data.trade_id).maybeSingle();
    if (!t) throw new Error("Troca não encontrada.");
    if (t.initiator_id !== me.id && t.partner_id !== me.id) throw new Error("Sem acesso.");
    if (["completed", "cancelled", "declined", "failed"].includes(t.status)) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("trade_sessions").update({ status: "cancelled" }).eq("id", t.id);
    return { ok: true };
  });