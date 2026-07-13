import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { getClanTree, saveClanTree } from "@/lib/clan-tree.functions";
import { toast } from "sonner";
import { Link2, Plus, Save, Trash2, X, Zap, Sparkles } from "lucide-react";

type Skill = { id: string; name: string; rank: string; image_url: string | null };
type Node = {
  id: string; // uuid ou tmp-*
  kind: "skill" | "buff";
  skill_id: string | null;
  buff_type: "hp_bonus" | "energy_bonus" | "skill_power_bonus" | "skill_cost_reduction" | null;
  buff_value: number | null;
  buff_label: string | null;
  buff_icon_url: string | null;
  x: number; y: number;
  rank_required: string | null;
  skill?: Skill | null;
};
type Edge = { id?: string; from_node_id: string; to_node_id: string };

const NODE_W = 96, NODE_H = 96;

const BUFF_LABEL: Record<string, string> = {
  hp_bonus: "HP +",
  energy_bonus: "Energia +",
  skill_power_bonus: "Poder % +",
  skill_cost_reduction: "Custo % -",
};

export function ClanTreeManager() {
  const [clans, setClans] = useState<any[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [clanId, setClanId] = useState<string>("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [pendingA, setPendingA] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number; moved: boolean } | null>(null);

  const getTree = useServerFn(getClanTree);
  const save = useServerFn(saveClanTree);

  async function loadAll() {
    const [c, s] = await Promise.all([
      supabase.from("clans").select("id,name,village").order("name"),
      supabase.from("skills").select("id,name,rank,image_url").order("rank"),
    ]);
    setClans(c.data ?? []); setSkills((s.data ?? []) as any);
  }
  const reload = useCallback(async (id: string) => {
    const res: any = await getTree({ data: { clan_id: id } });
    setNodes((res.nodes ?? []).map((n: any) => ({ ...n })));
    setEdges((res.edges ?? []).map((e: any) => ({ ...e })));
    setSelectedId(null); setPendingA(null);
  }, [getTree]);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (clanId) reload(clanId); else { setNodes([]); setEdges([]); } }, [clanId, reload]);

  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  function addSkillNode(skill_id: string) {
    const s = skillMap.get(skill_id); if (!s) return;
    const tmp: Node = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "skill", skill_id, buff_type: null, buff_value: null, buff_label: null, buff_icon_url: null,
      x: 40 + (nodes.length % 6) * 120, y: 40 + Math.floor(nodes.length / 6) * 120,
      rank_required: null, skill: s,
    };
    setNodes((n) => [...n, tmp]); setSelectedId(tmp.id);
  }
  function addBuffNode() {
    const tmp: Node = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "buff", skill_id: null, buff_type: "hp_bonus", buff_value: 10, buff_label: "HP +10", buff_icon_url: null,
      x: 40 + (nodes.length % 6) * 120, y: 40 + Math.floor(nodes.length / 6) * 120,
      rank_required: null,
    };
    setNodes((n) => [...n, tmp]); setSelectedId(tmp.id);
  }
  function updateSelected(patch: Partial<Node>) {
    if (!selectedId) return;
    setNodes((ns) => ns.map((n) => (n.id === selectedId ? { ...n, ...patch } : n)));
  }
  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from_node_id !== id && e.to_node_id !== id));
    if (selectedId === id) setSelectedId(null);
    if (pendingA === id) setPendingA(null);
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (connectMode) return;
    const el = wrapRef.current!; const r = el.getBoundingClientRect();
    const n = nodes.find((x) => x.id === id)!;
    dragRef.current = { id, offX: e.clientX - r.left - n.x, offY: e.clientY - r.top - n.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const el = wrapRef.current!; const r = el.getBoundingClientRect();
    const { id, offX, offY } = dragRef.current;
    dragRef.current.moved = true;
    const x = Math.max(0, e.clientX - r.left - offX);
    const y = Math.max(0, e.clientY - r.top - offY);
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }
  function onPointerUp() { dragRef.current = null; }

  function handleClick(id: string) {
    if (dragRef.current?.moved) return;
    if (!connectMode) { setSelectedId(id); return; }
    if (!pendingA) { setPendingA(id); return; }
    if (pendingA === id) { setPendingA(null); return; }
    const exists = edges.find((e) => e.from_node_id === pendingA && e.to_node_id === id);
    if (exists) { toast.info("Já existe conexão."); setPendingA(null); return; }
    setEdges((es) => [...es, { from_node_id: pendingA!, to_node_id: id }]);
    setPendingA(null);
  }
  function removeEdge(idx: number) {
    setEdges((es) => es.filter((_, i) => i !== idx));
  }

  async function persist() {
    if (!clanId) return;
    try {
      await save({ data: {
        clan_id: clanId,
        nodes: nodes.map((n) => ({
          id: n.id.startsWith("tmp-") ? undefined : n.id,
          kind: n.kind, skill_id: n.skill_id, buff_type: n.buff_type, buff_value: n.buff_value,
          buff_label: n.buff_label, buff_icon_url: n.buff_icon_url,
          x: Math.round(n.x), y: Math.round(n.y), rank_required: n.rank_required,
        })),
        edges: edges.map((e) => ({ from_node_id: e.from_node_id, to_node_id: e.to_node_id })),
      } } as any);
      toast.success("Árvore salva.");
      reload(clanId);
    } catch (e: any) { toast.error(e.message); }
  }

  const maxX = Math.max(700, ...nodes.map((n) => n.x + NODE_W + 40));
  const maxY = Math.max(500, ...nodes.map((n) => n.y + NODE_H + 40));

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label>Clã</Label>
          <Select value={clanId} onValueChange={setClanId}>
            <SelectTrigger><SelectValue placeholder="Selecione um clã" /></SelectTrigger>
            <SelectContent>{clans.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.village}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" disabled={!clanId} onClick={addBuffNode}><Sparkles size={14} className="mr-1" />Buff</Button>
        <Button variant={connectMode ? "default" : "outline"} size="sm" disabled={!clanId}
          onClick={() => { setConnectMode((v) => !v); setPendingA(null); }}>
          <Link2 size={14} className="mr-1" />{connectMode ? "Conectando..." : "Conectar"}
        </Button>
        <Button disabled={!clanId} onClick={persist}><Save size={14} className="mr-1" />Salvar</Button>
      </div>

      {clanId && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="scroll-panel rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-2">
              {connectMode ? (pendingA ? "Clique no destino…" : "Clique no nó de origem") : "Arraste para mover · clique para editar · clique na linha para remover"}
            </div>
            <div ref={wrapRef}
              className="relative w-full overflow-auto rounded border border-border bg-[url('/textures/wood.jpg')] bg-black/40"
              style={{ height: 520, touchAction: "none" }}
              onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
              <div className="relative" style={{ width: maxX, height: maxY }}>
                <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
                  {edges.map((e, idx) => {
                    const a = nodes.find((n) => n.id === e.from_node_id);
                    const b = nodes.find((n) => n.id === e.to_node_id);
                    if (!a || !b) return null;
                    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
                    const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2;
                    return (
                      <g key={idx} className="pointer-events-auto">
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="oklch(0.7 0.15 80)" strokeWidth={3} strokeOpacity={0.6} />
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16}
                          style={{ cursor: "pointer" }}
                          onClick={() => { if (confirm("Remover esta conexão?")) removeEdge(idx); }} />
                      </g>
                    );
                  })}
                </svg>
                {nodes.map((n) => {
                  const isSel = selectedId === n.id;
                  const isPending = pendingA === n.id;
                  const s = n.skill_id ? skillMap.get(n.skill_id) : null;
                  return (
                    <div key={n.id}
                      onPointerDown={(e) => onPointerDown(e, n.id)}
                      onClick={() => handleClick(n.id)}
                      title={n.kind === "skill" ? s?.name : (n.buff_label ?? "Buff")}
                      className={`absolute select-none rounded-full border-4 shadow-lg flex items-center justify-center overflow-hidden ${
                        isPending ? "border-blood"
                          : isSel ? "border-gold"
                          : n.kind === "buff" ? "border-emerald-500/70"
                          : "border-slate-500/70"
                      } ${connectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                      style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H, background: "hsl(var(--card))" }}>
                      {n.kind === "skill" ? (
                        s?.image_url
                          ? <img src={s.image_url} alt="" className="w-full h-full object-cover pointer-events-none" />
                          : <div className="text-xs text-center px-1 pointer-events-none">{s?.name}</div>
                      ) : (
                        <div className="text-center pointer-events-none">
                          <Sparkles size={20} className="mx-auto text-emerald-400" />
                          <div className="text-[10px] font-bold">{n.buff_label ?? BUFF_LABEL[n.buff_type ?? ""] ?? "Buff"}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Adicione habilidades ou buffs para começar.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="scroll-panel rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gold mb-2 flex items-center gap-1"><Plus size={14} />Adicionar habilidade</h4>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {skills.map((s) => (
                  <button key={s.id} onClick={() => addSkillNode(s.id)}
                    className="w-full text-left text-xs px-2 py-1 rounded hover:bg-secondary flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-secondary overflow-hidden">
                      {s.image_url && <img src={s.image_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-gold">{s.rank}</span>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="scroll-panel rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gold flex items-center gap-1"><Zap size={14} />Nó selecionado</h4>
                  <Button size="icon" variant="ghost" onClick={() => deleteNode(selected.id)}><Trash2 size={14} /></Button>
                </div>
                <div>
                  <Label className="text-xs">Rank mínimo</Label>
                  <Select value={selected.rank_required ?? "none"} onValueChange={(v) => updateSelected({ rank_required: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem restrição</SelectItem>
                      {["estudante","genin","chunin","jonin","anbu","kage"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selected.kind === "buff" && (
                  <>
                    <div>
                      <Label className="text-xs">Tipo de buff</Label>
                      <Select value={selected.buff_type ?? "hp_bonus"} onValueChange={(v) => updateSelected({ buff_type: v as any, buff_label: `${BUFF_LABEL[v]}${selected.buff_value ?? 0}` })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hp_bonus">HP flat</SelectItem>
                          <SelectItem value="energy_bonus">Energia flat</SelectItem>
                          <SelectItem value="skill_power_bonus">Poder da habilidade (%)</SelectItem>
                          <SelectItem value="skill_cost_reduction">Redução de custo (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Valor</Label>
                      <Input type="number" value={selected.buff_value ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          updateSelected({ buff_value: v, buff_label: `${BUFF_LABEL[selected.buff_type ?? "hp_bonus"]}${v}` });
                        }} />
                    </div>
                    <div>
                      <Label className="text-xs">Rótulo (opcional)</Label>
                      <Input value={selected.buff_label ?? ""} onChange={(e) => updateSelected({ buff_label: e.target.value })} />
                    </div>
                  </>
                )}
                {selected.kind === "skill" && selected.skill_id && (
                  <p className="text-xs text-muted-foreground">
                    Habilidade: <span className="text-foreground">{skillMap.get(selected.skill_id)?.name}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
