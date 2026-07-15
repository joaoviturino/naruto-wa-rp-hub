import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMissionHistory } from "@/lib/missions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";

type Entry = {
  mission_id: string;
  mission_name: string;
  category: string | null;
  rank: string | null;
  npc_name: string | null;
  status: "active" | "completed" | "claimed" | "cooldown";
  started_at: string;
  completed_at: string | null;
  claimed_at: string | null;
};

const STATUS_META: Record<Entry["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive"; cls: string }> = {
  active:    { label: "Em andamento", variant: "default",   cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  completed: { label: "Concluída",     variant: "secondary", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  claimed:   { label: "Entregue",      variant: "outline",   cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  cooldown:  { label: "Aguardando",    variant: "outline",   cls: "bg-muted text-muted-foreground" },
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

export function MissionHistoryPanel({ characterId }: { characterId: string }) {
  const fetchHistory = useServerFn(listMissionHistory);
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchHistory({ data: { character_id: characterId } });
      setItems(((res as any)?.history ?? []) as Entry[]);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`mission-history-${characterId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "character_missions", filter: `character_id=eq.${characterId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  return (
    <Card className="p-4 bg-card/60 border-border/60">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-gold" />
        <h3 className="font-semibold">Histórico de Missões</h3>
        <span className="text-xs text-muted-foreground ml-auto">{items.length} registro{items.length === 1 ? "" : "s"}</span>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma missão registrada ainda.</p>
      ) : (
        <ScrollArea className="max-h-[420px] pr-2">
          <ul className="space-y-2">
            {items.map((e) => {
              const meta = STATUS_META[e.status];
              return (
                <li key={e.mission_id} className="rounded-md border border-border/60 bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.mission_name}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        {e.category && <span className="capitalize">{e.category}</span>}
                        {e.rank && <span>· {e.rank}</span>}
                        {e.npc_name && <span>· NPC: <span className="text-foreground/80">{e.npc_name}</span></span>}
                      </div>
                    </div>
                    <Badge variant={meta.variant} className={meta.cls}>{meta.label}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                    <div>Aceita: <span className="text-foreground/80">{fmt(e.started_at)}</span></div>
                    <div>Concluída: <span className="text-foreground/80">{fmt(e.completed_at)}</span></div>
                    <div>Entregue: <span className="text-foreground/80">{fmt(e.claimed_at)}</span></div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </Card>
  );
}