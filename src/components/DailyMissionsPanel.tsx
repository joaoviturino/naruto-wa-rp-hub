import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyMissions, claimMission, acceptMissionFn } from "@/lib/missions.functions";
import { Scroll, CheckCircle2, Lock, Clock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type MissionRow = {
  id: string; name: string; rank: string; category: string; description: string | null;
  reward_xp: number; reward_ryo: number;
  objectives: Array<{ id: string; type: string; count: number; description: string | null; target_id?: string | null; target_ref?: string | null }>;
  rewards: any; requirements: any;
  cooldown_hours: number; repeatable: boolean;
  progress: Record<string, number>;
  status: "locked" | "active" | "completed" | "claimed" | "cooldown";
  cooldown_until: string | null;
  requirement_reason: string | null;
  accepted?: boolean;
};

export function DailyMissionsPanel({ characterId }: { characterId: string }) {
  const [rows, setRows] = useState<MissionRow[]>([]);
  const [filter, setFilter] = useState<"all"|"daily"|"common"|"special">("all");
  const [loading, setLoading] = useState(false);
  const list = useServerFn(listMyMissions);
  const claim = useServerFn(claimMission);
  const accept = useServerFn(acceptMissionFn);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await list(); setRows((r as any)?.missions ?? []); }
    catch (e: any) { toast.error(e.message ?? "Erro ao carregar missões."); }
    finally { setLoading(false); }
  }, [list]);

  useEffect(() => { load(); }, [load, characterId]);

  // Realtime: refresh whenever this character's mission progress changes.
  useEffect(() => {
    if (!characterId) return;
    const ch = supabase
      .channel(`char-missions:${characterId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "character_missions", filter: `character_id=eq.${characterId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [characterId, load]);

  const filtered = rows.filter((r) => filter === "all" || r.category === filter);

  if (!filtered.length && !loading) return null;

  return (
    <div className="scroll-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-gold flex items-center gap-2"><Scroll size={16} /> Missões</h3>
        <div className="flex gap-1 text-xs">
          {(["all","daily","common","special"] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-2 py-1 rounded ${filter === k ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              {k === "all" ? "Todas" : k === "daily" ? "Diárias" : k === "common" ? "Comuns" : "Especiais"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        {filtered.map((m) => <MissionCard key={m.id} m={m} onAccept={async () => {
          try { await accept({ data: { mission_id: m.id } } as any); toast.success("Missão aceita!"); load(); }
          catch (e: any) { toast.error(e.message ?? "Não foi possível aceitar."); }
        }} onClaim={async () => {
          try { await claim({ data: { mission_id: m.id } } as any); toast.success("Recompensa recebida!"); load(); }
          catch (e: any) { toast.error(e.message ?? "Não foi possível reivindicar."); }
        }} />)}
      </div>
    </div>
  );
}

function statusBadge(m: MissionRow) {
  if (m.status === "claimed") return <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 size={12} /> concluída</span>;
  if (m.status === "cooldown") {
    const t = m.cooldown_until ? new Date(m.cooldown_until) : null;
    return <span className="text-xs text-blue-300 flex items-center gap-1"><Clock size={12} /> {t ? t.toLocaleString() : "cooldown"}</span>;
  }
  if (m.status === "locked") return <span className="text-xs text-red-300 flex items-center gap-1"><Lock size={12} /> {m.requirement_reason ?? "bloqueada"}</span>;
  if (m.status === "completed") return <span className="text-xs text-emerald-400 flex items-center gap-1"><Trophy size={12} /> pronto para reivindicar</span>;
  if (!m.accepted) return <span className="text-xs text-amber-300">disponível — aceite para começar</span>;
  return <span className="text-xs text-muted-foreground">em andamento</span>;
}

function MissionCard({ m, onAccept, onClaim }: { m: MissionRow; onAccept: () => void; onClaim: () => void }) {
  return (
    <div className="rounded border border-border/60 p-3 bg-secondary/20">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{m.name} <span className="text-xs text-muted-foreground">· {m.rank}</span></div>
          {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
        </div>
        {statusBadge(m)}
      </div>
      {m.objectives?.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {m.objectives.map((o) => {
            const cur = Math.min(Number(m.progress?.[o.id] ?? 0), o.count);
            const done = cur >= o.count;
            return (
              <li key={o.id} className="flex items-center justify-between gap-2">
                <span className={done ? "line-through text-muted-foreground" : ""}>
                  {o.description || describeObjective(o)}
                </span>
                <span className={`text-xs ${done ? "text-emerald-400" : "text-muted-foreground"}`}>{cur}/{o.count}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          +{m.reward_xp ?? 0} XP · +{m.reward_ryo ?? 0} Ryō
          {(m.rewards?.items?.length ?? 0) > 0 && ` · ${m.rewards.items.length} item(ns)`}
          {(m.rewards?.skill_ids?.length ?? 0) > 0 && ` · ${m.rewards.skill_ids.length} habilidade(s)`}
        </div>
        {!m.accepted && m.status === "active" && <Button size="sm" variant="secondary" onClick={onAccept}>Aceitar</Button>}
        {m.status === "completed" && <Button size="sm" onClick={onClaim}>Reivindicar</Button>}
      </div>
    </div>
  );
}

function describeObjective(o: MissionRow["objectives"][number]): string {
  const map: Record<string, string> = {
    kill_npc: "Derrotar NPC alvo",
    kill_npc_kind: `Derrotar NPCs (${o.target_ref ?? "tipo"})`,
    kill_npc_group: "Derrotar grupo",
    complete_minigame: "Completar minigame",
    read_book: "Ler livro",
    reach_location: "Chegar a local",
    learn_skill: "Aprender habilidade",
    craft_item: "Fabricar item",
    collect_item: "Coletar item",
    reach_rank: `Atingir patente ${o.target_ref ?? ""}`,
    reach_level: `Atingir nível ${o.target_ref ?? ""}`,
    reach_proficiency: `Proficiência ${o.target_ref ?? ""}`,
    pvp_win: "Vencer duelo PvP",
    talk_npc: "Falar com NPC",
    custom: "Objetivo especial",
  };
  return map[o.type] ?? o.type;
}
