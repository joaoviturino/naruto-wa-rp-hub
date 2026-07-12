import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, RotateCcw, Save, X } from "lucide-react";
import { useProficiencies, refreshProficiencies, type Proficiency } from "@/hooks/useProficiencies";

export function ProficiencyManager() {
  const rows = useProficiencies({ includeInactive: true });
  const [editing, setEditing] = useState<Proficiency | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ value: string; label: string; description: string; sort_order: number }>({ value: "", label: "", description: "", sort_order: 999 });

  function startCreate() { setCreating(true); setEditing(null); setForm({ value: "", label: "", description: "", sort_order: (rows.length + 1) * 10 }); }
  function startEdit(r: Proficiency) { setEditing(r); setCreating(false); setForm({ value: r.value, label: r.label, description: (r.description ?? "") as string, sort_order: r.sort_order }); }
  function cancel() { setEditing(null); setCreating(false); }

  async function saveCreate() {
    if (!form.value.trim() || !form.label.trim()) { toast.error("Preencha valor e rótulo."); return; }
    const { error } = await supabase.rpc("add_proficiency", {
      _value: form.value, _label: form.label, _desc: form.description || undefined, _sort: form.sort_order,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Proficiência criada.");
    cancel(); refreshProficiencies();
  }
  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from("proficiencies").update({
      label: form.label, description: form.description || null, sort_order: form.sort_order,
    }).eq("value", editing.value);
    if (error) { toast.error(error.message); return; }
    toast.success("Proficiência atualizada.");
    cancel(); refreshProficiencies();
  }
  async function toggleActive(r: Proficiency) {
    const { error } = await supabase.from("proficiencies").update({ active: !r.active }).eq("value", r.value);
    if (error) { toast.error(error.message); return; }
    toast.success(r.active ? "Proficiência desativada." : "Proficiência reativada.");
    refreshProficiencies();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl text-gold">Proficiências</h3>
          <p className="text-xs text-muted-foreground">Catálogo global de classes de habilidade. Valores novos ficam disponíveis em habilidades, itens, minigames e livros. Não é possível remover permanentemente um valor já criado (limitação do banco) — use "Desativar" para escondê-lo.</p>
        </div>
        <Button onClick={startCreate}><Plus size={14} /> Nova proficiência</Button>
      </div>

      {(creating || editing) && (
        <div className="scroll-panel rounded-lg p-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Valor interno {editing && <span className="text-muted-foreground text-xs">(imutável)</span>}</Label>
            <Input value={form.value} disabled={!!editing} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="ex: kenjutsu_avancado" />
            <p className="text-[10px] text-muted-foreground mt-1">Somente letras minúsculas, números e "_". Sem acentos.</p>
          </div>
          <div>
            <Label>Rótulo (exibido)</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Kenjutsu Avançado" />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Ordem</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
          </div>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <Button variant="outline" onClick={cancel}><X size={14} /> Cancelar</Button>
            <Button onClick={creating ? saveCreate : saveEdit}><Save size={14} /> {creating ? "Criar" : "Salvar"}</Button>
          </div>
        </div>
      )}

      <div className="scroll-panel rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-3">Ordem</th>
              <th className="text-left p-3">Rótulo</th>
              <th className="text-left p-3">Valor</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-left p-3">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.value} className={"border-t border-border " + (r.active ? "" : "opacity-50")}>
                <td className="p-3 text-xs">{r.sort_order}</td>
                <td className="p-3 font-semibold">{r.label}</td>
                <td className="p-3 text-xs text-muted-foreground">{r.value}</td>
                <td className="p-3 text-xs max-w-md">{r.description ?? "—"}</td>
                <td className="p-3 text-xs">{r.active ? <span className="text-emerald-400">ativa</span> : <span className="text-red-400">desativada</span>}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => startEdit(r)}><Pencil size={12} /></Button>{" "}
                  <Button size="sm" variant={r.active ? "outline" : "secondary"} onClick={() => toggleActive(r)} title={r.active ? "Desativar" : "Reativar"}>
                    {r.active ? <Trash2 size={12} /> : <RotateCcw size={12} />}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma proficiência.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}