import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { listJobs, upsertJob, deleteJob } from "@/lib/jobs.functions";
import { toast } from "sonner";
import { Plus, Save, Trash2, Briefcase, Upload } from "lucide-react";

type Job = {
  id?: string; name: string; description: string | null; image_url: string | null;
  salary_ryo: number; salary_xp: number; salary_interval_hours: number;
  fire_after_days: number; active: boolean;
};

const EMPTY: Job = {
  name: "", description: "", image_url: null,
  salary_ryo: 100, salary_xp: 0, salary_interval_hours: 24,
  fire_after_days: 7, active: true,
};

export function JobManager() {
  const [list, setList] = useState<Job[]>([]);
  const [sel, setSel] = useState<Job | null>(null);
  const load = useServerFn(listJobs);
  const save = useServerFn(upsertJob);
  const del = useServerFn(deleteJob);

  async function refresh() {
    const r = await load({ data: {} } as any);
    setList((r.jobs ?? []) as any);
  }
  useEffect(() => { refresh(); }, []);

  async function onSave() {
    if (!sel) return;
    try {
      await save({ data: {
        ...(sel.id ? { id: sel.id } : {}),
        name: sel.name, description: sel.description || null, image_url: sel.image_url || null,
        salary_ryo: Number(sel.salary_ryo) || 0,
        salary_xp: Number(sel.salary_xp) || 0,
        salary_interval_hours: Number(sel.salary_interval_hours) || 24,
        fire_after_days: Number(sel.fire_after_days) || 7,
        active: !!sel.active,
      }});
      toast.success("Emprego salvo.");
      setSel(null);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  async function upload(file: File) {
    if (!sel) return;
    const path = `jobs/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("npcs").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("npcs").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (data?.signedUrl) setSel({ ...sel, image_url: data.signedUrl });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        <Button onClick={() => setSel({ ...EMPTY })} className="w-full"><Plus size={14} className="mr-1" /> Novo emprego</Button>
        <div className="scroll-panel rounded-lg p-2 max-h-[560px] overflow-y-auto">
          {list.map((j) => (
            <div key={j.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${sel?.id === j.id ? "bg-secondary" : "hover:bg-secondary/50"}`}
              onClick={() => setSel({ ...j })}>
              {j.image_url ? <img src={j.image_url} className="w-8 h-8 rounded object-cover" alt="" /> : <Briefcase size={16} className="text-gold" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{j.name}</div>
                <div className="text-[10px] text-muted-foreground">{j.salary_ryo} Ryo / {j.salary_interval_hours}h</div>
              </div>
              <span className={`text-[10px] px-1.5 rounded ${j.active ? "bg-emerald-900 text-emerald-200" : "bg-secondary text-muted-foreground"}`}>{j.active ? "on" : "off"}</span>
            </div>
          ))}
          {!list.length && <div className="text-xs text-muted-foreground p-3">Nenhum emprego ainda.</div>}
        </div>
      </div>

      {sel ? (
        <div className="scroll-panel rounded-lg p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Nome</Label><Input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} /></div>
            <div>
              <Label>Imagem</Label>
              <div className="flex gap-2 items-center">
                {sel.image_url && <img src={sel.image_url} className="w-10 h-10 rounded object-cover" alt="" />}
                <label className="cursor-pointer inline-flex items-center gap-1 border border-border rounded px-2 py-1 text-xs">
                  <Upload size={12} /> Enviar
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
          <div><Label>Descrição</Label><Textarea rows={2} value={sel.description ?? ""} onChange={(e) => setSel({ ...sel, description: e.target.value })} /></div>
          <div className="grid gap-3 md:grid-cols-4">
            <div><Label>Salário (Ryo)</Label><Input type="number" min={0} value={sel.salary_ryo} onChange={(e) => setSel({ ...sel, salary_ryo: Number(e.target.value) })} /></div>
            <div><Label>Salário (XP)</Label><Input type="number" min={0} value={sel.salary_xp} onChange={(e) => setSel({ ...sel, salary_xp: Number(e.target.value) })} /></div>
            <div><Label>Intervalo (h)</Label><Input type="number" min={1} value={sel.salary_interval_hours} onChange={(e) => setSel({ ...sel, salary_interval_hours: Number(e.target.value) })} /></div>
            <div><Label>Demissão após (dias)</Label><Input type="number" min={1} value={sel.fire_after_days} onChange={(e) => setSel({ ...sel, fire_after_days: Number(e.target.value) })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sel.active} onChange={(e) => setSel({ ...sel, active: e.target.checked })} /> Ativo
          </label>
          <div className="flex gap-2 pt-2">
            <Button onClick={onSave}><Save size={14} className="mr-1"/> Salvar</Button>
            {sel.id && <Button variant="destructive" onClick={async () => {
              if (!confirm("Apagar este emprego?")) return;
              try { await del({ data: { id: sel.id! } }); toast.success("Removido."); setSel(null); refresh(); }
              catch (e: any) { toast.error(e.message); }
            }}><Trash2 size={14} className="mr-1"/> Apagar</Button>}
            <Button variant="outline" onClick={() => setSel(null)}>Fechar</Button>
          </div>
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            Para contratar jogadores, crie um NPC do tipo "Empregador" e vincule este emprego a ele.
            O tempo de inatividade é medido pelos minigames vinculados; se o jogador ficar sem trabalhar por mais dias que o configurado, é demitido automaticamente ao coletar salário.
          </div>
        </div>
      ) : (
        <div className="scroll-panel rounded-lg p-8 text-sm text-muted-foreground text-center">
          Selecione um emprego ou crie um novo.
        </div>
      )}
    </div>
  );
}
