import { useMemo, useState } from "react";
import { Map as MapIcon, ChevronDown, ChevronUp, Skull } from "lucide-react";

type Loc = {
  id: string;
  name: string;
  map_x: number;
  map_y: number;
  image_url: string | null;
  is_danger_zone?: boolean;
  parent_id?: string | null;
};
type Conn = { a_id: string; b_id: string };

const VIEW_W = 240;
const VIEW_H = 180;
const RADIUS = 2; // profundidade de vizinhos a mostrar

function bfs(conns: Conn[], from: string, radius: number): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  for (const c of conns) {
    if (!adj.has(c.a_id)) adj.set(c.a_id, new Set());
    if (!adj.has(c.b_id)) adj.set(c.b_id, new Set());
    adj.get(c.a_id)!.add(c.b_id);
    adj.get(c.b_id)!.add(c.a_id);
  }
  const dist = new Map<string, number>();
  dist.set(from, 0);
  let frontier = [from];
  for (let d = 1; d <= radius; d++) {
    const next: string[] = [];
    for (const n of frontier) {
      for (const m of adj.get(n) ?? []) {
        if (dist.has(m)) continue;
        dist.set(m, d);
        next.push(m);
      }
    }
    frontier = next;
  }
  return dist;
}

export function Minimap({
  locations,
  connections,
  currentLocationId,
  onSelect,
}: {
  locations: Loc[];
  connections: Conn[];
  currentLocationId: string | null;
  onSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const { nodes, edges, tx, ty, scale } = useMemo(() => {
    if (!currentLocationId) return { nodes: [] as Loc[], edges: [] as Conn[], tx: 0, ty: 0, scale: 1 };
    const dist = bfs(connections, currentLocationId, RADIUS);
    const visibleIds = new Set(dist.keys());
    const nodes = locations.filter((l) => visibleIds.has(l.id));
    const edges = connections.filter((c) => visibleIds.has(c.a_id) && visibleIds.has(c.b_id));
    if (nodes.length === 0) return { nodes, edges, tx: 0, ty: 0, scale: 1 };
    const xs = nodes.map((n) => n.map_x || 0);
    const ys = nodes.map((n) => n.map_y || 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const pad = 20;
    const scale = Math.min((VIEW_W - pad * 2) / spanX, (VIEW_H - pad * 2) / spanY, 1);
    // Centrar o local atual
    const cur = nodes.find((n) => n.id === currentLocationId)!;
    const cx = (cur.map_x || 0) * scale;
    const cy = (cur.map_y || 0) * scale;
    const tx = VIEW_W / 2 - cx;
    const ty = VIEW_H / 2 - cy;
    return { nodes, edges, tx, ty, scale };
  }, [locations, connections, currentLocationId]);

  if (!currentLocationId) return null;

  return (
    <div className="pointer-events-auto rounded-lg border border-border bg-card/95 backdrop-blur shadow-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-secondary/40 transition"
      >
        <MapIcon size={12} className="text-gold" />
        <span className="flex-1 text-left">Minimapa</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div
          className="relative"
          style={{
            width: VIEW_W,
            height: VIEW_H,
            backgroundImage:
              "radial-gradient(oklch(0.4 0.02 260 / 0.35) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <svg width={VIEW_W} height={VIEW_H} className="absolute inset-0 pointer-events-none">
            {edges.map((c, i) => {
              const a = nodes.find((n) => n.id === c.a_id);
              const b = nodes.find((n) => n.id === c.b_id);
              if (!a || !b) return null;
              const x1 = (a.map_x || 0) * scale + tx;
              const y1 = (a.map_y || 0) * scale + ty;
              const x2 = (b.map_x || 0) * scale + tx;
              const y2 = (b.map_y || 0) * scale + ty;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="oklch(0.7 0.18 240)"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const isCur = n.id === currentLocationId;
            const x = (n.map_x || 0) * scale + tx;
            const y = (n.map_y || 0) * scale + ty;
            return (
              <button
                key={n.id}
                onClick={() => onSelect?.(n.id)}
                title={n.name}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center transition ${
                  isCur
                    ? "border-emerald-400 bg-emerald-400/20 ring-2 ring-emerald-300/50 animate-pulse"
                    : "border-gold/60 bg-card hover:border-gold hover:scale-110"
                }`}
                style={{ left: x, top: y, width: isCur ? 22 : 16, height: isCur ? 22 : 16 }}
              >
                {n.is_danger_zone && <Skull size={9} className="text-blood" />}
              </button>
            );
          })}
          {/* Nome do local atual */}
          <div className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-display text-gold bg-background/70 rounded px-1 py-0.5 truncate">
            {locations.find((l) => l.id === currentLocationId)?.name ?? "—"}
          </div>
        </div>
      )}
    </div>
  );
}