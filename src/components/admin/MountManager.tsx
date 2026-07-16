import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { listMounts, upsertMount, deleteMount, grantMountToCharacter, revokeMountFromCharacter } from "@/lib/mounts.functions";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import { Plus, Trash2, Rabbit, Save, UserPlus, UserMinus } from "lucide-react";

type Mount = { id: string; name: string; image_url: string | null; description: string | null; rank: string | null; speed_multiplier: number };
type Char = { id: string; nickname: string };

export function MountManager({ adminUserId }: { adminUserId: string }) {
  const [mounts, setMounts] = useState<Mount[]>([]);
  const [chars, setChars] = useState<Char[]>([]);
  const [editing, setEditing] = useState<Partial<Mount> | null>(null);
  const [grants, setGrants] = useState<Record<string, string[]>>({}); // mountId -> character ids

  const list = useServerFn(listMounts);
  const save = useServerFn(upsertMount);
  const del = useServerFn(deleteMount);
  const grantFn = useServerFn(grantMountToCharacter);
  const revokeFn = useServerFn(revokeMountFromCharacter);

  async function load() {
    const [r, { data: cs }, { data: cm }] = await Promise.all([
      list({}),
      supabase.from("characters").select("id,nickname").order("nickname"),
      supabase.from("character_mounts").select("mount_id,character_id"),
    ]);
    setMounts(r.mounts);
    setChars((cs as Char[]) ?? []);
    const map: Record<string, string[]> = {};
    ((cm as any[]) ?? []).forEach((row) => {
      if (!map[row.mount_id]) map[row.mount_id] = [];
      map[row.mount_id].push(row.character_id);
    });
    setGrants(map);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!editing?.name?.trim()) { toast.error("Nome obrigatório."); return; }
    try {
      await save({ data: {
        id: editing.id,
        name: editing.name.trim(),
        image_url: editing.image_url ?? null,
        description: editing.description ?? null,
        rank: editing.rank ?? null,
        speed_multiplier: Number(editing.speed_multiplier ?? 0.5),
      } });
      toast.success("Salvo.");
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(id: string) {
    if (!confirm("Remover esta montaria?")) return;
    try { await del({ data: { id } }); toast.success("Removida."); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function grant(mountId: string, characterId: string) {
    try { await grantFn({ data: { mountId, characterId } }); toast.success("Concedida."); load(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function revoke(mountId: string, characterId: string) {
    if (!confirm("Remover a montaria deste jogador?")) return;
    try { await revokeFn({ data: { mountId, characterId } }); toast.success("Removida."); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-gold flex items-center gap-2"><Rabbit size={20} /> Montarias</h2>
        <Button onClick={() => setEditing({ name: "", speed_multiplier: 0.5 })}>
          <Plus size={14} className="mr-1" /> Nova montaria
        </Button>
      </div>

      {editing && (
        <div className="scroll-panel rounded-lg p-4 space-y-3">
          <h3 className="font-display text-lg text-gold">{editing.id ? "Editar" : "Criar"} montaria</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label>Rank</Label>
              <Input placeholder="Ex: D, C, B, A, S" value={editing.rank ?? ""} onChange={(e) => setEditing({ ...editing, rank: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div>
              <Label>Multiplicador de velocidade (menor = mais rápido)</Label>
              <Input type="number" step="0.05" min={0.05} max={1}
                value={editing.speed_multiplier ?? 0.5}
                onChange={(e) => setEditing({ ...editing, speed_multiplier: Number(e.target.value) })} />
              <p className="text-[10px] text-muted-foreground mt-1">×0.5 = metade do tempo de viagem a pé. A pé = ×1.0.</p>
            </div>
            <div>
              <Label>Imagem</Label>
              <div className="flex items-center gap-2 mt-1">
                {editing.image_url && <img src={editing.image_url} className="w-16 h-16 rounded object-cover" alt="" />}
                <ImageUpload label="Enviar imagem" bucket="npcs" userId={adminUserId}
                  onUploaded={(url) => setEditing({ ...editing, image_url: url })} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={submit}><Save size={14} className="mr-1" /> Salvar</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {mounts.map((m) => {
          const ownerIds = grants[m.id] ?? [];
          return (
            <div key={m.id} className="scroll-panel rounded-lg p-3">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded bg-secondary overflow-hidden shrink-0">
                  {m.image_url && <img src={m.image_url} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg text-gold truncate">{m.name}</div>
                    {m.rank && <span className="text-[10px] uppercase tracking-widest bg-secondary rounded px-1.5">{m.rank}</span>}
                    <span className="text-[10px] text-gold">×{Number(m.speed_multiplier).toFixed(2)}</span>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{m.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setEditing(m)}>Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(m.id)}><Trash2 size={12} /></Button>
                </div>
              </div>

              <div className="mt-3 border-t border-border pt-3 space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Jogadores com esta montaria ({ownerIds.length})</div>
                <div className="flex flex-wrap gap-1">
                  {ownerIds.map((cid) => {
                    const c = chars.find((x) => x.id === cid);
                    if (!c) return null;
                    return (
                      <span key={cid} className="inline-flex items-center gap-1 text-xs bg-secondary rounded pl-2 pr-1 py-0.5">
                        {c.nickname}
                        <button className="hover:text-blood" onClick={() => revoke(m.id, cid)} title="Remover"><UserMinus size={11} /></button>
                      </span>
                    );
                  })}
                  {ownerIds.length === 0 && <span className="text-[10px] text-muted-foreground italic">Ninguém ainda.</span>}
                </div>
                <div className="flex gap-2">
                  <select className="bg-input rounded px-2 py-1 text-xs flex-1"
                    onChange={(e) => { if (e.target.value) { grant(m.id, e.target.value); e.target.value = ""; } }}>
                    <option value="">Conceder a jogador…</option>
                    {chars.filter((c) => !ownerIds.includes(c.id)).map((c) => (
                      <option key={c.id} value={c.id}>{c.nickname}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        {mounts.length === 0 && !editing && (
          <div className="text-center text-muted-foreground text-sm p-8">Nenhuma montaria cadastrada.</div>
        )}
      </div>
    </div>
  );
}