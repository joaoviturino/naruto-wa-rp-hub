import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { getClanTree, saveClanTree } from "@/lib/clan-tree.functions";
import { toast } from "sonner";
import { Plus, Save, Trash2, Zap, Sparkles } from "lucide-react";

type Skill = { id: string; name: string; rank: string; image_url: string | null };
type Node = {
  id: string;
  kind: "skill" | "buff";
  skill_id: string | null;
  buff_type: "hp_bonus" | "energy_bonus" | "skill_power_bonus" | "skill_cost_reduction" | null;
  buff_value: number | null;
  buff_label: string | null;
  buff_icon_url: string | null;
  x: number; y: number;
  rank_required: string | null;
  min_prereqs: number | null;
  xp_required: number | null;
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

type Handle = "t" | "r" | "b" | "l";

export function ClanTreeManager() {
  const [clans, setClans] = useState<any[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [clanId, setClanId] = useState<string>("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number; moved: boolean } | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);

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
    setSelectedId(null);
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
      rank_required: null, min_prereqs: null, xp_required: null, skill: s,
    };
    setNodes((n) => [...n, tmp]); setSelectedId(tmp.id);
  }
  function addBuffNode() {
    const tmp: Node = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "buff", skill_id: null, buff_type: "hp_bonus", buff_value: 10, buff_label: "HP +10", buff_icon_url: null,
      x: 40 + (nodes.length % 6) * 120, y: 40 + Math.floor(nodes.length / 6) * 120,
      rank_required: null, min_prereqs: null, xp_required: null,
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
  }

  function relCoords(e: React.PointerEvent) {
    const el = wrapRef.current!;
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left + el.scrollLeft, y: e.clientY - rect.top + el.scrollTop };
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const { x, y } = relCoords(e);
    const n = nodes.find((x) => x.id === id)!;
    dragRef.current = { id, offX: x - n.x, offY: y - n.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onNodePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { x, y } = relCoords(e);
    const { id, offX, offY } = dragRef.current;
    dragRef.current.moved = true;
    const nx = Math.max(0, x - offX);
    const ny = Math.max(0, y - offY);
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x: nx, y: ny } : n)));
  }
  function onNodePointerUp() {
    if (!dragRef.current) return;
    const { id, moved } = dragRef.current;
    dragRef.current = null;
    if (!moved) setSelectedId(id);
  }

  function onHandlePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const { x, y } = relCoords(e);
    setWire({ from: id, x, y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onHandlePointerMove(e: React.PointerEvent) {
    if (!wire) return;
    const { x, y } = relCoords(e);
    setWire({ ...wire, x, y });
  }
  function onHandlePointerUp(e: React.PointerEvent) {
    if (!wire) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const nodeEl = target?.closest("[data-node-id]") as HTMLElement | null;
    const toId = nodeEl?.dataset.nodeId;
    const fromId = wire.from;
    setWire(null);
    if (!toId || toId === fromId) return;
    const exists = edges.find((e) => e.from_node_id === fromId && e.to_node_id === toId);
    if (exists) { toast.info("Já existe conexão."); return; }
    setEdges((es) => [...es, { from_node_id: fromId, to_node_id: toId }]);
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
          x: Math.round(n.x), y: Math.round(n.y),
          rank_required: n.rank_required,
          min_prereqs: n.min_prereqs,
          xp_required: n.xp_required,
        })),
        edges: edges.map((e) => ({ from_node_id: e.from_node_id, to_node_id: e.to_node_id })),
      } } as any);
      toast.success("Árvore salva.");
      reload(clanId);
    } catch (e: any) { toast.error(e.message); }
  }

  const maxX = Math.max(700, ...nodes.map((n) => n.x + NODE_W + 60));
  const maxY = Math.max(500, ...nodes.map((n) => n.y + NODE_H + 80));

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
        <Button disabled={!clanId} onClick={persist}><Save size={14} className="mr-1" />Salvar</Button>
      </div>

      {clanId && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="scroll-panel rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-2">
              Arraste o corpo do nó para mover · arraste um ponto azul até outro nó para conectar · clique numa linha para remover
            </div>
            <div ref={wrapRef}
              className="relative w-full overflow-auto rounded border border-border bg-black/40"
              style={{ height: 520, touchAction: "none", backgroundImage: "radial-gradient(oklch(0.4 0.02 260 / 0.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
              onPointerMove={(e) => { onNodePointerMove(e); onHandlePointerMove(e); }}
              onPointerUp={(e) => { onNodePointerUp(); onHandlePointerUp(e); }}>
              <div className="relative" style={{ width: maxX, height: maxY }}>
                <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
                  {edges.map((e, idx) => {
                    const a = nodes.find((n) => n.id === e.from_node_id);
                    const b = nodes.find((n) => n.id === e.to_node_id);
                    if (!a || !b) return null;
                    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
                    const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2;
                    const mx = (x1 + x2) / 2;
                    const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
                    return (
                      <g key={idx} className="pointer-events-auto">
                        <path d={d} fill="none" stroke="oklch(0.7 0.18 240)" strokeWidth={2.5} strokeOpacity={0.7} />
                        <path d={d} fill="none" stroke="transparent" strokeWidth={16}
                          style={{ cursor: "pointer" }}
                          onClick={() => { if (confirm("Remover esta conexão?")) removeEdge(idx); }} />
                      </g>
                    );
                  })}
                  {wire && (() => {
                    const a = nodes.find((n) => n.id === wire.from); if (!a) return null;
                    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
                    const mx = (x1 + wire.x) / 2;
                    return <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${wire.y}, ${wire.x} ${wire.y}`}
                      fill="none" stroke="oklch(0.75 0.2 240)" strokeWidth={2.5} strokeDasharray="6 4" />;
                  })()}
                </svg>
                {nodes.map((n) => {
                  const isSel = selectedId === n.id;
                  const s = n.skill_id ? skillMap.get(n.skill_id) : null;
                  return (
                    <div key={n.id}
                      data-node-id={n.id}
                      onPointerDown={(e) => onNodePointerDown(e, n.id)}
                      title={n.kind === "skill" ? s?.name : (n.buff_label ?? "Buff")}
                      className={`absolute select-none rounded-full border-4 shadow-lg flex items-center justify-center overflow-hidden group cursor-grab active:cursor-grabbing ${
                        isSel ? "border-gold"
                          : n.kind === "buff" ? "border-emerald-500/70"
                          : "border-slate-500/70"
                      }`}
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
                      {(["t","r","b","l"] as Handle[]).map((h) => {
                        const style: React.CSSProperties =
                          h === "t" ? { top: -6, left: "50%", transform: "translateX(-50%)" } :
                          h === "b" ? { bottom: -6, left: "50%", transform: "translateX(-50%)" } :
                          h === "l" ? { left: -6, top: "50%", transform: "translateY(-50%)" } :
                                      { right: -6, top: "50%", transform: "translateY(-50%)" };
                        return (
                          <span key={h}
                            onPointerDown={(e) => onHandlePointerDown(e, n.id)}
                            className="absolute w-3.5 h-3.5 rounded-full bg-sky-400 border-2 border-background shadow hover:ring-2 hover:ring-sky-300/60 cursor-crosshair opacity-70 group-hover:opacity-100 z-10"
                            style={style} />
                        );
                      })}
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">XP mínimo</Label>
                    <Input type="number" min={0} value={selected.xp_required ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        updateSelected({ xp_required: v === "" ? null : Math.max(0, Number(v)) });
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs" title="Quantos nós conectados de entrada precisam estar destravados. Vazio = exige todos.">
                      Prérequisitos min.
                    </Label>
                    <Input type="number" min={0} value={selected.min_prereqs ?? ""}
                      placeholder="todos"
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        updateSelected({ min_prereqs: v === "" ? null : Math.max(0, Number(v)) });
                      }} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Vazio em "Prérequisitos min." = exige todos os nós conectados de entrada destravados.
                </p>
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