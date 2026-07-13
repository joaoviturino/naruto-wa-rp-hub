import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Move, Trash2 } from "lucide-react";

type Loc = { id: string; name: string; image_url: string | null; map_x: number; map_y: number };
type Conn = { id: string; a_id: string; b_id: string };

type Props = {
  locations: Loc[];
  connections: Conn[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: () => void;
};

const NODE_W = 140;
const NODE_H = 64;

type Handle = "t" | "r" | "b" | "l";
function handlePos(x: number, y: number, h: Handle) {
  switch (h) {
    case "t": return { x: x + NODE_W / 2, y };
    case "b": return { x: x + NODE_W / 2, y: y + NODE_H };
    case "l": return { x, y: y + NODE_H / 2 };
    case "r": return { x: x + NODE_W, y: y + NODE_H / 2 };
  }
}

export function LocationMapEditor({ locations, connections, selectedId, onSelect, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<{ id: string; offX: number; offY: number; moved: boolean } | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);

  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      locations.forEach((l, idx) => {
        if (next[l.id]) return;
        let x = l.map_x, y = l.map_y;
        if (!x && !y) {
          const col = idx % 5;
          const row = Math.floor(idx / 5);
          x = 40 + col * (NODE_W + 60);
          y = 40 + row * (NODE_H + 80);
        }
        next[l.id] = { x, y };
      });
      Object.keys(next).forEach((id) => { if (!locations.find((l) => l.id === id)) delete next[id]; });
      return next;
    });
  }, [locations]);

  const persistPos = useCallback(async (id: string, x: number, y: number) => {
    await supabase.from("locations").update({ map_x: Math.round(x), map_y: Math.round(y) }).eq("id", id);
  }, []);

  function relCoords(e: React.PointerEvent) {
    const el = wrapRef.current!;
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left + el.scrollLeft, y: e.clientY - rect.top + el.scrollTop };
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const { x, y } = relCoords(e);
    const pos = positions[id] ?? { x: 0, y: 0 };
    dragRef.current = { id, offX: x - pos.x, offY: y - pos.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onNodePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { x, y } = relCoords(e);
    const { id, offX, offY } = dragRef.current;
    dragRef.current.moved = true;
    const nx = Math.max(0, x - offX);
    const ny = Math.max(0, y - offY);
    setPositions((p) => ({ ...p, [id]: { x: nx, y: ny } }));
  }
  async function onNodePointerUp() {
    if (!dragRef.current) return;
    const { id, moved } = dragRef.current;
    const p = positions[id];
    dragRef.current = null;
    if (moved && p) await persistPos(id, p.x, p.y);
    else if (!moved) onSelect(id);
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
  async function onHandlePointerUp(e: React.PointerEvent) {
    if (!wire) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const nodeEl = target?.closest("[data-node-id]") as HTMLElement | null;
    const toId = nodeEl?.dataset.nodeId;
    const fromId = wire.from;
    setWire(null);
    if (!toId || toId === fromId) return;
    const [a, b] = [fromId, toId].sort();
    const exists = connections.find((c) => c.a_id === a && c.b_id === b);
    if (exists) { toast.info("Já existe conexão."); return; }
    const { error } = await supabase.from("location_connections").insert({ a_id: a, b_id: b });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else { toast.success("Conectado."); onChange(); }
  }

  async function removeConn(id: string) {
    await supabase.from("location_connections").delete().eq("id", id);
    onChange();
  }

  const maxX = Math.max(600, ...Object.values(positions).map((p) => p.x + NODE_W + 60));
  const maxY = Math.max(400, ...Object.values(positions).map((p) => p.y + NODE_H + 80));

  return (
    <div className="scroll-panel rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-display text-lg text-gold flex items-center gap-2">
          <Move size={16} /> Mapa de locais
        </h4>
        <span className="text-[11px] text-muted-foreground">
          Arraste o corpo para mover · arraste um ponto azul até outro local para conectar
        </span>
      </div>
      <div ref={wrapRef}
        className="relative w-full overflow-auto rounded border border-border bg-black/30"
        style={{ height: 460, touchAction: "none", backgroundImage: "radial-gradient(oklch(0.4 0.02 260 / 0.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        onPointerMove={(e) => { onNodePointerMove(e); onHandlePointerMove(e); }}
        onPointerUp={(e) => { onNodePointerUp(); onHandlePointerUp(e); }}>
        <div className="relative" style={{ width: maxX, height: maxY }}>
          <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
            {connections.map((c) => {
              const a = positions[c.a_id], b = positions[c.b_id];
              if (!a || !b) return null;
              const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
              const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
              return (
                <g key={c.id} className="pointer-events-auto">
                  <path d={d} fill="none" stroke="oklch(0.7 0.18 240)" strokeWidth={2.5} strokeOpacity={0.7} />
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16}
                    style={{ cursor: "pointer" }}
                    onClick={() => { if (confirm("Remover esta conexão?")) removeConn(c.id); }} />
                </g>
              );
            })}
            {wire && (() => {
              const a = positions[wire.from]; if (!a) return null;
              const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
              const mx = (x1 + wire.x) / 2;
              return <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${wire.y}, ${wire.x} ${wire.y}`}
                fill="none" stroke="oklch(0.75 0.2 240)" strokeWidth={2.5} strokeDasharray="6 4" />;
            })()}
          </svg>
          {locations.map((l) => {
            const p = positions[l.id] ?? { x: 0, y: 0 };
            const isSel = selectedId === l.id;
            return (
              <div key={l.id}
                data-node-id={l.id}
                onPointerDown={(e) => onNodePointerDown(e, l.id)}
                className={`absolute select-none rounded border-2 shadow-md flex items-center gap-2 px-2 group cursor-grab active:cursor-grabbing ${
                  isSel ? "border-gold bg-secondary" : "border-border bg-card hover:border-gold/60"
                }`}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}>
                <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0 pointer-events-none">
                  {l.image_url && <img src={l.image_url} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="text-xs font-semibold flex-1 truncate pointer-events-none">{l.name}</div>
                {(["t","r","b","l"] as Handle[]).map((h) => {
                  const style: React.CSSProperties =
                    h === "t" ? { top: -6, left: "50%", transform: "translateX(-50%)" } :
                    h === "b" ? { bottom: -6, left: "50%", transform: "translateX(-50%)" } :
                    h === "l" ? { left: -6, top: "50%", transform: "translateY(-50%)" } :
                                { right: -6, top: "50%", transform: "translateY(-50%)" };
                  return (
                    <span key={h}
                      onPointerDown={(e) => onHandlePointerDown(e, l.id)}
                      className="absolute w-3 h-3 rounded-full bg-sky-400 border-2 border-background shadow ring-0 hover:ring-2 hover:ring-sky-300/60 cursor-crosshair opacity-70 group-hover:opacity-100"
                      style={style} />
                  );
                })}
              </div>
            );
          })}
          {locations.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Crie um local para começar.
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        <Trash2 size={10} className="inline mr-1" />
        Clique numa linha de conexão para removê-la.
      </p>
    </div>
  );
}