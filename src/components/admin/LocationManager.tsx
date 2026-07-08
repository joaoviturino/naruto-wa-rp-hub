import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Upload, Link2, Plus } from "lucide-react";
import { toast } from "sonner";

type Loc = { id: string; name: string; description: string | null; image_url: string | null };
type Conn = { id: string; a_id: string; b_id: string };

export function LocationManager() {
  const [locs, setLocs] = useState<Loc[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [linkTo, setLinkTo] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [l, c] = await Promise.all([
      supabase.from("locations").select("id,name,description,image_url").order("name"),
      supabase.from("location_connections").select("id,a_id,b_id"),
    ]);
    setLocs((l.data as Loc[]) ?? []);
    setConns((c.data as Conn[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    const { error } = await supabase.from("locations").insert({ name: name.trim(), description: desc.trim() || null });
    if (error) return toast.error(error.message);
    setName(""); setDesc(""); toast.success("Local criado."); load();
  }
  async function remove(id: string) {
    if (!confirm("Apagar este local e todas as mensagens dele?")) return;
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected === id) setSelected(null);
    load();
  }
  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !selected) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Máx 5MB.");
    const ext = f.name.split(".").pop() ?? "png";
    const path = `${selected}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("locations").upload(path, f, { upsert: true, contentType: f.type });
    if (up.error) return toast.error(up.error.message);
    const signed = await supabase.storage.from("locations").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed.data?.signedUrl) return;
    await supabase.from("locations").update({ image_url: signed.data.signedUrl }).eq("id", selected);
    if (fileRef.current) fileRef.current.value = "";
    load();
  }
  async function linkAdd() {
    if (!selected || !linkTo || linkTo === selected) return;
    const [a, b] = [selected, linkTo].sort();
    const { error } = await supabase.from("location_connections").insert({ a_id: a, b_id: b });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    setLinkTo(""); load();
  }
  async function linkRemove(id: string) {
    await supabase.from("location_connections").delete().eq("id", id);
    load();
  }

  const sel = locs.find((l) => l.id === selected);
  const neighborIds = new Set(conns.filter((c) => c.a_id === selected || c.b_id === selected).map((c) => c.a_id === selected ? c.b_id : c.a_id));
  const availableToLink = locs.filter((l) => l.id !== selected && !neighborIds.has(l.id));

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="scroll-panel rounded-lg p-4 space-y-2">
          <h3 className="font-display text-lg text-gold">Novo local</h3>
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          <Button onClick={create} className="w-full"><Plus size={14} className="mr-1" /> Criar</Button>
        </div>
        <div className="scroll-panel rounded-lg p-2 max-h-[500px] overflow-y-auto">
          {locs.map((l) => (
            <div key={l.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selected===l.id?"bg-secondary":"hover:bg-secondary/50"}`}
              onClick={() => setSelected(l.id)}>
              <div className="flex-1 text-sm truncate">{l.name}</div>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(l.id); }}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          {locs.length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhum local ainda.</div>}
        </div>
      </div>

      {sel ? (
        <div className="space-y-4">
          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 rounded bg-secondary overflow-hidden shrink-0">
                {sel.image_url && <img src={sel.image_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-display text-2xl">{sel.name}</h3>
                <Textarea defaultValue={sel.description ?? ""} rows={3}
                  onBlur={async (e) => { await supabase.from("locations").update({ description: e.target.value }).eq("id", sel.id); load(); }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" /> Imagem do local
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
              </div>
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><Link2 size={16} /> Conexões</h4>
            <div className="flex flex-wrap gap-2">
              {conns.filter((c) => c.a_id === sel.id || c.b_id === sel.id).map((c) => {
                const other = locs.find((l) => l.id === (c.a_id === sel.id ? c.b_id : c.a_id));
                return (
                  <div key={c.id} className="flex items-center gap-1 bg-secondary rounded px-2 py-1 text-sm">
                    <span>{other?.name}</span>
                    <button onClick={() => linkRemove(c.id)} className="text-blood hover:text-blood/70"><Trash2 size={12} /></button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm">
                <option value="">— conectar a…</option>
                {availableToLink.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <Button size="sm" onClick={linkAdd} disabled={!linkTo}><Plus size={14} /></Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm p-6">Selecione um local à esquerda para editar suas conexões.</div>
      )}
    </div>
  );
}