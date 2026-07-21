import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Cfg = {
  rounds?: number;
  base_targets?: number;   // alvos na primeira rodada
  grow_per_round?: number; // +alvos por rodada
  round_time_ms?: number;  // tempo por rodada
  target_size?: number;
  max_mistakes?: number;   // rodadas perdidas
  difficulty?: number;
  background_url?: string | null;
  target_image_url?: string | null;
  shuriken_image_url?: string | null;
  hit_sound_url?: string | null;
  success_sound_url?: string | null;
  fail_sound_url?: string | null;
};

type Dot = { id: number; x: number; y: number; hit: boolean };

const W = 640;
const H = 420;

let ac: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  if (!ac) { try { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { ac = null; } }
  return ac;
}
function beep(freq: number, dur: number, gain = 0.25, type: OscillatorType = "square") {
  const ctx = audio(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + dur + 0.02);
}
function playHit(url?: string | null) { if (url) { try { const a = new Audio(url); a.volume = 0.6; a.play().catch(() => {}); return; } catch {} } beep(360, 0.12); }
function playWin(url?: string | null) { if (url) { try { const a = new Audio(url); a.volume = 0.7; a.play().catch(() => {}); return; } catch {} } beep(660, 0.12); setTimeout(() => beep(880, 0.16, 0.28, "triangle"), 90); }
function playFail(url?: string | null) { if (url) { try { const a = new Audio(url); a.volume = 0.5; a.play().catch(() => {}); return; } catch {} } beep(180, 0.22, 0.25, "sawtooth"); }

export function ShurikenMultiGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: Cfg;
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const difficulty = Math.max(1, Math.min(5, config.difficulty ?? 2));
  const rounds = Math.max(1, Math.min(20, config.rounds ?? 5));
  const baseTargets = Math.max(2, Math.min(12, config.base_targets ?? 3));
  const grow = Math.max(0, Math.min(4, config.grow_per_round ?? 1));
  const roundTime = Math.max(800, Math.min(15000, config.round_time_ms ?? Math.max(1500, 3500 - difficulty * 300)));
  const size = Math.max(28, Math.min(120, config.target_size ?? Math.max(38, 72 - difficulty * 5)));
  const maxMistakes = Math.max(0, Math.min(10, config.max_mistakes ?? 2));
  const bg = background ?? config.background_url ?? null;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(1);
  const [round, setRound] = useState(0);      // 0 = not started
  const [dots, setDots] = useState<Dot[]>([]);
  const [msLeft, setMsLeft] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const roundEndAt = useRef(0);
  const [phase, setPhase] = useState<"idle" | "prep" | "play" | "review">("idle");

  useEffect(() => {
    if (!running || done || phase !== "play") return;
    let raf = 0;
    function tick() {
      const left = Math.max(0, roundEndAt.current - performance.now());
      setMsLeft(left);
      if (left <= 0) endRound(false);
      else raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, done, phase]);

  function nextRound(current: number) {
    const idx = current + 1;
    if (idx > rounds) return finish(true);
    setRound(idx);
    const count = baseTargets + grow * (idx - 1);
    // gera pontos evitando sobreposição básica
    const arr: Dot[] = [];
    const min = size * 0.9;
    let guard = 0;
    while (arr.length < count && guard < 400) {
      guard++;
      const x = size / 2 + 20 + Math.random() * (W - size - 40);
      const y = size / 2 + 20 + Math.random() * (H - size - 40);
      if (arr.every((d) => Math.hypot(d.x - x, d.y - y) > min)) {
        arr.push({ id: idRef.current++, x, y, hit: false });
      }
    }
    setDots(arr);
    setPhase("prep");
    setTimeout(() => {
      roundEndAt.current = performance.now() + roundTime;
      setPhase("play");
    }, 700);
  }

  function endRound(force: boolean) {
    const remaining = dots.filter((d) => !d.hit).length;
    if (remaining > 0) {
      playFail(config.fail_sound_url);
      setMistakes((m) => {
        const nm = m + 1;
        if (nm > maxMistakes) { setTimeout(() => finish(false), 60); return nm; }
        setPhase("review");
        setTimeout(() => nextRound(round), 900);
        return nm;
      });
    } else {
      playWin(config.success_sound_url);
      setPhase("review");
      setTimeout(() => nextRound(round), 700);
    }
  }

  function shoot(e: React.PointerEvent) {
    if (!running || done || phase !== "play") return;
    const el = stageRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const sy = (e.clientY - rect.top) * (H / rect.height);
    let idx = -1;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (d.hit) continue;
      if (Math.hypot(d.x - sx, d.y - sy) <= size / 2) { idx = i; break; }
    }
    if (idx < 0) return;
    const next = dots.slice();
    next[idx] = { ...next[idx], hit: true };
    setDots(next);
    playHit(config.hit_sound_url);
    setTotalHits((t) => t + 1);
    if (next.every((d) => d.hit)) endRound(false);
  }

  function finish(_ok: boolean) {
    if (done) return;
    setDone(true); setRunning(false);
    const success = mistakes <= maxMistakes && round >= rounds && dots.every((d) => d.hit);
    setTimeout(() => onFinish({ score: totalHits, success }), 60);
  }

  const roundTargets = baseTargets + grow * Math.max(0, round - 1);

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="px-2 py-1 rounded bg-secondary">Rodada {Math.max(round, 1)} / {rounds}</div>
        <div className="px-2 py-1 rounded bg-secondary">Alvos {dots.filter((d) => !d.hit).length} / {roundTargets || baseTargets}</div>
        <div className="px-2 py-1 rounded bg-secondary text-red-300">✕ {mistakes} / {maxMistakes}</div>
        <div className="ml-auto px-2 py-1 rounded bg-secondary">⏱ {phase === "play" ? (msLeft / 1000).toFixed(1) : "--"}s</div>
      </div>

      <div
        ref={stageRef}
        onPointerDown={shoot}
        style={{
          width: "100%", maxWidth: W, aspectRatio: `${W} / ${H}`,
          backgroundImage: bg ? `url(${bg})` : undefined, backgroundSize: "cover", backgroundPosition: "center",
          background: bg ? undefined : "radial-gradient(circle at 50% 40%, #2a1b12, #0a0806 70%)",
        }}
        className="relative mx-auto rounded-lg overflow-hidden border border-gold/40 cursor-crosshair select-none touch-none"
      >
        {dots.map((d) => (
          <div key={d.id}
            className="absolute"
            style={{
              left: (d.x / W) * 100 + "%", top: (d.y / H) * 100 + "%",
              width: (size / W) * 100 + "%", aspectRatio: "1 / 1",
              transform: "translate(-50%,-50%)",
              opacity: d.hit ? 0.35 : 1,
              transition: "opacity 0.2s ease-out",
              filter: phase === "prep" ? "brightness(1.4)" : undefined,
            }}
          >
            {config.target_image_url ? (
              <img src={config.target_image_url} className="w-full h-full object-contain" alt="" draggable={false} />
            ) : (
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="48" fill="#f5f1e2" stroke="#111" strokeWidth="2" />
                <circle cx="50" cy="50" r="34" fill="#a11a1a" stroke="#2b1b0f" strokeWidth="2" />
                <circle cx="50" cy="50" r="18" fill="#f5c722" stroke="#2b1b0f" strokeWidth="2" />
                <circle cx="50" cy="50" r="5" fill="#111" />
              </svg>
            )}
            {d.hit && (
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

        {phase === "prep" && running && !done && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-gold font-display text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">Rajada!</div>
          </div>
        )}

        {!running && !done && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <div className="text-center space-y-3 p-4 max-w-md">
              <div className="text-gold font-display text-2xl">Kage Shuriken</div>
              <p className="text-sm text-muted-foreground">
                A cada rodada, vários alvos aparecem ao mesmo tempo. Acerte todos antes do tempo acabar —
                imitando o Kage Shuriken no Jutsu. Erros permitidos: <strong>{maxMistakes}</strong>.
              </p>
              <Button onClick={(e) => { e.stopPropagation(); setRunning(true); nextRound(0); }}>Começar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}