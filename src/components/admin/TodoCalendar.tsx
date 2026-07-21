import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

type Urgency = "low" | "medium" | "high" | "critical";
type Status = "todo" | "in_progress" | "blocked" | "done";

export type CalendarTodo = {
  id?: string;
  title: string;
  urgency: Urgency;
  status: Status;
  due_date: string | null;
  assignee?: string | null;
};

const URGENCY_DOT: Record<Urgency, string> = {
  low: "bg-emerald-400",
  medium: "bg-sky-400",
  high: "bg-amber-400",
  critical: "bg-red-500",
};
const URGENCY_BAR: Record<Urgency, string> = {
  low: "bg-emerald-900/50 text-emerald-100 border-emerald-700/50",
  medium: "bg-sky-900/50 text-sky-100 border-sky-700/50",
  high: "bg-amber-900/50 text-amber-100 border-amber-700/50",
  critical: "bg-red-900/60 text-red-100 border-red-700/60",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfMonthGrid(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return startOfWeek(first);
}

export function TodoCalendar({
  rows,
  onSelect,
  mode,
}: {
  rows: CalendarTodo[];
  onSelect: (t: CalendarTodo) => void;
  mode: "month" | "week";
}) {
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarTodo[]>();
    for (const r of rows) {
      if (!r.due_date) continue;
      const dt = new Date(r.due_date);
      const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const arr = m.get(k) ?? []; arr.push(r); m.set(k, arr);
    }
    // sort within day: overdue first, then by time; critical > high > medium > low
    const rank: Record<Urgency, number> = { critical: 3, high: 2, medium: 1, low: 0 };
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        (rank[b.urgency] - rank[a.urgency]) ||
        (new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
      );
    }
    return m;
  }, [rows]);

  function key(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const days = useMemo(() => {
    if (mode === "month") {
      const start = startOfMonthGrid(cursor);
      return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor, mode]);

  function go(delta: number) {
    const d = new Date(cursor);
    if (mode === "month") d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setCursor(d);
  }

  const title = mode === "month"
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : (() => {
        const s = startOfWeek(cursor); const e = addDays(s, 6);
        const f = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
        return `${f(s)} — ${f(e)} · ${e.getFullYear()}`;
      })();

  return (
    <div className="scroll-panel rounded-lg p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => go(-1)} aria-label="Anterior"><ChevronLeft size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); }}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => go(1)} aria-label="Próximo"><ChevronRight size={14} /></Button>
        </div>
        <div className="font-display text-lg text-gold capitalize">{title}</div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Crítica</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Alta</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> Média</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Baixa</span>
        </div>
      </div>

      {mode === "month" ? (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-[10px] uppercase text-muted-foreground text-center py-1">{w}</div>
          ))}
          {days.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = sameDay(d, today);
            const items = byDay.get(key(d)) ?? [];
            const overdueCount = items.filter((it) => it.status !== "done" && new Date(it.due_date!).getTime() < Date.now()).length;
            return (
              <div key={d.toISOString()}
                className={`min-h-[92px] rounded-md border p-1 text-left transition-colors ${
                  inMonth ? "border-border bg-secondary/20" : "border-border/40 bg-secondary/5 opacity-60"
                } ${isToday ? "ring-1 ring-gold/70" : ""}`}
              >
                <div className="flex items-center justify-between px-1">
                  <span className={`text-[11px] font-semibold ${isToday ? "text-gold" : "text-muted-foreground"}`}>{d.getDate()}</span>
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-red-300"><Flame size={9} />{overdueCount}</span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((it) => {
                    const overdue = it.status !== "done" && new Date(it.due_date!).getTime() < Date.now();
                    return (
                      <button key={it.id} onClick={() => onSelect(it)}
                        className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] border ${URGENCY_BAR[it.urgency]} ${
                          it.status === "done" ? "line-through opacity-60" : ""
                        } ${overdue ? "ring-1 ring-red-500/60" : ""}`}
                        title={it.title}
                      >
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${URGENCY_DOT[it.urgency]} mr-1`} />
                        {it.title}
                      </button>
                    );
                  })}
                  {items.length > 3 && (
                    <div className="px-1 text-[9px] text-muted-foreground">+{items.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {days.map((d) => {
            const isToday = sameDay(d, today);
            const items = byDay.get(key(d)) ?? [];
            return (
              <div key={d.toISOString()}
                className={`rounded-md border p-2 bg-secondary/20 ${isToday ? "ring-1 ring-gold/70 border-gold/40" : "border-border"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">{WEEKDAYS[d.getDay()]}</div>
                    <div className={`text-base font-black ${isToday ? "text-gold" : ""}`}>{d.getDate()}/{d.getMonth() + 1}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{items.length} tarefa(s)</div>
                </div>
                <div className="space-y-1">
                  {items.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic">—</div>
                  )}
                  {items.map((it) => {
                    const dt = new Date(it.due_date!);
                    const overdue = it.status !== "done" && dt.getTime() < Date.now();
                    const time = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <button key={it.id} onClick={() => onSelect(it)}
                        className={`w-full rounded border px-2 py-1 text-left text-[11px] ${URGENCY_BAR[it.urgency]} ${
                          it.status === "done" ? "line-through opacity-60" : ""
                        } ${overdue ? "ring-1 ring-red-500/60" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-semibold">{it.title}</span>
                          <span className="shrink-0 text-[9px] opacity-80">{time}</span>
                        </div>
                        {it.assignee && <div className="text-[9px] opacity-80 truncate">{it.assignee}</div>}
                        {overdue && <div className="text-[9px] text-red-200 font-bold">Atrasada</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}