import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link2, Move, Trash2, X } from "lucide-react";

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

export function LocationMapEditor({ locations, connections, selectedId, onSelect, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [connectMode, setConnectMode] = useState(false);
  const [pendingA, setPendingA] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null);

  // Seed positions from DB and auto-lay-out any that have (0,0)
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      locations.forEach((l, idx) => {
        if (next[l.id]) return;
        let x = l.map_x, y = l.map_y;
        if (!x && !y) {
          const col = idx % 5;
          const row = Math.floor(idx / 5);
          x = 40 + col * (NODE_W + 40);
          y = 40 + row * (NODE_H + 60);
        }
        next[l.id] = { x, y };
      });
      // remove positions of deleted locs
      Object.keys(next).forEach((id) => { if (!locations.find((l) => l.id === id)) delete next[id]; });
      return next;
    });
  }, [locations]);

  const persistPos = useCallback(async (id: string, x: number, y: number) => {
    await supabase.from("locations").update({ map_x: Math.round(x), map_y: Math.round(y) }).eq("id", id);
  }, []);

  function onPointerDown(e: React.PointerEvent, id: string) {
    if (connectMode) return;
    const el = wrapRef.current!;
    const rect = el.getBoundingClientRect();
    const pos = positions[id] ?? { x: 0, y: 0 };
    dragRef.current = {
      id,
      offX: e.clientX - rect.left - pos.x,
      offY: e.clientY - rect.top - pos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const el = wrapRef.current!;
    const rect = el.getBoundingClientRect();
    const { id, offX, offY } = dragRef.current;
    const x = Math.max(0, e.clientX - rect.left - offX);
    const y = Math.max(0, e.clientY - rect.top - offY);
    setPositions((p) => ({ ...p, [id]: { x, y } }));
  }
  async function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const { id } = dragRef.current;
    const p = positions[id];
    dragRef.current = null;
    if (p) await persistPos(id, p.x, p.y);
  }

  async function handleNodeClick(id: string) {
    if (!connectMode) { onSelect(id); return; }
    if (!pendingA) { setPendingA(id); return; }
    if (pendingA === id) { setPendingA(null); return; }
    const [a, b] = [pendingA, id].sort();
    const exists = connections.find((c) => c.a_id === a && c.b_id === b);
    if (exists) { toast.info("Já existe conexão."); setPendingA(null); return; }
    const { error } = await supabase.from("location_connections").insert({ a_id: a, b_id: b });
    if (error && !error.message.includes("duplicate")) toast.error(error.message);
    else toast.success("Conectado.");
    setPendingA(null);
    onChange();
  }

  async function removeConn(id: string) {
    await supabase.from("location_connections").delete().eq("id", id);
    onChange();
  }

  // canvas size fits farthest node + padding
  const maxX = Math.max(600, ...Object.values(positions).map((p) => p.x + NODE_W + 40));
  const maxY = Math.max(400, ...Object.values(positions).map((p) => p.y + NODE_H + 40));

  return (
    <div className="scroll-panel rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-display text-lg text-gold flex items-center gap-2">
          <Move size={16} /> Mapa de locais
        </h4>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground hidden sm:inline">
            {connectMode ? (pendingA ? "Clique no destino para conectar" : "Clique no primeiro local") : "Arraste para mover · clique para editar"}
          </span>
          <Button size="sm" variant={connectMode ? "default" : "outline"}
            onClick={() => { setConnectMode((v) => !v); setPendingA(null); }}>
            <Link2 size={14} className="mr-1" />
            {connectMode ? "Modo conectar (ativo)" : "Conectar"}
          </Button>
          {connectMode && pendingA && (
            <Button size="sm" variant="ghost" onClick={() => setPendingA(null)}>
              <X size={14} />
            </Button>
          )}
        </div>
      </div>
      <div ref={wrapRef}
        className="relative w-full overflow-auto rounded border border-border bg-black/30"
        style={{ height: 460, touchAction: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}>
        <div className="relative" style={{ width: maxX, height: maxY }}>
          <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
            {connections.map((c) => {
              const a = positions[c.a_id], b = positions[c.b_id];
              if (!a || !b) return null;
              const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H / 2;
              const x2 = b.x + NODE_W / 2, y2 = b.y + NODE_H / 2;
              return (
                <g key={c.id} className="pointer-events-auto">
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="oklch(0.7 0.15 80)" strokeWidth={2} strokeOpacity={0.55} />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14}
                    style={{ cursor: "pointer" }}
                    onClick={() => { if (confirm("Remover esta conexão?")) removeConn(c.id); }} />
                </g>
              );
            })}
          </svg>
          {locations.map((l) => {
            const p = positions[l.id] ?? { x: 0, y: 0 };
            const isSel = selectedId === l.id;
            const isPending = pendingA === l.id;
            return (
              <div key={l.id}
                onPointerDown={(e) => onPointerDown(e, l.id)}
                onClick={() => handleNodeClick(l.id)}
                className={`absolute select-none rounded border-2 shadow-md flex items-center gap-2 px-2 transition-colors ${
                  isPending ? "border-blood bg-blood/20"
                    : isSel ? "border-gold bg-secondary"
                    : "border-border bg-card hover:border-gold/60"
                } ${connectMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}>
                <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0 pointer-events-none">
                  {l.image_url && <img src={l.image_url} className="w-full h-full object-cover" alt="" />}
                </div>
                <div className="text-xs font-semibold flex-1 truncate pointer-events-none">{l.name}</div>
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