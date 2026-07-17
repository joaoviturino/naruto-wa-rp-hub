import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { mineNode } from "@/lib/minigame.functions";
import { toast } from "sonner";
import { Axe, X, Sparkles, TreePine } from "lucide-react";

type Drop = { item_id: string; qty: number; name: string; image_url: string | null };
type FloatingDrop = Drop & { key: number };
type Particle = { key: number; dx: number; dy: number; r: number; hue: number };

export function LoggingGame({
  runId,
  background,
  config,
  onExit,
  testMode = false,
}: {
  runId: string;
  background: string | null;
  config: any;
  onExit: (breaks: number) => void;
  testMode?: boolean;
}) {
  const strike = useServerFn(mineNode);
  const treeHp = Math.max(1, Number(config?.node_hp) || 5);
  const swingCd = Math.max(150, Number(config?.swing_cooldown_ms) || 500);

  const [hits, setHits] = useState(0);
  const [breaks, setBreaks] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [swinging, setSwinging] = useState(false);
  const [broken, setBroken] = useState(false);
  const [feed, setFeed] = useState<FloatingDrop[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingDrops, setFloatingDrops] = useState<FloatingDrop[]>([]);
  const lastSwingRef = useRef(0);
  const busyRef = useRef(false);
  const startedAt = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const damagePct = Math.min(100, (hits / treeHp) * 100);

  const spawnParticles = useCallback((count: number) => {
    const baseKey = Date.now();
    // wood chips: brown + green (leaves)
    const next: Particle[] = Array.from({ length: count }, (_, i) => ({
      key: baseKey + i + Math.random(),
      dx: (Math.random() - 0.5) * 240,
      dy: -40 - Math.random() * 180,
      r: Math.random() * 360,
      hue: Math.random() < 0.7 ? 25 + Math.random() * 15 : 90 + Math.random() * 40,
    }));
    setParticles((p) => [...p, ...next]);
    setTimeout(() => {
      setParticles((p) => p.filter((x) => !next.find((n) => n.key === x.key)));
    }, 900);
  }, []);

  const doSwing = useCallback(async () => {
    if (busyRef.current || broken) return;
    const now = Date.now();
    if (now - lastSwingRef.current < swingCd) return;
    lastSwingRef.current = now;
    setSwinging(true);
    spawnParticles(7);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { (navigator as any).vibrate?.(15); } catch { /* noop */ }
    }
    setTimeout(() => setSwinging(false), Math.min(280, swingCd - 20));

    const newHits = hits + 1;
    if (newHits < treeHp) {
      setHits(newHits);
      return;
    }

    busyRef.current = true;
    setBroken(true);
    try {
      let r: { breaks: number; xp: number; drops: Drop[] };
      if (testMode) {
        const dropsCfg: Array<{ item_id: string; name?: string; image_url?: string | null; chance: number; min_qty?: number; max_qty?: number; min?: number; max?: number }> = Array.isArray(config?.drops) ? config.drops : [];
        const rolled: Drop[] = [];
        for (const d of dropsCfg) {
          const chance = Math.max(0, Math.min(100, Number(d.chance) || 0));
          if (Math.random() * 100 < chance) {
            const min = Math.max(1, Number(d.min_qty ?? d.min) || 1);
            const max = Math.max(min, Number(d.max_qty ?? d.max) || min);
            const qty = Math.floor(min + Math.random() * (max - min + 1));
            rolled.push({ item_id: d.item_id, name: d.name || "Item", image_url: d.image_url ?? null, qty });
          }
        }
        r = { breaks: breaks + 1, xp: Number(config?.xp_per_break) || 0, drops: rolled };
      } else {
        r = await strike({ data: { run_id: runId } }) as any;
      }
      setBreaks(r.breaks);
      setTotalXp((x) => x + (r.xp || 0));
      spawnParticles(32);
      if (r.drops?.length) {
        const stamped: FloatingDrop[] = r.drops.map((d) => ({ ...d, key: Math.random() }));
        setFloatingDrops((prev) => [...prev, ...stamped]);
        setFeed((prev) => [...stamped, ...prev].slice(0, 20));
        setTimeout(() => {
          setFloatingDrops((prev) => prev.filter((p) => !stamped.find((s) => s.key === p.key)));
        }, 1600);
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao coletar madeira.");
      setBroken(false);
      setHits(treeHp - 1);
      busyRef.current = false;
      return;
    }

    setTimeout(() => {
      setHits(0);
      setBroken(false);
      busyRef.current = false;
    }, 800);
  }, [hits, treeHp, swingCd, broken, runId, strike, spawnParticles, breaks, config, testMode]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const cracks = useMemo(() => Math.floor((hits / treeHp) * 3), [hits, treeHp]);

  return (
    <div
      className="relative w-full h-[min(80vh,640px)] rounded-lg overflow-hidden border border-border select-none touch-manipulation"
      style={{
        backgroundImage: background ? `url(${background})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#0f1a12",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/60 pointer-events-none" />

      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-2 sm:p-3 gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-black/60 backdrop-blur px-2 py-1 rounded font-medium text-emerald-200 border border-emerald-500/30">
            🪵 {breaks} árvores
          </span>
          <span className="bg-black/60 backdrop-blur px-2 py-1 rounded text-emerald-300 border border-emerald-500/30">
            +{totalXp} XP
          </span>
          <span className="bg-black/60 backdrop-blur px-2 py-1 rounded text-slate-300 border border-slate-500/30 tabular-nums">
            ⏱ {mm}:{ss}
          </span>
        </div>
        <Button size="sm" variant="destructive" onClick={() => onExit(breaks)} className="shrink-0">
          <X size={14} className="mr-1" /> Sair
        </Button>
      </div>

      <div className="absolute right-2 top-16 z-20 max-w-[45%] sm:max-w-[220px] space-y-1 pointer-events-none">
        {feed.slice(0, 6).map((d) => (
          <div key={d.key} className="animate-fade-in flex items-center gap-2 bg-black/70 backdrop-blur border border-emerald-500/30 rounded px-2 py-1 text-xs">
            {d.image_url
              ? <img src={d.image_url} alt="" className="w-5 h-5 object-contain" />
              : <Sparkles size={14} className="text-emerald-300" />}
            <span className="truncate text-slate-100">{d.name}</span>
            <span className="text-emerald-300 font-semibold ml-auto">×{d.qty}</span>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-end justify-center pb-24">
        <button
          type="button"
          onClick={doSwing}
          disabled={broken}
          aria-label="Cortar árvore"
          className="relative group focus:outline-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {/* sombra */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-44 h-3 bg-black/50 blur-md rounded-full" />

          {/* Árvore */}
          <div
            className={`relative w-40 sm:w-56 md:w-64 flex flex-col items-center transition-transform ${swinging ? "animate-tree-shake" : "hover:scale-[1.02]"} ${broken ? "opacity-0 translate-y-8 rotate-6" : "opacity-100"}`}
            style={{ transition: "opacity .45s ease, transform .45s ease" }}
          >
            {/* Copa */}
            <div
              className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-full -mb-6"
              style={{
                background: "radial-gradient(circle at 40% 35%, #4b9a4a 0%, #2f6a2f 55%, #163d16 100%)",
                boxShadow: "inset -18px -20px 40px rgba(0,0,0,.55), inset 14px 14px 30px rgba(255,255,255,.08), 0 22px 40px rgba(0,0,0,.55)",
              }}
            >
              <div className="absolute inset-2 rounded-full opacity-70 pointer-events-none"
                style={{ background: "radial-gradient(circle at 60% 30%, rgba(180,240,150,.35) 0%, transparent 55%)" }} />
            </div>
            {/* Tronco */}
            <div
              className="relative w-10 sm:w-14 h-28 sm:h-36 rounded-b-md"
              style={{
                background: "linear-gradient(180deg, #6a4322 0%, #4a2d16 50%, #331f10 100%)",
                boxShadow: "inset -6px 0 10px rgba(0,0,0,.5), inset 6px 0 10px rgba(255,255,255,.06)",
              }}
            >
              {cracks >= 1 && (
                <svg viewBox="0 0 20 100" className="absolute inset-0 w-full h-full pointer-events-none">
                  <path d="M10 15 L8 40 L11 60 L9 85" stroke="rgba(0,0,0,.7)" strokeWidth="1.2" fill="none" />
                </svg>
              )}
              {cracks >= 2 && (
                <svg viewBox="0 0 20 100" className="absolute inset-0 w-full h-full pointer-events-none">
                  <path d="M4 30 L12 45 L6 65 L14 82" stroke="rgba(0,0,0,.65)" strokeWidth="1.1" fill="none" />
                </svg>
              )}
              {cracks >= 3 && (
                <svg viewBox="0 0 20 100" className="absolute inset-0 w-full h-full pointer-events-none animate-pulse">
                  <path d="M3 20 L14 55 L4 80" stroke="rgba(255,180,80,.75)" strokeWidth="1.5" fill="none" />
                </svg>
              )}
            </div>
          </div>

          {/* Machado */}
          <div className={`absolute top-24 sm:top-32 -right-4 sm:-right-8 pointer-events-none origin-bottom-left transition-transform ${swinging ? "animate-axe-swing" : "-rotate-12"}`}>
            <Axe size={64} className="text-amber-100 drop-shadow-[0_4px_10px_rgba(0,0,0,.7)]" />
          </div>

          {particles.map((p) => (
            <span
              key={p.key}
              className="absolute left-1/2 top-1/2 w-2 h-2 rounded-sm pointer-events-none animate-log-particle"
              style={{
                background: `hsl(${p.hue} 55% 45%)`,
                ["--dx" as any]: `${p.dx}px`,
                ["--dy" as any]: `${p.dy}px`,
                ["--rot" as any]: `${p.r}deg`,
              }}
            />
          ))}

          {floatingDrops.map((d) => (
            <div
              key={d.key}
              className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-drop-float flex items-center gap-1 bg-black/80 border border-emerald-400 rounded px-2 py-1 text-xs font-semibold text-emerald-300"
            >
              {d.image_url
                ? <img src={d.image_url} className="w-4 h-4 object-contain" alt="" />
                : <TreePine size={12} />}
              +{d.qty} {d.name}
            </div>
          ))}
        </button>
      </div>

      <div className="absolute bottom-16 sm:bottom-20 inset-x-0 flex justify-center z-10 pointer-events-none px-4">
        <div className="w-full max-w-xs h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-lime-500 via-emerald-500 to-green-700 transition-all"
            style={{ width: `${damagePct}%` }}
          />
        </div>
      </div>

      <div className="absolute bottom-3 inset-x-0 flex justify-center z-10 px-4">
        <Button
          size="lg"
          onClick={doSwing}
          disabled={broken}
          className="w-full max-w-xs bg-emerald-500 text-black hover:bg-emerald-400 font-bold text-base h-12 shadow-lg"
        >
          <Axe size={18} className="mr-2" /> Cortar
        </Button>
      </div>

      <style>{`
        @keyframes tree-shake {
          0%,100% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-3px,1px) rotate(-1.2deg); }
          40% { transform: translate(4px,-2px) rotate(1.5deg); }
          60% { transform: translate(-3px,2px) rotate(-0.9deg); }
          80% { transform: translate(2px,-1px) rotate(0.8deg); }
        }
        .animate-tree-shake { animation: tree-shake .35s ease-in-out; }
        @keyframes axe-swing {
          0% { transform: rotate(-12deg); }
          40% { transform: rotate(-95deg); }
          70% { transform: rotate(-75deg) translate(4px,4px); }
          100% { transform: rotate(-12deg); }
        }
        .animate-axe-swing { animation: axe-swing .35s cubic-bezier(.4,1.6,.5,1); }
        @keyframes log-particle {
          0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)); opacity: 0; }
        }
        .animate-log-particle { animation: log-particle .9s ease-out forwards; }
        @keyframes drop-float {
          0% { transform: translate(-50%,-50%) scale(.7); opacity: 0; }
          15% { transform: translate(-50%,-70%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%,-260%) scale(1); opacity: 0; }
        }
        .animate-drop-float { animation: drop-float 1.5s ease-out forwards; }
      `}</style>
    </div>
  );
}