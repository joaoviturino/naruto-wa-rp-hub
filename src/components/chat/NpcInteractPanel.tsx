import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store, Gift, MessageSquare } from "lucide-react";
import { listLocationInteractNpcs, buyFromShop, claimNpcReward } from "@/lib/npc-interact.functions";

type Npc = {
  id: string; name: string; image_url: string | null; kind: "shop" | "reward";
  dialog_intro: string | null; dialog_outro: string | null;
  shop_items?: { item_id: string; price: number; stock: number }[];
  reward_items?: { item_id: string; qty: number }[];
  reward_xp?: number; reward_ryo?: number;
  cooldown_remaining_ms?: number;
};
type Item = { id: string; name: string; image_url: string | null };

export function NpcInteractPanel({ locationId, refreshTick }: { locationId: string; refreshTick?: number }) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [open, setOpen] = useState<Npc | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [busy, setBusy] = useState(false);
  const list = useServerFn(listLocationInteractNpcs);
  const buy = useServerFn(buyFromShop);
  const claim = useServerFn(claimNpcReward);

  async function load() {
    try {
      const r = await list({ data: {} } as any);
      setNpcs(r.npcs as Npc[]);
      const ids = new Set<string>();
      for (const n of r.npcs as Npc[]) {
        for (const s of n.shop_items ?? []) ids.add(s.item_id);
        for (const s of n.reward_items ?? []) ids.add(s.item_id);
      }
      if (ids.size) {
        const { data } = await supabase.from("items").select("id,name,image_url").in("id", Array.from(ids));
        const map: Record<string, Item> = {};
        for (const it of (data as Item[]) ?? []) map[it.id] = it;
        setItems(map);
      }
    } catch {/* ignore */}
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [locationId, refreshTick]);

  if (!npcs.length) return null;
  const remH = (ms?: number) => ms && ms > 0 ? Math.ceil(ms / 3600000) : 0;

  return (
    <div className="border border-border rounded p-2 space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        <MessageSquare size={11} /> NPCs no local
      </div>
      <div className="space-y-1">
        {npcs.map((n) => {
          const disabled = n.kind === "reward" && (n.cooldown_remaining_ms ?? 0) > 0;
          return (
            <Button key={n.id} size="sm" variant="outline" className="w-full justify-start" onClick={() => setOpen(n)}>
              {n.kind === "shop" ? <Store size={12} className="mr-1" /> : <Gift size={12} className="mr-1" />}
              <span className="flex-1 truncate text-left">{n.name}</span>
              {disabled && <span className="text-[10px] text-muted-foreground">{remH(n.cooldown_remaining_ms)}h</span>}
            </Button>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => { if (!v) { setOpen(null); load(); } }}>
        <DialogContent className="max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded overflow-hidden bg-secondary shrink-0">
                    {open.image_url && <img src={open.image_url} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <span>{open.name}</span>
                  <Badge variant="outline">{open.kind === "shop" ? "Loja" : "Recompensa"}</Badge>
                </DialogTitle>
              </DialogHeader>
              {open.dialog_intro && (
                <div className="text-sm italic text-muted-foreground border-l-2 border-gold pl-3">
                  {open.dialog_intro}
                </div>
              )}
              {open.kind === "shop" ? (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {(open.shop_items ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem itens à venda.</p>}
                  {(open.shop_items ?? []).map((s, i) => {
                    const it = items[s.item_id];
                    return (
                      <div key={i} className="flex items-center gap-2 border border-border rounded p-2">
                        <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0">
                          {it?.image_url && <img src={it.image_url} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-display truncate">{it?.name ?? "?"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {s.price} Ryo • {Number(s.stock) === -1 ? "estoque ilimitado" : `${s.stock} em estoque`}
                          </div>
                        </div>
                        <Button size="sm" disabled={busy || (Number(s.stock) !== -1 && Number(s.stock) <= 0)}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const r = await buy({ data: { npc_id: open.id, item_id: s.item_id, qty: 1 } });
                              toast.success(`Comprado por ${r.spent} Ryo.`);
                              await load();
                            } catch (e: any) { toast.error(e.message); }
                            finally { setBusy(false); }
                          }}>Comprar</Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm">Recompensa: {open.reward_xp ? `${open.reward_xp} XP` : ""} {open.reward_ryo ? `+ ${open.reward_ryo} Ryo` : ""}</div>
                  {(open.reward_items ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(open.reward_items ?? []).map((r, i) => {
                        const it = items[r.item_id];
                        return (
                          <div key={i} className="flex items-center gap-2 border border-border rounded p-1 pr-2">
                            <div className="w-8 h-8 rounded bg-secondary overflow-hidden">
                              {it?.image_url && <img src={it.image_url} className="w-full h-full object-cover" alt="" />}
                            </div>
                            <span className="text-xs">{it?.name ?? "?"} ×{r.qty}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button disabled={busy || (open.cooldown_remaining_ms ?? 0) > 0}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await claim({ data: { npc_id: open.id } });
                        toast.success("Recompensa recebida.");
                        if (open.dialog_outro) toast.message(open.dialog_outro);
                        await load();
                        setOpen(null);
                      } catch (e: any) { toast.error(e.message); }
                      finally { setBusy(false); }
                    }}>
                    <Gift size={14} className="mr-1" /> Receber recompensa
                  </Button>
                  {(open.cooldown_remaining_ms ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">Disponível em ~{remH(open.cooldown_remaining_ms)}h.</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}