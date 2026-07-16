import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Store, Gift, MessageSquare, Coins, Minus, Plus, Lock, GraduationCap, Box, CheckCircle2, Target, Sparkles, HandCoins, Handshake } from "lucide-react";
import { listLocationInteractNpcs, buyFromShop, claimNpcReward, sellToBuyer } from "@/lib/npc-interact.functions";
import { acceptMissionFromNpc } from "@/lib/npc-interact.functions";
import { claimMission } from "@/lib/missions.functions";
import { listNpcLearningSteps } from "@/lib/minigame.functions";
import { MinigameDialog } from "@/components/minigame/MinigameDialog";
import { NpcMusic } from "@/components/NpcMusic";

type LearnBlock = { id: string; kind: "text" | "image"; text?: string | null; image_url?: string | null };
type Npc = {
  id: string; name: string; image_url: string | null; kind: "shop" | "reward" | "learning" | "object" | "dialogue" | "buyer";
  dialog_intro: string | null; dialog_outro: string | null;
  music_url?: string | null;
  shop_items?: { item_id: string; price: number; stock: number }[];
  buy_items?: { item_id: string; price: number; max_per_day: number }[];
  reward_items?: { item_id: string; qty: number }[];
  reward_xp?: number; reward_ryo?: number;
  cooldown_remaining_ms?: number;
  required_mission_id?: string | null;
  mission_required_name?: string | null;
  mission_unlocked?: boolean;
  offer_mission_id?: string | null;
  offer_mission?: {
    id: string; name: string;
    objectives: Array<{ id: string; type: string; count: number; description: string | null; target_ref?: string | null }>;
    reward_xp: number; reward_ryo: number; rewards: any;
    cooldown_hours: number; repeatable: boolean;
  } | null;
  offer_status?: "available" | "in_progress" | "ready" | "claimed" | "cooldown";
  offer_progress?: Record<string, number>;
  offer_cooldown_until?: string | null;
  offer_conflicts?: { mission_id: string; mission_name: string; shared: string[] }[];
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
  const [outro, setOutro] = useState<string | null>(null);
  const [ryo, setRyo] = useState<number>(0);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [objMinigame, setObjMinigame] = useState<any | null>(null);
  const [objOpen, setObjOpen] = useState(false);
  const [charId, setCharId] = useState<string | null>(null);
  const list = useServerFn(listLocationInteractNpcs);
  const buy = useServerFn(buyFromShop);
  const claim = useServerFn(claimNpcReward);
  const sell = useServerFn(sellToBuyer);
  const accept = useServerFn(acceptMissionFromNpc);
  const turnIn = useServerFn(claimMission);

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
      // Também carrega catálogo dos itens que os NPCs compradores aceitam.
      const buyIds = new Set<string>();
      for (const n of r.npcs as Npc[]) for (const s of n.buy_items ?? []) buyIds.add(s.item_id);
      if (buyIds.size) {
        const { data } = await supabase.from("items").select("id,name,image_url,description,type").in("id", Array.from(buyIds));
        setItems((m) => {
          const next = { ...m };
          for (const it of (data as Item[]) ?? []) next[it.id] = it;
          return next;
        });
      }
      const { data: me } = await supabase.auth.getUser();
      if (me.user) {
        const { data: ch } = await supabase.from("characters").select("id,ryo").eq("user_id", me.user.id).maybeSingle();
        setRyo(Number((ch as any)?.ryo ?? 0));
        setCharId((ch as any)?.id ?? null);
      }
    } catch {/* ignore */}
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [locationId, refreshTick]);

  // Realtime: refresh NPC offer progress when this character's mission rows change.
  useEffect(() => {
    if (!charId) return;
    const ch = supabase
      .channel(`npc-panel-missions:${charId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "character_missions", filter: `character_id=eq.${charId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [charId]);

  if (!npcs.length) return null;
  const remH = (ms?: number) => ms && ms > 0 ? Math.ceil(ms / 3600000) : 0;
  const shopNpcs = npcs.filter((n) => n.kind === "shop");
  const rewardNpcs = npcs.filter((n) => n.kind === "reward");
  const learningNpcs = npcs.filter((n) => n.kind === "learning");
  const objectNpcs = npcs.filter((n) => n.kind === "object");
  const dialogueNpcs = npcs.filter((n) => n.kind === "dialogue");
  const buyerNpcs = npcs.filter((n) => n.kind === "buyer");
  const getQty = (k: string) => Math.max(1, qtys[k] ?? 1);
  const setQty = (k: string, v: number) => setQtys((s) => ({ ...s, [k]: Math.max(1, Math.min(50, v)) }));

  async function openObject(n: Npc) {
    if (!n.linked_minigame_id) { toast.error("Este objeto ainda não tem minigame vinculado."); return; }
    const { data } = await supabase.from("minigames").select("*").eq("id", n.linked_minigame_id).maybeSingle();
    if (!data) { toast.error("Minigame não encontrado."); return; }
    setObjMinigame(data);
    setObjOpen(true);
  }

  return (
    <div className="border border-border rounded p-2 space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        <MessageSquare size={11} /> NPCs no local
      </div>
      {objectNpcs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Box size={11} /> Objetos</div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            {objectNpcs.map((n) => (
              <Button
                key={n.id}
                size="sm"
                variant="outline"
                className="gap-2 mx-auto sm:mx-0"
                onClick={() => openObject(n)}
              >
                {n.image_url ? (
                  <img src={n.image_url} className="w-5 h-5 rounded object-cover" alt="" />
                ) : (
                  <Box size={12} className="text-gold" />
                )}
                <span className="truncate">{n.name}</span>
                <Badge variant="secondary" className="text-[10px]">Interagir</Badge>
              </Button>
            ))}
          </div>
        </div>
      )}
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
      {buyerNpcs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><HandCoins size={11} /> Compradores</div>
          {buyerNpcs.map((n) => (
            <Button key={n.id} size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(n)}>
              <HandCoins size={12} className="text-gold" />
              <span className="flex-1 truncate text-left">{n.name}</span>
              <Badge variant="secondary" className="text-[10px]">Vender itens</Badge>
            </Button>
          ))}
        </div>
      )}
      {dialogueNpcs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Handshake size={11} /> Diálogos</div>
          {dialogueNpcs.map((n) => {
            const offer = n.offer_status;
            return (
              <Button key={n.id} size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(n)}>
                <Handshake size={12} className="text-gold" />
                <span className="flex-1 truncate text-left">{n.name}</span>
                {offer === "available" && <Badge className="text-[10px]">Nova missão</Badge>}
                {offer === "in_progress" && <Badge variant="secondary" className="text-[10px]">Em andamento</Badge>}
                {offer === "ready" && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Entregar</Badge>}
              </Button>
            );
          })}
        </div>
      )}
      {rewardNpcs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Gift size={11} /> Recompensas</div>
          {rewardNpcs.map((n) => {
            const locked = n.mission_unlocked === false;
            const cooldown = (n.cooldown_remaining_ms ?? 0) > 0;
            const offer = n.offer_status;
            return (
              <Button key={n.id} size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setOpen(n)}>
                {locked ? <Lock size={12} className="text-muted-foreground" /> : <Gift size={12} className="text-gold" />}
                <span className="flex-1 truncate text-left">{n.name}</span>
                {offer === "available" && <Badge className="text-[10px]">Nova missão</Badge>}
                {offer === "in_progress" && <Badge variant="secondary" className="text-[10px]">Em andamento</Badge>}
                {offer === "ready" && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">Entregar</Badge>}
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
              <NpcMusic src={open.music_url} />
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
              {outro ? (
                <div className="text-sm italic text-foreground border-l-2 border-gold pl-3 bg-gold/5 py-2 rounded-r">
                  {outro}
                </div>
              ) : open.dialog_intro && (
                <div className="text-sm italic text-muted-foreground border-l-2 border-gold pl-3">
                  {open.dialog_intro}
                </div>
              )}
              {outro ? (
                <div className="flex justify-end">
                  <Button onClick={() => { setOutro(null); setOpen(null); load(); }}>Fechar</Button>
                </div>
              ) : open.kind === "learning" ? (
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
                  {open.offer_mission && (
                    <MissionOfferBlock
                      npc={open}
                      busy={busy}
                      onAccept={async () => {
                        setBusy(true);
                        try { await accept({ data: { npc_id: open.id } }); toast.success("Missão aceita!"); await load(); }
                        catch (e: any) { toast.error(e.message); }
                        finally { setBusy(false); }
                      }}
                      onTurnIn={async () => {
                        setBusy(true);
                        try {
                          const r: any = await turnIn({ data: { mission_id: open.offer_mission!.id } });
                          toast.success(`Missão entregue! +${r?.applied?.xp ?? 0} XP · +${r?.applied?.ryo ?? 0} Ryo`);
                          if (open.dialog_outro) setOutro(open.dialog_outro);
                          await load();
                        }
                        catch (e: any) { toast.error(e.message); }
                        finally { setBusy(false); }
                      }}
                    />
                  )}
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
                        await load();
                        if (open.dialog_outro) setOutro(open.dialog_outro);
                        else setOpen(null);
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
      {objMinigame && (
        <MinigameDialog
          minigame={objMinigame}
          open={objOpen}
          onOpenChange={(v) => { setObjOpen(v); if (!v) { setObjMinigame(null); load(); } }}
        />
      )}
    </div>
  );
}
function LearningNpcView({ npc, onClose }: { npc: Npc; onClose: () => void }) {
  const blocks: LearnBlock[] = Array.isArray(npc.tutorial_blocks) ? npc.tutorial_blocks : [];
  const minSec = Math.max(5, Number(npc.learning_min_read_seconds ?? 30));
  const [elapsed, setElapsed] = useState(0);
  const [minigame, setMinigame] = useState<any | null>(null);
  const [openMg, setOpenMg] = useState(false);
  const [ready, setReady] = useState(false);
  const [steps, setSteps] = useState<any[] | null>(null);
  const loadSteps = useServerFn(listNpcLearningSteps);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (elapsed >= minSec) setReady(true); }, [elapsed, minSec]);
  useEffect(() => { loadSteps({ data: { npc_id: npc.id } }).then((r) => setSteps(r.steps)).catch(() => setSteps([])); /* eslint-disable-next-line */ }, [npc.id]);

  async function startMinigame(minigameId: string) {
    const { data } = await supabase.from("minigames").select("*").eq("id", minigameId).maybeSingle();
    if (!data) return toast.error("Minigame não encontrado.");
    setMinigame(data);
    setOpenMg(true);
  }

  const remaining = Math.max(0, minSec - elapsed);
  const nextAvailable = (steps ?? []).find((s) => s.status === "available");
  const nextLocked = !nextAvailable ? (steps ?? []).find((s) => s.status === "locked") : null;
  const allCompleted = (steps?.length ?? 0) > 0 && (steps ?? []).every((s) => s.status === "completed");
  const lockedBlockers: string[] = nextLocked?.blockers?.length ? nextLocked.blockers : [];
  const startBtn = (
    <Button
      disabled={!ready || !nextAvailable}
      onClick={() => nextAvailable && startMinigame(nextAvailable.minigame_id)}
      className={!nextAvailable && nextLocked ? "h-auto flex-col items-start py-2 gap-0.5" : undefined}
    >
      <span className="flex items-center gap-1">
        <GraduationCap size={14} />
        {nextAvailable ? `Iniciar: ${nextAvailable.name}` : allCompleted ? "Tudo concluído" : "Sem passo disponível"}
      </span>
      {!nextAvailable && nextLocked && (
        <span className="text-[10px] text-muted-foreground leading-tight text-left whitespace-normal">
          {lockedBlockers.length ? lockedBlockers.join(" · ") : "Conclua o passo anterior"}
        </span>
      )}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-3">
        {blocks.length === 0 && <div className="text-sm text-muted-foreground">Este NPC ainda não tem tutorial configurado.</div>}
        {blocks.map((b) => b.kind === "text"
          ? <div key={b.id} className="whitespace-pre-wrap text-sm leading-relaxed">{b.text ?? ""}</div>
          : (b.image_url ? <img key={b.id} src={b.image_url} className="w-full rounded" alt="" /> : null)
        )}
        {steps && steps.length > 0 && (
          <div className="border-t border-border pt-2 space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Progresso de aprendizado</div>
            {steps.map((s: any, i: number) => (
              <div key={s.id ?? i} className={`flex items-center gap-2 text-xs p-2 rounded border ${
                s.status === "completed" ? "border-emerald-700/40 bg-emerald-950/30" :
                s.status === "available" ? "border-gold/40 bg-secondary/40" :
                "border-border bg-secondary/20 opacity-70"}`}>
                <span className="font-mono">{i + 1}.</span>
                <span className="flex-1 truncate">{s.name}</span>
                {s.status === "completed" && <Badge variant="secondary" className="text-[10px]">Concluído</Badge>}
                {s.status === "available" && <Badge className="text-[10px]">Disponível</Badge>}
                {s.status === "locked" && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Lock size={10}/> {s.blockers?.length ? s.blockers.join(" · ") : "aguarde o anterior"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border pt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {ready
            ? "Você já pode iniciar o treino."
            : <span className="flex items-center gap-1"><Lock size={12}/> Leia por mais {remaining >= 60 ? `${Math.floor(remaining/60)}min ${remaining%60}s` : `${remaining}s`}…</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {!nextAvailable && nextLocked ? (
            <Popover>
              <TooltipProvider>
                <Tooltip>
                  <PopoverTrigger asChild>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>{startBtn}</span>
                    </TooltipTrigger>
                  </PopoverTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="text-[11px] font-semibold mb-1">Requisitos para "{nextLocked.name}":</div>
                    <ul className="text-[11px] list-disc pl-4 space-y-0.5">
                      {lockedBlockers.length
                        ? lockedBlockers.map((b, i) => <li key={i}>{b}</li>)
                        : <li>Conclua o passo anterior.</li>}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <PopoverContent side="top" className="max-w-xs text-xs">
                <div className="font-semibold mb-1">Requisitos para "{nextLocked.name}":</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {lockedBlockers.length
                    ? lockedBlockers.map((b, i) => <li key={i}>{b}</li>)
                    : <li>Conclua o passo anterior.</li>}
                </ul>
              </PopoverContent>
            </Popover>
          ) : startBtn}
        </div>
      </div>
      {minigame && (
        <MinigameDialog minigame={minigame} open={openMg} onOpenChange={(v) => { setOpenMg(v); if (!v) onClose(); }} />
      )}
    </div>
  );
}

function MissionOfferBlock({ npc, busy, onAccept, onTurnIn }: {
  npc: Npc; busy: boolean; onAccept: () => void; onTurnIn: () => void;
}) {
  const m = npc.offer_mission!;
  const status = npc.offer_status ?? "available";
  const progress = npc.offer_progress ?? {};
  const describe = (o: any) => o.description || (
    o.type === "kill_npc" ? "Derrotar alvo" :
    o.type === "kill_npc_kind" ? `Derrotar (${o.target_ref ?? "tipo"})` :
    o.type === "kill_npc_group" ? "Derrotar grupo" :
    o.type === "complete_minigame" ? "Completar minigame" :
    o.type === "read_book" ? "Ler livro" :
    o.type === "reach_location" ? "Chegar a local" :
    o.type === "learn_skill" ? "Aprender habilidade" :
    o.type === "craft_item" ? "Fabricar item" :
    o.type === "collect_item" ? "Coletar item" :
    o.type === "pvp_win" ? "Vencer duelo PvP" :
    o.type === "talk_npc" ? "Falar com NPC" :
    o.type === "reach_rank" ? "Atingir patente" :
    o.type === "reach_level" ? "Atingir nível" :
    o.type === "reach_proficiency" ? "Atingir proficiência" :
    "Objetivo"
  );
  const countsHint = (o: any): string => {
    switch (o.type) {
      case "kill_npc":         return `Cada derrota do NPC "${o.target_ref ?? "alvo"}" conta +1.`;
      case "kill_npc_kind":    return `Cada derrota de um NPC do tipo "${o.target_ref ?? "?"}" conta +1.`;
      case "kill_npc_group":   return `Cada NPC derrotado do grupo "${o.target_ref ?? "?"}" conta +1.`;
      case "complete_minigame":return `Concluir o minigame "${o.target_ref ?? "?"}" conta +1.`;
      case "read_book":        return `Terminar a leitura do livro "${o.target_ref ?? "?"}" conta +1.`;
      case "reach_location":   return `Chegar ao local "${o.target_ref ?? "?"}" marca o objetivo.`;
      case "learn_skill":      return `Aprender a habilidade "${o.target_ref ?? "?"}" marca o objetivo.`;
      case "craft_item":       return `Cada "${o.target_ref ?? "item"}" fabricado conta +1.`;
      case "collect_item":     return `Ter "${o.target_ref ?? "item"}" na bolsa conta a quantidade atual.`;
      case "reach_rank":       return `Ao alcançar a patente "${o.target_ref ?? "?"}" o objetivo é marcado.`;
      case "reach_level":      return `Ao alcançar o nível ${o.target_ref ?? "?"} o objetivo é marcado.`;
      case "reach_proficiency":return `Atingir "${o.target_ref ?? "?"}" marca o objetivo.`;
      case "pvp_win":          return "Cada vitória em duelo PvP conta +1.";
      case "talk_npc":         return `Falar com "${o.target_ref ?? "?"}" marca o objetivo.`;
      case "custom":           return "Marcação manual por um administrador.";
      default:                 return "Progresso registrado automaticamente.";
    }
  };

  // Detect objective completion transitions to give feedback.
  const prev = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (status !== "in_progress" && status !== "ready") { prev.current = { ...progress }; return; }
    for (const o of m.objectives) {
      const before = Math.min(Number(prev.current[o.id] ?? 0), o.count);
      const now = Math.min(Number(progress[o.id] ?? 0), o.count);
      if (before < o.count && now >= o.count) {
        toast.success(`Objetivo concluído: ${describe(o)}`);
        setFlash((s) => ({ ...s, [o.id]: true }));
        setTimeout(() => setFlash((s) => ({ ...s, [o.id]: false })), 1600);
      }
    }
    prev.current = { ...progress };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(progress), status]);

  const totalObjs = m.objectives.length;
  const doneObjs = m.objectives.filter((o) => Math.min(Number(progress[o.id] ?? 0), o.count) >= o.count).length;
  const showList = totalObjs > 0;
  return (
    <div className="rounded-lg border border-gold/40 bg-gold/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-display text-gold flex items-center gap-2">
          <Gift size={14} /> Missão: {m.name}
        </div>
        <Badge variant="outline" className="text-[10px]">
          {status === "available" ? "Disponível" :
           status === "in_progress" ? "Em andamento" :
           status === "ready" ? "Pronto para entregar" :
           status === "cooldown" ? "Cooldown" : "Concluída"}
        </Badge>
      </div>
      {showList && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Target size={11} /> Objetivos
            {(status === "in_progress" || status === "ready") && (
              <span className="ml-auto font-mono normal-case tracking-normal">
                {doneObjs}/{totalObjs} concluídos
              </span>
            )}
          </div>
          <ul className="space-y-1.5">
            {m.objectives.map((o) => {
              const cur = Math.min(Number(progress[o.id] ?? 0), o.count);
              const done = cur >= o.count;
              const pct = Math.round((cur / Math.max(1, o.count)) * 100);
              const isFlashing = !!flash[o.id];
              const showProgress = status === "in_progress" || status === "ready";
              return (
                <li
                  key={o.id}
                  className={`rounded-md border p-2 text-xs transition-colors ${
                    isFlashing ? "border-emerald-400 bg-emerald-500/15 animate-pulse" :
                    done ? "border-emerald-700/40 bg-emerald-950/30" :
                    "border-border/60 bg-background/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {done
                      ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      : <span className="h-3 w-3 rounded-full border border-muted-foreground/60 shrink-0" />}
                    <span className={`flex-1 truncate ${done ? "line-through text-muted-foreground" : ""}`}>{describe(o)}</span>
                    {showProgress && (
                      <span className={`font-mono text-[11px] ${done ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {cur}/{o.count}
                      </span>
                    )}
                  </div>
                  {showProgress && o.count > 1 && (
                    <div className="mt-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={`h-full transition-all ${done ? "bg-emerald-500" : "bg-gold"}`}
                        style={{ width: `${Math.min(100, Math.max(done ? 100 : pct, 0))}%` }}
                      />
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground/90 leading-snug">
                    {countsHint(o)}
                  </div>
                </li>
              );
            })}
          </ul>
          {status === "ready" && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <Sparkles size={12} /> Todos os objetivos concluídos — volte ao NPC para entregar!
            </div>
          )}
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">
        Recompensa: +{m.reward_xp} XP · +{m.reward_ryo} Ryo
        {(m.rewards?.items?.length ?? 0) > 0 && ` · ${m.rewards.items.length} item(ns)`}
        {(m.rewards?.skill_ids?.length ?? 0) > 0 && ` · ${m.rewards.skill_ids.length} habilidade(s)`}
      </div>
      {(status === "available" || status === "in_progress") && (npc.offer_conflicts?.length ?? 0) > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-[11px] text-amber-200 space-y-1">
          <div className="font-semibold flex items-center gap-1"><Sparkles size={11}/> Objetivos compartilhados</div>
          <div className="text-amber-100/90">
            Esta missão tem objetivos em comum com outra(s) missão(ões) suas em andamento. O progresso conta para todas simultaneamente:
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {npc.offer_conflicts!.map((c) => (
              <li key={c.mission_id}>
                <span className="font-medium">{c.mission_name}</span>
                {c.shared.length > 0 && <span className="text-amber-100/70"> — {c.shared.join(", ")}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end">
        {status === "available" && (
          <Button size="sm" disabled={busy} onClick={onAccept}>Aceitar missão</Button>
        )}
        {status === "in_progress" && (
          <span className="text-xs text-muted-foreground">Complete os objetivos e volte aqui.</span>
        )}
        {status === "ready" && (
          <Button size="sm" disabled={busy} onClick={onTurnIn}>Entregar & receber recompensa</Button>
        )}
        {status === "cooldown" && npc.offer_cooldown_until && (
          <span className="text-xs text-muted-foreground">Disponível em {new Date(npc.offer_cooldown_until).toLocaleString()}</span>
        )}
        {status === "claimed" && (
          <span className="text-xs text-muted-foreground">Missão já concluída.</span>
        )}
      </div>
    </div>
  );
}
