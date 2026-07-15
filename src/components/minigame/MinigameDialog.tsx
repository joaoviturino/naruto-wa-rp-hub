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
  const [forgePreview, setForgePreview] = useState<{ name: string; icon: string | null; recipe: Array<{ item_id: string; qty: number; name: string; icon: string | null }> } | null>(null);

  useEffect(() => {
    let cancel = false;
    async function loadPreview() {
      if (minigame.kind !== "forge") { setForgePreview(null); return; }
      const targetId = minigame.config?.recipe_item_id;
      if (!targetId) return;
      const { data: target } = await supabase.from("items").select("id,name,image_url,meta").eq("id", targetId).maybeSingle();
      if (!target) return;
      const recipe = Array.isArray((target as any).meta?.recipe) ? (target as any).meta.recipe : [];
      const ids = recipe.map((r: any) => r.item_id);
      const { data: mats } = ids.length
        ? await supabase.from("items").select("id,name,image_url").in("id", ids)
        : { data: [] as any[] };
      const byId = new Map((mats ?? []).map((m: any) => [m.id, m]));
      if (cancel) return;
      setForgePreview({
        name: target.name,
        icon: (target as any).image_url ?? null,
        recipe: recipe.map((r: any) => ({
          item_id: r.item_id, qty: r.qty,
          name: byId.get(r.item_id)?.name ?? r.item_id,
          icon: byId.get(r.item_id)?.image_url ?? null,
        })),
      });
    }
    loadPreview();
    return () => { cancel = true; };
  }, [minigame.id]);

  async function begin() {
    setBusy(true);
    try {
      const r = await start({ data: { minigame_id: minigame.id } });
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
    setStage("intro"); setRunId(null); setResult(null);
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
              {forgePreview && (
                <div className="rounded border border-border p-3 bg-secondary/30">
                  <div className="flex items-center gap-3 mb-2">
                    {forgePreview.icon && <img src={forgePreview.icon} className="w-12 h-12 object-contain" alt="" />}
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Você irá forjar</div>
                      <div className="font-display text-gold">{forgePreview.name}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Materiais consumidos:</div>
                  <ul className="text-sm space-y-1">
                    {forgePreview.recipe.map((r, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {r.icon && <img src={r.icon} className="w-5 h-5 object-contain" alt="" />}
                        <span>{r.name}</span>
                        <span className="text-muted-foreground">× {r.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={begin} disabled={busy}>{busy ? "…" : "Aceitar missão"}</Button>
                <Button variant="outline" onClick={close}>Sair</Button>
              </div>
            </div>
          </div>
        )}

        {stage === "play" && (
          (minigame.kind === "forge"
            ? <ForgeGame background={minigame.background_url} config={minigame.config ?? {}} preview={forgePreview ? { name: forgePreview.name, icon: forgePreview.icon } : undefined} onFinish={onFinish} />
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