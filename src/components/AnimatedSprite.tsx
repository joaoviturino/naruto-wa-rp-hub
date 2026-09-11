import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useCharacterCosmetics, type EquippedPiece } from "@/hooks/useCharacterCosmetics";
import { useReducedGameMotion } from "@/hooks/useGamePreferences";
import { loadImageSize } from "@/lib/sprite-validate";
import { atlasPosition, DEFAULT_STATES, mapLayerFrame, resolveSpriteState,
  type AnimState, type StateConfig, type StatesMap, type SpriteEnvironment } from "@/lib/sprite-animation";
export { DEFAULT_STATES, ANIM_STATE_LABEL } from "@/lib/sprite-animation";
export type { AnimState, StateConfig, StatesMap } from "@/lib/sprite-animation";

// A static sprite has no timer. Non-looping actions stop on their final frame.
// Hidden tabs and offscreen characters do no animation work.
export function useSpriteFrame(state: AnimState, cfg: StateConfig, resetKey = 0, enabled = true): number {
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const lastReset = useRef("");
  useEffect(() => {
    const key = `${state}:${cfg.row}:${cfg.frames}:${cfg.fps}:${cfg.loop}:${resetKey}`;
    if (lastReset.current !== key) { frameRef.current = 0; setFrame(0); lastReset.current = key; }
    if (!enabled || cfg.frames <= 1) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current = frameRef.current;
    const fps = Math.max(1, Math.min(60, cfg.fps || 8));
    const interval = 1000 / Math.min(30, fps);
    // Preserve authored timing above 30 FPS by sampling frames instead of slowing the action.
    const step = fps * interval / 1000;
    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden || (cfg.loop === false && current >= cfg.frames - 1)) return;
      timer = setTimeout(() => {
        current = cfg.loop === false ? Math.min(current + step, cfg.frames - 1) : (current + step) % cfg.frames;
        frameRef.current = current;
        setFrame(Math.floor(current));
        schedule();
      }, interval);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); };
  }, [state, cfg.row, cfg.frames, cfg.fps, cfg.loop, resetKey, enabled]);
  return frame;
}

function useSpriteViewport(ref: RefObject<HTMLDivElement | null>, image: string | null | undefined, cols = 1, rows = 1) {
  const [visible, setVisible] = useState(true);
  const [aspect, setAspect] = useState(1);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    let alive = true;
    setAspect(1);
    if (image) void loadImageSize(image).then(({ w, h }) => {
      if (alive) setAspect((w / Math.max(1, cols)) / (h / Math.max(1, rows)));
    }).catch(() => {});
    return () => { alive = false; };
  }, [image, cols, rows]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setBox({ width, height });
    });
    observer.observe(el);
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    intersection.observe(el);
    return () => { observer.disconnect(); intersection.disconnect(); };
  }, [ref]);
  const width = box ? Math.min(box.width, box.height * aspect) : undefined;
  return { visible, size: width ? { width, height: width / aspect } : { width: "100%", height: "100%" } };
}

const SheetLayer = memo(function SheetLayer({ sheetUrl, cols, rows, row, frame, fallbackUrl, zIndex = 0,
  slot, environment = "neutral", state = "idle", }:
  { sheetUrl?: string | null; cols: number; rows: number; row: number; frame: number;
    fallbackUrl?: string | null; zIndex?: number; slot?: string; environment?: SpriteEnvironment;
    state?: AnimState }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (sheetUrl) void loadImageSize(sheetUrl).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [sheetUrl, fallbackUrl]);
  if (!sheetUrl && (!fallbackUrl || failed)) return null;
  const style: CSSProperties = { zIndex, imageRendering: "pixelated" };
  return <div className="absolute inset-0 sprite-layer" data-slot={slot} data-environment={environment}
    data-action={state} style={style}>
    {sheetUrl && !failed ? <div className="absolute inset-0" style={{ ...atlasPosition(cols, rows, frame, row),
      backgroundImage: `url(${JSON.stringify(sheetUrl)})`, backgroundRepeat: "no-repeat" }} />
      : fallbackUrl ? <img src={fallbackUrl} alt="" draggable={false} decoding="async" onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-contain" /> : null}
  </div>;
});

export type BodyConfig = { imageUrl?: string | null; sheetUrl?: string | null;
  cols?: number | null; rows?: number | null; states?: StatesMap | null };

export function AnimatedCharacter({ characterId, body, state = "idle", flipX = false, className = "", style,
  pieces: previewPieces, environment = "neutral", restartKey = 0, chakraColor = "#69c7ff", motion = true, frameOverride, }:
  { characterId?: string | null; body: BodyConfig; state?: AnimState; flipX?: boolean;
    className?: string; style?: CSSProperties; pieces?: EquippedPiece[];
    environment?: SpriteEnvironment; restartKey?: number; chakraColor?: string; motion?: boolean; frameOverride?: number }) {
  // Preview data requires no extra database subscriptions.
  const equipped = useCharacterCosmetics(previewPieces ? null : characterId);
  const pieces = previewPieces ?? equipped;
  const hasSheet = !!(body.sheetUrl && body.cols && body.rows);
  const cols = body.cols ?? 1, rows = body.rows ?? 1;
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedGameMotion();
  const { visible, size } = useSpriteViewport(ref, hasSheet ? body.sheetUrl : body.imageUrl, hasSheet ? cols : 1, hasSheet ? rows : 1);
  const bodyCfg = useMemo(() => resolveSpriteState(body.states ?? (hasSheet ? DEFAULT_STATES : null), state,
    hasSheet ? cols : 1, hasSheet ? rows : 1), [body.states, hasSheet, state, cols, rows]);
  const layers = useMemo(() => pieces.map((p) => ({ ...p, cfg: resolveSpriteState(p.sheet_states,
    state, p.sheet_cols ?? 1, p.sheet_rows ?? 1) })), [pieces, state]);
  // Clothing can animate even over a static body; never treat a static PNG as a sheet.
  const master = layers.reduce((best, p) => p.sheet_url && p.cfg.frames > best.frames ? p.cfg : best, bodyCfg);
  const frame = useSpriteFrame(state, master, restartKey, visible && !reduced && motion && frameOverride === undefined);
  const displayFrame = frameOverride ?? frame;
  const procedural = !hasSheet || !body.states?.[state];
  return <div ref={ref} className={`relative flex items-center justify-center ${className}`} style={style}
    data-sprite-state={state} data-sprite-motion={visible && !reduced && motion ? "on" : "off"}>
    <div className="relative shrink-0" style={{ ...size, transform: flipX ? "scaleX(-1)" : undefined }}>
      <div key={`${state}-${restartKey}`} className={`absolute inset-0 sprite-pose ${procedural ? `sprite-pose-${state}` : ""}`}
        style={{ "--chakra-color": chakraColor } as CSSProperties}>
        <SheetLayer sheetUrl={hasSheet ? body.sheetUrl : null} cols={cols} rows={rows}
          row={bodyCfg.row} frame={mapLayerFrame(displayFrame, master, bodyCfg)} fallbackUrl={body.imageUrl} />
        {layers.map((p) => <SheetLayer key={p.id ?? p.slot} sheetUrl={p.sheet_url && p.sheet_cols && p.sheet_rows ? p.sheet_url : null}
          cols={p.sheet_cols ?? 1} rows={p.sheet_rows ?? 1} row={p.cfg.row}
          frame={mapLayerFrame(displayFrame, master, p.cfg)} fallbackUrl={p.image_url}
          zIndex={10 + p.z_index} slot={p.slot} state={state} environment={environment} />)}
      </div>
    </div>
  </div>;
}

export function AnimatedSprite({ sheetUrl, cols, rows, states, state = "idle", fallbackUrl, flipX = false,
  className = "", style, restartKey = 0, motion = true, frameOverride }:
  { sheetUrl?: string | null; cols?: number | null; rows?: number | null; states?: StatesMap | null;
    state?: AnimState; fallbackUrl?: string | null; flipX?: boolean; className?: string; style?: CSSProperties;
    restartKey?: number; motion?: boolean; frameOverride?: number }) {
  return <AnimatedCharacter body={{ imageUrl: fallbackUrl, sheetUrl, cols, rows, states }} pieces={[]}
    state={state} flipX={flipX} className={className} style={style} restartKey={restartKey} motion={motion} frameOverride={frameOverride} />;
}
