import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { listNpcGroups, upsertNpcGroup, deleteNpcGroup, setNpcGroupMembers } from "@/lib/npc.functions";
import { Plus, Trash2, Users, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { supabase } from "@/integrations/supabase/client";

type Group = { id: string; name: string; description: string | null; battle_bg_url?: string | null; music_url?: string | null };
type Member = { group_id: string; npc_id: string; weight: number };
type NpcLite = { id: string; name: string; kind: string | null };

export function NpcGroupManager({ npcs }: { npcs: NpcLite[] }) {
  const list = useServerFn(listNpcGroups);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState<Group | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await list({} as any) as any;
      setGroups(res.groups ?? []);
      setMembers(res.members ?? []);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, []);

  const npcName = (id: string) => npcs.find((n) => n.id === id)?.name ?? "NPC removido";

  return (
    <div className="scroll-panel rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gold" />
          <h4 className="font-display text-sm text-gold">Grupos de NPCs ({groups.length})</h4>
        </div>
        <Button size="sm" onClick={() => { setEditing({ id: "", name: "", description: "" }); setOpen(true); }}>
          <Plus size={14} className="mr-1" /> Novo grupo
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Conjuntos de NPCs que aparecem juntos numa mesma batalha. O cenário e a música definidos aqui sobrescrevem os individuais dos NPCs.
      </p>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground italic p-2">Nenhum grupo criado ainda.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {groups.map((g) => {
            const gm = members.filter((m) => m.group_id === g.id);
            return (
              <div key={g.id} className="flex items-start gap-2 border border-border/60 rounded p-2 bg-input/30">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{g.name}</div>
                  {g.description && <div className="text-[11px] text-muted-foreground truncate">{g.description}</div>}
                  <div className="text-[11px] mt-1 flex flex-wrap gap-1">
                    {gm.length === 0
                      ? <span className="text-muted-foreground italic">sem membros</span>
                      : gm.map((m, i) => (
                          <span key={i} className="bg-secondary rounded-full px-2 py-0.5">
                            {npcName(m.npc_id)}{m.weight > 1 ? ` ×${m.weight}` : ""}
                          </span>
                        ))}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(g); setOpen(true); }}>
                  <Pencil size={14} />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <GroupDialog
        open={open}
        onOpenChange={setOpen}
        group={editing}
        npcs={npcs}
        currentMembers={editing?.id ? members.filter((m) => m.group_id === editing!.id) : []}
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}

function GroupDialog({ open, onOpenChange, group, npcs, currentMembers, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  group: Group | null; npcs: NpcLite[]; currentMembers: Member[]; onSaved: () => void;
}) {
  const upsert = useServerFn(upsertNpcGroup);
  const del = useServerFn(deleteNpcGroup);
  const setMembers = useServerFn(setNpcGroupMembers);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [bgUrl, setBgUrl] = useState<string>("");
  const [musicUrl, setMusicUrl] = useState<string>("");
  const [rows, setRows] = useState<{ npc_id: string; weight: number }[]>([]);
  const [pick, setPick] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setDesc(group?.description ?? "");
    setBgUrl(group?.battle_bg_url ?? "");
    setMusicUrl(group?.music_url ?? "");
    setRows(currentMembers.map((m) => ({ npc_id: m.npc_id, weight: m.weight })));
    setPick("");
  }, [open, group?.id]);

  const availableNpcs = npcs.filter((n) => (n.kind ?? "aggressive") === "aggressive" && !rows.some((r) => r.npc_id === n.id));

  async function save() {
    if (!name.trim()) { toast.error("Dê um nome ao grupo."); return; }
    try {
      const { id } = await upsert({ data: {
        id: group?.id || undefined,
        name: name.trim(),
        description: desc.trim() || null,
        battle_bg_url: bgUrl.trim() || null,
        music_url: musicUrl.trim() || null,
      } } as any) as any;
      await setMembers({ data: { group_id: id, members: rows } } as any);
      toast.success("Grupo salvo.");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove() {
    if (!group?.id) return;
    if (!confirm(`Remover o grupo "${group.name}"?`)) return;
    try { await del({ data: { id: group.id } } as any); toast.success("Grupo removido."); onSaved(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{group?.id ? "Editar grupo" : "Novo grupo de NPCs"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bandidos da estrada" />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3">
            <div>
              <Label>Cenário de batalha (imagem)</Label>
              <div className="flex gap-2 items-center">
                <Input value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} placeholder="URL da imagem de fundo" />
                <GroupUpload bucket="scenes" label="Upload" onUploaded={setBgUrl} />
                {bgUrl && <Button size="icon" variant="ghost" onClick={() => setBgUrl("")}><X size={14} /></Button>}
              </div>
              {bgUrl && <img src={bgUrl} alt="" className="mt-1 h-20 w-full object-cover rounded border border-border" />}
              <p className="text-[10px] text-muted-foreground mt-1">Sobrescreve o cenário individual dos NPCs quando este grupo é sorteado.</p>
            </div>
            <div>
              <Label>Música de fundo (loop)</Label>
              <div className="flex gap-2 items-center">
                <Input value={musicUrl} onChange={(e) => setMusicUrl(e.target.value)} placeholder="URL do áudio (.mp3, .ogg...)" />
                <GroupUpload bucket="scenes" label="Upload" accept="audio/*" maxMb={15} onUploaded={setMusicUrl} />
                {musicUrl && <Button size="icon" variant="ghost" onClick={() => setMusicUrl("")}><X size={14} /></Button>}
              </div>
              {musicUrl && <audio src={musicUrl} controls className="mt-1 w-full h-8" />}
              <p className="text-[10px] text-muted-foreground mt-1">Sobrescreve a música individual dos NPCs.</p>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <Label>Membros ({rows.length})</Label>
            <p className="text-[11px] text-muted-foreground mb-2">Cada NPC listado aparecerá junto quando o grupo for sorteado. "Peso" = quantas cópias entram na batalha.</p>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {rows.map((r, i) => (
                <div key={r.npc_id} className="flex items-center gap-2 bg-input/40 rounded px-2 py-1">
                  <span className="flex-1 text-sm truncate">{npcs.find((n) => n.id === r.npc_id)?.name ?? "?"}</span>
                  <Input type="number" min={1} max={20} value={r.weight}
                    onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, weight: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } : x))}
                    className="h-7 w-16 text-xs" />
                  <Button size="icon" variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                    <X size={14} />
                  </Button>
                </div>
              ))}
              {rows.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum membro.</p>}
            </div>
            <div className="flex gap-2 mt-2">
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar NPC agressivo..." /></SelectTrigger>
                <SelectContent>
                  {availableNpcs.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                  {availableNpcs.length === 0 && <div className="text-xs text-muted-foreground p-2">Todos já adicionados.</div>}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!pick} onClick={() => {
                if (!pick) return;
                setRows((rs) => [...rs, { npc_id: pick, weight: 1 }]);
                setPick("");
              }}><Plus size={14} /></Button>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            {group?.id ? (
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={remove}>
                <Trash2 size={14} className="mr-1" /> Remover grupo
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
