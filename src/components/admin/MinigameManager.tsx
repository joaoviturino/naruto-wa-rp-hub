import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, Plus, Save } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { upsertMinigame, deleteMinigame } from "@/lib/minigame.functions";
import { toast } from "sonner";

type Item = { id: string; name: string };
type RewardItem = { item_id: string; qty: number };
type Minigame = {
  id: string; slug: string; kind: string; name: string; description: string | null;
  background_url: string | null; tileset_url: string | null; npc_portrait_url: string | null; npc_name: string | null;
  dialog_intro: string | null; dialog_outro: string | null;
  config: any; rewards: any; cooldown_hours: number; active: boolean;
};

const EMPTY: Minigame = {
  id: "", slug: "", kind: "cleanup", name: "", description: "",
  background_url: null, tileset_url: null, npc_portrait_url: null, npc_name: "",
  dialog_intro: "", dialog_outro: "",
  config: { duration_seconds: 60, spots: 12, target_score: 8 },
  rewards: { xp: 0, ryo: 0, ef: 0, em: 0, chakra: 0, items: [] },
  cooldown_hours: 24, active: true,
};

export function MinigameManager() {
  const [list, setList] = useState<Minigame[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Minigame | null>(null);
  const upsert = useServerFn(upsertMinigame);
  const remove = useServerFn(deleteMinigame);

  async function load() {
    const [{ data: mg }, { data: it }] = await Promise.all([
      supabase.from("minigames").select("*").order("name"),
      supabase.from("items").select("id,name").order("name"),
    ]);
    setList((mg as Minigame[]) ?? []);
    setItems((it as Item[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function newOne() { setSelected({ ...EMPTY }); }
  function edit(m: Minigame) { setSelected({ ...m, config: m.config ?? EMPTY.config, rewards: m.rewards ?? EMPTY.rewards }); }

  async function save() {
    if (!selected) return;
    try {
      const payload: any = {
        ...(selected.id ? { id: selected.id } : {}),
        slug: selected.slug, kind: selected.kind || "cleanup", name: selected.name,
        description: selected.description || null,
        background_url: selected.background_url, tileset_url: selected.tileset_url,
        npc_portrait_url: selected.npc_portrait_url, npc_name: selected.npc_name || null,
        dialog_intro: selected.dialog_intro || null, dialog_outro: selected.dialog_outro || null,
        config: selected.config, rewards: selected.rewards,
        cooldown_hours: Number(selected.cooldown_hours) || 0, active: selected.active,
      };
      const r = await upsert({ data: payload });
      toast.success("Minigame salvo.");
      setSelected(null);
      await load();
      const fresh = (await supabase.from("minigames").select("*").eq("id", r.id).maybeSingle()).data as Minigame | null;
      if (fresh) setSelected(fresh);
    } catch (e: any) { toast.error(e.message); }
  }

  async function del(id: string) {
    if (!confirm("Apagar este minigame?")) return;
    try { await remove({ data: { id } }); toast.success("Removido."); setSelected(null); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <Button onClick={newOne} className="w-full"><Plus size={14} className="mr-1" /> Novo minigame</Button>
        <div className="scroll-panel rounded-lg p-2 max-h-[560px] overflow-y-auto">
          {list.map((m) => (
            <div key={m.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selected?.id===m.id?"bg-secondary":"hover:bg-secondary/50"}`}
              onClick={() => edit(m)}>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{m.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{m.slug} · CD {m.cooldown_hours}h</div>
              </div>
              <span className={`text-[10px] px-1.5 rounded ${m.active ? "bg-emerald-900 text-emerald-200" : "bg-secondary text-muted-foreground"}`}>{m.active ? "on" : "off"}</span>
            </div>
          ))}
          {list.length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhum minigame ainda.</div>}
        </div>
      </div>

      {selected ? (
        <div className="space-y-4">
          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Tipo</Label>
                <select className="w-full bg-input border border-border rounded px-2 py-2 text-sm"
                  value={selected.kind || "cleanup"}
                  onChange={(e) => {
                    const kind = e.target.value;
                    const config = kind === "sequence"
                      ? { duration_seconds: 60, max_mistakes: 2, tiles: [] }
                      : { duration_seconds: 60, spots: 12, target_score: 8 };
                    setSelected({ ...selected, kind, config });
                  }}>
                  <option value="cleanup">Limpeza (clique)</option>
                  <option value="sequence">Sequência (acerto)</option>
                </select>
              </div>
              <div><Label>Nome</Label><Input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} /></div>
              <div><Label>Slug (único, a-z, 0-9, _, -)</Label><Input value={selected.slug} onChange={(e) => setSelected({ ...selected, slug: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={2} value={selected.description ?? ""} onChange={(e) => setSelected({ ...selected, description: e.target.value })} /></div>
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label>Cooldown (horas)</Label><Input type="number" min={0} value={selected.cooldown_hours} onChange={(e) => setSelected({ ...selected, cooldown_hours: Number(e.target.value) })} /></div>
              <label className="flex items-center gap-2 mt-6 text-sm">
                <input type="checkbox" checked={selected.active} onChange={(e) => setSelected({ ...selected, active: e.target.checked })} /> Ativo
              </label>
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold">Assets</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <ImgSlot label="Fundo (cena)" url={selected.background_url}
                onChange={(u) => setSelected({ ...selected, background_url: u })} folder={selected.slug || "new"} />
              <ImgSlot label="Tileset (itens de limpeza)" url={selected.tileset_url}
                onChange={(u) => setSelected({ ...selected, tileset_url: u })} folder={selected.slug || "new"} />
              <ImgSlot label="Retrato NPC" url={selected.npc_portrait_url}
                onChange={(u) => setSelected({ ...selected, npc_portrait_url: u })} folder={selected.slug || "new"} />
            </div>
            <div><Label>Nome do NPC</Label><Input value={selected.npc_name ?? ""} onChange={(e) => setSelected({ ...selected, npc_name: e.target.value })} /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Diálogo de início</Label><Textarea rows={4} value={selected.dialog_intro ?? ""} onChange={(e) => setSelected({ ...selected, dialog_intro: e.target.value })} /></div>
              <div><Label>Diálogo final</Label><Textarea rows={4} value={selected.dialog_outro ?? ""} onChange={(e) => setSelected({ ...selected, dialog_outro: e.target.value })} /></div>
            </div>
          </div>

          {selected.kind === "sequence" ? (
            <SequenceConfigEditor selected={selected} setSelected={setSelected} />
          ) : (
            <div className="scroll-panel rounded-lg p-4 space-y-3">
              <h4 className="font-display text-lg text-gold">Configuração da limpeza</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <div><Label>Duração (s)</Label><Input type="number" min={15} max={600} value={selected.config?.duration_seconds ?? 60} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, duration_seconds: Number(e.target.value) } })} /></div>
                <div><Label>Sujeiras na cena</Label><Input type="number" min={3} max={40} value={selected.config?.spots ?? 12} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, spots: Number(e.target.value) } })} /></div>
                <div><Label>Alvo p/ sucesso</Label><Input type="number" min={1} max={40} value={selected.config?.target_score ?? 8} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, target_score: Number(e.target.value) } })} /></div>
              </div>
            </div>
          )}

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold">Recompensas (ao concluir com sucesso)</h4>
            <div className="grid gap-3 md:grid-cols-5">
              {(["xp","ryo","ef","em","chakra"] as const).map((k) => (
                <div key={k}><Label>{k.toUpperCase()}</Label>
                  <Input type="number" min={0} value={selected.rewards?.[k] ?? 0}
                    onChange={(e) => setSelected({ ...selected, rewards: { ...selected.rewards, [k]: Number(e.target.value) } })} />
                </div>
              ))}
            </div>
            <div>
              <Label>Itens recompensa</Label>
              <div className="space-y-1">
                {(selected.rewards?.items ?? []).map((ri: RewardItem, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm"
                      value={ri.item_id} onChange={(e) => {
                        const next = [...(selected.rewards.items ?? [])]; next[idx] = { ...ri, item_id: e.target.value };
                        setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                      }}>
                      <option value="">— item —</option>
                      {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                    <Input type="number" min={1} className="w-20" value={ri.qty}
                      onChange={(e) => {
                        const next = [...(selected.rewards.items ?? [])]; next[idx] = { ...ri, qty: Number(e.target.value) };
                        setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                      }} />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = [...(selected.rewards.items ?? [])]; next.splice(idx, 1);
                      setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                    }}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => {
                  const next = [...(selected.rewards?.items ?? []), { item_id: "", qty: 1 }];
                  setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                }}><Plus size={14} className="mr-1" /> Adicionar item</Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={save}><Save size={14} className="mr-1" /> Salvar</Button>
            {selected.id && <Button variant="destructive" onClick={() => del(selected.id)}><Trash2 size={14} className="mr-1" /> Apagar</Button>}
            <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm p-6">Selecione ou crie um minigame à esquerda.</div>
      )}
    </div>
  );
}

function ImgSlot({ label, url, onChange, folder }: { label: string; url: string | null; onChange: (u: string | null) => void; folder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Máx 10MB.");
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() ?? "png";
      const path = `${folder}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("minigames").upload(path, f, { upsert: true, contentType: f.type });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("minigames").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!signed.data?.signedUrl) throw new Error("Falha ao gerar URL.");
      onChange(signed.data.signedUrl);
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 aspect-square rounded bg-secondary overflow-hidden flex items-center justify-center">
        {url ? <img src={url} className="w-full h-full object-contain" alt="" /> : <span className="text-xs text-muted-foreground">Nenhuma</span>}
      </div>
      <div className="flex gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy}>
          <Upload size={12} className="mr-1" /> {busy ? "…" : "Enviar"}
        </Button>
        {url && <Button variant="ghost" size="sm" onClick={() => onChange(null)}><Trash2 size={12} /></Button>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}