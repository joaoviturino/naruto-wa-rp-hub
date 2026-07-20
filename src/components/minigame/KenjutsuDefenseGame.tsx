import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Dir = "up" | "down" | "left" | "right";
type AttackKind = "normal" | "fast" | "double" | "feint" | "kunai" | "shuriken";
type Attack = {
  id: number;
  dir: Dir;
  kind: AttackKind;
  bornAt: number;
  deadline: number;
  step: 0 | 1; // usado em ataques duplos
  nextDir?: Dir;
};

type Cfg = {
  duration_seconds?: number;
  target_score?: number;
  max_missed?: number;
  spawn_interval_ms?: number;
  spawn_jitter_ms?: number;
  reaction_window_ms?: number;
  difficulty?: number;
  double_chance?: number;
  feint_chance?: number;
  projectile_chance?: number;
  background_url?: string | null;
  hero_image_url?: string | null;
  dummy_image_url?: string | null;
  kunai_image_url?: string | null;
  shuriken_image_url?: string | null;
  clang_sound_url?: string | null;
  hit_sound_url?: string | null;
};

const DIRS: Dir[] = ["up", "down", "left", "right"];
const ARROW: Record<Dir, string> = { up: "↑", down: "↓", left: "←", right: "→" };

let ac: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ac) { try { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { ac = null; } }
  return ac;
}
function playClang(url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.6; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(1400, now); o.frequency.exponentialRampToValueAtTime(500, now + 0.25);
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.5, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.35);
}
function playHit(url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.7; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.6, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  s.connect(g); g.connect(ctx.destination); s.start(now); s.stop(now + 0.22);
}

export function KenjutsuDefenseGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: Cfg;
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const cfg = useMemo(() => ({
    duration_seconds: config.duration_seconds ?? 60,
    target_score: config.target_score ?? 15,
    max_missed: config.max_missed ?? 5,
    spawn_interval_ms: config.spawn_interval_ms ?? 1400,
    spawn_jitter_ms: config.spawn_jitter_ms ?? 400,
    reaction_window_ms: config.reaction_window_ms ?? 1200,
    difficulty: Math.max(1, Math.min(5, config.difficulty ?? 2)),
    double_chance: config.double_chance ?? 15,
    feint_chance: config.feint_chance ?? 10,
    projectile_chance: config.projectile_chance ?? 15,
  }), [config]);

  const bg = config.background_url || background;
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [flash, setFlash] = useState<null | "ok" | "hit">(null);
  const [remaining, setRemaining] = useState(cfg.duration_seconds);
  const [current, setCurrent] = useState<Attack | null>(null);
  const [done, setDone] = useState(false);
  const idRef = useRef(0);
  const currentRef = useRef<Attack | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => { currentRef.current = current; }, [current]);

  // timer
  useEffect(() => {
    if (done) return;
    if (remaining <= 0) { finish(); return; }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, done]);

  // spawner
  useEffect(() => {
    if (done) return;
    let cancel = false;
    function schedule() {
      const jitter = Math.random() * cfg.spawn_jitter_ms;
      const interval = Math.max(300, cfg.spawn_interval_ms - (cfg.difficulty - 1) * 120);
      const wait = interval + jitter;
      setTimeout(() => {
        if (cancel || done) return;
        if (!currentRef.current) spawn();
        schedule();
      }, wait);
    }
    schedule();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // deadline watcher
  useEffect(() => {
    if (!current || done) return;
    const remainMs = current.deadline - Date.now();
    const t = setTimeout(() => {
      if (currentRef.current?.id === current.id) missBlock();
    }, Math.max(50, remainMs));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function spawn() {
    const roll = Math.random() * 100;
    let kind: AttackKind = "normal";
    if (roll < cfg.projectile_chance) kind = Math.random() < 0.5 ? "kunai" : "shuriken";
    else if (roll < cfg.projectile_chance + cfg.feint_chance) kind = "feint";
    else if (roll < cfg.projectile_chance + cfg.feint_chance + cfg.double_chance) kind = "double";
    else kind = cfg.difficulty >= 3 && Math.random() < 0.35 ? "fast" : "normal";

    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    let nextDir: Dir | undefined;
    if (kind === "double") {
      const others = DIRS.filter((d) => d !== dir);
      nextDir = others[Math.floor(Math.random() * others.length)];
    }
    const speedMul = kind === "fast" || kind === "kunai" || kind === "shuriken" ? 0.55 : 1;
    const window = Math.max(250, cfg.reaction_window_ms * speedMul - (cfg.difficulty - 1) * 60);
    const now = Date.now();
    setCurrent({ id: ++idRef.current, dir, kind, bornAt: now, deadline: now + window, step: 0, nextDir });
  }

  function correctBlock() {
    playClang(config.clang_sound_url);
    setFlash("ok"); setTimeout(() => setFlash(null), 120);
    setScore((s) => {
      const n = s + 1;
      if (n >= cfg.target_score) setTimeout(() => finish(true), 200);
      return n;
    });
    setCurrent(null);
  }
  function missBlock() {
    playHit(config.hit_sound_url);
    setFlash("hit"); setTimeout(() => setFlash(null), 200);
    setMissed((m) => {
      const n = m + 1;
      if (n > cfg.max_missed) setTimeout(() => finish(false), 250);
      return n;
    });
    setCurrent(null);
  }

  function tryDirection(d: Dir) {
    const cur = currentRef.current;
    if (!cur || done) return;
    if (cur.kind === "feint") {
      // Feint: se o jogador atacou, sofre; se esperou (não swipe), sistema... aqui swipe = punir.
      missBlock();
      return;
    }
    if (d !== cur.dir) { missBlock(); return; }
    if (cur.kind === "double" && cur.step === 0 && cur.nextDir) {
      playClang(config.clang_sound_url);
      setFlash("ok"); setTimeout(() => setFlash(null), 100);
      const now = Date.now();
      const window = Math.max(250, cfg.reaction_window_ms * 0.55);
      setCurrent({ ...cur, dir: cur.nextDir, step: 1, nextDir: undefined, bornAt: now, deadline: now + window });
      return;
    }
    correctBlock();
  }

  function onPointerDown(e: React.PointerEvent) {
    swipeStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = swipeStart.current; swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x; const dy = e.clientY - s.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < 24) {
      // toque curto = feint corretamente ignorado; se havia ataque de verdade não conta
      const cur = currentRef.current;
      if (cur?.kind === "feint") {
        // esperou o feint — bloqueia mentalmente
        playClang(config.clang_sound_url);
        setFlash("ok"); setTimeout(() => setFlash(null), 100);
        setScore((sc) => {
          const n = sc + 1;
          if (n >= cfg.target_score) setTimeout(() => finish(true), 200);
          return n;
        });
        setCurrent(null);
      }
      return;
    }
    const dir: Dir = adx > ady ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    tryDirection(dir);
  }

  // teclado (opcional)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === "ArrowUp") tryDirection("up");
      else if (e.key === "ArrowDown") tryDirection("down");
      else if (e.key === "ArrowLeft") tryDirection("left");
      else if (e.key === "ArrowRight") tryDirection("right");
      else if (e.key === " ") {
        const cur = currentRef.current;
        if (cur?.kind === "feint") {
          playClang(config.clang_sound_url);
          setScore((sc) => sc + 1);
          setCurrent(null);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function finish(forceSuccess?: boolean) {
    if (done) return;
    setDone(true);
    const success = typeof forceSuccess === "boolean" ? forceSuccess : (score >= cfg.target_score && missed <= cfg.max_missed);
    onFinish({ score, success });
  }

  const projectile = current && (current.kind === "kunai" || current.kind === "shuriken");
  const attackerImg = projectile
    ? (current!.kind === "kunai" ? config.kunai_image_url : config.shuriken_image_url)
    : config.dummy_image_url;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>Tempo: <b className="text-gold">{remaining}s</b></span>
        <span>Bloqueios: <b className="text-emerald-300">{score}/{cfg.target_score}</b></span>
        <span>Falhas: <b className={missed > cfg.max_missed ? "text-red-400" : "text-red-300"}>{missed}/{cfg.max_missed}</b></span>
      </div>

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className={`relative rounded-lg overflow-hidden border border-border touch-none select-none ${flash === "ok" ? "ring-2 ring-emerald-400" : ""} ${flash === "hit" ? "ring-2 ring-red-500" : ""}`}
        style={{ aspectRatio: "16 / 10", background: bg ? `url(${bg}) center/cover no-repeat` : "hsl(var(--secondary))" }}
      >
        {/* Herói central */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {config.hero_image_url ? (
            <img src={config.hero_image_url} className="max-h-[70%] max-w-[40%] object-contain drop-shadow-lg" alt="" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-black/40 border-2 border-gold flex items-center justify-center text-4xl">🥷</div>
          )}
        </div>

        {/* Ataque */}
        {current && (
          <AttackSprite key={current.id} attack={current} img={attackerImg ?? null} />
        )}

        {/* Setas de HUD nas bordas */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {current && !projectile && current.kind !== "feint" && (
            <div className="text-6xl font-black text-red-400/80 animate-pulse drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]">
              {ARROW[current.dir]}
            </div>
          )}
          {current?.kind === "feint" && (
            <div className="px-3 py-1 bg-yellow-500/30 border border-yellow-400 rounded text-yellow-200 text-xs animate-pulse">
              Finta! Não caia.
            </div>
          )}
        </div>

        {/* Instrução */}
        {!current && !done && (
          <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-white/70 bg-black/40 rounded py-1">
            Deslize na direção do ataque para bloquear. Em fintas, não deslize.
          </div>
        )}
      </div>

      {/* Botões (fallback mobile) */}
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        <div />
        <Button variant="secondary" onClick={() => tryDirection("up")}>↑</Button>
        <div />
        <Button variant="secondary" onClick={() => tryDirection("left")}>←</Button>
        <Button variant="outline" onClick={() => {
          const cur = currentRef.current;
          if (cur?.kind === "feint") {
            playClang(config.clang_sound_url);
            setScore((s) => s + 1); setCurrent(null);
          }
        }}>⏸ finta</Button>
        <Button variant="secondary" onClick={() => tryDirection("right")}>→</Button>
        <div />
        <Button variant="secondary" onClick={() => tryDirection("down")}>↓</Button>
        <div />
      </div>
    </div>
  );
}

function AttackSprite({ attack, img }: { attack: Attack; img: string | null }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf: number; let start = performance.now();
    const loop = () => {
      setT(Math.min(1, (performance.now() - start) / Math.max(1, attack.deadline - attack.bornAt)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [attack.id, attack.bornAt, attack.deadline]);

  // início: borda; fim: centro
  const start: Record<Dir, { x: number; y: number }> = {
    up: { x: 50, y: -5 }, down: { x: 50, y: 105 },
    left: { x: -5, y: 50 }, right: { x: 105, y: 50 },
  };
  const s = start[attack.dir];
  const cx = 50, cy = 50;
  const x = s.x + (cx - s.x) * t;
  const y = s.y + (cy - s.y) * t;
  const scale = 0.6 + 0.6 * t;
  return (
    <div className="absolute pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${scale})` }}>
      {img ? (
        <img src={img} className="w-24 h-24 object-contain drop-shadow-[0_0_10px_rgba(255,0,0,0.6)]" alt="" />
      ) : (
        <div className="w-16 h-16 rounded bg-red-500/70 border-2 border-red-300 flex items-center justify-center text-white font-black">
          {attack.kind === "kunai" ? "🗡" : attack.kind === "shuriken" ? "✦" : "⚔"}
        </div>
      )}
    </div>
  );
}