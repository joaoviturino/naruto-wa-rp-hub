import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComboSelect } from "@/components/ui/combo-select";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Hammer } from "lucide-react";
import { NINJA_RANKS, SKILL_RANKS, ITEM_TYPES, labelize } from "@/components/admin/shared";
import { useProficiencies } from "@/hooks/useProficiencies";
import { submitItemSubmission, listMySubmissions, deleteSubmission } from "@/lib/blacksmith.functions";

const CRAFTABLE = ["weapon","weapon_primary","weapon_secondary","armor_helmet","armor_vest","armor_pants","armor_boots","tool","consumable"];

export function BlacksmithPanel() {
  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const list = useServerFn(listMySubmissions);
  const remove = useServerFn(deleteSubmission);

  async function load() {
    try { const data = await list({} as any); setRows(data as any); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
    load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-6 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blood to-gold text-background">
          <Hammer size={22} />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-black">Forja do Ferreiro</h1>
          <p className="text-xs text-muted-foreground">Crie itens e envie-os para aprovação da administração.</p>
        </div>
        <Button onClick={() => { setEditing({ type: "weapon", rank: "E", slot_size: 1, stackable: false, meta: {} }); setOpen(true); }}>
          <Plus size={16} /> Nova submissão
        </Button>
      </div>

      <div className="scroll-panel rounded-lg overflow-x-auto border border-border">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Img</th>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Rank</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Notas do admin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma submissão ainda. Clique em <b>Nova submissão</b>.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2">{r.image_url ? <img src={r.image_url} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-secondary" />}</td>
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2">{labelize(r.type)}</td>
                <td className="p-2">{r.rank}</td>
                <td className="p-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="p-2 text-xs text-muted-foreground max-w-[280px] truncate">{r.review_notes ?? "—"}</td>
                <td className="p-2 text-right">
                  {r.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil size={14} /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm(`Remover submissão "${r.name}"?`)) return;
                        try { await remove({ data: { id: r.id } } as any); toast.success("Removido."); load(); }
                        catch (e: any) { toast.error(e.message); }
                      }}><Trash2 size={14} /></Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubmissionDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        userId={userId}
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    rejected: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  const label: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${map[status] ?? ""}`}>{label[status] ?? status}</span>;
}

function SubmissionDialog({ open, onOpenChange, initial, userId, onSaved }: any) {
  const save = useServerFn(submitItemSubmission);
  const SKILL_CLASSES = useProficiencies();
  const [f, setF] = useState<any>(initial ?? {});
  const [materials, setMaterials] = useState<any[]>([]);
  useEffect(() => { setF(initial ?? {}); }, [initial, open]);
  useEffect(() => {
    if (!open) return;
    supabase.from("items").select("id,name,type").eq("type","material").order("name").then(({ data }) => setMaterials(data ?? []));
  }, [open]);

  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }
  const isCraftable = CRAFTABLE.includes(f.type);
  const recipe: { item_id: string; qty: number }[] = Array.isArray(f.meta?.recipe) ? f.meta.recipe : [];
  function setRecipe(next: any[] | null) {
    up("meta", { ...(f.meta ?? {}), recipe: next && next.length ? next : null });
  }

  async function handleSave() {
    try {
      const cleanMeta = { ...(f.meta ?? {}) };
      if (Array.isArray(cleanMeta.recipe)) {
        const cleaned = cleanMeta.recipe.filter((r: any) => r && r.item_id && r.qty > 0);
        cleanMeta.recipe = cleaned.length ? cleaned : null;
      }
      await save({ data: {
        id: f.id,
        name: f.name,
        type: f.type,
        rank: f.rank,
        description: f.description || null,
        image_url: f.image_url || null,
        durability: f.durability ?? null,
        slot_size: f.slot_size ?? 1,
        stackable: !!f.stackable,
        stack_limit: f.stack_limit ?? null,
        req_rank: f.req_rank || null,
        req_class: f.req_class || null,
        req_nivel: f.req_nivel || null,
        req_maestria: f.req_maestria || null,
        meta: cleanMeta,
      } } as any);
      toast.success(f.id ? "Submissão atualizada." : "Submissão enviada para aprovação.");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar submissão" : "Nova submissão de item"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><Input value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} /></Field>
          <Field label="Tipo">
            <ComboSelect value={f.type ?? ""} onChange={(v) => up("type", v)} placeholder="Selecionar"
              options={ITEM_TYPES.map((t) => ({ value: t, label: labelize(t) }))} />
          </Field>
          <Field label="Rank">
            <ComboSelect value={f.rank ?? "E"} onChange={(v) => up("rank", v)}
              options={SKILL_RANKS.map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Tamanho de slot">
            <Input type="number" min={1} max={20} value={f.slot_size ?? 1} onChange={(e) => up("slot_size", Number(e.target.value))} />
          </Field>
          <Field label="Durabilidade (vazio = infinita)">
            <Input type="number" min={0} value={f.durability ?? ""} onChange={(e) => up("durability", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label="Imagem">
            <div className="flex items-center gap-2">
              {f.image_url && <img src={f.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="items" userId={userId} onUploaded={(url) => up("image_url", url)} />
            </div>
          </Field>
          <Field label="Patente mínima">
            <ComboSelect value={f.req_rank ?? ""} onChange={(v) => up("req_rank", v || null)} placeholder="— Nenhum —"
              options={[{ value: "", label: "— Nenhum —" }, ...NINJA_RANKS.map((r) => ({ value: r.value, label: r.label }))]} />
          </Field>
          <Field label="Classe requerida">
            <ComboSelect value={f.req_class ?? ""} onChange={(v) => up("req_class", v || null)} placeholder="— Nenhum —"
              options={[{ value: "", label: "— Nenhum —" }, ...SKILL_CLASSES.map((c: any) => ({ value: c.value, label: c.label }))]} />
          </Field>
          <Field label="Nível mínimo">
            <ComboSelect value={f.req_nivel ?? ""} onChange={(v) => up("req_nivel", v || null)} placeholder="— Nenhum —"
              options={[{ value: "", label: "— Nenhum —" }, ...SKILL_RANKS.map((r) => ({ value: r, label: r }))]} />
          </Field>
          <Field label="Maestria mínima">
            <ComboSelect value={f.req_maestria ?? ""} onChange={(v) => up("req_maestria", v || null)} placeholder="— Nenhum —"
              options={[{ value: "", label: "— Nenhum —" }, ...SKILL_RANKS.map((r) => ({ value: r, label: r }))]} />
          </Field>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} />
          </div>

          {isCraftable && (
            <div className="sm:col-span-2 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Receita de fabricação</Label>
                  <p className="text-xs text-muted-foreground">Materiais necessários para forjar este item.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRecipe([...recipe, { item_id: materials[0]?.id ?? "", qty: 1 }])}>
                  <Plus size={14} /> Ingrediente
                </Button>
              </div>
              {materials.length === 0 && (
                <p className="text-xs text-amber-500">Nenhum material cadastrado no jogo ainda — peça a um admin.</p>
              )}
              {recipe.map((r, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <ComboSelect value={r.item_id || ""} onChange={(v) => {
                      const next = [...recipe]; next[idx] = { ...next[idx], item_id: v }; setRecipe(next);
                    }} options={materials.map((m: any) => ({ value: m.id, label: m.name }))} />
                  </div>
                  <Input type="number" min={1} className="w-24" value={r.qty}
                    onChange={(e) => {
                      const next = [...recipe]; next[idx] = { ...next[idx], qty: Math.max(1, Number(e.target.value) || 1) }; setRecipe(next);
                    }} />
                  <Button size="icon" variant="ghost" onClick={() => setRecipe(recipe.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{f.id ? "Salvar alterações" : "Enviar para aprovação"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: any) {
  return <div><Label>{label}</Label>{children}</div>;
}