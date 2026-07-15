import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Store, Gift, MessageSquare, Coins, Minus, Plus, Lock, GraduationCap, Box } from "lucide-react";
import { listLocationInteractNpcs, buyFromShop, claimNpcReward } from "@/lib/npc-interact.functions";
import { listNpcLearningSteps } from "@/lib/minigame.functions";
import { MinigameDialog } from "@/components/minigame/MinigameDialog";
import { NpcMusic } from "@/components/NpcMusic";

type LearnBlock = { id: string; kind: "text" | "image"; text?: string | null; image_url?: string | null };
type Npc = {
  id: string; name: string; image_url: string | null; kind: "shop" | "reward" | "learning" | "object";
  dialog_intro: string | null; dialog_outro: string | null;
  music_url?: string | null;
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
  const [objMinigame, setObjMinigame] = useState<any | null>(null);
  const [objOpen, setObjOpen] = useState(false);
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
  const objectNpcs = npcs.filter((n) => n.kind === "object");
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
