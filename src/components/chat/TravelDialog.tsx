import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { travelTo, getMyTravel, completeTravel, cancelTravel, listMyMounts } from "@/lib/travel.functions";
import { shortestPathDistance } from "@/lib/location-graph";
import { toast } from "sonner";
import { Compass, Footprints, MapPin, X, Sparkles } from "lucide-react";

type Loc = { id: string; name: string; image_url: string | null; map_x: number; map_y: number };
type Conn = { a_id: string; b_id: string };
type Mount = { id: string; name: string; image_url: string | null; description: string | null; rank: string | null; speed_multiplier: number };

const NODE_W = 130;
const NODE_H = 60;

export function TravelDialog({ open, onOpenChange, currentLocationId, onArrived }: {
  open: boolean; onOpenChange: (v: boolean) => void; currentLocationId: string | null; onArrived: () => void;
}) {
  const [locs, setLocs] = useState<Loc[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [mounts, setMounts] = useState<Mount[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [chosenMount, setChosenMount] = useState<string | null>(null);
  const [travel, setTravel] = useState<any | null>(null);
  const [now, setNow] = useState(Date.now());

  const start = useServerFn(travelTo);
  const getT = useServerFn(getMyTravel);
  const finish = useServerFn(completeTravel);
  const cancel = useServerFn(cancelTravel);
  const listMounts = useServerFn(listMyMounts);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: l }, { data: cn }, m, t] = await Promise.all([
        supabase.from("locations").select("id,name,image_url,map_x,map_y").order("name"),
        supabase.from("location_connections").select("a_id,b_id"),
        listMounts({}), getT({}),
      ]);
      setLocs((l as Loc[]) ?? []);
      setConns((cn as Conn[]) ?? []);
      setMounts(m.mounts ?? []);
      setTravel(t.travel ?? null);
      setSelected(null); setChosenMount(null);
    })();
  }, [open]);

  // Timer 1s enquanto viajando
  useEffect(() => {
    if (!travel) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [travel?.id]);

  // Ao chegar, chama complete e fecha
  useEffect(() => {
    if (!travel) return;
    const remaining = new Date(travel.arrives_at).getTime() - now;
    if (remaining <= 0) {
      (async () => {
        try { await finish({ data: { travelId: travel.id } }); }
        catch (e: any) { /* idempotent */ }
        toast.success("Você chegou ao destino.");
        setTravel(null);
        onArrived();
        onOpenChange(false);
      })();
    }
  }, [now, travel?.id]);

  const dist = useMemo(() => {
    if (!currentLocationId || !selected) return -1;
    return shortestPathDistance(conns, currentLocationId, selected);
  }, [conns, currentLocationId, selected]);

  const selectedLoc = selected ? locs.find((l) => l.id === selected) ?? null : null;
  const currentLoc = currentLocationId ? locs.find((l) => l.id === currentLocationId) ?? null : null;

  const baseSec = Math.max(3, dist * 30);
  const mountMul = chosenMount ? (mounts.find((m) => m.id === chosenMount)?.speed_multiplier ?? 1) : 1;
  const estSec = Math.max(3, Math.round(baseSec * mountMul));

  async function doStart() {
    if (!selected) return;
    try {
      const r = await start({ data: { toLocationId: selected, mountId: chosenMount ?? undefined } });
      setTravel({ ...r.travel });
      toast.success("Viagem iniciada.");
    } catch (e: any) { toast.error(e.message); }
  }
  async function doCancel() {
    if (!travel) return;
    try {
      await cancel({ data: { travelId: travel.id } });
      setTravel(null);
      toast.info("Viagem cancelada.");
    } catch (e: any) { toast.error(e.message); }
  }

  // Bounding box para caber o mapa
  const maxX = Math.max(600, ...locs.map((l) => (l.map_x || 0) + NODE_W + 60));
  const maxY = Math.max(400, ...locs.map((l) => (l.map_y || 0) + NODE_H + 80));

  // ---------- Rendering ----------
  if (travel) {
    const total = (new Date(travel.arrives_at).getTime() - new Date(travel.started_at).getTime()) / 1000;
    const rem = Math.max(0, (new Date(travel.arrives_at).getTime() - now) / 1000);
    const pct = Math.min(100, Math.max(0, ((total - rem) / total) * 100));
    const toLoc = locs.find((l) => l.id === travel.to_location_id);
    const mount = travel.mount_id ? mounts.find((m) => m.id === travel.mount_id) : null;
    return (
      <Dialog open={open} onOpenChange={() => { /* travando fechar durante a viagem */ }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Compass size={16} className="text-gold" /> Viajando…</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden h-40 bg-secondary/40 border border-border">
              {toLoc?.image_url && <img src={toLoc.image_url} className="absolute inset-0 w-full h-full object-cover opacity-70" alt="" />}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Destino</div>
                <div className="font-display text-xl text-gold">{toLoc?.name ?? "?"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {mount ? <><Sparkles size={14} className="text-gold" /> Montado em <b className="text-foreground">{mount.name}</b></> : <><Footprints size={14} /> A pé</>}
            </div>
            <div>
              <div className="h-3 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold to-blood transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-center text-xs text-muted-foreground">
                {Math.ceil(rem)}s restante{Math.ceil(rem) === 1 ? "" : "s"}
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={doCancel}>
              <X size={14} className="mr-1" /> Cancelar viagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapPin size={16} className="text-gold" /> Mover-se</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div ref={wrapRef} className="relative w-full overflow-auto rounded border border-border bg-black/40" style={{ height: 460, backgroundImage: "radial-gradient(oklch(0.4 0.02 260 / 0.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
            <div className="relative" style={{ width: maxX, height: maxY }}>
              <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
                {conns.map((c, i) => {
                  const a = locs.find((l) => l.id === c.a_id);
                  const b = locs.find((l) => l.id === c.b_id);
                  if (!a || !b) return null;
                  const x1 = (a.map_x || 0) + NODE_W / 2, y1 = (a.map_y || 0) + NODE_H / 2;
                  const x2 = (b.map_x || 0) + NODE_W / 2, y2 = (b.map_y || 0) + NODE_H / 2;
                  const mx = (x1 + x2) / 2;
                  return <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    fill="none" stroke="oklch(0.7 0.18 240)" strokeWidth={2} strokeOpacity={0.55} />;
                })}
              </svg>
              {locs.map((l) => {
                const isCurrent = l.id === currentLocationId;
                const isSel = l.id === selected;
                return (
                  <button key={l.id}
                    onClick={() => setSelected(l.id)}
                    className={`absolute rounded border-2 shadow-md flex items-center gap-2 px-2 text-left transition ${
                      isCurrent ? "border-emerald-400 bg-emerald-400/10 ring-2 ring-emerald-300/40" :
                      isSel ? "border-gold bg-gold/10 ring-2 ring-gold/60" :
                      "border-border bg-card hover:border-gold/60"}`}
                    style={{ left: l.map_x || 0, top: l.map_y || 0, width: NODE_W, height: NODE_H }}>
                    <div className="w-9 h-9 rounded bg-secondary overflow-hidden shrink-0">
                      {l.image_url && <img src={l.image_url} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="text-xs font-semibold flex-1 truncate">{l.name}</div>
                  </button>
                );
              })}
              {locs.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Nenhum local cadastrado.</div>}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded border border-border p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Você está em</div>
              <div className="font-display text-lg text-emerald-300">{currentLoc?.name ?? "—"}</div>
            </div>
            {selectedLoc ? (
              <div className="rounded border border-border p-3 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Destino</div>
                  <div className="font-display text-lg text-gold">{selectedLoc.name}</div>
                </div>
                {selectedLoc.image_url && <img src={selectedLoc.image_url} className="w-full h-28 object-cover rounded" alt="" />}
                {selected === currentLocationId ? (
                  <p className="text-xs text-muted-foreground">Você já está aqui.</p>
                ) : dist < 0 ? (
                  <p className="text-xs text-blood">Sem caminho até este local.</p>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">
                      Distância: <b className="text-foreground">{dist}</b> nó(s) · Tempo estimado: <b className="text-foreground">{estSec}s</b>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Modo de transporte</div>
                      <button onClick={() => setChosenMount(null)}
                        className={`w-full flex items-center gap-2 rounded border p-2 text-left ${!chosenMount ? "border-gold bg-gold/10" : "border-border hover:bg-secondary/50"}`}>
                        <Footprints size={14} /> <span className="text-sm">A pé</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">×1.0</span>
                      </button>
                      {mounts.map((m) => (
                        <button key={m.id} onClick={() => setChosenMount(m.id)}
                          className={`w-full flex items-center gap-2 rounded border p-2 text-left ${chosenMount === m.id ? "border-gold bg-gold/10" : "border-border hover:bg-secondary/50"}`}>
                          <div className="w-8 h-8 rounded bg-secondary overflow-hidden shrink-0">
                            {m.image_url && <img src={m.image_url} className="w-full h-full object-cover" alt="" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{m.name}</div>
                            {m.rank && <div className="text-[10px] text-muted-foreground">{m.rank}</div>}
                          </div>
                          <span className="text-[10px] text-gold">×{m.speed_multiplier.toFixed(2)}</span>
                        </button>
                      ))}
                      {mounts.length === 0 && <p className="text-[10px] text-muted-foreground italic">Você ainda não possui montarias.</p>}
                    </div>
                    <Button onClick={doStart} className="w-full">
                      <Compass size={14} className="mr-1" /> Ir até o local ({estSec}s)
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Clique em um local do mapa para selecionar.</p>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}