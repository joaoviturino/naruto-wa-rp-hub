import { useEffect, useMemo, useRef, useState } from "react";
import { useCharacterCosmetics } from "@/hooks/useCharacterCosmetics";
import { supabase } from "@/integrations/supabase/client";

// ============================================================
// Sistema de animação por Sprite Sheet
// ============================================================
// Uma spritesheet é uma PNG única com uma grade de frames:
//   cols = colunas, rows = linhas.
// Cada "estado" (idle, run, punch, kick, hurt, cast, death) ocupa
// UMA linha inteira e usa as primeiras N frames dessa linha.
//
// Config (guardado como JSON no banco):
//   { idle: { row: 0, frames: 4, fps: 6, loop: true }, punch: { row: 2, frames: 5, fps: 12, loop: false }, ... }
//
// O corpo base do personagem e cada peça cosmética podem ter sua
// própria spritesheet — todas compartilham o mesmo relógio (frame
// index) para ficarem perfeitamente sincronizadas.
// ============================================================

export type AnimState =
  | "idle" | "run" | "punch" | "kick" | "hurt" | "cast" | "death";

export type StateConfig = { row: number; frames: number; fps?: number; loop?: boolean };
export type StatesMap = Partial<Record<AnimState, StateConfig>>;

export const DEFAULT_STATES: StatesMap = {
  idle:  { row: 0, frames: 4, fps: 6,  loop: true },
  run:   { row: 1, frames: 6, fps: 10, loop: true },
  punch: { row: 2, frames: 5, fps: 12, loop: false },
  kick:  { row: 3, frames: 5, fps: 12, loop: false },
  hurt:  { row: 4, frames: 3, fps: 10, loop: false },
  cast:  { row: 5, frames: 6, fps: 10, loop: false },
  death: { row: 6, frames: 6, fps: 8,  loop: false },
};

export const ANIM_STATE_LABEL: Record<AnimState, string> = {
  idle: "Idle (parado)", run: "Correr", punch: "Soco",
  kick: "Chute", hurt: "Recebendo dano", cast: "Poder / Cast", death: "Morte",
};

function resolveState(states: StatesMap | null | undefined, state: AnimState): StateConfig {
  const s = states?.[state];
  if (s && s.frames > 0) return { fps: 8, loop: true, ...s };
  // fallback: idle → 1 frame estático
  const idle = states?.idle;
  if (idle && idle.frames > 0) return { fps: 8, loop: true, ...idle };
  return { row: 0, frames: 1, fps: 1, loop: true };
}

// Hook: gera o frame index atual para um estado, respeitando fps/loop.
export function useSpriteFrame(state: AnimState, cfg: StateConfig, resetKey: number = 0): number {
  const [frame, setFrame] = useState(0);
  const startRef = useRef<number>(performance.now());
  useEffect(() => {
    startRef.current = performance.now();
    setFrame(0);
    const dur = 1000 / (cfg.fps || 8);
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const raw = Math.floor(elapsed / dur);
      const f = cfg.loop === false
        ? Math.min(raw, Math.max(0, cfg.frames - 1))
        : raw % Math.max(1, cfg.frames);
      setFrame(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, cfg.frames, cfg.fps, cfg.loop, resetKey]);
  return frame;
}

// Renderiza UMA camada de spritesheet posicionando `background-image`.
// Se `sheetUrl` for nulo, cai no static `fallbackUrl`.
function SheetLayer({
  sheetUrl, cols, rows, row, frame, fallbackUrl, flipX, zIndex, className, style,
}: {
  sheetUrl: string | null | undefined;
  cols: number; rows: number; row: number; frame: number;
  fallbackUrl?: string | null;
  flipX?: boolean; zIndex?: number;
  className?: string; style?: React.CSSProperties;
}) {
  if (!sheetUrl) {
    if (!fallbackUrl) return null;
    return (
      <img
        src={fallbackUrl}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full object-contain ${className ?? ""}`}
        style={{ zIndex, transform: flipX ? "scaleX(-1)" : undefined, imageRendering: "pixelated", ...style }}
      />
    );
  }
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  // porcentagens de posição do frame na sheet
  const bgPosX = c === 1 ? "50%" : `${(frame / (c - 1)) * 100}%`;
  const bgPosY = r === 1 ? "50%" : `${(row / (r - 1)) * 100}%`;
  return (
    <div
      className={`absolute inset-0 ${className ?? ""}`}
      style={{
        backgroundImage: `url(${sheetUrl})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${c * 100}% ${r * 100}%`,
        backgroundPosition: `${bgPosX} ${bgPosY}`,
        imageRendering: "pixelated",
        zIndex,
        transform: flipX ? "scaleX(-1)" : undefined,
        ...style,
      }}
    />
  );
}

// ---------- Personagem animado completo ----------
// Combina corpo base + peças cosméticas do banco, todos sincronizados.

type PieceFull = {
  slot: "hair" | "face" | "clothing" | "accessory";
  image_url: string;
  z_index: number;
  sheet_url: string | null;
  sheet_cols: number | null;
  sheet_rows: number | null;
  sheet_states: StatesMap | null;
};

// Cache local de peças com dados de sheet (não fica em useCharacterCosmetics para evitar mexer no hook base).
const piecesCache = new Map<string, PieceFull[]>();
const piecesListeners = new Map<string, Set<(v: PieceFull[]) => void>>();

async function fetchFullPieces(characterId: string) {
  const { data } = await supabase
    .from("character_cosmetics")
    .select("slot, piece:cosmetic_pieces(image_url,z_index,slot,sheet_url,sheet_cols,sheet_rows,sheet_states)")
    .eq("character_id", characterId);
  const list: PieceFull[] = ((data ?? []) as any[])
    .map((r) => r.piece ? {
      slot: r.piece.slot,
      image_url: r.piece.image_url,
      z_index: r.piece.z_index ?? 0,
      sheet_url: r.piece.sheet_url ?? null,
      sheet_cols: r.piece.sheet_cols ?? null,
      sheet_rows: r.piece.sheet_rows ?? null,
      sheet_states: r.piece.sheet_states ?? null,
    } : null)
    .filter(Boolean) as PieceFull[];
  list.sort((a, b) => a.z_index - b.z_index);
  piecesCache.set(characterId, list);
  piecesListeners.get(characterId)?.forEach((cb) => cb(list));
}

function useFullCosmetics(characterId: string | null | undefined): PieceFull[] {
  const [pieces, setPieces] = useState<PieceFull[]>(() =>
    characterId ? piecesCache.get(characterId) ?? [] : [],
  );
  // Reage a mudanças básicas de cosméticos equipados (para invalidar).
  const light = useCharacterCosmetics(characterId ?? null);
  const sig = light.map((p) => p.image_url).join("|");
  useEffect(() => {
    if (!characterId) { setPieces([]); return; }
    if (!piecesListeners.has(characterId)) piecesListeners.set(characterId, new Set());
    const set = piecesListeners.get(characterId)!;
    const cb = (v: PieceFull[]) => setPieces(v);
    set.add(cb);
    if (piecesCache.has(characterId)) setPieces(piecesCache.get(characterId)!);
    void fetchFullPieces(characterId);
    return () => { set.delete(cb); };
  }, [characterId, sig]);
  return pieces;
}

export type BodyConfig = {
  // corpo base (fallback estático quando não há sheet)
  imageUrl?: string | null;
  sheetUrl?: string | null;
  cols?: number | null;
  rows?: number | null;
  states?: StatesMap | null;
};

/**
 * Personagem completo com camadas animadas sincronizadas.
 * O corpo base + cada peça cosmética são renderizados como camadas
 * na MESMA grade (mesmo aspect ratio) e compartilham o frame index.
 */
export function AnimatedCharacter({
  characterId,
  body,
  state = "idle",
  flipX = false,
  className = "",
  style,
}: {
  characterId?: string | null;
  body: BodyConfig;
  state?: AnimState;
  flipX?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const pieces = useFullCosmetics(characterId ?? null);

  // Config do corpo dita o "relógio mestre" — todas as camadas usam o
  // MESMO frame index para ficarem sincronizadas.
  const masterCfg = useMemo(
    () => resolveState(body.states ?? DEFAULT_STATES, state),
    [body.states, state],
  );
  const frame = useSpriteFrame(state, masterCfg);

  const hasBodySheet = !!(body.sheetUrl && body.cols && body.rows);
  const cols = body.cols ?? 1;
  const rows = body.rows ?? 1;

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Camada base: corpo */}
      <SheetLayer
        sheetUrl={hasBodySheet ? body.sheetUrl! : null}
        cols={cols}
        rows={rows}
        row={masterCfg.row}
        frame={frame}
        fallbackUrl={body.imageUrl ?? null}
        flipX={flipX}
        zIndex={0}
      />
      {/* Camadas cosméticas */}
      {pieces.map((p, i) => {
        const cfg = resolveState(p.sheet_states ?? body.states ?? DEFAULT_STATES, state);
        const pieceHasOwnSheet = !!(p.sheet_url && p.sheet_cols && p.sheet_rows);
        // Se a peça tem sheet própria, usa a config da peça.
        // Senão, tratamos a image_url da peça como spritesheet usando a MESMA
        // grade/estados do corpo — assim toda camada anima em sincronia com o
        // sprite base, sem exceção.
        const pieceSheetUrl = pieceHasOwnSheet ? p.sheet_url : (hasBodySheet ? p.image_url : null);
        const pieceCols = pieceHasOwnSheet ? p.sheet_cols! : cols;
        const pieceRows = pieceHasOwnSheet ? p.sheet_rows! : rows;
        const pieceRow = pieceHasOwnSheet ? cfg.row : masterCfg.row;
        return (
          <SheetLayer
            key={`${p.slot}-${i}`}
            sheetUrl={pieceSheetUrl}
            cols={pieceCols}
            rows={pieceRows}
            row={pieceRow}
            frame={frame}
            fallbackUrl={p.image_url}
            flipX={flipX}
            zIndex={10 + p.z_index}
          />
        );
      })}
    </div>
  );
}

/**
 * Versão simples: apenas 1 spritesheet sem camadas cosméticas.
 * Útil para NPCs.
 */
export function AnimatedSprite({
  sheetUrl, cols, rows, states, state = "idle",
  fallbackUrl, flipX = false, className = "", style,
}: {
  sheetUrl?: string | null;
  cols?: number | null;
  rows?: number | null;
  states?: StatesMap | null;
  state?: AnimState;
  fallbackUrl?: string | null;
  flipX?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cfg = useMemo(() => resolveState(states ?? DEFAULT_STATES, state), [states, state]);
  const frame = useSpriteFrame(state, cfg);
  const hasSheet = !!(sheetUrl && cols && rows);
  return (
    <div className={`relative ${className}`} style={style}>
      <SheetLayer
        sheetUrl={hasSheet ? sheetUrl! : null}
        cols={cols ?? 1}
        rows={rows ?? 1}
        row={cfg.row}
        frame={frame}
        fallbackUrl={fallbackUrl}
        flipX={flipX}
        zIndex={0}
      />
    </div>
  );
}