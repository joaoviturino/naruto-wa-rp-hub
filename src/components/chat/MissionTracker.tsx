import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyMissions, claimMission, acceptMissionFn } from "@/lib/missions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Scroll, ChevronDown, ChevronUp, Trophy, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mission = {
  id: string; name: string; rank: string;
  objectives: Array<{ id: string; type: string; count: number; description: string | null; target_ref?: string | null }>;
  progress: Record<string, number>;
  status: "locked" | "active" | "completed" | "claimed" | "cooldown";
  accepted?: boolean;
  reward_xp: number; reward_ryo: number;
};

/** Floating collapsible mission tracker for chat — mobile-first. */
export function MissionTracker({ characterId }: { characterId: string }) {
  const [rows, setRows] = useState<Mission[]>([]);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const list = useServerFn(listMyMissions);
  const claim = useServerFn(claimMission);
  const accept = useServerFn(acceptMissionFn);

  const load = useCallback(async () => {
    try { const r = await list(); setRows(((r as any)?.missions ?? []) as Mission[]); } catch {}
  }, [list]);

  useEffect(() => { load(); }, [load, characterId]);
  useEffect(() => {
    if (!characterId) return;
    const ch = supabase
      .channel(`mt:${characterId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "character_missions", filter: `character_id=eq.${characterId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [characterId, load]);

  // Only show missions the player has actively engaged with.
  const active = rows.filter((m) => (m.accepted && (m.status === "active" || m.status === "completed")));
  const readyCount = active.filter((m) => m.status === "completed").length;
  if (hidden || active.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed z-40 pointer-events-auto",
        // Positioned bottom-right on mobile, top-right (below HUD) on desktop.
        "right-2 bottom-20 md:bottom-4 md:right-4",
        "w-[min(92vw,340px)]",
      )}
    >
      <div className="rounded-xl border border-gold/40 bg-background/95 backdrop-blur shadow-lg overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-display text-gold hover:bg-gold/10 transition"
        >
          <Scroll size={14} />
          <span className="flex-1 text-left">Missões ativas</span>
          {readyCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
              <Trophy size={10} /> {readyCount}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{active.length}</span>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span
            role="button"
            aria-label="Fechar"
            onClick={(e) => { e.stopPropagation(); setHidden(true); }}
            className="ml-1 p-0.5 rounded hover:bg-destructive/20"
          >
            <X size={12} />
          </span>
        </button>
        {open && (
          <div className="max-h-[45vh] overflow-y-auto p-2 space-y-2 border-t border-border/60">
            {active.map((m) => {
              const total = m.objectives.length;
              const done = m.objectives.filter((o) => Math.min(Number(m.progress[o.id] ?? 0), o.count) >= o.count).length;
              return (
                <div key={m.id} className="rounded-md border border-border/60 bg-secondary/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold truncate">{m.name}</div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{done}/{total}</span>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {m.objectives.map((o) => {
                      const cur = Math.min(Number(m.progress[o.id] ?? 0), o.count);
                      const ok = cur >= o.count;
                      const pct = Math.round((cur / Math.max(1, o.count)) * 100);
                      return (
                        <li key={o.id} className="text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {ok ? <CheckCircle2 size={10} className="text-emerald-400 shrink-0" /> : <span className="h-2 w-2 rounded-full border border-muted-foreground/60 shrink-0" />}
                            <span className={cn("flex-1 truncate", ok && "line-through text-muted-foreground")}>
                              {o.description || o.type}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">{cur}/{o.count}</span>
                          </div>
                          {o.count > 1 && (
                            <div className="mt-0.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                              <div className={cn("h-full transition-all", ok ? "bg-emerald-500" : "bg-gold")} style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {m.status === "completed" && (
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" className="h-6 text-[11px] px-2" onClick={async () => {
                        try { await claim({ data: { mission_id: m.id } } as any); toast.success("Recompensa recebida!"); load(); }
                        catch (e: any) { toast.error(e.message ?? "Não foi possível reivindicar."); }
                      }}>Reivindicar</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Silence unused warnings for potentially untriggered helper.
void acceptMissionFn;