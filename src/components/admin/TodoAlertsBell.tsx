import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Flame, AlertTriangle, Clock, Ban, PlayCircle, ListTodo } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Urgency = "low" | "medium" | "high" | "critical";
type Status = "todo" | "in_progress" | "blocked" | "done";
type Row = {
  id: string; title: string; urgency: Urgency; status: Status;
  due_date: string | null; assignee: string | null;
};

// Janela de "próximo do prazo" por urgência (horas antes do due_date).
const SOON_HOURS: Record<Urgency, number> = { low: 6, medium: 12, high: 24, critical: 48 };

const URGENCY_META: Record<Urgency, { label: string; cls: string; ring: string; rank: number }> = {
  low:      { label: "Baixa",   cls: "text-emerald-300",  ring: "ring-emerald-500/40", rank: 0 },
  medium:   { label: "Média",   cls: "text-sky-300",      ring: "ring-sky-500/40",     rank: 1 },
  high:     { label: "Alta",    cls: "text-amber-300",    ring: "ring-amber-500/50",   rank: 2 },
  critical: { label: "Crítica", cls: "text-red-300",      ring: "ring-red-500/60",     rank: 3 },
};
const STATUS_META: Record<Status, { label: string; cls: string; icon: any }> = {
  todo:        { label: "A fazer",      cls: "bg-secondary text-muted-foreground", icon: ListTodo },
  in_progress: { label: "Em andamento", cls: "bg-blue-900/40 text-blue-200",       icon: PlayCircle },
  blocked:     { label: "Bloqueada",    cls: "bg-orange-900/40 text-orange-200",   icon: Ban },
  done:        { label: "Concluída",    cls: "bg-emerald-900/40 text-emerald-200", icon: Clock },
};

function fmtDelta(due: string): string {
  const ms = new Date(due).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 36e5);
  const m = Math.floor((abs % 36e5) / 6e4);
  const label = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return ms < 0 ? `atrasada há ${label}` : `em ${label}`;
}

export function TodoAlertsBell({ onOpenTodos }: { onOpenTodos: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tick, setTick] = useState(0);

  async function load() {
    const { data } = await supabase.from("admin_todos" as any)
      .select("id,title,urgency,status,due_date,assignee")
      .neq("status", "done")
      .not("due_date", "is", null);
    setRows(((data as any) ?? []) as Row[]);
  }
  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    const ivClock = setInterval(() => setTick((t) => (t + 1) % 1e6), 30_000);
    const ch = supabase
      .channel("admin-todos-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_todos" }, () => load())
      .subscribe();
    return () => { clearInterval(iv); clearInterval(ivClock); supabase.removeChannel(ch); };
  }, []);

  const { overdue, soon, highest } = useMemo(() => {
    const now = Date.now();
    const overdue: Row[] = []; const soon: Row[] = [];
    for (const r of rows) {
      if (!r.due_date) continue;
      const dt = new Date(r.due_date).getTime();
      if (dt < now) overdue.push(r);
      else {
        const h = (dt - now) / 36e5;
        if (h <= (SOON_HOURS[r.urgency] ?? 24)) soon.push(r);
      }
    }
    const rank = (r: Row) => URGENCY_META[r.urgency].rank + (r.status === "blocked" ? -0.1 : 0);
    const sort = (a: Row, b: Row) => rank(b) - rank(a) || (new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    overdue.sort(sort); soon.sort(sort);
    let hi = -1;
    for (const r of [...overdue, ...soon]) hi = Math.max(hi, URGENCY_META[r.urgency].rank);
    return { overdue, soon, highest: hi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tick]);

  const total = overdue.length + soon.length;
  const pulse = overdue.length > 0 || highest >= 2;
  const color =
    highest >= 3 ? "text-red-300" :
    highest >= 2 ? "text-amber-300" :
    highest >= 1 ? "text-sky-300" :
    highest >= 0 ? "text-emerald-300" : "text-muted-foreground";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificações de tarefas (${total})`}
          className={`relative admin-card grid h-11 w-11 place-items-center rounded-xl hover:bg-secondary/60 transition-colors ${pulse ? "animate-pulse" : ""}`}
        >
          <Bell size={18} className={color} />
          {total > 0 && (
            <span
              className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center
                ${overdue.length > 0 ? "bg-red-600 text-white" : highest >= 2 ? "bg-amber-500 text-black" : "bg-sky-500 text-white"}`}
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell size={14} className={color} />
            <span className="text-sm font-semibold">Tarefas em alerta</span>
          </div>
          <button onClick={onOpenTodos} className="text-xs text-gold hover:underline">Abrir painel</button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {total === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhuma tarefa próxima do prazo. Bom trabalho!
            </div>
          ) : (
            <>
              {overdue.length > 0 && (
                <Section title="Atrasadas" icon={<Flame size={12} className="text-red-400" />} items={overdue} onClick={onOpenTodos} kind="overdue" />
              )}
              {soon.length > 0 && (
                <Section title="Próximas do prazo" icon={<AlertTriangle size={12} className="text-amber-300" />} items={soon} onClick={onOpenTodos} kind="soon" />
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  title, icon, items, onClick, kind,
}: {
  title: string; icon: React.ReactNode; items: Row[]; onClick: () => void; kind: "overdue" | "soon";
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40 border-b border-border flex items-center gap-1">
        {icon} <span>{title}</span> <span className="ml-auto opacity-70">{items.length}</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((r) => {
          const U = URGENCY_META[r.urgency]; const S = STATUS_META[r.status]; const Si = S.icon;
          return (
            <li key={r.id}>
              <button onClick={onClick}
                className={`w-full text-left px-3 py-2 hover:bg-secondary/50 ring-inset ${kind === "overdue" ? "ring-1 ring-red-500/30" : ""} ${U.ring}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{r.title}</div>
                    <div className={`text-[11px] ${kind === "overdue" ? "text-red-300" : "text-amber-200"}`}>
                      {r.due_date ? fmtDelta(r.due_date) : "sem prazo"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border border-border ${U.cls}`}>{U.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${S.cls}`}>
                      <Si size={10} /> {S.label}
                    </span>
                  </div>
                </div>
                {r.assignee && <div className="text-[10px] text-muted-foreground mt-0.5">👤 {r.assignee}</div>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}