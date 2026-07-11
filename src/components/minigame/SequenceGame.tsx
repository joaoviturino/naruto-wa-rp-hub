import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Tile = { slot: number; image_url: string; correct: boolean; order: number | null; description?: string | null };

export function SequenceGame({
  background, config, onFinish,
}: {
  background: string | null;
  config: { duration_seconds?: number; max_mistakes?: number; tiles?: Tile[] };
  onFinish: (r: { score: number; success: boolean }) => void;
}) {
  const duration = Math.max(10, config.duration_seconds ?? 60);
  const maxMistakes = Math.max(0, config.max_mistakes ?? 2);
  const tiles: Tile[] = Array.isArray(config.tiles) ? config.tiles : [];

  const correctSeq = useMemo(
    () => tiles.filter((t) => t.correct && t.order != null).sort((a, b) => (a.order! - b.order!)),
    [tiles],
  );
  const [nextIdx, setNextIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [okFlash, setOkFlash] = useState<Set<number>>(new Set());
  const [remaining, setRemaining] = useState(duration);
  const [done, setDone] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (done) return;
    if (remaining <= 0) { finish(false); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, done]);

  function finish(success: boolean) {
    if (done) return;
    setDone(true);
    const score = nextIdx * 10 - mistakes * 5;
    onFinish({ score: Math.max(0, score), success });
  }

  function onClick(slot: number) {
    if (done) return;
    const tile = tiles.find((t) => t.slot === slot);
    if (!tile?.image_url) return;
    const expected = correctSeq[nextIdx];
    if (tile.correct && expected && tile.slot === expected.slot) {
      const s = new Set(okFlash); s.add(slot); setOkFlash(s);
      const ni = nextIdx + 1;
      setNextIdx(ni);
      if (ni >= correctSeq.length) setTimeout(() => finish(true), 350);
    } else {
      setWrongFlash(slot);
      setTimeout(() => setWrongFlash(null), 400);
      const m = mistakes + 1;
      setMistakes(m);
      if (m > maxMistakes) setTimeout(() => finish(false), 400);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>Tempo: <b className="text-gold">{remaining}s</b></span>
        <span>Erros: <b className={mistakes > maxMistakes ? "text-red-400" : "text-gold"}>{mistakes}/{maxMistakes}</b></span>
        <span>Progresso: <b className="text-gold">{nextIdx}/{correctSeq.length}</b></span>
      </div>
      <div className="relative rounded-lg overflow-hidden border border-border" style={{ aspectRatio: "1 / 1", background: background ? `url(${background}) center/cover no-repeat` : "hsl(var(--secondary))" }}>
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-1 p-1">
          {Array.from({ length: 16 }, (_, slot) => {
            const t = tiles.find((x) => x.slot === slot);
            const ok = okFlash.has(slot);
            const wrong = wrongFlash === slot;
            return (
              <button key={slot} onClick={() => onClick(slot)}
                onMouseEnter={() => setHovered(slot)} onMouseLeave={() => setHovered((s) => s === slot ? null : s)}
                title={t?.description ?? ""}
                disabled={!t?.image_url || done}
                className={`rounded overflow-hidden flex items-center justify-center transition
                  ${t?.image_url ? "bg-black/30 hover:ring-2 hover:ring-gold" : "bg-transparent"}
                  ${ok ? "ring-2 ring-emerald-400" : ""} ${wrong ? "ring-2 ring-red-500" : ""}`}>
                {t?.image_url && <img src={t.image_url} className="w-full h-full object-cover" alt="" />}
              </button>
            );
          })}
        </div>
        {hovered != null && tiles.find((x) => x.slot === hovered)?.description && (
          <div className="absolute left-2 right-2 bottom-2 rounded bg-black/70 text-white text-xs px-2 py-1 pointer-events-none">
            {tiles.find((x) => x.slot === hovered)?.description}
          </div>
        )}
      </div>
      {correctSeq.length === 0 && (
        <div className="text-xs text-red-400">Este minigame ainda não tem tiles corretos configurados.</div>
      )}
    </div>
  );
}
