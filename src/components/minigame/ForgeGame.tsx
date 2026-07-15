import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Phase = "heat" | "hammer" | "temper" | "done";
type Config = {
  duration_seconds?: number;
  difficulty?: number; // 1..5
  hammer_hits?: number;
  heat_target?: number; // 0..100
  temper_target?: number; // 0..100
};

/**
 * Forge minigame — 3 phases:
 * 1. Heat: hold to raise temperature into a target band.
 * 2. Hammer: click in rhythm N times inside a moving sweet-spot.
 * 3. Temper: release cursor to freeze at target zone.
 */
export function ForgeGame({
  background,
  config,
  preview,
  onFinish,
}: {
  background: string | null;
  config: Config;
  preview?: { name: string; icon: string | null };
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const difficulty = Math.max(1, Math.min(5, config.difficulty ?? 2));
  const cfg = {
    duration_seconds: Math.max(20, Math.min(300, config.duration_seconds ?? 90)),
    hammer_hits: Math.max(3, Math.min(20, config.hammer_hits ?? 6 + difficulty)),
    heat_target: config.heat_target ?? 70,
    temper_target: config.temper_target ?? 40,
  };
  const [phase, setPhase] = useState<Phase>("heat");
  const [remaining, setRemaining] = useState(cfg.duration_seconds);
  const [heat, setHeat] = useState(0);
  const [holding, setHolding] = useState(false);
  const [hits, setHits] = useState(0);
  const [goodHits, setGoodHits] = useState(0);
  const [sweetX, setSweetX] = useState(50);
  const [temper, setTemper] = useState(0);
  const [temperDir, setTemperDir] = useState(1);
  const [temperFrozen, setTemperFrozen] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const [hammerSwing, setHammerSwing] = useState(0); // increments to retrigger animation
  const [lastHitGood, setLastHitGood] = useState<boolean | null>(null);
  const [sparks, setSparks] = useState<Array<{ id: number; x: number; y: number; good: boolean }>>([]);
  const [steaming, setSteaming] = useState(false);

  // countdown
  useEffect(() => {
    if (phase === "done") return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (remaining <= 0 && phase !== "done" && !finishedRef.current) finish();
  }, [remaining]);

  // heat tick
  useEffect(() => {
    if (phase !== "heat") return;
    const speed = 2 + difficulty * 0.6;
    const id = setInterval(() => {
      setHeat((h) => {
        const next = holding ? Math.min(100, h + speed) : Math.max(0, h - speed * 0.6);
        return next;
      });
    }, 90);
    return () => clearInterval(id);
  }, [phase, holding, difficulty]);

  // hammer sweet-spot movement
  useEffect(() => {
    if (phase !== "hammer") return;
    let dir = 1;
    const speed = 0.9 + difficulty * 0.6;
    const id = setInterval(() => {
      setSweetX((x) => {
        let n = x + dir * speed;
        if (n > 90) { n = 90; dir = -1; }
        if (n < 10) { n = 10; dir = 1; }
        return n;
      });
    }, 40);
    return () => clearInterval(id);
  }, [phase, difficulty]);

  // temper bar movement
  useEffect(() => {
    if (phase !== "temper" || temperFrozen != null) return;
    const speed = 1 + difficulty * 0.5;
    const id = setInterval(() => {
      setTemper((v) => {
        let n = v + temperDir * speed;
        if (n >= 100) { n = 100; setTemperDir(-1); }
        if (n <= 0) { n = 0; setTemperDir(1); }
        return n;
      });
    }, 40);
    return () => clearInterval(id);
  }, [phase, temperDir, temperFrozen, difficulty]);

  function submitHeat() {
    // sweet band: heat_target ± 12
    const ok = Math.abs(heat - cfg.heat_target) <= 12;
    if (ok) setPhase("hammer");
    else {
      // penalty: skip anyway but marks 0 heat score
      setPhase("hammer");
    }
  }

  function onHammer(e: React.MouseEvent<HTMLDivElement>) {
    if (phase !== "hammer") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const good = Math.abs(clickX - sweetX) <= 10;
    if (good) setGoodHits((g) => g + 1);
    const nextHits = hits + 1;
    setHits(nextHits);
    setHammerSwing((s) => s + 1);
    setLastHitGood(good);
    // spawn sparks near anvil center
    const id = Date.now() + Math.random();
    const burst = Array.from({ length: good ? 8 : 3 }, (_, i) => ({
      id: id + i,
      x: 50 + (Math.random() * 40 - 20),
      y: 55 + (Math.random() * 20 - 10),
      good,
    }));
    setSparks((prev) => [...prev, ...burst]);
    setTimeout(() => setSparks((prev) => prev.filter((s) => !burst.find((b) => b.id === s.id))), 600);
    if (nextHits >= cfg.hammer_hits) setPhase("temper");
  }

  function freezeTemper() {
    if (phase !== "temper" || temperFrozen != null) return;
    setTemperFrozen(temper);
    setSteaming(true);
    setTimeout(() => finish(temper), 400);
  }

  function finish(temperVal?: number) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const heatScore = Math.max(0, 100 - Math.abs(heat - cfg.heat_target) * 4);
    const hammerScore = cfg.hammer_hits > 0 ? (goodHits / cfg.hammer_hits) * 100 : 0;
    const tVal = temperVal ?? temperFrozen ?? temper;
    const temperScore = Math.max(0, 100 - Math.abs(tVal - cfg.temper_target) * 3);
    const score = Math.round((heatScore + hammerScore + temperScore) / 3);
    const needed = 45 + difficulty * 6;
    setPhase("done");
    onFinish({ score, success: score >= needed });
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border select-none"
      style={{ background: background ? `#0b0710 url(${background}) center/cover no-repeat` : "linear-gradient(180deg,#150f1a,#2b2233)" }}>
      <style>{`
        @keyframes forge-flame { 0%,100%{ transform: translateY(0) scale(1); opacity:.9 } 50%{ transform: translateY(-6px) scale(1.15); opacity:1 } }
        @keyframes forge-flame-alt { 0%,100%{ transform: translateY(-3px) scale(.9); opacity:.7 } 50%{ transform: translateY(-10px) scale(1.1); opacity:1 } }
        @keyframes forge-ember { 0%{ transform: translateY(0) scale(1); opacity: 1 } 100%{ transform: translateY(-40px) scale(.4); opacity: 0 } }
        @keyframes forge-hammer { 0%{ transform: translate(-50%, -110%) rotate(-55deg) } 45%{ transform: translate(-50%, -20%) rotate(0deg) } 70%{ transform: translate(-50%, -25%) rotate(-8deg) } 100%{ transform: translate(-50%, -110%) rotate(-55deg) } }
        @keyframes forge-spark { 0%{ transform: translate(-50%,-50%) scale(1); opacity: 1 } 100%{ transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.2); opacity: 0 } }
        @keyframes forge-steam { 0%{ transform: translate(-50%,0) scale(.6); opacity:.0 } 30%{ opacity:.8 } 100%{ transform: translate(-50%,-60px) scale(1.4); opacity:0 } }
        @keyframes forge-glow { 0%,100%{ box-shadow: 0 0 12px 4px rgba(255,140,50,.5) } 50%{ box-shadow: 0 0 24px 10px rgba(255,180,60,.85) } }
      `}</style>
      <div className="flex items-center justify-between px-3 py-2 bg-black/50 text-xs">
        <span className="font-display text-gold">
          {phase === "heat" && "1. Aquecer"}
          {phase === "hammer" && "2. Martelar"}
          {phase === "temper" && "3. Temperar"}
          {phase === "done" && "Concluído"}
        </span>
        {preview && (
          <span className="flex items-center gap-2 text-muted-foreground">
            {preview.icon && <img src={preview.icon} className="w-6 h-6 object-contain" alt="" />}
            Forjando: <b className="text-foreground">{preview.name}</b>
          </span>
        )}
        <span className="tabular-nums">{remaining}s</span>
      </div>

      <div className="p-4 min-h-[340px] flex flex-col items-center justify-center gap-4">
        {/* Cena da forja */}
        <ForgeScene
          phase={phase}
          heat={heat}
          hammerSwing={hammerSwing}
          lastHitGood={lastHitGood}
          sparks={sparks}
          steaming={steaming}
          temperFrozen={temperFrozen}
        />

        {phase === "heat" && (
          <>
            <div className="text-xs text-muted-foreground">Segure o botão para aquecer até a faixa dourada.</div>
            <div className="relative w-full max-w-md h-10 bg-black/40 rounded overflow-hidden border border-border">
              <div className="absolute top-0 bottom-0 bg-gold/30 border-x border-gold"
                style={{ left: `${cfg.heat_target - 12}%`, width: `24%` }} />
              <div className="absolute inset-y-0 left-0 transition-[width] duration-75"
                style={{ width: `${heat}%`, background: "linear-gradient(90deg,#e4483c,#ff8c32,#ffd75e)" }} />
            </div>
            <div className="flex gap-2">
              <Button
                onMouseDown={() => setHolding(true)}
                onMouseUp={() => setHolding(false)}
                onMouseLeave={() => setHolding(false)}
                onTouchStart={() => setHolding(true)}
                onTouchEnd={() => setHolding(false)}
              >🔥 Aquecer</Button>
              <Button variant="secondary" onClick={submitHeat}>Pronto</Button>
            </div>
          </>
        )}

        {phase === "hammer" && (
          <>
            <div className="text-xs text-muted-foreground">
              Clique dentro da faixa dourada. {hits}/{cfg.hammer_hits} · Bons: {goodHits}
            </div>
            <div
              onClick={onHammer}
              className="relative w-full max-w-md h-16 bg-black/40 rounded overflow-hidden border border-border cursor-crosshair"
            >
              <div className="absolute top-0 bottom-0 bg-gold/40 border-x border-gold"
                style={{ left: `${sweetX - 10}%`, width: `20%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gold/70 pointer-events-none">
                CLIQUE
              </div>
            </div>
          </>
        )}

        {phase === "temper" && (
          <>
            <div className="text-xs text-muted-foreground">
              Solte a lâmina na faixa fria (alvo {cfg.temper_target}%).
            </div>
            <div className="relative w-full max-w-md h-10 bg-black/40 rounded overflow-hidden border border-border">
              <div className="absolute top-0 bottom-0 bg-cyan-500/30 border-x border-cyan-400"
                style={{ left: `${cfg.temper_target - 8}%`, width: `16%` }} />
              <div className="absolute top-0 bottom-0 w-1 bg-white"
                style={{ left: `${temperFrozen ?? temper}%` }} />
            </div>
            <Button onClick={freezeTemper} disabled={temperFrozen != null}>❄ Temperar</Button>
          </>
        )}

        {phase === "done" && (
          <div className="text-sm text-muted-foreground">Finalizando…</div>
        )}
      </div>
    </div>
  );
}

function ForgeScene({
  phase, heat, hammerSwing, lastHitGood, sparks, steaming, temperFrozen,
}: {
  phase: Phase;
  heat: number;
  hammerSwing: number;
  lastHitGood: boolean | null;
  sparks: Array<{ id: number; x: number; y: number; good: boolean }>;
  steaming: boolean;
  temperFrozen: number | null;
}) {
  // Ingot color goes from dark gray → red → orange → yellow-white with heat
  const ingotColor =
    heat < 20 ? "#3a2a25" :
    heat < 40 ? "#7a2418" :
    heat < 60 ? "#c8391a" :
    heat < 80 ? "#ff7a25" :
                "#ffe58a";
  const glowIntensity = Math.min(1, heat / 100);
  return (
    <div className="relative w-full max-w-md h-40 mx-auto pointer-events-none">
      {/* Fornalha à esquerda */}
      <div className="absolute left-2 bottom-0 w-24 h-28">
        {/* base de tijolo */}
        <div className="absolute inset-x-0 bottom-0 h-16 rounded-md" style={{ background: "linear-gradient(180deg,#4a2a20,#2b1712)", boxShadow: "inset 0 -6px 0 rgba(0,0,0,.4)" }} />
        {/* boca da fornalha */}
        <div className="absolute left-2 right-2 bottom-2 h-12 rounded-md overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 80%, #ffb347 0%, #d24a0f 45%, #3a0a04 90%)" }}>
          {/* chamas */}
          <span className="absolute left-2 bottom-1 text-2xl" style={{ animation: "forge-flame 0.9s ease-in-out infinite" }}>🔥</span>
          <span className="absolute left-1/2 -translate-x-1/2 bottom-0 text-3xl" style={{ animation: "forge-flame-alt 1.1s ease-in-out infinite" }}>🔥</span>
          <span className="absolute right-2 bottom-1 text-2xl" style={{ animation: "forge-flame 1.3s ease-in-out infinite" }}>🔥</span>
        </div>
        {/* chaminé com brasas subindo, mais fortes quando aquece */}
        {phase === "heat" && Array.from({ length: 4 }).map((_, i) => (
          <span key={i}
            className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
            style={{
              bottom: "70%",
              background: "#ffb347",
              opacity: glowIntensity,
              animation: `forge-ember ${1 + i * 0.3}s linear ${i * 0.25}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Bigorna ao centro */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-40 h-24">
        {/* topo da bigorna */}
        <div className="absolute left-0 right-0 top-6 h-4 rounded-sm" style={{ background: "linear-gradient(180deg,#4a4a52,#2a2a30)", boxShadow: "0 2px 0 rgba(0,0,0,.6)" }} />
        {/* coluna */}
        <div className="absolute left-1/2 -translate-x-1/2 top-10 w-8 h-6" style={{ background: "linear-gradient(180deg,#3a3a42,#1e1e24)" }} />
        {/* base */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-24 h-6 rounded-sm" style={{ background: "linear-gradient(180deg,#4a4a52,#1e1e24)" }} />

        {/* Lingote / lâmina em cima da bigorna */}
        <div
          className="absolute left-1/2 top-4"
          style={{
            transform: "translate(-50%, -50%)",
            width: 70,
            height: 10,
            borderRadius: 3,
            background: temperFrozen != null
              ? "linear-gradient(90deg,#8fa4b8,#e6edf5,#8fa4b8)"
              : `linear-gradient(90deg, #2a1a15, ${ingotColor}, #2a1a15)`,
            boxShadow: temperFrozen != null
              ? "0 0 8px 2px rgba(140,190,230,.6)"
              : `0 0 ${8 + glowIntensity * 20}px ${2 + glowIntensity * 8}px rgba(255,140,50,${0.3 + glowIntensity * 0.6})`,
            animation: phase === "heat" && heat > 30 ? "forge-glow 1.2s ease-in-out infinite" : undefined,
          }}
        />

        {/* Martelo — aparece apenas na fase de martelar, com uma animação por golpe */}
        {phase === "hammer" && (
          <div
            key={hammerSwing}
            className="absolute left-1/2 top-4 text-4xl"
            style={{
              transformOrigin: "50% 100%",
              animation: "forge-hammer 340ms ease-out",
            }}
          >
            🔨
          </div>
        )}

        {/* Faíscas */}
        {sparks.map((s) => (
          <span
            key={s.id}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              left: `${s.x}%`, top: `${s.y}%`,
              background: s.good ? "#ffe58a" : "#c96a30",
              boxShadow: s.good ? "0 0 6px 2px rgba(255,229,138,.9)" : "0 0 4px 1px rgba(201,106,48,.7)",
              // random direction
              // @ts-expect-error CSS var
              "--dx": `${(Math.random() * 40 - 20).toFixed(0)}px`,
              // @ts-expect-error CSS var
              "--dy": `${(-20 - Math.random() * 30).toFixed(0)}px`,
              animation: "forge-spark 500ms ease-out forwards",
            }}
          />
        ))}

        {/* Feedback do último golpe */}
        {phase === "hammer" && lastHitGood != null && (
          <div
            key={`fb-${hammerSwing}`}
            className="absolute left-1/2 -translate-x-1/2 -top-2 text-xs font-bold animate-fade-in"
            style={{ color: lastHitGood ? "#ffe58a" : "#c96a30" }}
          >
            {lastHitGood ? "PERFEITO!" : "fraco"}
          </div>
        )}

        {/* Vapor da têmpera */}
        {steaming && Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="absolute w-6 h-6 rounded-full"
            style={{
              left: `${40 + i * 6}%`, top: "20%",
              background: "radial-gradient(circle, rgba(220,235,255,.9), rgba(220,235,255,0) 70%)",
              animation: `forge-steam ${1.2 + i * 0.15}s ease-out ${i * 0.08}s forwards`,
            }}
          />
        ))}
      </div>

      {/* Barril de água para têmpera */}
      <div className="absolute right-2 bottom-0 w-20 h-20">
        <div className="absolute inset-x-0 bottom-0 h-16 rounded-md overflow-hidden" style={{ background: "linear-gradient(180deg,#3b2a1e,#1e140c)" }}>
          <div className="absolute inset-x-1 top-2 bottom-2 rounded-sm overflow-hidden" style={{ background: "linear-gradient(180deg,#1e6b8a,#0a2b3a)" }}>
            <div className="absolute inset-x-0 top-0 h-1 bg-white/40" style={{ animation: "forge-flame 2s ease-in-out infinite" }} />
          </div>
        </div>
      </div>
    </div>
  );
}