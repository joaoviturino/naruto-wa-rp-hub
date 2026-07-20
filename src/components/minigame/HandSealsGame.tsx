import { useEffect, useMemo, useRef, useState } from "react";

export const HAND_SEALS: Array<{ key: string; jp: string; pt: string; emoji: string }> = [
  { key: "ne", jp: "Ne", pt: "Rato", emoji: "🐀" },
  { key: "ushi", jp: "Ushi", pt: "Boi", emoji: "🐂" },
  { key: "tora", jp: "Tora", pt: "Tigre", emoji: "🐅" },
  { key: "u", jp: "U", pt: "Coelho", emoji: "🐇" },
  { key: "tatsu", jp: "Tatsu", pt: "Dragão", emoji: "🐉" },
  { key: "mi", jp: "Mi", pt: "Serpente", emoji: "🐍" },
  { key: "uma", jp: "Uma", pt: "Cavalo", emoji: "🐎" },
  { key: "hitsuji", jp: "Hitsuji", pt: "Carneiro", emoji: "🐏" },
  { key: "saru", jp: "Saru", pt: "Macaco", emoji: "🐒" },
  { key: "tori", jp: "Tori", pt: "Galo", emoji: "🐓" },
  { key: "inu", jp: "Inu", pt: "Cão", emoji: "🐕" },
  { key: "i", jp: "I", pt: "Javali", emoji: "🐖" },
];

function playSound(url: string | null | undefined) {
  if (!url) return;
  try { const a = new Audio(url); a.volume = 0.6; a.play().catch(() => {}); } catch {}
}

type Config = {
  seal_time_ms?: number;
  max_mistakes?: number;
  show_hint?: boolean;
  sequence?: string[];
  seal_images?: Record<string, string>;
  background_url?: string | null;
  correct_sound_url?: string | null;
  wrong_sound_url?: string | null;
  success_sound_url?: string | null;
};

export function HandSealsGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: Config;
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const sealTime = Math.max(400, Number(config.seal_time_ms) || 1600);
  const maxMistakes = Math.max(0, Number(config.max_mistakes) || 2);
  const showHint = config.show_hint !== false;
  const sequence = useMemo(
    () => (Array.isArray(config.sequence) ? config.sequence.filter((k) => HAND_SEALS.some((s) => s.key === k)) : []),
    [config.sequence],
  );
  const images = config.seal_images ?? {};
  const bg = config.background_url ?? background ?? null;

  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [remaining, setRemaining] = useState(sealTime);
  const [flash, setFlash] = useState<{ key: string; ok: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const startRef = useRef<number>(Date.now());

  useEffect(() => { setRemaining(sealTime); }, [idx, sealTime]);

  useEffect(() => {
    if (done || sequence.length === 0) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 60) {
          clearInterval(t);
          registerMistake();
          return sealTime;
        }
        return r - 60;
      });
    }, 60);
    return () => clearInterval(t);
  }, [idx, done, sequence.length]);

  function finish(success: boolean) {
    if (done) return;
    setDone(true);
    const elapsed = Date.now() - startRef.current;
    const timeBonus = Math.max(0, sequence.length * sealTime - elapsed) / 100;
    const score = Math.max(0, Math.round(idx * 10 - mistakes * 5 + (success ? timeBonus : 0)));
    if (success) playSound(config.success_sound_url);
    onFinish({ score, success });
  }

  function registerMistake() {
    playSound(config.wrong_sound_url);
    const m = mistakes + 1;
    setMistakes(m);
    setFlash({ key: "__miss__", ok: false });
    setTimeout(() => setFlash(null), 250);
    if (m > maxMistakes) setTimeout(() => finish(false), 300);
  }

  function press(key: string) {
    if (done || sequence.length === 0) return;
    const expected = sequence[idx];
    if (key === expected) {
      playSound(config.correct_sound_url);
      setFlash({ key, ok: true });
      setTimeout(() => setFlash(null), 180);
      const ni = idx + 1;
      if (ni >= sequence.length) setTimeout(() => finish(true), 200);
      else setIdx(ni);
    } else {
      setFlash({ key, ok: false });
      setTimeout(() => setFlash(null), 220);
      const m = mistakes + 1;
      setMistakes(m);
      if (m > maxMistakes) setTimeout(() => finish(false), 300);
    }
  }

  const expected = sequence[idx];
  const expectedSeal = HAND_SEALS.find((s) => s.key === expected);
  const pct = Math.max(0, Math.min(100, (remaining / sealTime) * 100));

  if (sequence.length === 0) {
    return <div className="text-xs text-red-400 p-4">Nenhuma sequência de selos configurada.</div>;
  }

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between text-sm">
        <span>Progresso: <b className="text-gold">{idx}/{sequence.length}</b></span>
        <span>Erros: <b className={mistakes > maxMistakes ? "text-red-400" : "text-gold"}>{mistakes}/{maxMistakes}</b></span>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border p-4 flex flex-col items-center gap-3"
        style={{ aspectRatio: "16/10", background: bg ? `url(${bg}) center/cover no-repeat` : "linear-gradient(180deg,#0b1220,#131a2a)" }}>
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-1">
          <div className="text-[10px] uppercase tracking-widest text-gold/80">Próximo selo</div>
          <div className={`w-28 h-28 md:w-32 md:h-32 rounded-2xl border-2 flex flex-col items-center justify-center bg-black/60 ${flash?.ok ? "border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)]" : flash && !flash.ok ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]" : "border-gold"}`}>
            {expectedSeal && (
              images[expectedSeal.key]
                ? <img src={images[expectedSeal.key]} alt={expectedSeal.jp} className="w-20 h-20 object-contain" />
                : <span className="text-5xl md:text-6xl leading-none">{expectedSeal.emoji}</span>
            )}
            {showHint && expectedSeal && <div className="text-[10px] text-gold mt-1">{expectedSeal.jp}</div>}
          </div>
          <div className="w-40 h-1.5 rounded bg-white/10 overflow-hidden mt-1">
            <div className="h-full bg-gold transition-[width] duration-75" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="relative z-10 mt-auto grid grid-cols-4 md:grid-cols-6 gap-2 w-full max-w-2xl">
          {HAND_SEALS.map((s) => {
            const isFlash = flash?.key === s.key;
            return (
              <button key={s.key} type="button" onClick={() => press(s.key)}
                className={`aspect-square rounded-xl border bg-black/50 hover:bg-black/40 active:scale-95 transition flex flex-col items-center justify-center gap-0.5
                  ${isFlash && flash.ok ? "border-emerald-400 bg-emerald-500/20" : isFlash ? "border-red-500 bg-red-500/20" : "border-white/15"}`}>
                {images[s.key]
                  ? <img src={images[s.key]} alt={s.jp} className="w-8 h-8 md:w-10 md:h-10 object-contain" />
                  : <span className="text-2xl md:text-3xl leading-none">{s.emoji}</span>}
                <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/70">{s.jp}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {sequence.map((k, i) => {
          const seal = HAND_SEALS.find((s) => s.key === k);
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <div key={i}
              className={`w-7 h-7 rounded flex items-center justify-center text-sm border ${state === "done" ? "bg-emerald-500/30 border-emerald-400" : state === "current" ? "bg-gold/20 border-gold" : "bg-black/30 border-white/10"}`}
              title={seal?.pt}>
              {seal?.emoji}
            </div>
          );
        })}
      </div>
    </div>
  );
}