import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Dir = "up" | "down" | "left" | "right" | "up-left" | "up-right" | "down-left" | "down-right";
const CARDINAL: Dir[] = ["up", "down", "left", "right"];
const DIAGONALS: Dir[] = ["up-left", "up-right", "down-left", "down-right"];
const ARROW: Record<Dir, string> = {
  up: "↑", down: "↓", left: "←", right: "→",
  "up-left": "↖", "up-right": "↗", "down-left": "↙", "down-right": "↘",
};

type Cfg = {
  rounds?: number;
  base_length?: number;
  grow_per_round?: number;
  demo_step_ms?: number;
  input_time_ms?: number;
  max_mistakes?: number;
  allow_diagonals?: boolean;
  background_url?: string | null;
  sensei_image_url?: string | null;
  correct_sound_url?: string | null;
  wrong_sound_url?: string | null;
};

let ac: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ac) { try { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { ac = null; } }
  return ac;
}
function beep(freq: number, dur = 0.12, url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.6; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "square"; o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.3, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + dur + 0.02);
}

export function KenjutsuKataGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: Cfg;
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const cfg = useMemo(() => ({
    rounds: config.rounds ?? 5,
    base_length: config.base_length ?? 3,
    grow_per_round: config.grow_per_round ?? 1,
    demo_step_ms: config.demo_step_ms ?? 650,
    input_time_ms: config.input_time_ms ?? 6000,
    max_mistakes: config.max_mistakes ?? 2,
    allow_diagonals: config.allow_diagonals ?? true,
  }), [config]);

  const bg = config.background_url || background;
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"demo" | "input" | "review">("demo");
  const [sequence, setSequence] = useState<Dir[]>([]);
  const [demoIdx, setDemoIdx] = useState(-1);
  const [inputIdx, setInputIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [inputLeft, setInputLeft] = useState(cfg.input_time_ms);
  const [flash, setFlash] = useState<null | "ok" | "wrong">(null);
  const [done, setDone] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  // gera nova sequência ao entrar em nova rodada
  useEffect(() => {
    if (done) return;
    const len = cfg.base_length + (round - 1) * cfg.grow_per_round;
    const pool: Dir[] = cfg.allow_diagonals ? [...CARDINAL, ...DIAGONALS] : [...CARDINAL];
    const seq: Dir[] = [];
    for (let i = 0; i < len; i++) seq.push(pool[Math.floor(Math.random() * pool.length)]);
    setSequence(seq);
    setDemoIdx(-1);
    setInputIdx(0);
    setPhase("demo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, done]);

  // demo
  useEffect(() => {
    if (done || phase !== "demo" || sequence.length === 0) return;
    let i = -1;
    const step = () => {
      i++;
      if (i >= sequence.length) {
        setTimeout(() => {
          setDemoIdx(-1);
          setPhase("input");
          setInputLeft(cfg.input_time_ms);
        }, 400);
        return;
      }
      setDemoIdx(i);
      beep(500 + i * 40, 0.1);
      setTimeout(step, cfg.demo_step_ms);
    };
    const t = setTimeout(step, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sequence, done]);

  // input timer
  useEffect(() => {
    if (done || phase !== "input") return;
    if (inputLeft <= 0) {
      failStep();
      return;
    }
    const t = setTimeout(() => setInputLeft((v) => Math.max(0, v - 100)), 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputLeft, phase, done]);

  function nextRound() {
    if (round >= cfg.rounds) {
      setDone(true);
      onFinish({ score, success: mistakes <= cfg.max_mistakes });
      return;
    }
    setRound((r) => r + 1);
  }

  function failStep() {
    beep(160, 0.25, config.wrong_sound_url);
    setFlash("wrong"); setTimeout(() => setFlash(null), 200);
    const m = mistakes + 1;
    setMistakes(m);
    if (m > cfg.max_mistakes) {
      setDone(true);
      onFinish({ score, success: false });
      return;
    }
    // reinicia a rodada
    setPhase("review");
    setTimeout(() => setPhase("demo"), 600);
  }

  function pressDir(d: Dir) {
    if (done || phase !== "input") return;
    const expected = sequence[inputIdx];
    if (d !== expected) { failStep(); return; }
    beep(700 + inputIdx * 25, 0.08, config.correct_sound_url);
    setFlash("ok"); setTimeout(() => setFlash(null), 80);
    const ni = inputIdx + 1;
    if (ni >= sequence.length) {
      setScore((s) => s + sequence.length * 10);
      setPhase("review");
      setTimeout(() => nextRound(), 700);
    } else {
      setInputIdx(ni);
    }
  }

  function onPointerDown(e: React.PointerEvent) { swipeStart.current = { x: e.clientX, y: e.clientY }; }
  function onPointerUp(e: React.PointerEvent) {
    const s = swipeStart.current; swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x; const dy = e.clientY - s.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < 24) return;
    if (cfg.allow_diagonals) {
      const ratio = Math.min(adx, ady) / Math.max(adx, ady);
      if (ratio > 0.5) {
        const h = dx > 0 ? "right" : "left";
        const v = dy > 0 ? "down" : "up";
        pressDir(`${v}-${h}` as Dir);
        return;
      }
    }
    pressDir(adx > ady ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      const m: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
        q: "up-left", e: "up-right", z: "down-left", c: "down-right",
      };
      const d = m[e.key];
      if (d) pressDir(d);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, inputIdx, sequence, done]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>Kata: <b className="text-gold">{round}/{cfg.rounds}</b></span>
        <span>Erros: <b className={mistakes > cfg.max_mistakes ? "text-red-400" : "text-red-300"}>{mistakes}/{cfg.max_mistakes}</b></span>
        <span>Score: <b className="text-emerald-300">{score}</b></span>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className={`relative rounded-lg overflow-hidden border border-border touch-none select-none ${flash === "ok" ? "ring-2 ring-emerald-400" : ""} ${flash === "wrong" ? "ring-2 ring-red-500" : ""}`}
        style={{ aspectRatio: "16 / 10", background: bg ? `url(${bg}) center/cover no-repeat` : "hsl(var(--secondary))" }}
      >
        {config.sensei_image_url && (
          <img src={config.sensei_image_url} className="absolute bottom-2 left-2 h-2/3 object-contain drop-shadow-lg pointer-events-none" alt="" />
        )}

        {/* Fase demo */}
        {phase === "demo" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xs uppercase tracking-widest text-white/80 mb-2 bg-black/50 px-3 py-1 rounded">
              Sensei demonstra — observe.
            </div>
            <div className="text-8xl font-black drop-shadow-[0_0_12px_rgba(0,0,0,0.9)] text-gold">
              {demoIdx >= 0 && demoIdx < sequence.length ? ARROW[sequence[demoIdx]] : "…"}
            </div>
            <div className="mt-3 flex gap-1 opacity-70">
              {sequence.map((_, i) => (
                <span key={i} className={`w-2 h-2 rounded-full ${i <= demoIdx ? "bg-gold" : "bg-white/30"}`} />
              ))}
            </div>
          </div>
        )}

        {/* Fase input */}
        {phase === "input" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xs uppercase tracking-widest text-emerald-300 mb-2 bg-black/50 px-3 py-1 rounded">
              Sua vez! Deslize a sequência.
            </div>
            <div className="flex gap-2 flex-wrap justify-center max-w-[80%]">
              {sequence.map((d, i) => (
                <div key={i} className={`text-3xl w-10 h-10 flex items-center justify-center rounded border ${
                  i < inputIdx ? "border-emerald-400 text-emerald-300 bg-emerald-950/40"
                  : i === inputIdx ? "border-gold text-gold animate-pulse"
                  : "border-white/20 text-white/40"
                }`}>{i < inputIdx ? "✓" : "?"}</div>
              ))}
            </div>
            <div className="mt-3 w-2/3 h-2 bg-white/20 rounded overflow-hidden">
              <div className="h-full bg-gold transition-all" style={{ width: `${(inputLeft / cfg.input_time_ms) * 100}%` }} />
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="px-4 py-2 rounded bg-black/60 text-white text-sm">Preparando próxima kata…</div>
          </div>
        )}
      </div>

      {/* controles mobile */}
      <div className={`grid ${cfg.allow_diagonals ? "grid-cols-3" : "grid-cols-3"} gap-2 max-w-xs mx-auto`}>
        {cfg.allow_diagonals ? (
          <>
            <Button variant="secondary" onClick={() => pressDir("up-left")}>↖</Button>
            <Button variant="secondary" onClick={() => pressDir("up")}>↑</Button>
            <Button variant="secondary" onClick={() => pressDir("up-right")}>↗</Button>
            <Button variant="secondary" onClick={() => pressDir("left")}>←</Button>
            <div />
            <Button variant="secondary" onClick={() => pressDir("right")}>→</Button>
            <Button variant="secondary" onClick={() => pressDir("down-left")}>↙</Button>
            <Button variant="secondary" onClick={() => pressDir("down")}>↓</Button>
            <Button variant="secondary" onClick={() => pressDir("down-right")}>↘</Button>
          </>
        ) : (
          <>
            <div />
            <Button variant="secondary" onClick={() => pressDir("up")}>↑</Button>
            <div />
            <Button variant="secondary" onClick={() => pressDir("left")}>←</Button>
            <div />
            <Button variant="secondary" onClick={() => pressDir("right")}>→</Button>
            <div />
            <Button variant="secondary" onClick={() => pressDir("down")}>↓</Button>
            <div />
          </>
        )}
      </div>
    </div>
  );
}