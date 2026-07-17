import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { repairMinigameTools } from "@/lib/minigame.functions";
import { toast } from "sonner";
import { Wrench } from "lucide-react";

export type ToolStatus = {
  item_id: string;
  name: string;
  image_url: string | null;
  qty: number;
  dur: number | null;
  max: number | null;
};

export function ToolDurabilityHud({
  runId,
  tools,
  onRepaired,
  testMode = false,
}: {
  runId: string;
  tools: ToolStatus[];
  onRepaired?: (tools: ToolStatus[]) => void;
  testMode?: boolean;
}) {
  const repair = useServerFn(repairMinigameTools);
  const [busy, setBusy] = useState(false);
  if (!tools?.length) return null;

  const anyBroken = tools.some((t) => t.qty <= 0);
  const needsRepair = tools.some((t) => (t.max ?? 0) > 0 && ((t.dur ?? t.max ?? 0) < (t.max ?? 0)));

  const doRepair = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (testMode) {
        toast.success("Reparo simulado (modo teste).");
        onRepaired?.(tools.map((t) => ({ ...t, dur: t.max, qty: Math.max(1, t.qty) })));
      } else {
        const r: any = await repair({ data: { run_id: runId } });
        if (r.cost > 0) toast.success(`Reparo concluído • -${r.cost} ryo`);
        else toast.info("Nada para reparar.");
        onRepaired?.(tools.map((t) => ({ ...t, dur: t.max, qty: Math.max(1, t.qty) })));
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao reparar.");
    } finally { setBusy(false); }
  };

  return (
    <div className="absolute left-2 top-16 z-20 space-y-1 max-w-[45%] sm:max-w-[220px]">
      {tools.map((t) => {
        const max = t.max ?? 0;
        const cur = t.qty <= 0 ? 0 : (t.dur ?? max);
        const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
        const color = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-400" : "bg-red-500";
        return (
          <div key={t.item_id} className={`flex flex-col gap-1 bg-black/70 backdrop-blur border rounded px-2 py-1 text-xs ${t.qty <= 0 ? "border-red-500/70 animate-pulse" : "border-white/10"}`}>
            <div className="flex items-center gap-2">
              {t.image_url
                ? <img src={t.image_url} alt="" className="w-5 h-5 object-contain" />
                : <Wrench size={14} className="text-slate-300" />}
              <span className="truncate text-slate-100 flex-1">{t.name}</span>
              <span className="tabular-nums text-slate-300">
                {t.qty <= 0 ? "quebrado" : max ? `${cur}/${max}` : "∞"}
                {t.qty > 1 && <span className="text-slate-500 ml-1">×{t.qty}</span>}
              </span>
            </div>
            {max > 0 && (
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
      {(needsRepair || anyBroken) && (
        <Button size="sm" variant="secondary" onClick={doRepair} disabled={busy} className="w-full h-8 text-xs">
          <Wrench size={12} className="mr-1" /> {busy ? "Reparando..." : "Reparar (ryo)"}
        </Button>
      )}
    </div>
  );
}