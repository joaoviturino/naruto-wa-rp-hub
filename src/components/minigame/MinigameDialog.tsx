import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { startMinigameRun, completeMinigameRun } from "@/lib/minigame.functions";
import { CleanupGame } from "./CleanupGame";
import { SequenceGame } from "./SequenceGame";
import { ForgeGame } from "./ForgeGame";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Minigame = {
  id: string; name: string; kind: string;
  background_url: string | null; tileset_url: string | null;
  npc_portrait_url: string | null; npc_name: string | null;
  dialog_intro: string | null; dialog_outro: string | null;
  config: any; rewards: any;
};

export function MinigameDialog({
  minigame, open, onOpenChange, onCompleted,
}: {
  minigame: Minigame;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCompleted?: () => void;
}) {
  const start = useServerFn(startMinigameRun);
  const complete = useServerFn(completeMinigameRun);
  const [stage, setStage] = useState<"intro" | "play" | "outro">("intro");
  const [runId, setRunId] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; success: boolean; rewards: any } | null>(null);
  const [busy, setBusy] = useState(false);

  // Forge state
  const [bag, setBag] = useState<Array<{ item_id: string; qty: number; name: string; image_url: string | null }>>([]);
  const [craftables, setCraftables] = useState<Array<{ id: string; name: string; image_url: string | null; recipe: Array<{ item_id: string; qty: number }> }>>([]);
  const [selection, setSelection] = useState<Record<string, number>>({});
  const isForge = minigame.kind === "forge";

  const forgeMatch = (() => {
    if (!isForge) return null;
    const selEntries = Object.entries(selection).filter(([, q]) => q > 0);
    if (!selEntries.length) return null;
    const selMap = new Map(selEntries.map(([k, v]) => [k, v]));
    return craftables.find((c) => {
      if (!c.recipe.length) return false;
      const rMap = new Map<string, number>();
      for (const r of c.recipe) rMap.set(r.item_id, (rMap.get(r.item_id) ?? 0) + Number(r.qty || 0));
      if (rMap.size !== selMap.size) return false;
      for (const [k, v] of rMap.entries()) if (selMap.get(k) !== v) return false;
      return true;
    }) ?? null;
  })();

  useEffect(() => {
    let cancel = false;
    async function loadForgeData() {
      if (!isForge || !open) return;
      setSelection({});
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const { data: ch } = await supabase.from("characters").select("id").eq("user_id", uid).maybeSingle();
      if (!ch) return;
      const { data: inv } = await supabase.from("inventory").select("ninja_bag").eq("character_id", ch.id).maybeSingle();
      const rawBag: Array<{ item_id: string; qty: number }> = (((inv?.ninja_bag as any[]) ?? [])
        .filter((e: any) => e && e.item_id)
        .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 })));
      // agrega qty por item
      const agg = new Map<string, number>();
      rawBag.forEach((e) => agg.set(e.item_id, (agg.get(e.item_id) ?? 0) + e.qty));
      const ids = Array.from(agg.keys());
      const { data: itemsData } = ids.length
        ? await supabase.from("items").select("id,name,image_url").in("id", ids)
        : { data: [] as any[] };
      const byId = new Map((itemsData ?? []).map((i: any) => [i.id, i]));
      // Também carrega TODOS os itens com receita (para matching)
      const { data: allItems } = await supabase.from("items").select("id,name,image_url,meta");
      const craftablesList = (allItems ?? [])
        .filter((it: any) => Array.isArray(it?.meta?.recipe) && it.meta.recipe.length > 0)
        .map((it: any) => ({
          id: it.id, name: it.name, image_url: it.image_url ?? null,
          recipe: it.meta.recipe as Array<{ item_id: string; qty: number }>,
        }));
      if (cancel) return;
      setBag(Array.from(agg.entries()).map(([item_id, qty]) => ({
        item_id, qty,
        name: byId.get(item_id)?.name ?? "?",
        image_url: byId.get(item_id)?.image_url ?? null,
      })).sort((a, b) => a.name.localeCompare(b.name)));
      setCraftables(craftablesList);
    }
    loadForgeData();
    return () => { cancel = true; };
  }, [minigame.id, isForge, open]);

  function bump(item_id: string, delta: number) {
    setSelection((prev) => {
      const cur = prev[item_id] ?? 0;
      const max = bag.find((b) => b.item_id === item_id)?.qty ?? 0;
      const next = Math.max(0, Math.min(max, cur + delta));
      const out = { ...prev };
      if (next <= 0) delete out[item_id]; else out[item_id] = next;
      return out;
    });
  }

  async function begin() {
    setBusy(true);
    try {
      const payload: any = { minigame_id: minigame.id };
      if (isForge) {
        payload.forge_selection = Object.entries(selection)
          .filter(([, q]) => q > 0)
          .map(([item_id, qty]) => ({ item_id, qty }));
      }
      const r = await start({ data: payload });
      setRunId(r.run_id);
      setStage("play");
    } catch (e: any) { toast.error(e.message); onOpenChange(false); }
    finally { setBusy(false); }
  }

  async function onFinish(res: { score: number; success: boolean }) {
    if (!runId) return;
    try {
      const r = await complete({ data: { run_id: runId, score: res.score, success: res.success } });
      setResult({ ...res, rewards: r.rewards });
      setStage("outro");
      onCompleted?.();
    } catch (e: any) { toast.error(e.message); onOpenChange(false); }
  }

  function close() {
    setStage("intro"); setRunId(null); setResult(null); setSelection({});
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{minigame.name}</DialogTitle></DialogHeader>

        {stage === "intro" && (
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {minigame.npc_portrait_url && (
              <img src={minigame.npc_portrait_url} className="w-32 h-32 rounded object-cover shrink-0" alt="" />
            )}
            <div className="flex-1 space-y-3">
              <div className="font-display text-lg text-gold">{minigame.npc_name ?? "NPC"}</div>
              <p className="whitespace-pre-wrap text-sm">{minigame.dialog_intro || "Bora começar?"}</p>
              {isForge && (
                <div className="rounded border border-border p-3 bg-secondary/30 space-y-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Bolsa Ninja — escolha os materiais</div>
                  {bag.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sua bolsa está vazia.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1">
                      {bag.map((b) => {
                        const sel = selection[b.item_id] ?? 0;
                        return (
                          <div key={b.item_id} className={`flex items-center gap-2 border rounded p-2 ${sel > 0 ? "border-gold bg-gold/10" : "border-border"}`}>
                            <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0">
                              {b.image_url && <img src={b.image_url} className="w-full h-full object-contain" alt="" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate">{b.name}</div>
                              <div className="text-[10px] text-muted-foreground">Tem: {b.qty}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" className="w-6 h-6 rounded bg-secondary hover:bg-secondary/70 text-sm" onClick={() => bump(b.item_id, -1)}>−</button>
                              <span className="w-6 text-center text-sm tabular-nums">{sel}</span>
                              <button type="button" className="w-6 h-6 rounded bg-secondary hover:bg-secondary/70 text-sm" onClick={() => bump(b.item_id, 1)}>+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {forgeMatch ? (
                    <div className="rounded border border-gold/60 bg-gold/10 p-2 flex items-center gap-3">
                      {forgeMatch.image_url && <img src={forgeMatch.image_url} className="w-10 h-10 object-contain" alt="" />}
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sugestão de forja</div>
                        <div className="font-display text-gold">{forgeMatch.name}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">
                      {Object.keys(selection).length === 0
                        ? "Selecione materiais para ver o que pode ser forjado."
                        : "Nenhuma receita conhecida bate com essa combinação."}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={begin} disabled={busy || (isForge && !forgeMatch)}>
                  {busy ? "…" : (isForge ? "Iniciar Forja" : "Aceitar missão")}
                </Button>
                <Button variant="outline" onClick={close}>Sair</Button>
              </div>
            </div>
          </div>
        )}

        {stage === "play" && (
          (minigame.kind === "forge"
            ? <ForgeGame background={minigame.background_url} config={minigame.config ?? {}} preview={forgeMatch ? { name: forgeMatch.name, icon: forgeMatch.image_url } : undefined} onFinish={onFinish} />
            : minigame.kind === "sequence"
            ? <SequenceGame background={minigame.background_url} config={minigame.config ?? {}} onFinish={onFinish} />
            : <CleanupGame background={minigame.background_url} tileset={minigame.tileset_url} config={minigame.config ?? {}} onFinish={onFinish} />
          )
        )}

        {stage === "outro" && result && (
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {minigame.npc_portrait_url && (
              <img src={minigame.npc_portrait_url} className="w-32 h-32 rounded object-cover shrink-0" alt="" />
            )}
            <div className="flex-1 space-y-3">
              <div className="font-display text-lg text-gold">{minigame.npc_name ?? "NPC"}</div>
              <p className="whitespace-pre-wrap text-sm">
                {result.success ? (minigame.dialog_outro || "Obrigado pelo trabalho!") : "Poxa, não foi dessa vez. Tenta de novo depois."}
              </p>
              {result.success && result.rewards && Object.keys(result.rewards).length > 0 && (
                <div className="rounded border border-border p-2 text-sm">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Recompensas</div>
                  <div className="flex flex-wrap gap-2 text-gold">
                    {result.rewards.xp ? <span>+{result.rewards.xp} XP</span> : null}
                    {result.rewards.ryo ? <span>+{result.rewards.ryo} Ryo 💰</span> : null}
                    {result.rewards.ef ? <span>+{result.rewards.ef} EF</span> : null}
                    {result.rewards.em ? <span>+{result.rewards.em} EM</span> : null}
                    {result.rewards.chakra ? <span>+{result.rewards.chakra} Chakra</span> : null}
                    {result.rewards.items?.length ? <span>+{result.rewards.items.length} item(ns)</span> : null}
                    {result.rewards.forged ? <span>⚒ {result.rewards.forged.name}</span> : null}
                  </div>
                </div>
              )}
              <Button onClick={close}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}