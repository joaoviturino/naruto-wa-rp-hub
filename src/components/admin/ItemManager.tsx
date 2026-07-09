import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { upsertItem, deleteItem } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { NINJA_RANKS, SKILL_RANKS, ITEM_TYPES, PROFICIENCIES, labelize } from "./shared";
import { Trash2, Pencil, Plus } from "lucide-react";
import { RestoreEffectFields } from "./RestoreEffectFields";

type Item = any;

export function ItemManager({ adminUserId }: { adminUserId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [i, m, s] = await Promise.all([
      supabase.from("items").select("*").order("type").order("rank"),
      supabase.from("missions").select("id,name"),
      supabase.from("skills").select("id,name"),
    ]);
    setItems(i.data ?? []); setMissions(m.data ?? []); setSkills(s.data ?? []);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-gold">Itens ({items.length})</h3>
        <Button size="sm" onClick={() => { setEditing({}); setOpen(true); }}><Plus size={14} /> Novo item</Button>
      </div>
      <div className="scroll-panel rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Img</th>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Rank</th>
              <th className="text-left p-2">Requisito</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-border">
                <td className="p-2">{it.image_url ? <img src={it.image_url} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-secondary" />}</td>
                <td className="p-2 font-semibold">{it.name}</td>
                <td className="p-2">{labelize(it.type)}</td>
                <td className="p-2">{it.rank}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {it.req_rank && <>Patente ≥ {labelize(it.req_rank)} </>}
                  {it.req_proficiency_kind && <>· {it.req_proficiency_kind} ≥ {it.req_proficiency_level ?? 0} </>}
                </td>
                <td className="p-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(it); setOpen(true); }}><Pencil size={14} /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(`Remover ${it.name}?`)) return;
                    try { await deleteItem({ data: { id: it.id } } as any); toast.success("Removido."); load(); }
                    catch (e: any) { toast.error(e.message); }
                  }}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ItemDialog open={open} onOpenChange={setOpen} initial={editing} missions={missions} skills={skills}
        adminUserId={adminUserId} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function ItemDialog({ open, onOpenChange, initial, missions, skills, adminUserId, onSaved }: any) {
  const save = useServerFn(upsertItem);
  const [f, setF] = useState<any>(initial ?? {});
  useEffect(() => { setF(initial ?? {}); }, [initial]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar item" : "Criar item"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><Input value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} /></Field>
          <Field label="Tipo">
            <SimpleSelect value={f.type} onChange={(v: any) => up("type", v)} options={ITEM_TYPES.map((t) => ({ value: t, label: labelize(t) }))} />
          </Field>
          <Field label="Rank">
            <SimpleSelect value={f.rank ?? "E"} onChange={(v: any) => up("rank", v)} options={SKILL_RANKS.map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Tamanho de slot"><Input type="number" min={1} max={20} value={f.slot_size ?? 1} onChange={(e) => up("slot_size", Number(e.target.value))} /></Field>
          <Field label="Durabilidade (vazio = infinita)"><Input type="number" min={0} value={f.durability ?? ""} onChange={(e) => up("durability", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Imagem">
            <div className="flex items-center gap-2">
              {f.image_url && <img src={f.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="items" userId={adminUserId} onUploaded={(url) => up("image_url", url)} />
            </div>
          </Field>
          <Field label="Patente mínima">
            <NullableSelect value={f.req_rank} onChange={(v: any) => up("req_rank", v)} options={NINJA_RANKS.map((r) => ({ value: r.value, label: r.label }))} />
          </Field>
          <Field label="Proficiência requerida">
            <NullableSelect value={f.req_proficiency_kind} onChange={(v: any) => up("req_proficiency_kind", v)} options={PROFICIENCIES.map((p) => ({ value: p, label: p }))} />
          </Field>
          <Field label="Nível mínimo dessa proficiência"><Input type="number" min={0} max={100} value={f.req_proficiency_level ?? ""} onChange={(e) => up("req_proficiency_level", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Requer missão">
            <NullableSelect value={f.req_mission_id} onChange={(v: any) => up("req_mission_id", v)} options={missions.map((m: any) => ({ value: m.id, label: m.name }))} />
          </Field>
          <Field label="Requer habilidade">
            <NullableSelect value={f.req_skill_id} onChange={(v: any) => up("req_skill_id", v)} options={skills.map((s: any) => ({ value: s.id, label: s.name }))} />
          </Field>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} />
          </div>
          {f.type === "consumable" && (
            <RestoreEffectFields
              value={f.meta?.restore ?? null}
              onChange={(r) => up("meta", { ...(f.meta ?? {}), restore: r })}
              title="Restauração de energia (consumível)"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => {
            try {
              await save({ data: { ...f, description: f.description || null, image_url: f.image_url || null, meta: f.meta ?? {} } } as any);
              toast.success("Item salvo."); onSaved();
            } catch (e: any) { toast.error(e.message); }
          }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: any) {
  return <div><Label>{label}</Label>{children}</div>;
}
function SimpleSelect({ value, onChange, options }: any) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
      <SelectContent>{options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}
function NullableSelect({ value, onChange, options }: any) {
  return (
    <Select value={value ?? "__none__"} onValueChange={(v: string) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Nenhum —</SelectItem>
        {options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}