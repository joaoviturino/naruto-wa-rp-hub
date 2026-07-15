import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Phase = "cut" | "sew" | "finish" | "done";
type Config = {
  duration_seconds?: number;
  difficulty?: number;
  hammer_hits?: number; // reaproveitado como "pontos de costura"
  heat_target?: number; // reaproveitado como "corte ideal"
  temper_target?: number; // reaproveitado como "acabamento"
};

/**
 * Minigame de Confecção — 3 fases:
 * 1. Cortar: segurar para deslizar a tesoura até a marca do molde.
 * 2. Costurar: clicar em ritmo na faixa da agulha.
 * 3. Acabar: passar o ferro e travar no ponto ideal.
 *
 * Mesma mecânica base da forja, cenário e cores diferentes.
 */
export function TailoringGame({
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
    stitches: Math.max(3, Math.min(20, config.hammer_hits ?? 6 + difficulty)),
    cut_target: config.heat_target ?? 70,
    finish_target: config.temper_target ?? 40,
  };
  const [phase, setPhase] = useState<Phase>("cut");
  const [remaining, setRemaining] = useState(cfg.duration_seconds);
  const [cut, setCut] = useState(0);
  const [holding, setHolding] = useState(false);
  const [hits, setHits] = useState(0);
  const [goodHits, setGoodHits] = useState(0);
  const [sweetX, setSweetX] = useState(50);
  const [finishVal, setFinishVal] = useState(0);
  const [finishDir, setFinishDir] = useState(1);
  const [finishFrozen, setFinishFrozen] = useState<number | null>(null);
  const finishedRef = useRef(false);
  const [needleSwing, setNeedleSwing] = useState(0);
  const [lastHitGood, setLastHitGood] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<Array<{ id: number; x: number; y: number; good: boolean }>>([]);
  const [ironing, setIroning] = useState(false);

  useEffect(() => {
    if (phase === "done") return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (remaining <= 0 && phase !== "done" && !finishedRef.current) end();
  }, [remaining]);

  useEffect(() => {
    if (phase !== "cut") return;
    const speed = 2 + difficulty * 0.6;
    const id = setInterval(() => {
      setCut((h) => holding ? Math.min(100, h + speed) : Math.max(0, h - speed * 0.6));
    }, 90);
    return () => clearInterval(id);
  }, [phase, holding, difficulty]);

  useEffect(() => {
    if (phase !== "sew") return;
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

  useEffect(() => {
    if (phase !== "finish" || finishFrozen != null) return;
    const speed = 1 + difficulty * 0.5;
    const id = setInterval(() => {
      setFinishVal((v) => {
        let n = v + finishDir * speed;
        if (n >= 100) { n = 100; setFinishDir(-1); }
        if (n <= 0) { n = 0; setFinishDir(1); }
        return n;
      });
    }, 40);
    return () => clearInterval(id);
  }, [phase, finishDir, finishFrozen, difficulty]);

  function submitCut() { setPhase("sew"); }

  function onSew(e: React.MouseEvent<HTMLDivElement>) {
    if (phase !== "sew") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const good = Math.abs(clickX - sweetX) <= 10;
    if (good) setGoodHits((g) => g + 1);
    const nextHits = hits + 1;
    setHits(nextHits);
    setNeedleSwing((s) => s + 1);
    setLastHitGood(good);
    const id = Date.now() + Math.random();
    const burst = Array.from({ length: good ? 6 : 2 }, (_, i) => ({
      id: id + i,
      x: 50 + (Math.random() * 40 - 20),
      y: 55 + (Math.random() * 20 - 10),
      good,
    }));
    setThreads((prev) => [...prev, ...burst]);
    setTimeout(() => setThreads((prev) => prev.filter((s) => !burst.find((b) => b.id === s.id))), 600);
    if (nextHits >= cfg.stitches) setPhase("finish");
  }

  function lockFinish() {
    if (phase !== "finish" || finishFrozen != null) return;
    setFinishFrozen(finishVal);
    setIroning(true);
    setTimeout(() => end(finishVal), 400);
  }

  function end(finishV?: number) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const cutScore = Math.max(0, 100 - Math.abs(cut - cfg.cut_target) * 4);
    const sewScore = cfg.stitches > 0 ? (goodHits / cfg.stitches) * 100 : 0;
    const fVal = finishV ?? finishFrozen ?? finishVal;
    const finishScore = Math.max(0, 100 - Math.abs(fVal - cfg.finish_target) * 3);
    const score = Math.round((cutScore + sewScore + finishScore) / 3);
    const needed = 45 + difficulty * 6;
    setPhase("done");
    onFinish({ score, success: score >= needed });
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border select-none"
      style={{ background: background ? `#0d0b14 url(${background}) center/cover no-repeat` : "linear-gradient(180deg,#1a1526,#2c2540)" }}>
      <style>{`
        @keyframes tail-needle { 0%{ transform: translate(-50%, -110%) rotate(-15deg) } 45%{ transform: translate(-50%, -30%) rotate(0deg) } 70%{ transform: translate(-50%, -35%) rotate(-6deg) } 100%{ transform: translate(-50%, -110%) rotate(-15deg) } }
        @keyframes tail-thread { 0%{ transform: translate(-50%,-50%) scale(1); opacity: 1 } 100%{ transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.2); opacity: 0 } }
        @keyframes tail-steam { 0%{ transform: translate(-50%,0) scale(.6); opacity:.0 } 30%{ opacity:.8 } 100%{ transform: translate(-50%,-50px) scale(1.4); opacity:0 } }
        @keyframes tail-scissor { 0%,100%{ transform: rotate(-8deg) } 50%{ transform: rotate(8deg) } }
      `}</style>
      <div className="flex items-center justify-between px-3 py-2 bg-black/50 text-xs">
        <span className="font-display text-gold">
          {phase === "cut" && "1. Cortar"}
          {phase === "sew" && "2. Costurar"}
          {phase === "finish" && "3. Passar"}
          {phase === "done" && "Concluído"}
        </span>
        {preview && (
          <span className="flex items-center gap-2 text-muted-foreground">
            {preview.icon && <img src={preview.icon} className="w-6 h-6 object-contain" alt="" />}
            Confeccionando: <b className="text-foreground">{preview.name}</b>
          </span>
        )}
        <span className="tabular-nums">{remaining}s</span>
      </div>

      <div className="p-4 min-h-[340px] flex flex-col items-center justify-center gap-4">
        <TailoringScene
          phase={phase}
          cut={cut}
          needleSwing={needleSwing}
          lastHitGood={lastHitGood}
          threads={threads}
          ironing={ironing}
          finishFrozen={finishFrozen}
          holding={holding}
        />

        {phase === "cut" && (
          <>
            <div className="text-xs text-muted-foreground">Segure para deslizar a tesoura até a faixa do molde.</div>
            <div className="relative w-full max-w-md h-10 bg-black/40 rounded overflow-hidden border border-border">
              <div className="absolute top-0 bottom-0 bg-fuchsia-500/30 border-x border-fuchsia-400"
                style={{ left: `${cfg.cut_target - 12}%`, width: `24%` }} />
              <div className="absolute inset-y-0 left-0 transition-[width] duration-75"
                style={{ width: `${cut}%`, background: "linear-gradient(90deg,#7c3aed,#d946ef,#f0abfc)" }} />
            </div>
            <div className="flex gap-2">
              <Button
                onMouseDown={() => setHolding(true)}
                onMouseUp={() => setHolding(false)}
                onMouseLeave={() => setHolding(false)}
                onTouchStart={() => setHolding(true)}
                onTouchEnd={() => setHolding(false)}
              >✂ Cortar</Button>
              <Button variant="secondary" onClick={submitCut}>Pronto</Button>
            </div>
          </>
        )}

        {phase === "sew" && (
          <>
            <div className="text-xs text-muted-foreground">
              Clique dentro da faixa da agulha. {hits}/{cfg.stitches} · Bons: {goodHits}
            </div>
            <div
              onClick={onSew}
              className="relative w-full max-w-md h-16 bg-black/40 rounded overflow-hidden border border-border cursor-crosshair"
            >
              <div className="absolute top-0 bottom-0 bg-fuchsia-500/40 border-x border-fuchsia-400"
                style={{ left: `${sweetX - 10}%`, width: `20%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-fuchsia-200/80 pointer-events-none">
                COSTURAR
              </div>
            </div>
          </>
        )}

        {phase === "finish" && (
          <>
            <div className="text-xs text-muted-foreground">
              Trave o ferro na faixa (alvo {cfg.finish_target}%).
            </div>
            <div className="relative w-full max-w-md h-10 bg-black/40 rounded overflow-hidden border border-border">
              <div className="absolute top-0 bottom-0 bg-emerald-500/30 border-x border-emerald-400"
                style={{ left: `${cfg.finish_target - 8}%`, width: `16%` }} />
              <div className="absolute top-0 bottom-0 w-1 bg-white"
                style={{ left: `${finishFrozen ?? finishVal}%` }} />
            </div>
            <Button onClick={lockFinish} disabled={finishFrozen != null}>🪭 Passar ferro</Button>
          </>
        )}

        {phase === "done" && (
          <div className="text-sm text-muted-foreground">Finalizando…</div>
        )}
      </div>
    </div>
  );
}

function TailoringScene({
  phase, cut, needleSwing, lastHitGood, threads, ironing, finishFrozen, holding,
}: {
  phase: Phase;
  cut: number;
  needleSwing: number;
  lastHitGood: boolean | null;
  threads: Array<{ id: number; x: number; y: number; good: boolean }>;
  ironing: boolean;
  finishFrozen: number | null;
  holding: boolean;
}) {
  const fabricColor =
    cut < 20 ? "#5a4a6a" :
    cut < 60 ? "#9d6bb8" :
                "#e0b4ff";
  return (
    <div className="relative w-full max-w-md h-40 mx-auto pointer-events-none">
      {/* Mesa de trabalho */}
      <div className="absolute inset-x-0 bottom-0 h-10 rounded-md" style={{ background: "linear-gradient(180deg,#5a3a24,#2b1712)", boxShadow: "inset 0 -6px 0 rgba(0,0,0,.4)" }} />

      {/* Rolo de tecido à esquerda */}
      <div className="absolute left-2 bottom-8 w-16 h-20">
        <div className="absolute inset-x-0 bottom-0 h-16 rounded-md" style={{ background: "linear-gradient(180deg,#7c3aed,#4c1d95)", boxShadow: "inset -6px 0 0 rgba(0,0,0,.25)" }} />
        <div className="absolute inset-x-0 top-0 h-3 rounded-t-md bg-neutral-800" />
      </div>

      {/* Máquina de costura ao centro */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-40 h-24">
        {/* base */}
        <div className="absolute left-0 right-0 bottom-0 h-6 rounded-sm" style={{ background: "linear-gradient(180deg,#4a4a52,#2a2a30)", boxShadow: "0 2px 0 rgba(0,0,0,.6)" }} />
        {/* corpo */}
        <div className="absolute left-4 right-4 bottom-6 h-10 rounded-md" style={{ background: "linear-gradient(180deg,#e5e7eb,#9ca3af)" }} />
        {/* braço superior */}
        <div className="absolute left-6 right-6 bottom-14 h-3 rounded-md" style={{ background: "linear-gradient(180deg,#f5f5f5,#a3a3a3)" }} />
        {/* carretel */}
        <div className="absolute right-8 bottom-16 w-2 h-4 bg-fuchsia-400 rounded-sm" />

        {/* Tecido em cima da máquina */}
        <div
          className="absolute left-1/2 bottom-6"
          style={{
            transform: "translate(-50%, 0)",
            width: 84,
            height: 8,
            borderRadius: 2,
            background: finishFrozen != null
              ? "linear-gradient(90deg,#a7f3d0,#ecfeff,#a7f3d0)"
              : `linear-gradient(90deg,#3b2a4a, ${fabricColor}, #3b2a4a)`,
            boxShadow: `0 0 6px 2px rgba(217,70,239,${0.15 + cut / 200})`,
          }}
        />

        {/* Agulha na fase de costura */}
        {phase === "sew" && (
          <div
            key={needleSwing}
            className="absolute left-1/2 bottom-6 text-2xl"
            style={{ transformOrigin: "50% 100%", animation: "tail-needle 340ms ease-out" }}
          >
            🪡
          </div>
        )}

        {/* Tesoura na fase de corte */}
        {phase === "cut" && (
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl"
            style={{ animation: holding ? "tail-scissor 250ms ease-in-out infinite" : undefined }}
          >
            ✂️
          </div>
        )}

        {/* Ferro de passar */}
        {phase === "finish" && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl">🪭</div>
        )}

        {/* Fiapos / partículas */}
        {threads.map((s) => (
          <span
            key={s.id}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              left: `${s.x}%`, top: `${s.y}%`,
              background: s.good ? "#f0abfc" : "#6b7280",
              boxShadow: s.good ? "0 0 6px 2px rgba(240,171,252,.7)" : "none",
              ["--dx" as any]: `${(Math.random() * 40 - 20).toFixed(0)}px`,
              ["--dy" as any]: `${(-20 - Math.random() * 30).toFixed(0)}px`,
              animation: "tail-thread 500ms ease-out forwards",
            } as React.CSSProperties}
          />
        ))}

        {phase === "sew" && lastHitGood != null && (
          <div
            key={`fb-${needleSwing}`}
            className="absolute left-1/2 -translate-x-1/2 -top-2 text-xs font-bold animate-fade-in"
            style={{ color: lastHitGood ? "#f0abfc" : "#94a3b8" }}
          >
            {lastHitGood ? "PERFEITO!" : "fraco"}
          </div>
        )}

        {ironing && Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="absolute w-6 h-6 rounded-full"
            style={{
              left: `${40 + i * 6}%`, top: "10%",
              background: "radial-gradient(circle, rgba(220,255,235,.9), rgba(220,255,235,0) 70%)",
              animation: `tail-steam ${1.2 + i * 0.15}s ease-out ${i * 0.08}s forwards`,
            }}
          />
        ))}
      </div>

      {/* Manequim à direita */}
      <div className="absolute right-2 bottom-8 w-14 h-20">
        <div className="absolute inset-x-0 bottom-0 h-4 rounded-sm bg-neutral-800" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-1 h-8 bg-neutral-700" />
        <div className="absolute inset-x-0 bottom-8 h-10 rounded-t-full" style={{ background: "linear-gradient(180deg,#d8b4fe,#7c3aed)" }} />
      </div>
    </div>
  );
}