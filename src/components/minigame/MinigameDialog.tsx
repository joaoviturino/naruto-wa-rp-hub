import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { startMinigameRun, completeMinigameRun } from "@/lib/minigame.functions";
import { CleanupGame } from "./CleanupGame";
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
              <div className="flex gap-2">
                <Button onClick={begin} disabled={busy}>{busy ? "…" : "Aceitar missão"}</Button>
                <Button variant="outline" onClick={close}>Sair</Button>
              </div>
            </div>
          </div>
        )}

        {stage === "play" && (
          <CleanupGame background={minigame.background_url} tileset={minigame.tileset_url}
            config={minigame.config ?? {}} onFinish={onFinish} />
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