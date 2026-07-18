import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeftRight, Check, X, Coins, Plus, Minus, Trash2, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { respondTrade, updateTradeOffer, confirmTrade, cancelTrade } from "@/lib/trade.functions";
import { toast } from "sonner";

type TradeRow = {
  id: string;
  initiator_id: string;
  partner_id: string;
  initiator_offer: { items: { item_id: string; qty: number }[]; ryo: number };
  partner_offer:   { items: { item_id: string; qty: number }[]; ryo: number };
  initiator_confirmed: boolean;
  partner_confirmed: boolean;
  status: string;
  tax_percent: number;
  updated_at: string;
};
type CharMini = { id: string; nickname: string; avatar_url: string | null; ryo: number };
type ItemMini = { id: string; name: string; icon_url: string | null; rank: string | null };

export function TradeWatcher({ myCharacterId }: { myCharacterId: string | null }) {
  const [trade, setTrade] = useState<TradeRow | null>(null);
  const chRef = useRef<any>(null);

  async function refresh() {
    if (!myCharacterId) return;
    const { data } = await supabase
      .from("trade_sessions")
      .select("*")
      .in("status", ["pending", "active"])
      .or(`initiator_id.eq.${myCharacterId},partner_id.eq.${myCharacterId}`)
      .order("created_at", { ascending: false })
      .limit(1);
    setTrade((((data ?? [])[0] as unknown) as TradeRow) ?? null);
  }

  useEffect(() => {
    if (!myCharacterId) return;
    refresh();
    const suffix = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`trade_watch_${myCharacterId}_${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_sessions" }, () => refresh())
      .subscribe();
    chRef.current = ch;
    return () => { if (chRef.current) supabase.removeChannel(chRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCharacterId]);

  if (!trade || !myCharacterId) return null;
  return <TradeDialog trade={trade} myCharacterId={myCharacterId} onClose={() => setTrade(null)} />;
}

function TradeDialog({
  trade, myCharacterId, onClose,
}: { trade: TradeRow; myCharacterId: string; onClose: () => void }) {
  const isInitiator = trade.initiator_id === myCharacterId;
  const myOffer = isInitiator ? trade.initiator_offer : trade.partner_offer;
  const theirOffer = isInitiator ? trade.partner_offer : trade.initiator_offer;
  const myConfirmed = isInitiator ? trade.initiator_confirmed : trade.partner_confirmed;
  const theirConfirmed = isInitiator ? trade.partner_confirmed : trade.initiator_confirmed;
  const otherId = isInitiator ? trade.partner_id : trade.initiator_id;

  const [chars, setChars] = useState<Record<string, CharMini>>({});
  const [myBag, setMyBag] = useState<{ item_id: string; qty: number }[]>([]);
  const [items, setItems] = useState<Record<string, ItemMini>>({});
  const [draftItems, setDraftItems] = useState<{ item_id: string; qty: number }[]>(myOffer.items);
  const [draftRyo, setDraftRyo] = useState<number>(myOffer.ryo);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const respond = useServerFn(respondTrade);
  const update = useServerFn(updateTradeOffer);
  const confirm = useServerFn(confirmTrade);
  const cancel = useServerFn(cancelTrade);

  // Load characters + inventory + item metadata
  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from("characters")
        .select("id,nickname,avatar_url,ryo")
        .in("id", [trade.initiator_id, trade.partner_id]);
      const cm: Record<string, CharMini> = {};
      (cs ?? []).forEach((c: any) => (cm[c.id] = c));
      setChars(cm);

      const { data: inv } = await supabase.from("inventory").select("ninja_bag").eq("character_id", myCharacterId).maybeSingle();
      const bag = (((inv as any)?.ninja_bag ?? []) as { item_id: string; qty: number }[]).filter((b) => b.item_id && b.qty > 0);
      setMyBag(bag);

      const allIds = new Set<string>();
      bag.forEach((b) => allIds.add(b.item_id));
      trade.initiator_offer.items.forEach((b) => allIds.add(b.item_id));
      trade.partner_offer.items.forEach((b) => allIds.add(b.item_id));
      if (allIds.size > 0) {
        const { data: its } = await supabase.from("items").select("id,name,icon_url,rank").in("id", Array.from(allIds));
        const im: Record<string, ItemMini> = {};
        (its ?? []).forEach((it: any) => (im[it.id] = it));
        setItems(im);
      }
    })();
  }, [trade.id, myCharacterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync draft when the row updates from the other side (only if I haven't touched it)
  useEffect(() => {
    if (!dirty) {
      setDraftItems(myOffer.items);
      setDraftRyo(myOffer.ryo);
    }
  }, [trade.updated_at, myOffer.items, myOffer.ryo, dirty]);

  const me = chars[myCharacterId];
  const other = chars[otherId];

  const bagAvailable = useMemo(() => {
    const drafted = new Map<string, number>();
    for (const d of draftItems) drafted.set(d.item_id, (drafted.get(d.item_id) ?? 0) + d.qty);
    return myBag.map((b) => ({ ...b, remaining: b.qty - (drafted.get(b.item_id) ?? 0) })).filter((b) => b.remaining > 0);
  }, [myBag, draftItems]);

  function addItemToOffer(item_id: string) {
    setDirty(true);
    setDraftItems((prev) => {
      const idx = prev.findIndex((p) => p.item_id === item_id);
      if (idx >= 0) {
        const copy = [...prev]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy;
      }
      return [...prev, { item_id, qty: 1 }];
    });
  }
  function changeQty(item_id: string, delta: number) {
    setDirty(true);
    setDraftItems((prev) => prev.flatMap((p) => {
      if (p.item_id !== item_id) return [p];
      const q = p.qty + delta;
      return q <= 0 ? [] : [{ ...p, qty: q }];
    }));
  }
  function removeItem(item_id: string) {
    setDirty(true);
    setDraftItems((prev) => prev.filter((p) => p.item_id !== item_id));
  }

  async function saveDraft() {
    setBusy("save");
    try {
      await update({ data: { trade_id: trade.id, offer: { items: draftItems, ryo: Math.max(0, Math.floor(draftRyo || 0)) } } });
      setDirty(false);
      toast.success("Oferta atualizada.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function toggleConfirm() {
    if (dirty) { toast.error("Salve sua oferta antes de confirmar."); return; }
    setBusy("confirm");
    try {
      const res = await confirm({ data: { trade_id: trade.id, confirm: !myConfirmed } });
      if ((res as any).completed) { toast.success("Troca concluída!"); onClose(); }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function doCancel() {
    setBusy("cancel");
    try { await cancel({ data: { trade_id: trade.id } }); toast("Troca cancelada."); onClose(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function doRespond(accept: boolean) {
    setBusy("respond");
    try { await respond({ data: { trade_id: trade.id, accept } }); if (!accept) onClose(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  // ================ Pending state (partner sees invite) ================
  if (trade.status === "pending") {
    const iAmPartner = trade.partner_id === myCharacterId;
    return (
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight size={16} /> Convite de troca
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <div className="w-12 h-12 rounded-full bg-secondary overflow-hidden shrink-0">
              {other?.avatar_url && <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{other?.nickname ?? "…"}</div>
              <div className="text-xs text-muted-foreground">
                {iAmPartner ? "Deseja abrir uma janela de troca?" : "Aguardando resposta do jogador…"}
              </div>
              {trade.tax_percent > 0 && (
                <div className="text-[11px] text-gold mt-1">Taxa do mercado: {trade.tax_percent}%</div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {iAmPartner ? (
              <>
                <Button variant="outline" className="flex-1" disabled={!!busy} onClick={() => doRespond(false)}>
                  <X size={14} className="mr-1" /> Recusar
                </Button>
                <Button className="flex-1" disabled={!!busy} onClick={() => doRespond(true)}>
                  <Check size={14} className="mr-1" /> Aceitar
                </Button>
              </>
            ) : (
              <Button variant="outline" className="w-full" disabled={!!busy} onClick={doCancel}>
                <X size={14} className="mr-1" /> Cancelar convite
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ================ Active state (trading window) ================
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ArrowLeftRight size={16} /> Troca — {me?.nickname ?? "…"} ↔ {other?.nickname ?? "…"}
            {trade.tax_percent > 0 && (
              <span className="ml-auto text-[11px] text-gold">Taxa {trade.tax_percent}%</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Minha coluna */}
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden shrink-0">
                {me?.avatar_url && <img src={me.avatar_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{me?.nickname} (você)</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Coins size={10} />{me?.ryo ?? 0} ryo
                </div>
              </div>
              {myConfirmed && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Confirmado</span>}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Sua oferta</div>
              <div className="border border-border rounded p-2 min-h-[80px] space-y-1">
                {draftItems.length === 0 && draftRyo === 0 && (
                  <div className="text-[11px] text-muted-foreground italic">Nada oferecido</div>
                )}
                {draftItems.map((d) => {
                  const it = items[d.item_id];
                  return (
                    <div key={d.item_id} className="flex items-center gap-2 text-[11px]">
                      <div className="w-6 h-6 rounded bg-background overflow-hidden shrink-0">
                        {it?.icon_url && <img src={it.icon_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <span className="flex-1 truncate">{it?.name ?? d.item_id.slice(0, 6)}</span>
                      <button className="w-5 h-5 rounded bg-secondary hover:bg-secondary/80 grid place-items-center" onClick={() => changeQty(d.item_id, -1)}>
                        <Minus size={10} />
                      </button>
                      <span className="w-6 text-center">{d.qty}</span>
                      <button className="w-5 h-5 rounded bg-secondary hover:bg-secondary/80 grid place-items-center" onClick={() => changeQty(d.item_id, 1)}>
                        <Plus size={10} />
                      </button>
                      <button className="w-5 h-5 rounded hover:bg-blood/20 grid place-items-center" onClick={() => removeItem(d.item_id)}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Coins size={12} className="text-gold" />
                <Input
                  type="number" min={0} max={me?.ryo ?? 0}
                  className="h-8 text-xs"
                  value={draftRyo}
                  onChange={(e) => { setDirty(true); setDraftRyo(Math.max(0, Math.min(me?.ryo ?? 0, parseInt(e.target.value || "0", 10)))); }}
                />
                <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => { setDirty(true); setDraftRyo(me?.ryo ?? 0); }}>MAX</Button>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Sua bolsa</div>
              <div className="border border-border rounded p-2 max-h-40 overflow-y-auto grid grid-cols-4 gap-1">
                {bagAvailable.length === 0 && (
                  <div className="text-[11px] text-muted-foreground italic col-span-4">Nada disponível para trocar.</div>
                )}
                {bagAvailable.map((b) => {
                  const it = items[b.item_id];
                  return (
                    <button key={b.item_id}
                      onClick={() => addItemToOffer(b.item_id)}
                      className="relative aspect-square rounded bg-background border border-border hover:border-gold overflow-hidden"
                      title={it?.name}>
                      {it?.icon_url ? (
                        <img src={it.icon_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[9px]">{it?.name?.slice(0, 3)}</div>
                      )}
                      <span className="absolute bottom-0 right-0 text-[9px] bg-background/80 px-1 rounded-tl">{b.remaining}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs" disabled={!dirty || !!busy} onClick={saveDraft}>
                {busy === "save" && <Loader2 size={12} className="animate-spin mr-1" />} Salvar oferta
              </Button>
              <Button className={`flex-1 h-9 text-xs ${myConfirmed ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                disabled={!!busy || dirty} onClick={toggleConfirm}>
                {busy === "confirm" && <Loader2 size={12} className="animate-spin mr-1" />}
                {myConfirmed ? "Confirmado ✓" : "Confirmar"}
              </Button>
            </div>
          </div>

          {/* Coluna do outro */}
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden shrink-0">
                {other?.avatar_url && <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{other?.nickname ?? "…"}</div>
              </div>
              {theirConfirmed && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Confirmado</span>}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Oferta dele(a)</div>
              <div className="border border-border rounded p-2 min-h-[80px] space-y-1">
                {theirOffer.items.length === 0 && theirOffer.ryo === 0 && (
                  <div className="text-[11px] text-muted-foreground italic">Nada oferecido ainda</div>
                )}
                {theirOffer.items.map((d) => {
                  const it = items[d.item_id];
                  return (
                    <div key={d.item_id} className="flex items-center gap-2 text-[11px]">
                      <div className="w-6 h-6 rounded bg-background overflow-hidden shrink-0">
                        {it?.icon_url && <img src={it.icon_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <span className="flex-1 truncate">{it?.name ?? d.item_id.slice(0, 6)}</span>
                      <span className="text-muted-foreground">×{d.qty}</span>
                    </div>
                  );
                })}
                {theirOffer.ryo > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-gold">
                    <Coins size={12} /> {theirOffer.ryo} ryo
                    {trade.tax_percent > 0 && (
                      <span className="text-muted-foreground text-[10px]">
                        (você recebe {Math.floor(theirOffer.ryo * (100 - trade.tax_percent) / 100)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground italic min-h-[3rem]">
              {myConfirmed && theirConfirmed
                ? "Finalizando…"
                : myConfirmed
                ? "Aguardando confirmação do outro jogador."
                : theirConfirmed
                ? "O outro jogador já confirmou. Confirme para concluir a troca."
                : "Ajuste sua oferta. Qualquer alteração cancela as confirmações."}
            </div>

            <Button variant="outline" className="w-full h-9 text-xs border-blood/40 text-blood hover:bg-blood/10" disabled={!!busy} onClick={doCancel}>
              <X size={12} className="mr-1" /> Cancelar troca
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}