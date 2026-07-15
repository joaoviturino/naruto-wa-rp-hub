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
import { NINJA_RANKS, SKILL_RANKS, ITEM_TYPES, labelize } from "./shared";
import { useProficiencies } from "@/hooks/useProficiencies";
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setEditing({ type: "material", rank: "E", stackable: true, stack_limit: 99 }); setOpen(true); }}>
            <Plus size={14} /> Novo material
          </Button>
          <Button size="sm" onClick={() => { setEditing({}); setOpen(true); }}><Plus size={14} /> Novo item</Button>
        </div>
      </div>
      <div className="scroll-panel rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
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
                  {it.req_class && <>· {it.req_class} N{it.req_nivel ?? "—"}/M{it.req_maestria ?? "—"} </>}
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
  const SKILL_CLASSES = useProficiencies();
  const save = useServerFn(upsertItem);
  const [f, setF] = useState<any>(initial ?? {});
  const [allItems, setAllItems] = useState<any[]>([]);
  useEffect(() => { setF(initial ?? {}); }, [initial]);
  useEffect(() => {
    supabase.from("items").select("id,name,type").order("name").then(({ data }) => setAllItems(data ?? []));
  }, [open]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  const CRAFTABLE = ["weapon","weapon_primary","weapon_secondary","armor_helmet","armor_vest","armor_pants","armor_boots","tool","consumable"];
  const isCraftable = CRAFTABLE.includes(f.type);
  const recipe: { item_id: string; qty: number }[] = Array.isArray(f.meta?.recipe) ? f.meta.recipe : [];
  function setRecipe(next: any[] | null) {
    up("meta", { ...(f.meta ?? {}), recipe: next && next.length ? next : null });
  }
  const materials = allItems.filter((i) => i.type === "material");

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
          {(f.type === "consumable" || f.type === "material" || f.meta?.is_tool) && (
            <>
              <Field label="Empilhável">
                <SimpleSelect
                  value={f.stackable === false ? "no" : "yes"}
                  onChange={(v: string) => up("stackable", v === "yes")}
                  options={[{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }]}
                />
              </Field>
              <Field label="Limite por pilha (vazio = ilimitado)">
                <Input
                  type="number"
                  min={1}
                  disabled={f.stackable === false}
                  value={f.stack_limit ?? ""}
                  onChange={(e) => up("stack_limit", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
            </>
          )}
          <Field label="Imagem">
            <div className="flex items-center gap-2">
              {f.image_url && <img src={f.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="items" userId={adminUserId} onUploaded={(url) => up("image_url", url)} />
            </div>
          </Field>
          <Field label="Patente mínima">
            <NullableSelect value={f.req_rank} onChange={(v: any) => up("req_rank", v)} options={NINJA_RANKS.map((r) => ({ value: r.value, label: r.label }))} />
          </Field>
          <Field label="Classe requerida">
            <NullableSelect value={f.req_class} onChange={(v: any) => up("req_class", v)} options={SKILL_CLASSES.map((c) => ({ value: c.value, label: c.label }))} />
          </Field>
          <Field label="Nível mínimo">
            <NullableSelect value={f.req_nivel} onChange={(v: any) => up("req_nivel", v)} options={SKILL_RANKS.map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Maestria mínima">
            <NullableSelect value={f.req_maestria} onChange={(v: any) => up("req_maestria", v)} options={SKILL_RANKS.map((r) => ({ value: r, label: r }))} />
          </Field>
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
          {isCraftable && (
            <div className="sm:col-span-2 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Receita de fabricação</Label>
                  <p className="text-xs text-muted-foreground">Deixe vazio para item não fabricável. Materiais devem ser cadastrados como itens do tipo <b>material</b>.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRecipe([...recipe, { item_id: materials[0]?.id ?? "", qty: 1 }])}>
                  <Plus size={14} /> Ingrediente
                </Button>
              </div>
              {materials.length === 0 && (
                <p className="text-xs text-amber-500">Nenhum item do tipo <b>material</b> cadastrado ainda.</p>
              )}
              {recipe.map((r, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <SimpleSelect
                      value={r.item_id || undefined}
                      onChange={(v: string) => {
                        const next = [...recipe]; next[idx] = { ...next[idx], item_id: v }; setRecipe(next);
                      }}
                      options={materials.map((m: any) => ({ value: m.id, label: m.name }))}
                    />
                  </div>
                  <Input
                    type="number" min={1} className="w-24"
                    value={r.qty}
                    onChange={(e) => {
                      const next = [...recipe]; next[idx] = { ...next[idx], qty: Math.max(1, Number(e.target.value) || 1) }; setRecipe(next);
                    }}
                  />
                  <Button size="icon" variant="ghost" onClick={() => {
                    const next = recipe.filter((_, i) => i !== idx); setRecipe(next);
                  }}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
          )}
          <Field label="Ferramenta de Shurikenjutsu">
            <SimpleSelect
              value={f.meta?.is_tool ? "yes" : "no"}
              onChange={(v: string) => up("meta", { ...(f.meta ?? {}), is_tool: v === "yes" })}
              options={[{ value: "no", label: "Não" }, { value: "yes", label: "Sim (kunai, shuriken, etc.)" }]}
            />
          </Field>
          <Field label="Bônus crítico de Shurikenjutsu (%)">
            <Input
              type="number"
              min={0}
              max={500}
              disabled={!f.meta?.is_tool}
              value={f.meta?.crit_bonus ?? ""}
              onChange={(e) => up("meta", { ...(f.meta ?? {}), crit_bonus: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => {
            try {
              const cleanMeta = { ...(f.meta ?? {}) };
              if (Array.isArray(cleanMeta.recipe)) {
                const cleaned = cleanMeta.recipe.filter((r: any) => r && r.item_id && r.qty > 0);
                cleanMeta.recipe = cleaned.length ? cleaned : null;
              }
              await save({ data: { ...f, description: f.description || null, image_url: f.image_url || null, meta: cleanMeta } } as any);
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