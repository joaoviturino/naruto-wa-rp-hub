import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Cfg = {
  duration_seconds?: number;
  throws?: number;
  target_score?: number;
  wind_amp?: number;      // px amplitude (0-200)
  wind_speed?: number;    // rad/s (0.5-6)
  crosshair_size?: number;
  ring_scores?: number[]; // [bulls, ring1, ring2, outer]
  difficulty?: number;
  background_url?: string | null;
  target_image_url?: string | null;
  shuriken_image_url?: string | null;
  throw_sound_url?: string | null;
  hit_sound_url?: string | null;
};

const W = 640;
const H = 420;

let ac: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ac) { try { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { ac = null; } }
  return ac;
}
function playWhoosh(url?: string | null) {
  if (url) { try { const a = new Audio(url); a.volume = 0.6; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.5, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(now); src.stop(now + 0.18);
}
function playHit(url?: string | null, kind: "wood" | "miss" = "wood") {
  if (url) { try { const a = new Audio(url); a.volume = 0.7; a.play().catch(() => {}); return; } catch {} }
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = "square";
  if (kind === "wood") { osc.frequency.setValueAtTime(320, now); osc.frequency.exponentialRampToValueAtTime(110, now + 0.15); }
  else { osc.frequency.setValueAtTime(140, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.2); }
  g.gain.setValueAtTime(0.32, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.22);
}

type Marker = { id: number; x: number; y: number; ring: number };

export function ShurikenTargetGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: Cfg;
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const difficulty = Math.max(1, Math.min(5, config.difficulty ?? 2));
  const duration = Math.max(15, config.duration_seconds ?? 45);
  const throws = Math.max(3, Math.min(30, config.throws ?? 6));
  const targetScore = Math.max(1, config.target_score ?? throws * 40);
  const rings = config.ring_scores && config.ring_scores.length === 4 ? config.ring_scores : [100, 60, 30, 10];
  const windAmp = Math.max(0, Math.min(300, config.wind_amp ?? (30 + difficulty * 20)));
  const windSpeed = Math.max(0.2, Math.min(6, config.wind_speed ?? (1 + difficulty * 0.35)));
  const cross = Math.max(28, Math.min(120, config.crosshair_size ?? 56));
  const bg = background ?? config.background_url ?? null;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(throws);
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const idRef = useRef(1);
  const startedAt = useRef<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running || done) return;
    let raf = 0;
    const loop = () => { setTick((t) => (t + 1) % 1e6); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, done]);

  useEffect(() => {
    if (!running || done) return;
    if (remaining <= 0) return finish();
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, running, done]);

  // Position of crosshair (wind drift, two oscillators, X & Y)
  const cx = useMemo(() => W / 2, []);
  const cy = useMemo(() => H / 2, []);
  function currentAim() {
    const t = (performance.now() - startedAt.current) / 1000;
    const x = cx + Math.sin(t * windSpeed) * windAmp + Math.sin(t * (windSpeed * 0.53)) * (windAmp * 0.35);
    const y = cy + Math.cos(t * windSpeed * 0.9) * (windAmp * 0.6) + Math.sin(t * (windSpeed * 1.7)) * (windAmp * 0.2);
    return { x, y };
  }

  function ringAt(x: number, y: number): { ring: number; pts: number } {
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r <= 22) return { ring: 0, pts: rings[0] };
    if (r <= 55) return { ring: 1, pts: rings[1] };
    if (r <= 95) return { ring: 2, pts: rings[2] };
    if (r <= 135) return { ring: 3, pts: rings[3] };
    return { ring: -1, pts: 0 };
  }

  function throwOne() {
    if (!running || done || left <= 0) return;
    const aim = currentAim();
    // ninja aims for center — actual hit = center + drift (aim - center)
    const hx = aim.x, hy = aim.y;
    playWhoosh(config.throw_sound_url);
    const res = ringAt(hx, hy);
    setScore((s) => s + res.pts);
    setMarkers((m) => [...m, { id: idRef.current++, x: hx, y: hy, ring: res.ring }]);
    playHit(config.hit_sound_url, res.pts > 0 ? "wood" : "miss");
    setLeft((l) => {
      const nl = l - 1;
      if (nl <= 0) setTimeout(() => finish(), 350);
      return nl;
    });
  }

  function finish() {
    if (done) return;
    setDone(true);
    setRunning(false);
    setTimeout(() => onFinish({ score, success: score >= targetScore }), 60);
  }

  const aim = running && !done ? currentAim() : { x: cx, y: cy };

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="px-2 py-1 rounded bg-secondary">⏱ {remaining}s</div>
        <div className="px-2 py-1 rounded bg-secondary">🎯 {score} / {targetScore}</div>
        <div className="px-2 py-1 rounded bg-secondary">Restam: {left}</div>
        <div className="ml-auto text-muted-foreground">Vento: nível {difficulty}</div>
      </div>

      <div
        ref={stageRef}
        onClick={throwOne}
        style={{
          width: "100%",
          maxWidth: W,
          aspectRatio: `${W} / ${H}`,
          backgroundImage: bg ? `url(${bg})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          background: bg ? undefined : "radial-gradient(circle at 50% 40%, #4a2f18, #1a0e05 70%)",
        }}
        className="relative mx-auto rounded-lg overflow-hidden border border-gold/40 cursor-crosshair select-none touch-none"
      >
        {/* Alvo */}
        <div
          className="absolute"
          style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 280, height: 280 }}
        >
          {config.target_image_url ? (
            <img src={config.target_image_url} className="w-full h-full object-contain" draggable={false} alt="" />
          ) : (
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle cx="100" cy="100" r="97" fill="#f5f1e2" stroke="#000" strokeWidth="3" />
              <circle cx="100" cy="100" r="72" fill="none" stroke="#2b1b0f" strokeWidth="3" />
              <circle cx="100" cy="100" r="46" fill="#a11a1a" stroke="#2b1b0f" strokeWidth="3" />
              <circle cx="100" cy="100" r="22" fill="#f5c722" stroke="#2b1b0f" strokeWidth="3" />
              <circle cx="100" cy="100" r="6" fill="#111" />
            </svg>
          )}
        </div>

        {/* Marcadores dos shurikens cravados */}
        {markers.map((m) => (
          <div key={m.id}
            className="absolute"
            style={{ left: m.x, top: m.y, transform: "translate(-50%,-50%)", width: 22, height: 22, filter: m.ring < 0 ? "grayscale(1) opacity(0.6)" : "drop-shadow(0 2px 3px rgba(0,0,0,0.6))" }}>
            {config.shuriken_image_url ? (
              <img src={config.shuriken_image_url} className="w-full h-full object-contain" alt="" />
            ) : (
              <svg viewBox="-10 -10 20 20" className="w-full h-full">
                <g fill="#c8ccd3" stroke="#111" strokeWidth="0.6">
                  <polygon points="0,-9 2.4,-2 9,0 2.4,2 0,9 -2.4,2 -9,0 -2.4,-2" />
                  <circle cx="0" cy="0" r="1.5" fill="#111" />
                </g>
              </svg>
            )}
          </div>
        ))}

        {/* Mira (crosshair oscilando com o vento) */}
        {running && !done && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: aim.x, top: aim.y, transform: "translate(-50%,-50%)",
              width: cross, height: cross,
            }}
          >
            <svg viewBox="-50 -50 100 100" className="w-full h-full">
              <circle r="46" fill="none" stroke="rgba(255,90,90,0.9)" strokeWidth="2" />
              <line x1="-46" y1="0" x2="-14" y2="0" stroke="rgba(255,90,90,0.9)" strokeWidth="2" />
              <line x1="14" y1="0" x2="46" y2="0" stroke="rgba(255,90,90,0.9)" strokeWidth="2" />
              <line x1="0" y1="-46" x2="0" y2="-14" stroke="rgba(255,90,90,0.9)" strokeWidth="2" />
              <line x1="0" y1="14" x2="0" y2="46" stroke="rgba(255,90,90,0.9)" strokeWidth="2" />
              <circle r="2" fill="rgba(255,90,90,0.9)" />
            </svg>
          </div>
        )}

        {/* Cover start */}
        {!running && !done && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <div className="text-center space-y-3 p-4 max-w-md">
              <div className="text-gold font-display text-2xl">Alvo do Shuriken</div>
              <p className="text-sm text-muted-foreground">
                Uma brisa move a sua mira. Clique/toque para lançar — mire no centro do alvo.
                Você tem <strong>{throws}</strong> lançamentos e {duration}s.
              </p>
              <Button onClick={(e) => { e.stopPropagation(); startedAt.current = performance.now(); setRunning(true); }}>
                Começar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Centro: {rings[0]} · Amarelo: {rings[1]} · Vermelho: {rings[2]} · Externo: {rings[3]}</span>
        <span>Objetivo: {targetScore} pts</span>
      </div>
    </div>
  );
}