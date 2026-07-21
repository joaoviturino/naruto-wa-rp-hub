import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Cfg = {
  duration_seconds?: number;
  target_score?: number;
  max_missed?: number;
  spawn_interval_ms?: number;
  spawn_jitter_ms?: number;
  target_speed?: number;      // px/frame
  target_size?: number;       // px
  difficulty?: number;
  background_url?: string | null;
  target_image_url?: string | null;
  shuriken_image_url?: string | null;
  hit_sound_url?: string | null;
  miss_sound_url?: string | null;
};

type Target = {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  hit: boolean;
  spawnAt: number;
};

const W = 640;
const H = 420;

let ac: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ac) { try { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { ac = null; } }
  return ac;
}
function playHit(url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.7; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = "square"; osc.frequency.setValueAtTime(340, now); osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
  g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.2);
}
function playMiss(url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.5; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = "sawtooth"; osc.frequency.setValueAtTime(140, now); osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);
  g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.18);
}

export function ShurikenMovingGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: Cfg;
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const difficulty = Math.max(1, Math.min(5, config.difficulty ?? 2));
  const duration = Math.max(15, config.duration_seconds ?? 60);
  const targetScore = Math.max(1, config.target_score ?? 12);
  const maxMissed = Math.max(0, config.max_missed ?? Math.max(3, 8 - difficulty));
  const baseSpawn = Math.max(300, config.spawn_interval_ms ?? Math.max(500, 1400 - difficulty * 160));
  const jitter = Math.max(0, config.spawn_jitter_ms ?? 400);
  const speed = Math.max(1, config.target_speed ?? (2 + difficulty * 0.8));
  const size = Math.max(28, Math.min(120, config.target_size ?? Math.max(40, 84 - difficulty * 6)));
  const bg = background ?? config.background_url ?? null;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const targetsRef = useRef<Target[]>([]);
  const idRef = useRef(1);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!running || done) return;
    if (remaining <= 0) return finish();
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, running, done]);

  // Spawn
  useEffect(() => {
    if (!running || done) return;
    let alive = true;
    (async () => {
      while (alive && !done) {
        await new Promise((r) => setTimeout(r, baseSpawn + Math.random() * jitter));
        if (!alive) return;
        spawn();
        if (difficulty >= 4 && Math.random() < 0.3) spawn();
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, done]);

  function spawn() {
    // vem de fora, atravessa horizontalmente com leve zigzag
    const fromLeft = Math.random() < 0.5;
    const y = 60 + Math.random() * (H - 120);
    const vx = (fromLeft ? 1 : -1) * (speed + Math.random() * 1.2);
    const vy = (Math.random() - 0.5) * (difficulty >= 3 ? 1.6 : 0.8);
    targetsRef.current.push({
      id: idRef.current++,
      x: fromLeft ? -size : W + size, y, vx, vy,
      size, hit: false, spawnAt: performance.now(),
    });
  }

  // RAF
  useEffect(() => {
    if (!running || done) return;
    let raf = 0; let last = performance.now();
    function tick(now: number) {
      const dt = Math.min(2.5, (now - last) / 16.6667); last = now;
      let missedInc = 0;
      for (const t of targetsRef.current) {
        if (t.hit) continue;
        t.x += t.vx * dt; t.y += t.vy * dt;
      }
      // remove que sairam
      const kept: Target[] = [];
      for (const t of targetsRef.current) {
        if (t.hit) { if (now - t.spawnAt < 5000) kept.push(t); continue; }
        const outside = t.x < -t.size - 20 || t.x > W + t.size + 20 || t.y < -t.size - 20 || t.y > H + t.size + 20;
        if (outside) { missedInc++; continue; }
        kept.push(t);
      }
      targetsRef.current = kept;
      if (missedInc) {
        playMiss(config.miss_sound_url);
        setMissed((m) => {
          const nm = m + missedInc;
          if (nm >= maxMissed) setTimeout(() => finish(), 30);
          return nm;
        });
      }
      forceTick((v) => (v + 1) % 1e6);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, done]);

  function shoot(e: React.PointerEvent) {
    if (!running || done) return;
    const el = stageRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const sy = (e.clientY - rect.top) * (H / rect.height);
    let hitOne = false;
    for (const t of targetsRef.current) {
      if (t.hit) continue;
      const d = Math.hypot(t.x - sx, t.y - sy);
      if (d <= t.size / 2) { t.hit = true; hitOne = true; break; }
    }
    if (hitOne) {
      playHit(config.hit_sound_url);
      setScore((s) => {
        const ns = s + 1;
        if (ns >= targetScore) setTimeout(() => finish(), 30);
        return ns;
      });
    } else {
      playMiss(config.miss_sound_url);
    }
  }

  function finish() {
    if (done) return;
    setDone(true); setRunning(false);
    setTimeout(() => onFinish({ score, success: score >= targetScore && missed < maxMissed }), 60);
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="px-2 py-1 rounded bg-secondary">⏱ {remaining}s</div>
        <div className="px-2 py-1 rounded bg-secondary">🎯 {score} / {targetScore}</div>
        <div className="px-2 py-1 rounded bg-secondary text-red-300">✕ {missed} / {maxMissed}</div>
        <div className="ml-auto text-muted-foreground">Dificuldade {difficulty}</div>
      </div>

      <div
        ref={stageRef}
        onPointerDown={shoot}
        style={{
          width: "100%", maxWidth: W, aspectRatio: `${W} / ${H}`,
          backgroundImage: bg ? `url(${bg})` : undefined, backgroundSize: "cover", backgroundPosition: "center",
          background: bg ? undefined : "linear-gradient(180deg,#1e3624 0%,#0b1a10 100%)",
        }}
        className="relative mx-auto rounded-lg overflow-hidden border border-gold/40 cursor-crosshair select-none touch-none"
      >
        {targetsRef.current.map((t) => (
          <div key={t.id}
            className="absolute"
            style={{
              left: (t.x / W) * 100 + "%", top: (t.y / H) * 100 + "%",
              width: (t.size / W) * 100 + "%", aspectRatio: "1 / 1",
              transform: "translate(-50%,-50%)",
              transition: t.hit ? "opacity 0.35s ease-out, transform 0.35s ease-out" : undefined,
              opacity: t.hit ? 0 : 1,
            }}
          >
            {config.target_image_url ? (
              <img src={config.target_image_url} className="w-full h-full object-contain" alt="" draggable={false} />
            ) : (
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow">
                <circle cx="50" cy="50" r="48" fill="#f5f1e2" stroke="#111" strokeWidth="2" />
                <circle cx="50" cy="50" r="36" fill="none" stroke="#2b1b0f" strokeWidth="2" />
                <circle cx="50" cy="50" r="24" fill="#a11a1a" stroke="#2b1b0f" strokeWidth="2" />
                <circle cx="50" cy="50" r="11" fill="#f5c722" stroke="#2b1b0f" strokeWidth="2" />
                <circle cx="50" cy="50" r="3" fill="#111" />
              </svg>
            )}
            {t.hit && (
              <div className="absolute inset-0 grid place-items-center">
                {config.shuriken_image_url ? (
                  <img src={config.shuriken_image_url} className="w-1/3 h-1/3 object-contain" alt="" />
                ) : (
                  <svg viewBox="-10 -10 20 20" className="w-1/3 h-1/3">
                    <g fill="#c8ccd3" stroke="#111" strokeWidth="0.6">
                      <polygon points="0,-9 2.4,-2 9,0 2.4,2 0,9 -2.4,2 -9,0 -2.4,-2" />
                      <circle cx="0" cy="0" r="1.5" fill="#111" />
                    </g>
                  </svg>
                )}
              </div>
            )}
          </div>
        ))}

        {!running && !done && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <div className="text-center space-y-3 p-4 max-w-md">
              <div className="text-gold font-display text-2xl">Alvos em Movimento</div>
              <p className="text-sm text-muted-foreground">
                Alvos de madeira atravessam a arena. Toque para atirar seus shurikens.
                Meta: <strong>{targetScore}</strong> acertos, no máximo {maxMissed} fugas.
              </p>
              <Button onClick={(e) => { e.stopPropagation(); setRunning(true); }}>Começar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}