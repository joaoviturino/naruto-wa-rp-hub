import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CosmeticUploader } from "@/components/admin/CosmeticUploader";
import { SpriteSheetConfig } from "@/components/admin/SpriteSheetConfig";
import type { StatesMap } from "@/components/AnimatedSprite";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Save, X, Eye, EyeOff } from "lucide-react";
import { validateSpriteSheet } from "@/lib/sprite-validate";

type Slot = "hair" | "face" | "clothing" | "accessory";
type Piece = {
  id: string; slot: Slot; name: string; image_url: string;
  z_index: number; sort_order: number; active: boolean;
  sheet_url: string | null; sheet_cols: number | null; sheet_rows: number | null;
  sheet_states: StatesMap | null;
};

const SLOT_LABEL: Record<Slot, string> = {
  hair: "Cabelo", face: "Rosto", clothing: "Roupa/Armadura", accessory: "Acessório",
};
const SLOT_DEFAULT_Z: Record<Slot, number> = { clothing: 1, face: 2, hair: 3, accessory: 4 };

export function CosmeticsManager({ adminUserId }: { adminUserId: string }) {
  const [rows, setRows] = useState<Piece[]>([]);
  const [editing, setEditing] = useState<Piece | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<Piece, "id">>({
    slot: "hair", name: "", image_url: "", z_index: 3, sort_order: 0, active: true,
    sheet_url: null, sheet_cols: null, sheet_rows: null, sheet_states: null,
  });
  const [filter, setFilter] = useState<Slot | "all">("all");

  async function load() {
    const { data, error } = await supabase.from("cosmetic_pieces").select("*").order("slot").order("sort_order");
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Piece[]);
  }
  useEffect(() => { load(); }, []);

  function startCreate() {
    setCreating(true); setEditing(null);
    setForm({ slot: "hair", name: "", image_url: "", z_index: SLOT_DEFAULT_Z.hair, sort_order: rows.length * 10, active: true,
      sheet_url: null, sheet_cols: null, sheet_rows: null, sheet_states: null });
  }
  function startEdit(r: Piece) {
    setEditing(r); setCreating(false);
    setForm({ slot: r.slot, name: r.name, image_url: r.image_url, z_index: r.z_index, sort_order: r.sort_order, active: r.active,
      sheet_url: r.sheet_url ?? null, sheet_cols: r.sheet_cols ?? null, sheet_rows: r.sheet_rows ?? null, sheet_states: r.sheet_states ?? null });
  }
  function cancel() { setCreating(false); setEditing(null); }

  async function save() {
    if (!form.name.trim() || !form.image_url) return toast.error("Nome e imagem são obrigatórios.");
    if (form.sheet_url) {
      const v = await validateSpriteSheet(form.sheet_url, form.sheet_cols, form.sheet_rows, form.sheet_states);
      if (!v.ok) {
        return toast.error(`Spritesheet inválida: ${v.errors[0] ?? "verifique cols/rows/estados."}`);
      }
      if (v.warnings.length) toast.warning(v.warnings[0]);
    }
    if (editing) {
      const { error } = await supabase.from("cosmetic_pieces").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Peça atualizada.");
    } else {
      const { error } = await supabase.from("cosmetic_pieces").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Peça criada.");
    }
    cancel(); load();
  }

  async function del(r: Piece) {
    if (!confirm(`Excluir "${r.name}"? Personagens que estiverem usando perdem a peça.`)) return;
    const { error } = await supabase.from("cosmetic_pieces").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Peça removida.");
    load();
  }

  async function toggleActive(r: Piece) {
    const { error } = await supabase.from("cosmetic_pieces").update({ active: !r.active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.slot === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-xl text-gold">Personalização — Peças cosméticas</h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Faça upload de PNGs com fundo transparente. Cada peça pertence a um slot (cabelo, rosto, roupa, acessório) e é sobreposta ao sprite do personagem. O <b>z-index</b> define a ordem de empilhamento (maior = mais na frente). Use tamanhos consistentes (ex: 512×512) para que as peças alinhem.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os slots</SelectItem>
              {(Object.keys(SLOT_LABEL) as Slot[]).map((s) => (
                <SelectItem key={s} value={s}>{SLOT_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={startCreate}><Plus size={14} /> Nova peça</Button>
        </div>
      </div>

      {(creating || editing) && (
        <div className="admin-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Slot</Label>
              <Select value={form.slot} onValueChange={(v) => setForm({ ...form, slot: v as Slot, z_index: SLOT_DEFAULT_Z[v as Slot] })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SLOT_LABEL) as Slot[]).map((s) => (
                    <SelectItem key={s} value={s}>{SLOT_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Cabelo Espetado Preto" />
            </div>
            <div>
              <Label>Ordem (sort)</Label>
              <Input className="mt-1" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value || "0") })} />
            </div>
            <div>
              <Label>Z-Index (camada)</Label>
              <Input className="mt-1" type="number" value={form.z_index} onChange={(e) => setForm({ ...form, z_index: parseInt(e.target.value || "0") })} />
            </div>
          </div>
          <CosmeticUploader
            slot={form.slot}
            userId={adminUserId}
            currentUrl={form.image_url}
            onUploaded={(url) => setForm((f) => ({ ...f, image_url: url }))}
          />
          <SpriteSheetConfig
            label="Spritesheet animada (opcional) — sincroniza com o corpo do personagem"
            userId={adminUserId}
            bucket="cosmetics"
            sheetUrl={form.sheet_url}
            cols={form.sheet_cols}
            rows={form.sheet_rows}
            states={form.sheet_states}
            fallbackImageUrl={form.image_url}
            onChange={(patch) => setForm((f) => ({
              ...f,
              sheet_url: patch.sheet_url !== undefined ? patch.sheet_url : f.sheet_url,
              sheet_cols: patch.sheet_cols !== undefined ? patch.sheet_cols : f.sheet_cols,
              sheet_rows: patch.sheet_rows !== undefined ? patch.sheet_rows : f.sheet_rows,
              sheet_states: patch.sheet_states !== undefined ? patch.sheet_states : f.sheet_states,
            }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancel}><X size={14} /> Cancelar</Button>
            <Button onClick={save}><Save size={14} /> Salvar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((r) => (
          <div key={r.id} className={`admin-card p-3 space-y-2 ${!r.active ? "opacity-60" : ""}`}>
            <div className="h-32 rounded bg-black/40 flex items-center justify-center overflow-hidden">
              <img src={r.image_url} alt={r.name} className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold">{SLOT_LABEL[r.slot]} · z{r.z_index}</div>
              <div className="text-sm font-semibold truncate">{r.name}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => startEdit(r)}><Pencil size={12} /></Button>
              <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>{r.active ? <Eye size={12} /> : <EyeOff size={12} />}</Button>
              <Button size="sm" variant="destructive" onClick={() => del(r)} className="ml-auto"><Trash2 size={12} /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-sm text-muted-foreground py-8 text-center">Nenhuma peça cadastrada.</div>}
      </div>
    </div>
  );
}