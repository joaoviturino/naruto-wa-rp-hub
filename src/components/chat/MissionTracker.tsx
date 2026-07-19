import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyMissions, claimMission } from "@/lib/missions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Scroll, ChevronDown, ChevronUp, Trophy, CheckCircle2, X, Loader2, Sparkles } from "lucide-react";
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

const LS_KEY = "mt:state:v1";

type Persisted = {
  open: boolean;
  hidden: boolean;
  lastMissionId: string | null;
};

function readPersisted(characterId: string): Persisted {
  if (typeof window === "undefined") return { open: false, hidden: false, lastMissionId: null };
  try {
    const raw = window.localStorage.getItem(`${LS_KEY}:${characterId}`);
    if (!raw) return { open: false, hidden: false, lastMissionId: null };
    const p = JSON.parse(raw);
    return {
      open: !!p.open,
      hidden: !!p.hidden,
      lastMissionId: typeof p.lastMissionId === "string" ? p.lastMissionId : null,
    };
  } catch { return { open: false, hidden: false, lastMissionId: null }; }
}

/** Floating collapsible mission tracker for chat — mobile-first. */
export function MissionTracker({ characterId }: { characterId: string }) {
  const [rows, setRows] = useState<Mission[]>([]);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastMissionId, setLastMissionId] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const [busy, setBusy] = useState<Record<string, "claim" | null>>({});
  const list = useServerFn(listMyMissions);
  const claim = useServerFn(claimMission);

  // Hidrata do localStorage por personagem — só no cliente.
  useEffect(() => {
    if (!characterId) return;
    const p = readPersisted(characterId);
    setOpen(p.open);
    setHidden(p.hidden);
    setLastMissionId(p.lastMissionId);
    hydratedRef.current = true;
  }, [characterId]);

  // Persiste mudanças (após hidratar, para não sobrescrever com defaults).
  useEffect(() => {
    if (!characterId || !hydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `${LS_KEY}:${characterId}`,
        JSON.stringify({ open, hidden, lastMissionId } satisfies Persisted),
      );
    } catch {}
  }, [characterId, open, hidden, lastMissionId]);

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

  // Exibe apenas missões já aceitas pelo jogador: em progresso, prontas ou reivindicadas.
  // Aceitar missões só acontece no local (NPC), nunca por este popup.
  const visible = rows.filter((m) => {
    if (m.status === "locked" || m.status === "cooldown" || !m.accepted) return false;
    return true;
  });
  const readyCount = visible.filter((m) => m.status === "completed").length;

  // Atualiza "última missão focada" — prioriza a que está pronta; senão, a mais recente em progresso.
  useEffect(() => {
    if (!hydratedRef.current || !visible.length) return;
    const ready = visible.find((m) => m.status === "completed");
    const inProg = visible.find((m) => m.status === "active");
    const pick = ready ?? inProg ?? visible[0];
    if (pick && pick.id !== lastMissionId) setLastMissionId(pick.id);
  }, [visible, lastMissionId]);

  // Reordena para colocar a última missão salva no topo quando o painel abre.
  const ordered = lastMissionId
    ? [...visible].sort((a, b) => (a.id === lastMissionId ? -1 : b.id === lastMissionId ? 1 : 0))
    : visible;

  // Se ficou "escondido" mas surgiu uma missão pronta, reexibe automaticamente.
  useEffect(() => {
    if (hidden && readyCount > 0) setHidden(false);
  }, [readyCount, hidden]);

  if (hidden || visible.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed z-40 pointer-events-auto",
        // Positioned bottom-right on mobile, top-right (below HUD) on desktop.
        "right-2 bottom-24 md:bottom-4 md:right-4",
        "pb-[env(safe-area-inset-bottom)]",
        "w-[min(92vw,340px)]",
      )}
    >
      <div className="rounded-xl border border-gold/40 bg-background/95 backdrop-blur shadow-lg overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-display text-gold hover:bg-gold/10 transition"
        >
          <Scroll size={14} />
          <span className="flex-1 text-left">Missões</span>
          {readyCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
              <Trophy size={10} /> {readyCount}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{visible.length}</span>
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
            {ordered.map((m) => {
              const total = m.objectives.length;
              const done = m.objectives.filter((o) => Math.min(Number(m.progress[o.id] ?? 0), o.count) >= o.count).length;
              const phase = derivePhase(m);
              const isBusy = busy[m.id] === "claim";
              return (
                <div key={m.id} className="rounded-md border border-border/60 bg-secondary/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold truncate">{m.name}</div>
                    <StateBadge phase={phase} />
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{done}/{total} objetivos</div>
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
                  <div className="mt-2 flex justify-end">
                    {phase === "in_progress" && (
                      <Button size="sm" className="h-6 text-[11px] px-2" disabled variant="outline">
                        Em progresso
                      </Button>
                    )}
                    {phase === "ready" && (
                      <Button
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        disabled={isBusy}
                        onClick={async () => {
                          setBusy((s) => ({ ...s, [m.id]: "claim" }));
                          try { await claim({ data: { mission_id: m.id } } as any); toast.success("Recompensa recebida!"); await load(); }
                          catch (e: any) { toast.error(e.message ?? "Não foi possível reivindicar."); }
                          finally { setBusy((s) => ({ ...s, [m.id]: null })); }
                        }}
                      >
                        {isBusy ? <Loader2 size={10} className="animate-spin" /> : "Reivindicar"}
                      </Button>
                    )}
                    {phase === "claimed" && (
                      <Button size="sm" className="h-6 text-[11px] px-2" disabled variant="outline">
                        Reivindicado
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type Phase = "in_progress" | "ready" | "claimed";

function derivePhase(m: Mission): Phase {
  if (m.status === "claimed") return "claimed";
  if (m.status === "completed") return "ready";
  return "in_progress";
}

function StateBadge({ phase }: { phase: Phase }) {
  const map: Record<Phase, { label: string; cls: string; icon: React.ReactNode }> = {
    in_progress: { label: "Em progresso", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: <Loader2 size={10} /> },
    ready: { label: "Pronto", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: <Trophy size={10} /> },
    claimed: { label: "Reivindicado", cls: "bg-muted/30 text-muted-foreground border-border", icon: <Sparkles size={10} /> },
  };
  const s = map[phase];
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 shrink-0", s.cls)}>
      {s.icon}
      {s.label}
    </span>
  );
}