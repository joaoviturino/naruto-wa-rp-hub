import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Config = { duration_seconds: number; spots: number; target_score: number };
type Spot = { id: number; x: number; y: number; tile: number; cleaned: boolean };

export function CleanupGame({
  background, tileset, config, onFinish,
}: {
  background: string | null;
  tileset: string | null;
  config: Config;
  onFinish: (result: { score: number; success: boolean }) => void;
}) {
  const cfg: Config = {
    duration_seconds: Math.max(15, Math.min(600, config?.duration_seconds ?? 60)),
    spots: Math.max(3, Math.min(40, config?.spots ?? 12)),
    target_score: Math.max(1, Math.min(40, config?.target_score ?? 8)),
  };
  const [tileCount, setTileCount] = useState(3);
  const [tileW, setTileW] = useState(1);
  const [tileH, setTileH] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState(cfg.duration_seconds);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Descobre quantos tiles horizontais o tileset tem (assume tiles quadrados).
  useEffect(() => {
    if (!tileset) { setTileCount(3); return; }
    const img = new Image();
    img.onload = () => {
      const h = img.naturalHeight || 1;
      const w = img.naturalWidth || 1;
      const count = Math.max(1, Math.round(w / h));
      setTileCount(count);
      setTileW(w);
      setTileH(h);
    };
    img.src = tileset;
  }, [tileset]);

  // Gera spots aleatórios uma vez.
  useMemo(() => {
    const arr: Spot[] = [];
    for (let i = 0; i < cfg.spots; i++) {
      arr.push({
        id: i,
        x: 5 + Math.random() * 90,
        y: 10 + Math.random() * 80,
        tile: Math.floor(Math.random() * tileCount),
        cleaned: false,
      });
    }
    setSpots(arr);
  }, [tileCount, cfg.spots]);

  // Timer
  useEffect(() => {
    if (finished) return;
    if (remaining <= 0) { setFinished(true); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, finished]);

  useEffect(() => {
    if (finished) onFinish({ score, success: score >= cfg.target_score });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function click(s: Spot) {
    if (finished || s.cleaned) return;
    setSpots((prev) => prev.map((x) => x.id === s.id ? { ...x, cleaned: true } : x));
    setScore((v) => v + 1);
  }

  const cleaned = spots.filter((s) => s.cleaned).length;
  const target = cfg.target_score;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div><span className="text-muted-foreground">Sujeira limpa:</span> <b className="text-gold">{cleaned}</b> / {cfg.spots} <span className="text-muted-foreground">(alvo {target})</span></div>
        <div><span className="text-muted-foreground">Tempo:</span> <b className={remaining <= 5 ? "text-blood" : "text-gold"}>{remaining}s</b></div>
      </div>
      <div ref={stageRef} className="relative w-full aspect-video bg-black rounded overflow-hidden border border-border select-none"
        style={background ? { backgroundImage: `url(${background})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        {spots.map((s) => (
          <button key={s.id} onClick={() => click(s)}
            className={`absolute transition-all ${s.cleaned ? "opacity-0 scale-50 pointer-events-none" : "opacity-100 hover:scale-110"}`}
            style={{
              left: `${s.x}%`, top: `${s.y}%`, width: 48, height: 48, transform: "translate(-50%,-50%)",
              backgroundImage: tileset ? `url(${tileset})` : undefined,
              backgroundSize: `${(tileCount * 48)}px 48px`,
              backgroundPosition: `${-s.tile * 48}px 0`,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))",
            }}
            aria-label="limpar" />
        ))}
        {finished && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
            <div className="font-display text-3xl text-gold">{score >= target ? "Trabalho impecável!" : "Não foi dessa vez…"}</div>
            <div className="text-sm text-muted-foreground">Pontuação: {score} / {target}</div>
          </div>
        )}
      </div>
      {!finished && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setFinished(true)}>Encerrar</Button>
        </div>
      )}
    </div>
  );
}
// Suppress unused warning for setters used only in future extensions
void tileW; void tileH;