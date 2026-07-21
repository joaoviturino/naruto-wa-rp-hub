import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Save, Trash2, X, CheckCircle2, Clock, AlertTriangle, Flame, ListTodo, PlayCircle, Ban, LayoutList, CalendarDays, CalendarRange } from "lucide-react";
import { TodoCalendar } from "@/components/admin/TodoCalendar";

type Urgency = "low" | "medium" | "high" | "critical";
type Status = "todo" | "in_progress" | "blocked" | "done";

type Todo = {
  id?: string;
  title: string;
  description: string | null;
  urgency: Urgency;
  status: Status;
  due_date: string | null;
  assignee: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

const EMPTY: Todo = { title: "", description: "", urgency: "medium", status: "todo", due_date: null, assignee: "" };

const URGENCY_META: Record<Urgency, { label: string; cls: string; icon: any }> = {
  low:      { label: "Baixa",    cls: "bg-emerald-900/40 text-emerald-200 border-emerald-700/40",   icon: Clock },
  medium:   { label: "Média",    cls: "bg-sky-900/40 text-sky-200 border-sky-700/40",               icon: AlertTriangle },
  high:     { label: "Alta",     cls: "bg-amber-900/40 text-amber-200 border-amber-700/40",         icon: AlertTriangle },
  critical: { label: "Crítica",  cls: "bg-red-900/50 text-red-200 border-red-700/50",               icon: Flame },
};

const STATUS_META: Record<Status, { label: string; cls: string; icon: any }> = {
  todo:        { label: "A fazer",     cls: "bg-secondary text-muted-foreground",                icon: ListTodo },
  in_progress: { label: "Em andamento",cls: "bg-blue-900/40 text-blue-200",                       icon: PlayCircle },
  blocked:     { label: "Bloqueada",   cls: "bg-orange-900/40 text-orange-200",                   icon: Ban },
  done:        { label: "Concluída",   cls: "bg-emerald-900/40 text-emerald-200",                 icon: CheckCircle2 },
};

function fmtDue(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  const now = new Date();
  const diffH = (dt.getTime() - now.getTime()) / 36e5;
  const s = dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (diffH < 0) return `${s} (atrasada)`;
  if (diffH < 24) return `${s} (hoje)`;
  return s;
}
function toLocalInput(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function TodoManager() {
  const [rows, setRows] = useState<Todo[]>([]);
  const [sel, setSel] = useState<Todo | null>(null);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [filterUrgency, setFilterUrgency] = useState<Urgency | "all">("all");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "month" | "week">("list");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_todos" as any)
      .select("*")
      .order("status", { ascending: true })
      .order("urgency", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) =>
    (filterStatus === "all" || r.status === filterStatus) &&
    (filterUrgency === "all" || r.urgency === filterUrgency),
  ), [rows, filterStatus, filterUrgency]);

  const counts = useMemo(() => {
    const c = { todo: 0, in_progress: 0, blocked: 0, done: 0, overdue: 0 };
    const now = Date.now();
    for (const r of rows) {
      c[r.status]++;
      if (r.status !== "done" && r.due_date && new Date(r.due_date).getTime() < now) c.overdue++;
    }
    return c;
  }, [rows]);

  async function save() {
    if (!sel) return;
    if (!sel.title.trim()) return toast.error("Título obrigatório.");
    const payload: any = {
      title: sel.title.trim(),
      description: sel.description || null,
      urgency: sel.urgency,
      status: sel.status,
      due_date: sel.due_date || null,
      assignee: sel.assignee || null,
      completed_at: sel.status === "done" ? (sel.completed_at ?? new Date().toISOString()) : null,
    };
    let error: any;
    if (sel.id) {
      ({ error } = await supabase.from("admin_todos" as any).update(payload).eq("id", sel.id));
    } else {
      const { data: auth } = await supabase.auth.getUser();
      payload.created_by = auth.user?.id ?? null;
      ({ error } = await supabase.from("admin_todos" as any).insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success("Tarefa salva.");
    setSel(null);
    load();
  }

  async function quickStatus(r: Todo, status: Status) {
    const patch: any = { status };
    if (status === "done") patch.completed_at = new Date().toISOString();
    else patch.completed_at = null;
    const { error } = await supabase.from("admin_todos" as any).update(patch).eq("id", r.id!);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(r: Todo) {
    if (!confirm(`Apagar tarefa "${r.title}"?`)) return;
    const { error } = await supabase.from("admin_todos" as any).delete().eq("id", r.id!);
    if (error) return toast.error(error.message);
    toast.success("Removida.");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h3 className="font-display text-xl text-gold">Tarefas Admin</h3>
          <p className="text-xs text-muted-foreground">Organize prazos, urgências e status das pendências da equipe.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button onClick={() => setView("list")}
              className={`px-2 py-1 text-[11px] flex items-center gap-1 ${view === "list" ? "bg-gold/20 text-gold" : "text-muted-foreground hover:bg-secondary/60"}`}>
              <LayoutList size={12} /> Lista
            </button>
            <button onClick={() => setView("month")}
              className={`px-2 py-1 text-[11px] flex items-center gap-1 border-l border-border ${view === "month" ? "bg-gold/20 text-gold" : "text-muted-foreground hover:bg-secondary/60"}`}>
              <CalendarDays size={12} /> Mês
            </button>
            <button onClick={() => setView("week")}
              className={`px-2 py-1 text-[11px] flex items-center gap-1 border-l border-border ${view === "week" ? "bg-gold/20 text-gold" : "text-muted-foreground hover:bg-secondary/60"}`}>
              <CalendarRange size={12} /> Semana
            </button>
          </div>
          <Button onClick={() => setSel({ ...EMPTY })}><Plus size={14} className="mr-1" /> Nova tarefa</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(["todo","in_progress","blocked","done"] as Status[]).map((s) => {
          const M = STATUS_META[s]; const Ic = M.icon;
          return (
            <div key={s} className="admin-card rounded-lg p-3 flex items-center gap-2">
              <Ic size={18} className="text-muted-foreground" />
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">{M.label}</div>
                <div className="text-lg font-bold">{counts[s]}</div>
              </div>
            </div>
          );
        })}
        <div className="admin-card rounded-lg p-3 flex items-center gap-2 border border-red-800/40">
          <Flame size={18} className="text-red-400" />
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Atrasadas</div>
            <div className="text-lg font-bold text-red-300">{counts.overdue}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">Status:</span>
          {(["all","todo","in_progress","blocked","done"] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2 py-1 rounded border text-[11px] ${filterStatus === s ? "bg-gold/20 border-gold text-gold" : "border-border text-muted-foreground hover:bg-secondary/60"}`}>
              {s === "all" ? "Todos" : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">Urgência:</span>
          {(["all","low","medium","high","critical"] as const).map((u) => (
            <button key={u} onClick={() => setFilterUrgency(u)}
              className={`px-2 py-1 rounded border text-[11px] ${filterUrgency === u ? "bg-gold/20 border-gold text-gold" : "border-border text-muted-foreground hover:bg-secondary/60"}`}>
              {u === "all" ? "Todas" : URGENCY_META[u].label}
            </button>
          ))}
        </div>
      </div>

      {view !== "list" ? (
        <TodoCalendar rows={filtered as any} mode={view} onSelect={(t) => setSel({ ...(t as any) })} />
      ) : (
      <div className="scroll-panel rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-3">Tarefa</th>
              <th className="text-left p-3">Urgência</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Prazo</th>
              <th className="text-left p-3">Responsável</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const U = URGENCY_META[r.urgency]; const S = STATUS_META[r.status];
              const overdue = r.status !== "done" && r.due_date && new Date(r.due_date).getTime() < Date.now();
              return (
                <tr key={r.id} className={"border-t border-border " + (r.status === "done" ? "opacity-60" : "")}>
                  <td className="p-3 max-w-[320px]">
                    <div className={"font-semibold " + (r.status === "done" ? "line-through" : "")}>{r.title}</div>
                    {r.description && <div className="text-[11px] text-muted-foreground line-clamp-2">{r.description}</div>}
                  </td>
                  <td className="p-3"><span className={`text-[11px] px-2 py-0.5 rounded border ${U.cls}`}>{U.label}</span></td>
                  <td className="p-3"><span className={`text-[11px] px-2 py-0.5 rounded ${S.cls}`}>{S.label}</span></td>
                  <td className={"p-3 text-xs " + (overdue ? "text-red-400 font-semibold" : "")}>{fmtDue(r.due_date)}</td>
                  <td className="p-3 text-xs">{r.assignee || "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {r.status !== "done" ? (
                      <Button size="sm" variant="outline" onClick={() => quickStatus(r, "done")} title="Concluir"><CheckCircle2 size={12} /></Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => quickStatus(r, "todo")} title="Reabrir"><ListTodo size={12} /></Button>
                    )}
                    {" "}
                    <Button size="sm" variant="outline" onClick={() => setSel({ ...r })}>Editar</Button>{" "}
                    <Button size="sm" variant="destructive" onClick={() => remove(r)}><Trash2 size={12} /></Button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{loading ? "Carregando…" : "Nenhuma tarefa."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {sel && (
        <div className="scroll-panel rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display text-lg text-gold">{sel.id ? "Editar tarefa" : "Nova tarefa"}</h4>
            <Button variant="outline" size="sm" onClick={() => setSel(null)}><X size={14} /></Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={sel.title} onChange={(e) => setSel({ ...sel, title: e.target.value })} placeholder="Ex: Balancear XP do arco Chunin" />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={sel.description ?? ""} onChange={(e) => setSel({ ...sel, description: e.target.value })} />
            </div>
            <div>
              <Label>Urgência</Label>
              <select className="w-full bg-secondary rounded px-2 py-2 text-sm border border-border"
                value={sel.urgency} onChange={(e) => setSel({ ...sel, urgency: e.target.value as Urgency })}>
                {(Object.keys(URGENCY_META) as Urgency[]).map((k) => <option key={k} value={k}>{URGENCY_META[k].label}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full bg-secondary rounded px-2 py-2 text-sm border border-border"
                value={sel.status} onChange={(e) => setSel({ ...sel, status: e.target.value as Status })}>
                {(Object.keys(STATUS_META) as Status[]).map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
              </select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="datetime-local" value={toLocalInput(sel.due_date)}
                onChange={(e) => setSel({ ...sel, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={sel.assignee ?? ""} onChange={(e) => setSel({ ...sel, assignee: e.target.value })} placeholder="Nome ou @user" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSel(null)}>Cancelar</Button>
            <Button onClick={save}><Save size={14} className="mr-1" /> Salvar</Button>
          </div>
        </div>
      )}
    </div>
  );
}