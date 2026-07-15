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
    if (nextHits >= cfg.hammer_hits) setPhase("temper");
  }

  function freezeTemper() {
    if (phase !== "temper" || temperFrozen != null) return;
    setTemperFrozen(temper);
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