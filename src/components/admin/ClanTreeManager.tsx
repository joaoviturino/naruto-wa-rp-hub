import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { setClanTree } from "@/lib/admin.functions";
import { toast } from "sonner";
import { X, GripVertical } from "lucide-react";

export function ClanTreeManager() {
  const [clans, setClans] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [clanId, setClanId] = useState<string>("");
  const [tree, setTree] = useState<any[]>([]);
  const save = useServerFn(setClanTree);

  async function loadAll() {
    const [c, s] = await Promise.all([
      supabase.from("clans").select("id,name,village").order("name"),
      supabase.from("skills").select("id,name,rank,clan_id").order("rank"),
    ]);
    setClans(c.data ?? []); setSkills(s.data ?? []);
  }
  async function loadTree(id: string) {
    const { data } = await supabase.from("clan_skills").select("skill_id,position").eq("clan_id", id).order("position");
    setTree(data ?? []);
  }
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (clanId) loadTree(clanId); else setTree([]); }, [clanId]);

  const skillMap = new Map(skills.map((s) => [s.id, s]));
  const inTree = new Set(tree.map((t) => t.skill_id));
  const available = skills.filter((s) => !inTree.has(s.id) && (!s.clan_id || s.clan_id === clanId));

  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function onDragStart(e: React.DragEvent, payload: { from: "tree" | "available"; id: string; idx?: number }) {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }
  function onDropOnTree(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    setDragOverIdx(null);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const payload = JSON.parse(raw) as { from: "tree" | "available"; id: string; idx?: number };
    if (payload.from === "tree" && payload.idx !== undefined) {
      const from = payload.idx;
      if (from === targetIdx) return;
      const next = [...tree];
      const [moved] = next.splice(from, 1);
      const insertAt = from < targetIdx ? targetIdx - 1 : targetIdx;
      next.splice(insertAt, 0, moved);
      setTree(next);
    } else {
      // from available → insert at targetIdx
      if (inTree.has(payload.id)) return;
      const next = [...tree];
      next.splice(targetIdx, 0, { skill_id: payload.id, position: targetIdx });
      setTree(next);
    }
  }
  function onDropOnAvailable(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const payload = JSON.parse(raw) as { from: "tree" | "available"; id: string; idx?: number };
    if (payload.from === "tree" && payload.idx !== undefined) {
      setTree(tree.filter((_, i) => i !== payload.idx));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label>Clã</Label>
          <Select value={clanId} onValueChange={setClanId}>
            <SelectTrigger><SelectValue placeholder="Selecione um clã" /></SelectTrigger>
            <SelectContent>{clans.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.village}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button disabled={!clanId} onClick={async () => {
          try { await save({ data: { clan_id: clanId, skill_ids: tree.map((t) => t.skill_id) } } as any); toast.success("Árvore salva."); }
          catch (e: any) { toast.error(e.message); }
        }}>Salvar árvore</Button>
      </div>

      {clanId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="scroll-panel rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gold mb-3">Ordem de desbloqueio (linear)</h4>
            <p className="text-xs text-muted-foreground mb-3">Arraste as habilidades para reordenar. Arraste do painel ao lado para adicionar; solte fora para remover.</p>
            <ol className="space-y-1 min-h-[80px]">
              {tree.map((t, idx) => {
                const s = skillMap.get(t.skill_id);
                return (
                  <li key={t.skill_id}
                    draggable
                    onDragStart={(e) => onDragStart(e, { from: "tree", id: t.skill_id, idx })}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragLeave={() => setDragOverIdx((v) => (v === idx ? null : v))}
                    onDrop={(e) => onDropOnTree(e, idx)}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-sm border cursor-grab active:cursor-grabbing ${
                      dragOverIdx === idx ? "border-gold bg-gold/10" : "border-transparent bg-secondary/40"
                    }`}>
                    <GripVertical size={14} className="text-muted-foreground" />
                    <span className="text-xs w-6 text-muted-foreground">#{idx + 1}</span>
                    <span className="flex-1">{s?.name ?? "?"} <span className="text-gold">({s?.rank})</span></span>
                    <Button size="icon" variant="ghost" onClick={() => setTree(tree.filter((_, i) => i !== idx))}><X size={14} /></Button>
                  </li>
                );
              })}
              {/* drop zone at end */}
              <li
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(tree.length); }}
                onDragLeave={() => setDragOverIdx((v) => (v === tree.length ? null : v))}
                onDrop={(e) => onDropOnTree(e, tree.length)}
                className={`text-xs text-center rounded border border-dashed py-3 ${
                  dragOverIdx === tree.length ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"
                }`}>
                {tree.length === 0 ? "Arraste habilidades aqui" : "Soltar no fim"}
              </li>
            </ol>
          </div>
          <div className="scroll-panel rounded-lg p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropOnAvailable}>
            <h4 className="text-sm font-semibold text-gold mb-3">Habilidades disponíveis</h4>
            <p className="text-xs text-muted-foreground mb-3">Arraste para a árvore para incluir. Só entram habilidades sem clã ou já marcadas para este clã.</p>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {available.map((s) => (
                <li key={s.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, { from: "available", id: s.id })}
                  className="flex items-center gap-2 border-b border-border py-1 text-sm cursor-grab active:cursor-grabbing hover:bg-secondary/40 px-2 rounded">
                  <GripVertical size={14} className="text-muted-foreground" />
                  <span className="flex-1">{s.name} <span className="text-gold">({s.rank})</span></span>
                </li>
              ))}
              {available.length === 0 && <li className="text-xs text-muted-foreground">Nada disponível.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}