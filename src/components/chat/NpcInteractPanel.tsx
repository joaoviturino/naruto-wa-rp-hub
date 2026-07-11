import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Store, Gift, MessageSquare, Coins, Minus, Plus, Lock, GraduationCap } from "lucide-react";
import { listLocationInteractNpcs, buyFromShop, claimNpcReward } from "@/lib/npc-interact.functions";
import { MinigameDialog } from "@/components/minigame/MinigameDialog";

type LearnBlock = { id: string; kind: "text" | "image"; text?: string | null; image_url?: string | null };
type Npc = {
  id: string; name: string; image_url: string | null; kind: "shop" | "reward" | "learning";
  dialog_intro: string | null; dialog_outro: string | null;
  shop_items?: { item_id: string; price: number; stock: number }[];
  reward_items?: { item_id: string; qty: number }[];
  reward_xp?: number; reward_ryo?: number;
  cooldown_remaining_ms?: number;
  required_mission_id?: string | null;
  mission_required_name?: string | null;
  mission_unlocked?: boolean;
  tutorial_blocks?: LearnBlock[];
  learning_min_read_seconds?: number;
  linked_minigame_id?: string | null;
};
type Item = { id: string; name: string; image_url: string | null; description: string | null; type: string | null };

export function NpcInteractPanel({ locationId, refreshTick }: { locationId: string; refreshTick?: number }) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [open, setOpen] = useState<Npc | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [busy, setBusy] = useState(false);
  const [ryo, setRyo] = useState<number>(0);
  const [qtys, setQtys] = useState<Record<string, number>>({});
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
        const { data } = await supabase.from("items").select("id,name,image_url,description,type").in("id", Array.from(ids));
        const map: Record<string, Item> = {};
        for (const it of (data as Item[]) ?? []) map[it.id] = it;
        setItems(map);
      }
      const { data: me } = await supabase.auth.getUser();
      if (me.user) {
        const { data: ch } = await supabase.from("characters").select("ryo").eq("user_id", me.user.id).maybeSingle();
        setRyo(Number((ch as any)?.ryo ?? 0));
      }
    } catch {/* ignore */}
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [locationId, refreshTick]);

  if (!npcs.length) return null;
  const remH = (ms?: number) => ms && ms > 0 ? Math.ceil(ms / 3600000) : 0;
  const shopNpcs = npcs.filter((n) => n.kind === "shop");
  const rewardNpcs = npcs.filter((n) => n.kind === "reward");
  const learningNpcs = npcs.filter((n) => n.kind === "learning");
  const getQty = (k: string) => Math.max(1, qtys[k] ?? 1);
  const setQty = (k: string, v: number) => setQtys((s) => ({ ...s, [k]: Math.max(1, Math.min(50, v)) }));

  return (
    <div className="border border-border rounded p-2 space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        <MessageSquare size={11} /> NPCs no local
      </div>
      {shopNpcs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Store size={11} /> Lojas</div>
          {shopNpcs.map((n) => (
            <Button key={n.id} size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(n)}>
              <Store size={12} className="text-gold" />
              <span className="flex-1 truncate text-left">{n.name}</span>
              <Badge variant="secondary" className="text-[10px]">Abrir loja</Badge>
            </Button>
          ))}
        </div>
      )}
      {rewardNpcs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Gift size={11} /> Recompensas</div>
          {rewardNpcs.map((n) => {
            const locked = n.mission_unlocked === false;
            const cooldown = (n.cooldown_remaining_ms ?? 0) > 0;
            return (
              <Button key={n.id} size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(n)}>
                {locked ? <Lock size={12} className="text-muted-foreground" /> : <Gift size={12} className="text-gold" />}
                <span className="flex-1 truncate text-left">{n.name}</span>
                {locked && <span className="text-[10px] text-muted-foreground">bloqueado</span>}
                {!locked && cooldown && <span className="text-[10px] text-muted-foreground">{remH(n.cooldown_remaining_ms)}h</span>}
              </Button>
            );
          })}
        </div>
      )}
      {learningNpcs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><GraduationCap size={11} /> Aprendizagem</div>
          {learningNpcs.map((n) => (
            <Button key={n.id} size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(n)}>
              <GraduationCap size={12} className="text-gold" />
              <span className="flex-1 truncate text-left">{n.name}</span>
              <Badge variant="secondary" className="text-[10px]">Aprender</Badge>
            </Button>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => { if (!v) { setOpen(null); load(); } }}>
        <DialogContent className="max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded overflow-hidden bg-secondary shrink-0 border border-border">
                    {open.image_url && <img src={open.image_url} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{open.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{open.kind === "shop" ? "Loja" : "Recompensa"}</Badge>
                      {open.kind === "shop" && (
                        <span className="text-xs text-gold flex items-center gap-1"><Coins size={12} /> {ryo} Ryo</span>
                      )}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              {open.dialog_intro && (
                <div className="text-sm italic text-muted-foreground border-l-2 border-gold pl-3">
                  {open.dialog_intro}
                </div>
              )}
              {open.kind === "learning" ? (
                <LearningNpcView npc={open} onClose={() => { setOpen(null); load(); }} />
              ) : open.kind === "shop" ? (
                <div className="grid gap-2 sm:grid-cols-2 max-h-[55vh] overflow-y-auto pr-1">
                  {(open.shop_items ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem itens à venda.</p>}
                  {(open.shop_items ?? []).map((s, i) => {
                    const it = items[s.item_id];
                    const key = `${open.id}:${s.item_id}`;
                    const qty = getQty(key);
                    const stockLeft = Number(s.stock);
                    const outOfStock = stockLeft !== -1 && stockLeft <= 0;
                    const total = Number(s.price) * qty;
                    const cannotAfford = ryo < total;
                    return (
                      <div key={i} className="border border-border rounded-lg p-2 flex flex-col gap-2 bg-secondary/20">
                        <div className="flex gap-2">
                          <div className="w-14 h-14 rounded bg-secondary overflow-hidden shrink-0 border border-border">
                            {it?.image_url && <img src={it.image_url} className="w-full h-full object-cover" alt="" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-display truncate">{it?.name ?? "?"}</div>
                            {it?.type && <Badge variant="outline" className="text-[9px] mt-0.5">{it.type}</Badge>}
                            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Coins size={10} className="text-gold" /> {s.price} Ryo
                              <span>•</span>
                              <span>{stockLeft === -1 ? "∞ estoque" : `${stockLeft} em estoque`}</span>
                            </div>
                          </div>
                        </div>
                        {it?.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{it.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-auto">
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={outOfStock || qty <= 1}
                            onClick={() => setQty(key, qty - 1)}><Minus size={12} /></Button>
                          <div className="w-8 text-center text-sm font-mono">{qty}</div>
                          <Button variant="outline" size="icon" className="h-7 w-7" disabled={outOfStock || (stockLeft !== -1 && qty >= stockLeft)}
                            onClick={() => setQty(key, qty + 1)}><Plus size={12} /></Button>
                          <Button size="sm" className="flex-1" disabled={busy || outOfStock || cannotAfford}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const r = await buy({ data: { npc_id: open.id, item_id: s.item_id, qty } });
                                toast.success(`Comprado ${qty}× por ${r.spent} Ryo.`);
                                setQty(key, 1);
                                await load();
                              } catch (e: any) { toast.error(e.message); }
                              finally { setBusy(false); }
                            }}>
                            {outOfStock ? "Esgotado" : cannotAfford ? "Sem Ryo" : `Comprar ${total}`}
                          </Button>
                        </div>
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
                  {open.mission_unlocked === false && (
                    <div className="text-xs text-destructive border border-destructive/40 rounded p-2 flex items-center gap-2">
                      <Lock size={12} /> Requer a missão "{open.mission_required_name}" concluída.
                    </div>
                  )}
                  <Button disabled={busy || (open.cooldown_remaining_ms ?? 0) > 0 || open.mission_unlocked === false}
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