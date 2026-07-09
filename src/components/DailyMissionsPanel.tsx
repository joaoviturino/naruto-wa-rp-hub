import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Gamepad2 } from "lucide-react";

type Row = { minigame_id: string; completed_at: string; minigames: { name: string; cooldown_hours: number } };

export function DailyMissionsPanel({ characterId }: { characterId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("minigame_runs")
        .select("minigame_id,completed_at,minigames(name,cooldown_hours)")
        .eq("character_id", characterId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      const seen = new Set<string>();
      const uniq: Row[] = [];
      (data as any[] ?? []).forEach((r) => { if (!seen.has(r.minigame_id)) { seen.add(r.minigame_id); uniq.push(r); } });
      setRows(uniq);
    })();
  }, [characterId]);

  if (rows.length === 0) return null;
  const now = Date.now();
  return (
    <div className="scroll-panel rounded-lg p-4">
      <h3 className="font-display text-lg text-gold flex items-center gap-2 mb-2"><Gamepad2 size={16} /> Missões diárias</h3>
      <div className="grid gap-1 text-sm">
        {rows.map((r) => {
          const next = new Date(r.completed_at).getTime() + (r.minigames?.cooldown_hours ?? 0) * 3600000;
          const remaining = next - now;
          if (remaining <= 0) return (
            <div key={r.minigame_id} className="flex justify-between">
              <span>{r.minigames?.name}</span><span className="text-emerald-400">disponível</span>
            </div>
          );
          const h = Math.floor(remaining / 3600000);
          const m = Math.floor((remaining % 3600000) / 60000);
          return (
            <div key={r.minigame_id} className="flex justify-between">
              <span>{r.minigames?.name}</span>
              <span className="text-muted-foreground">em {h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}