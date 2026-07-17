import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { mineNode } from "@/lib/minigame.functions";
import { toast } from "sonner";
import { Pickaxe, X, Sparkles } from "lucide-react";
import { ToolDurabilityHud, type ToolStatus } from "./ToolDurabilityHud";

type Drop = { item_id: string; qty: number; name: string; image_url: string | null };
type FloatingDrop = Drop & { key: number };
type Particle = { key: number; dx: number; dy: number; r: number; hue: number };

export function MiningGame({
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
  const nodeHp = Math.max(1, Number(config?.node_hp) || 4);
  const swingCd = Math.max(150, Number(config?.swing_cooldown_ms) || 500);

  const [hits, setHits] = useState(0);
  const [breaks, setBreaks] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [swinging, setSwinging] = useState(false);
  const [broken, setBroken] = useState(false);
  const [feed, setFeed] = useState<FloatingDrop[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingDrops, setFloatingDrops] = useState<FloatingDrop[]>([]);
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [toolBroken, setToolBroken] = useState(false);
  const lastSwingRef = useRef(0);
  const busyRef = useRef(false);
  const startedAt = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const damagePct = Math.min(100, (hits / nodeHp) * 100);

  const spawnParticles = useCallback((count: number) => {
    const baseKey = Date.now();
    const next: Particle[] = Array.from({ length: count }, (_, i) => ({
      key: baseKey + i + Math.random(),
      dx: (Math.random() - 0.5) * 220,
      dy: -60 - Math.random() * 160,
      r: Math.random() * 360,
      hue: 30 + Math.random() * 30,
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
    spawnParticles(6);
    // vibrate on touch devices
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { (navigator as any).vibrate?.(15); } catch { /* noop */ }
    }
    setTimeout(() => setSwinging(false), Math.min(280, swingCd - 20));

    const newHits = hits + 1;
    if (newHits < nodeHp) {
      setHits(newHits);
      return;
    }

    // BREAK — pede sorteio ao servidor
    busyRef.current = true;
    setBroken(true);
    try {
      let r: { breaks: number; xp: number; drops: Drop[]; tools?: ToolStatus[]; broken_now?: { item_id: string; name: string }[] };
      if (testMode) {
        // Simulação local: rola drops a partir da config
        const dropsCfg: Array<{ item_id: string; name?: string; image_url?: string | null; chance: number; min?: number; max?: number }> = Array.isArray(config?.drops) ? config.drops : [];
        const rolled: Drop[] = [];
        for (const d of dropsCfg) {
          if (Math.random() <= (Number(d.chance) || 0)) {
            const min = Math.max(1, Number(d.min) || 1);
            const max = Math.max(min, Number(d.max) || min);
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
      if (r.tools) setTools(r.tools);
      if (r.broken_now?.length) {
        toast.error(`Ferramenta quebrou: ${r.broken_now.map((b) => b.name).join(", ")}`);
      }
      spawnParticles(28);
      if (r.drops?.length) {
        const stamped: FloatingDrop[] = r.drops.map((d) => ({ ...d, key: Math.random() }));
        setFloatingDrops((prev) => [...prev, ...stamped]);
        setFeed((prev) => [...stamped, ...prev].slice(0, 20));
        setTimeout(() => {
          setFloatingDrops((prev) => prev.filter((p) => !stamped.find((s) => s.key === p.key)));
        }, 1600);
      }
    } catch (e: any) {
      const msg = e.message || "Falha ao minerar.";
      toast.error(msg);
      if (/quebrada|ferramenta/i.test(msg)) setToolBroken(true);
      // reverte estado — permite recomeçar
      setBroken(false);
      setHits(nodeHp - 1);
      busyRef.current = false;
      return;
    }

    // respawn node after brief delay
    setTimeout(() => {
      setHits(0);
      setBroken(false);
      busyRef.current = false;
    }, 700);
  }, [hits, nodeHp, swingCd, broken, runId, strike, spawnParticles]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const rockGradient = useMemo(() => {
    const cracks = Math.floor((hits / nodeHp) * 3);
    return { cracks };
  }, [hits, nodeHp]);

  return (
    <div
      className="relative w-full h-[min(80vh,640px)] rounded-lg overflow-hidden border border-border select-none touch-manipulation"
      style={{
        backgroundImage: background ? `url(${background})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#1a1410",
      }}
    >
      {/* Overlay escurecedor */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/60 pointer-events-none" />

      {/* HUD topo */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-2 sm:p-3 gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-black/60 backdrop-blur px-2 py-1 rounded font-medium text-gold border border-gold/30">
            ⛏ {breaks} pedras
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

      <ToolDurabilityHud
        runId={runId}
        tools={tools}
        testMode={testMode}
        onRepaired={(t) => { setTools(t); setToolBroken(false); }}
      />

      {/* Feed de drops (lateral) */}
      <div className="absolute right-2 top-16 z-20 max-w-[45%] sm:max-w-[220px] space-y-1 pointer-events-none">
        {feed.slice(0, 6).map((d) => (
          <div key={d.key} className="animate-fade-in flex items-center gap-2 bg-black/70 backdrop-blur border border-gold/30 rounded px-2 py-1 text-xs">
            {d.image_url
              ? <img src={d.image_url} alt="" className="w-5 h-5 object-contain" />
              : <Sparkles size={14} className="text-gold" />}
            <span className="truncate text-slate-100">{d.name}</span>
            <span className="text-gold font-semibold ml-auto">×{d.qty}</span>
          </div>
        ))}
      </div>

      {/* Pedra central + drops flutuantes */}
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={doSwing}
          disabled={broken}
          aria-label="Minerar"
          className="relative group focus:outline-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {/* base sombra */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-40 sm:w-56 h-3 bg-black/50 blur-md rounded-full" />

          {/* Rocha */}
          <div
            className={`relative w-40 h-40 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-[38%_62%_55%_45%/55%_45%_60%_40%] shadow-2xl transition-transform ${swinging ? "animate-mine-shake" : "hover:scale-[1.02]"} ${broken ? "opacity-0 scale-125" : "opacity-100"}`}
            style={{
              background: "radial-gradient(circle at 30% 30%, #6b6a68 0%, #4a4947 45%, #2b2a29 100%)",
              transition: "opacity .35s ease, transform .35s ease",
              boxShadow: "inset -14px -14px 30px rgba(0,0,0,.5), inset 12px 10px 28px rgba(255,255,255,.08), 0 20px 40px rgba(0,0,0,.5)",
            }}
          >
            {/* veios dourados */}
            <div className="absolute inset-0 rounded-[38%_62%_55%_45%/55%_45%_60%_40%] pointer-events-none opacity-70"
              style={{ background: "radial-gradient(ellipse at 65% 40%, rgba(212,175,55,.35) 0%, transparent 55%)" }} />
            {/* rachaduras */}
            {rockGradient.cracks >= 1 && (
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
                <path d="M50 10 L46 40 L54 55 L48 80" stroke="rgba(0,0,0,.65)" strokeWidth="1.4" fill="none" />
              </svg>
            )}
            {rockGradient.cracks >= 2 && (
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
                <path d="M20 45 L45 50 L58 42 L82 55" stroke="rgba(0,0,0,.6)" strokeWidth="1.2" fill="none" />
                <path d="M40 70 L55 62 L68 78" stroke="rgba(0,0,0,.55)" strokeWidth="1.1" fill="none" />
              </svg>
            )}
            {rockGradient.cracks >= 3 && (
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none animate-pulse">
                <path d="M25 25 L48 48 L30 70" stroke="rgba(255,180,0,.65)" strokeWidth="1.6" fill="none" />
                <path d="M75 30 L52 52 L70 78" stroke="rgba(255,180,0,.55)" strokeWidth="1.4" fill="none" />
              </svg>
            )}
          </div>

          {/* Picareta swing */}
          <div className={`absolute -top-6 -right-4 sm:-top-8 sm:-right-6 pointer-events-none origin-bottom-left transition-transform ${swinging ? "animate-pickaxe-swing" : "-rotate-12"}`}>
            <Pickaxe size={64} className="text-amber-200 drop-shadow-[0_4px_10px_rgba(0,0,0,.7)]" />
          </div>

          {/* Partículas */}
          {particles.map((p) => (
            <span
              key={p.key}
              className="absolute left-1/2 top-1/2 w-2 h-2 rounded-sm pointer-events-none animate-mine-particle"
              style={{
                background: `hsl(${p.hue} 55% 55%)`,
                ["--dx" as any]: `${p.dx}px`,
                ["--dy" as any]: `${p.dy}px`,
                ["--rot" as any]: `${p.r}deg`,
              }}
            />
          ))}

          {/* Drops flutuantes */}
          {floatingDrops.map((d) => (
            <div
              key={d.key}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-drop-float flex items-center gap-1 bg-black/80 border border-gold rounded px-2 py-1 text-xs font-semibold text-gold"
            >
              {d.image_url && <img src={d.image_url} className="w-4 h-4 object-contain" alt="" />}
              +{d.qty} {d.name}
            </div>
          ))}
        </button>
      </div>

      {/* Barra de HP da rocha */}
      <div className="absolute bottom-16 sm:bottom-20 inset-x-0 flex justify-center z-10 pointer-events-none px-4">
        <div className="w-full max-w-xs h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-red-500 transition-all"
            style={{ width: `${damagePct}%` }}
          />
        </div>
      </div>

      {/* Botão grande mobile */}
      <div className="absolute bottom-3 inset-x-0 flex justify-center z-10 px-4">
        <Button
          size="lg"
          onClick={doSwing}
          disabled={broken || toolBroken}
          className="w-full max-w-xs bg-gold text-black hover:bg-gold/90 font-bold text-base h-12 shadow-lg"
        >
          <Pickaxe size={18} className="mr-2" /> {toolBroken ? "Ferramenta quebrada" : "Golpear"}
        </Button>
      </div>

      <style>{`
        @keyframes mine-shake {
          0%,100% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-4px,2px) rotate(-1.5deg); }
          40% { transform: translate(5px,-2px) rotate(1.5deg); }
          60% { transform: translate(-3px,3px) rotate(-1deg); }
          80% { transform: translate(3px,-1px) rotate(1deg); }
        }
        .animate-mine-shake { animation: mine-shake .3s ease-in-out; }
        @keyframes pickaxe-swing {
          0% { transform: rotate(-12deg); }
          40% { transform: rotate(-90deg); }
          70% { transform: rotate(-70deg) translate(4px,4px); }
          100% { transform: rotate(-12deg); }
        }
        .animate-pickaxe-swing { animation: pickaxe-swing .35s cubic-bezier(.4,1.6,.5,1); }
        @keyframes mine-particle {
          0% { transform: translate(-50%,-50%) rotate(0); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)); opacity: 0; }
        }
        .animate-mine-particle { animation: mine-particle .85s ease-out forwards; }
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
