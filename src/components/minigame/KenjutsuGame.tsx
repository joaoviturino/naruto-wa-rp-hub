import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Cfg = {
  duration_seconds?: number;
  target_score?: number;
  max_missed?: number;
  spawn_interval_ms?: number;
  spawn_jitter_ms?: number;
  min_slice_speed?: number; // px/frame
  difficulty?: number; // 1..5
  gravity?: number; // px/frame^2
  bomb_chance?: number; // 0..100
  log_image_url?: string | null;
  bomb_image_url?: string | null;
  slice_sound_url?: string | null;
  bomb_sound_url?: string | null;
};

type Projectile = {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  kind: "log" | "bomb";
  sliced: boolean;
  halves?: { x: number; y: number; vx: number; vy: number; rot: number; vr: number; side: -1 | 1 }[];
  spawnAt: number;
};

const W = 640;
const H = 420;

// --- Sons sintéticos (Web Audio) — sem depender de assets ---
let ac: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ac) {
    try { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { ac = null; }
  }
  return ac;
}
function playSlice(url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.6; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  // whoosh: ruído branco filtrado + envelope curto
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(now); src.stop(now + 0.2);
  // chunk: click grave da madeira quebrando
  const osc = ctx.createOscillator(); const og = ctx.createGain();
  osc.type = "square"; osc.frequency.setValueAtTime(180, now); osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
  og.gain.setValueAtTime(0.35, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  osc.connect(og); og.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.15);
}
function playBomb(url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.7; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.8, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  src.connect(lp); lp.connect(g); g.connect(ctx.destination);
  src.start(now); src.stop(now + 0.5);
}
function playMiss() {
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(360, now); osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
  g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.3);
}

export function KenjutsuGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: Cfg;
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const difficulty = Math.max(1, Math.min(5, config.difficulty ?? 2));
  const duration = Math.max(15, config.duration_seconds ?? 60);
  const target = Math.max(1, config.target_score ?? (10 + difficulty * 5));
  const maxMissed = Math.max(0, config.max_missed ?? Math.max(3, 8 - difficulty));
  const gravity = config.gravity ?? (0.28 + difficulty * 0.05);
  const minSpeed = Math.max(4, config.min_slice_speed ?? 12);
  const baseSpawn = Math.max(220, config.spawn_interval_ms ?? (1400 - difficulty * 160));
  const jitter = Math.max(0, config.spawn_jitter_ms ?? 500);
  const bombChance = Math.max(0, Math.min(60, config.bomb_chance ?? (10 + difficulty * 3)));

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [missed, setMissed] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);

  const projRef = useRef<Projectile[]>([]);
  const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const cutRef = useRef<{ active: boolean; last: { x: number; y: number; t: number } | null }>({ active: false, last: null });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(1);
  const flashRef = useRef<{ bomb: boolean; at: number } | null>(null);
  const [, forceTick] = useState(0);

  const settings = useMemo(() => ({
    duration, target, maxMissed, gravity, minSpeed, baseSpawn, jitter, bombChance,
  }), [duration, target, maxMissed, gravity, minSpeed, baseSpawn, jitter, bombChance]);

  // Timer
  useEffect(() => {
    if (!running || done) return;
    if (remaining <= 0) { finish(); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, running, done]);

  // Spawner
  useEffect(() => {
    if (!running || done) return;
    let alive = true;
    async function loop() {
      while (alive && !done) {
        const wait = settings.baseSpawn + (Math.random() * settings.jitter);
        await new Promise((r) => setTimeout(r, wait));
        if (!alive) return;
        const burst = 1 + (Math.random() < Math.min(0.3, difficulty * 0.06) ? 1 : 0) + (difficulty >= 4 && Math.random() < 0.2 ? 1 : 0);
        for (let i = 0; i < burst; i++) spawn();
      }
    }
    loop();
    return () => { alive = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done, settings]);

  // Game loop (RAF)
  useEffect(() => {
    if (!running || done) return;
    let raf = 0;
    let last = performance.now();
    function tick(now: number) {
      const dt = Math.min(2.5, (now - last) / 16.6667);
      last = now;
      const arr = projRef.current;
      let missedInc = 0;
      for (const p of arr) {
        if (!p.sliced) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += settings.gravity * dt;
          p.rot += p.vr * dt;
        } else if (p.halves) {
          for (const h of p.halves) {
            h.x += h.vx * dt; h.y += h.vy * dt; h.vy += settings.gravity * dt; h.rot += h.vr * dt;
          }
        }
      }
      // remove os que sairam
      projRef.current = arr.filter((p) => {
        if (p.sliced) return (p.halves ?? []).some((h) => h.y < H + 100);
        const gone = p.y > H + 80;
        if (gone) {
          if (p.kind === "log" && now - p.spawnAt > 400) missedInc++;
          return false;
        }
        return true;
      });
      if (missedInc > 0) {
        setMissed((m) => {
          const nm = m + missedInc;
          if (nm >= settings.maxMissed) setTimeout(finish, 50);
          return nm;
        });
        setCombo(0);
        playMiss();
      }
      // trail decay
      const cutoff = now - 220;
      trailRef.current = trailRef.current.filter((t) => t.t > cutoff);
      forceTick((t) => (t + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done, settings]);

  function spawn() {
    const isBomb = Math.random() * 100 < settings.bombChance;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? 40 + Math.random() * 120 : W - 40 - Math.random() * 120;
    const y = H + 20;
    const targetX = W * 0.3 + Math.random() * W * 0.4;
    const flightMs = 1400 + Math.random() * 400;
    const frames = flightMs / 16.6667;
    const vx = (targetX - x) / frames;
    // v0y from projectile: apex at y = H*0.15..0.35
    const apex = H * (0.10 + Math.random() * 0.25);
    const vy = -Math.sqrt(2 * settings.gravity * (y - apex));
    projRef.current.push({
      id: idRef.current++,
      x, y, vx, vy,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
      kind: isBomb ? "bomb" : "log",
      sliced: false,
      spawnAt: performance.now(),
    });
  }

  function stageCoords(e: React.PointerEvent | PointerEvent): { x: number; y: number } | null {
    const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return null;
    const nx = (("clientX" in e ? e.clientX : 0) - rect.left) * (W / rect.width);
    const ny = (("clientY" in e ? e.clientY : 0) - rect.top) * (H / rect.height);
    return { x: nx, y: ny };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    cutRef.current.active = true;
    const c = stageCoords(e); if (!c) return;
    cutRef.current.last = { ...c, t: performance.now() };
    trailRef.current.push({ ...c, t: performance.now() });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!cutRef.current.active) return;
    const c = stageCoords(e); if (!c) return;
    const now = performance.now();
    const prev = cutRef.current.last;
    trailRef.current.push({ ...c, t: now });
    if (!prev) { cutRef.current.last = { ...c, t: now }; return; }
    const dx = c.x - prev.x; const dy = c.y - prev.y;
    const dt = Math.max(1, now - prev.t);
    const speed = Math.sqrt(dx * dx + dy * dy) / (dt / 16.6667);
    cutRef.current.last = { ...c, t: now };
    if (speed < settings.minSpeed) return;
    trySliceSegment(prev.x, prev.y, c.x, c.y);
  }
  function onPointerUp() { cutRef.current.active = false; cutRef.current.last = null; }

  function trySliceSegment(x1: number, y1: number, x2: number, y2: number) {
    for (const p of projRef.current) {
      if (p.sliced) continue;
      const R = p.kind === "bomb" ? 34 : 40;
      const d = pointSegDist(p.x, p.y, x1, y1, x2, y2);
      if (d <= R) sliceProjectile(p, x2 - x1, y2 - y1);
    }
  }
  function sliceProjectile(p: Projectile, dx: number, dy: number) {
    p.sliced = true;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = -dy / len, ny = dx / len;
    p.halves = [
      { x: p.x, y: p.y, vx: p.vx + nx * 3, vy: p.vy + ny * 3 - 2, rot: p.rot, vr: p.vr + 0.15, side: -1 },
      { x: p.x, y: p.y, vx: p.vx - nx * 3, vy: p.vy - ny * 3 - 2, rot: p.rot, vr: p.vr - 0.15, side: 1 },
    ];
    if (p.kind === "bomb") {
      playBomb(config.bomb_sound_url);
      flashRef.current = { bomb: true, at: performance.now() };
      setCombo(0);
      setMissed((m) => {
        const nm = m + Math.max(1, Math.ceil(settings.maxMissed / 2));
        if (nm >= settings.maxMissed) setTimeout(finish, 60);
        return nm;
      });
    } else {
      playSlice(config.slice_sound_url);
      setCombo((c) => {
        const nc = c + 1;
        const bonus = nc >= 3 ? 1 : 0;
        setScore((s) => {
          const ns = s + 1 + bonus;
          if (ns >= settings.target) setTimeout(finish, 60);
          return ns;
        });
        return nc;
      });
    }
  }

  const finishRef = useRef<() => void>(() => {});
  finishRef.current = () => {
    if (done) return;
    setDone(true);
    const success = score >= settings.target && missed < settings.maxMissed;
    onFinish({ score, success });
  };
  function finish() { finishRef.current(); }

  const list = projRef.current;
  const bombFlash = flashRef.current && (performance.now() - flashRef.current.at) < 180;

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between text-sm">
        <span>Tempo: <b className="text-gold">{remaining}s</b></span>
        <span>Cortes: <b className="text-gold">{score}/{settings.target}</b></span>
        <span>Combo: <b className="text-gold">×{combo}</b></span>
        <span>Erros: <b className={missed >= settings.maxMissed ? "text-red-400" : "text-gold"}>{missed}/{settings.maxMissed}</b></span>
      </div>
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        className={`relative rounded-lg overflow-hidden border border-border touch-none cursor-crosshair ${bombFlash ? "ring-4 ring-red-500" : ""}`}
        style={{
          aspectRatio: `${W} / ${H}`,
          background: background ? `url(${background}) center/cover no-repeat` : "linear-gradient(180deg, #1c2b3a, #0e1620)",
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full pointer-events-none">
          {/* projéteis */}
          {list.map((p) => {
            if (!p.sliced) return <ProjSprite key={p.id} p={p} config={config} />;
            return (
              <g key={p.id}>
                {p.halves!.map((h, i) => (
                  <HalfSprite key={i} p={p} h={h} idx={i} config={config} />
                ))}
              </g>
            );
          })}
          {/* trilha do corte */}
          <TrailSvg trail={trailRef.current} />
        </svg>

        {!running && !done && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center space-y-3 p-6">
              <div className="font-display text-2xl text-gold">Kenjutsu — Corte da Madeira</div>
              <p className="text-sm text-white/80 max-w-md">
                Arraste rápido para cortar as toras. Não deixe cair {settings.maxMissed}. Cuidado com as <b className="text-red-400">bombas</b> — não corte!
              </p>
              <Button onClick={() => { setRunning(true); audio(); }}>Iniciar treino</Button>
            </div>
          </div>
        )}
      </div>

      {done && (
        <div className="text-xs text-muted-foreground text-center">
          Fim! {score >= settings.target ? "Meta atingida." : "Meta não atingida."}
        </div>
      )}
    </div>
  );
}

function ProjSprite({ p, config }: { p: Projectile; config: Cfg }) {
  if (p.kind === "bomb") {
    return (
      <g transform={`translate(${p.x} ${p.y}) rotate(${(p.rot * 180) / Math.PI})`}>
        {config.bomb_image_url ? (
          <image href={config.bomb_image_url} x={-28} y={-28} width={56} height={56} />
        ) : (
          <>
            <circle r={26} fill="#111" stroke="#333" strokeWidth={2} />
            <rect x={-3} y={-32} width={6} height={10} fill="#2a2a2a" />
            <circle cx={0} cy={-38} r={4} fill="#ff9d3d">
              <animate attributeName="r" values="3;5;3" dur="0.4s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </g>
    );
  }
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${(p.rot * 180) / Math.PI})`}>
      {config.log_image_url ? (
        <image href={config.log_image_url} x={-36} y={-22} width={72} height={44} />
      ) : (
        <>
          <rect x={-36} y={-18} width={72} height={36} rx={14} fill="#8b5a2b" stroke="#4a2f16" strokeWidth={2} />
          <ellipse cx={-32} cy={0} rx={8} ry={14} fill="#c98b4f" stroke="#4a2f16" strokeWidth={2} />
          <ellipse cx={32} cy={0} rx={8} ry={14} fill="#c98b4f" stroke="#4a2f16" strokeWidth={2} />
          <circle cx={-32} cy={0} r={3} fill="#4a2f16" />
          <circle cx={32} cy={0} r={3} fill="#4a2f16" />
          <path d="M-20 -6 L 20 -6 M -22 4 L 18 4" stroke="#4a2f16" strokeWidth={1} opacity={0.5} />
        </>
      )}
    </g>
  );
}

function HalfSprite({ p, h, idx, config }: { p: Projectile; h: NonNullable<Projectile["halves"]>[number]; idx: number; config: Cfg }) {
  const clipId = `clip-${p.id}-${idx}`;
  return (
    <g transform={`translate(${h.x} ${h.y}) rotate(${(h.rot * 180) / Math.PI})`}>
      <defs>
        <clipPath id={clipId}>
          {h.side === -1 ? <rect x={-40} y={-30} width={40} height={60} /> : <rect x={0} y={-30} width={40} height={60} />}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {p.kind === "log" ? (
          config.log_image_url ? (
            <image href={config.log_image_url} x={-36} y={-22} width={72} height={44} />
          ) : (
            <>
              <rect x={-36} y={-18} width={72} height={36} rx={14} fill="#8b5a2b" stroke="#4a2f16" strokeWidth={2} />
              <ellipse cx={-32} cy={0} rx={8} ry={14} fill="#c98b4f" stroke="#4a2f16" strokeWidth={2} />
              <ellipse cx={32} cy={0} rx={8} ry={14} fill="#c98b4f" stroke="#4a2f16" strokeWidth={2} />
            </>
          )
        ) : (
          <circle r={26} fill="#111" stroke="#333" strokeWidth={2} />
        )}
      </g>
      {p.kind === "log" && (
        <line x1={h.side === -1 ? -2 : 2} y1={-18} x2={h.side === -1 ? -2 : 2} y2={18} stroke="#3a1f0f" strokeWidth={2} />
      )}
    </g>
  );
}

function TrailSvg({ trail }: { trail: { x: number; y: number; t: number }[] }) {
  if (trail.length < 2) return null;
  const now = performance.now();
  const pts = trail.slice(-20);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const alpha = Math.min(1, (now - pts[0].t) / 220);
  return (
    <>
      <path d={path} stroke="rgba(255,255,255,0.9)" strokeWidth={5} strokeLinecap="round" fill="none" opacity={1 - alpha} />
      <path d={path} stroke="rgba(215,175,90,0.8)" strokeWidth={2} strokeLinecap="round" fill="none" opacity={1 - alpha} />
    </>
  );
}

function pointSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}