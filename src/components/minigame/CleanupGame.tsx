import { useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";
import { loadImageSize } from "@/lib/sprite-validate";
import { cleanupReducer, cleanupTileStyle, createCleanupState, normalizeCleanupConfig, type CleanupConfig } from "@/lib/cleanup-game";

type Props = { background: string | null; tileset: string | null; config: Partial<CleanupConfig>;
  onFinish: (result: { score: number; success: boolean }) => void };
export function CleanupGame(props: Props) {
  const cfg = normalizeCleanupConfig(props.config ?? {});
  // Configuration changes in the admin preview start a new, independent round.
  return <CleanupRound key={JSON.stringify([cfg, props.tileset, props.background])} {...props} config={cfg} />;
}
function CleanupRound({ background, tileset, config, onFinish }: Props & { config: CleanupConfig }) {
  const [state, dispatch] = useReducer(cleanupReducer, config, createCleanupState);
  const [atlas, setAtlas] = useState<{ cols: number; rows: number } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const finishRef = useRef(onFinish);
  const notified = useRef(false);
  finishRef.current = onFinish;
  const deadline = useRef(0);
  useEffect(() => {
    let alive = true;
    if (tileset) void loadImageSize(tileset).then(({ w, h }) => {
      if (!alive) return;
      const cols = config.tileset_cols ?? Math.max(1, Math.min(32, Math.floor(w / h)));
      const rows = config.tileset_rows ?? 1;
      if (w % cols || h % rows) { setImageFailed(true); return; }
      setAtlas({ cols, rows });
    }).catch(() => { if (alive) setImageFailed(true); });
    return () => { alive = false; };
  }, [tileset, config.tileset_cols, config.tileset_rows]);
  useEffect(() => {
    if (state.finished) return;
    deadline.current ||= Date.now() + config.duration_seconds * 1000;
    const tick = () => dispatch({ type: "tick", remaining: Math.ceil((deadline.current - Date.now()) / 1000) });
    const timer = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [state.finished, config.duration_seconds]);
  useEffect(() => {
    if (state.finished && !notified.current) {
      notified.current = true;
      finishRef.current({ score: state.score, success: state.score >= config.target_score });
    }
  }, [state.finished, state.score, config.target_score]);
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3 text-sm" role="status">
      <span>Limpeza <b className="text-gold">{state.score}/{config.spots}</b> · Meta {config.target_score}</span>
      <b className={state.remaining <= 5 ? "text-blood" : "text-gold"}>{state.remaining}s</b>
    </div>
    {imageFailed && <p className="text-sm text-amber-300">A imagem dos itens não carregou ou a grade está inválida. Você pode continuar pelos marcadores.</p>}
    <div className="relative w-full min-h-[320px] sm:aspect-video rounded-xl overflow-hidden border border-border bg-secondary select-none"
      style={background ? { backgroundImage: `url(${JSON.stringify(background)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <div className="absolute inset-6">
        {state.spots.map((spot) => <button key={spot.id} type="button" disabled={spot.cleaned || state.finished}
          aria-label={`Limpar sujeira ${spot.id + 1}`} onClick={() => {
            if (Date.now() >= deadline.current) dispatch({ type: "tick", remaining: 0 });
            else dispatch({ type: "clean", id: spot.id });
          }}
          className={`absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-md touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${spot.cleaned ? "invisible" : "hover:brightness-125"}`}
          style={{ left: `${spot.x}%`, top: `${spot.y}%`, imageRendering: "pixelated",
            ...(atlas && tileset ? { backgroundImage: `url(${JSON.stringify(tileset)})`, backgroundRepeat: "no-repeat",
              ...cleanupTileStyle(spot.variant, atlas.cols, atlas.rows) } : {}) }}>
          {!atlas && <Eraser size={28} className="m-auto rounded bg-background/90 p-1 text-gold" />}
        </button>)}
      </div>
      {state.finished && <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <div className="font-display text-2xl text-gold">{state.score >= config.target_score ? "Missão cumprida!" : "Treine e tente novamente"}</div>
        <div>Pontuação: {state.score} / {config.target_score}</div>
      </div>}
    </div>
    {!state.finished && <Button variant="outline" onClick={() => dispatch({ type: "finish" })}>Encerrar limpeza</Button>}
  </div>;
}
