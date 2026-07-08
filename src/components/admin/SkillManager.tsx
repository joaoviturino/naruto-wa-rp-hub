import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { upsertSkill, deleteSkill } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { NINJA_RANKS, SKILL_RANKS, PROFICIENCIES, ELEMENTS, CLASSIFICATIONS, RANGES, labelize } from "./shared";
import { Trash2, Pencil, Plus } from "lucide-react";

export function SkillManager({ adminUserId }: { adminUserId: string }) {
  const [skills, setSkills] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [clans, setClans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [s, m, c] = await Promise.all([
      supabase.from("skills").select("*").order("rank"),
      supabase.from("missions").select("id,name"),
      supabase.from("clans").select("id,name,village"),
    ]);
    setSkills(s.data ?? []); setMissions(m.data ?? []); setClans(c.data ?? []);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-gold">Habilidades ({skills.length})</h3>
        <Button size="sm" onClick={() => { setEditing({}); setOpen(true); }}><Plus size={14} /> Nova habilidade</Button>
      </div>
      <div className="scroll-panel rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Img</th>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Rank</th>
              <th className="text-left p-2">Classif.</th>
              <th className="text-left p-2">Classe</th>
              <th className="text-left p-2">Alcance</th>
              <th className="text-left p-2">Clã</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2">{s.image_url ? <img src={s.image_url} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-secondary" />}</td>
                <td className="p-2 font-semibold">{s.name}</td>
                <td className="p-2">{s.rank}</td>
                <td className="p-2">{labelize(s.classification)}</td>
                <td className="p-2">{s.skill_class ?? "—"}</td>
                <td className="p-2">{labelize(s.range)}</td>
                <td className="p-2 text-xs">{clans.find((c) => c.id === s.clan_id)?.name ?? "—"}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil size={14} /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(`Remover ${s.name}?`)) return;
                    try { await deleteSkill({ data: { id: s.id } } as any); toast.success("Removida."); load(); }
                    catch (e: any) { toast.error(e.message); }
                  }}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SkillDialog open={open} onOpenChange={setOpen} initial={editing} missions={missions} clans={clans} allSkills={skills}
        adminUserId={adminUserId} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function SkillDialog({ open, onOpenChange, initial, missions, clans, allSkills, adminUserId, onSaved }: any) {
  const save = useServerFn(upsertSkill);
  const [f, setF] = useState<any>(initial ?? {});
  useEffect(() => { setF(initial ?? {}); }, [initial]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar habilidade" : "Criar habilidade"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><Input value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} /></Field>
          <Field label="Rank">
            <Select value={f.rank ?? "E"} onValueChange={(v) => up("rank", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Classificação">
            <NullableSelect value={f.classification} onChange={(v) => up("classification", v)} options={CLASSIFICATIONS.map((c) => ({ value: c, label: labelize(c) }))} />
          </Field>
          <Field label="Classe (livre)"><Input placeholder="Elemental, Ninpô, Kekkei Genkai..." value={f.skill_class ?? ""} onChange={(e) => up("skill_class", e.target.value)} /></Field>
          <Field label="Alcance">
            <NullableSelect value={f.range} onChange={(v) => up("range", v)} options={RANGES.map((r) => ({ value: r, label: labelize(r) }))} />
          </Field>
          <Field label="Elemento">
            <NullableSelect value={f.element} onChange={(v) => up("element", v)} options={ELEMENTS.map((e) => ({ value: e, label: e }))} />
          </Field>
          <Field label="Imagem">
            <div className="flex items-center gap-2">
              {f.image_url && <img src={f.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="skills" userId={adminUserId} onUploaded={(url) => up("image_url", url)} />
            </div>
          </Field>
          <Field label="Clã (opcional, define técnica de clã)">
            <NullableSelect value={f.clan_id} onChange={(v) => up("clan_id", v)} options={clans.map((c: any) => ({ value: c.id, label: `${c.name} (${c.village})` }))} />
          </Field>
          <Field label="Patente mínima">
            <NullableSelect value={f.req_rank} onChange={(v) => up("req_rank", v)} options={NINJA_RANKS.map((r) => ({ value: r.value, label: r.label }))} />
          </Field>
          <Field label="Proficiência requerida">
            <NullableSelect value={f.req_proficiency_kind} onChange={(v) => up("req_proficiency_kind", v)} options={PROFICIENCIES.map((p) => ({ value: p, label: p }))} />
          </Field>
          <Field label="Nível mínimo"><Input type="number" min={0} max={100} value={f.req_proficiency_level ?? ""} onChange={(e) => up("req_proficiency_level", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Requer missão">
            <NullableSelect value={f.req_mission_id} onChange={(v) => up("req_mission_id", v)} options={missions.map((m: any) => ({ value: m.id, label: m.name }))} />
          </Field>
          <Field label="Habilidade pré-requisito">
            <NullableSelect value={f.req_prereq_skill_id} onChange={(v) => up("req_prereq_skill_id", v)}
              options={allSkills.filter((x: any) => x.id !== f.id).map((s: any) => ({ value: s.id, label: `${s.name} (${s.rank})` }))} />
          </Field>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => {
            try {
              await save({ data: {
                ...f,
                description: f.description || null,
                image_url: f.image_url || null,
                skill_class: f.skill_class || null,
              } } as any);
              toast.success("Habilidade salva."); onSaved();
            } catch (e: any) { toast.error(e.message); }
          }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: any) { return <div><Label>{label}</Label>{children}</div>; }
function NullableSelect({ value, onChange, options }: any) {
  return (
    <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Nenhum —</SelectItem>
        {options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}