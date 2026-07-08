import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { setClanTree } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, X, Plus } from "lucide-react";

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

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= tree.length) return;
    const next = [...tree];
    [next[idx], next[j]] = [next[j], next[idx]];
    setTree(next);
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
            <p className="text-xs text-muted-foreground mb-3">Cada habilidade só desbloqueia depois da anterior + requisitos próprios (patente, proficiência, missão).</p>
            <ol className="space-y-1">
              {tree.map((t, idx) => {
                const s = skillMap.get(t.skill_id);
                return (
                  <li key={t.skill_id} className="flex items-center gap-2 bg-secondary/40 rounded px-2 py-1 text-sm">
                    <span className="text-xs w-6 text-muted-foreground">#{idx + 1}</span>
                    <span className="flex-1">{s?.name ?? "?"} <span className="text-gold">({s?.rank})</span></span>
                    <Button size="icon" variant="ghost" onClick={() => move(idx, -1)}><ChevronUp size={14} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(idx, 1)}><ChevronDown size={14} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setTree(tree.filter((_, i) => i !== idx))}><X size={14} /></Button>
                  </li>
                );
              })}
              {tree.length === 0 && <li className="text-xs text-muted-foreground">Árvore vazia.</li>}
            </ol>
          </div>
          <div className="scroll-panel rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gold mb-3">Habilidades disponíveis</h4>
            <p className="text-xs text-muted-foreground mb-3">Só entram na árvore desse clã habilidades sem clã ou já marcadas para ele.</p>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {available.map((s) => (
                <li key={s.id} className="flex items-center gap-2 border-b border-border py-1 text-sm">
                  <span className="flex-1">{s.name} <span className="text-gold">({s.rank})</span></span>
                  <Button size="icon" variant="ghost" onClick={() => setTree([...tree, { skill_id: s.id, position: tree.length }])}><Plus size={14} /></Button>
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