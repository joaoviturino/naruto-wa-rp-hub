export type AnimState = "idle" | "run" | "punch" | "kick" | "hurt" | "cast" | "death" | "guard";
export type StateConfig = { row: number; frames: number; fps?: number; loop?: boolean };
export type StatesMap = Partial<Record<AnimState, StateConfig>>;
export type SpriteEnvironment = "neutral" | "wind" | "rain" | "water";

export const ANIM_STATE_LABEL: Record<AnimState, string> = {
  idle: "Parado", run: "Correr", punch: "Soco", kick: "Chute",
  hurt: "Receber dano", cast: "Conjurar jutsu", death: "Derrotado", guard: "Defender",
};
export const DEFAULT_STATES: StatesMap = {
  idle: { row: 0, frames: 4, fps: 6, loop: true },
  run: { row: 1, frames: 6, fps: 10, loop: true },
  punch: { row: 2, frames: 5, fps: 12, loop: false },
  kick: { row: 3, frames: 5, fps: 12, loop: false },
  hurt: { row: 4, frames: 3, fps: 10, loop: false },
  cast: { row: 5, frames: 6, fps: 10, loop: false },
  death: { row: 6, frames: 6, fps: 8, loop: false },
  guard: { row: 0, frames: 1, fps: 1, loop: false },
};

export function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}

/** Invalid/absent actions fall back to idle, never another row of the atlas. */
export function resolveSpriteState(states: StatesMap | null | undefined, state: AnimState, cols = 1, rows = 1): StateConfig {
  const c = boundedInt(cols, 1, 1, 64), r = boundedInt(rows, 1, 1, 64);
  const valid = (cfg: StateConfig | undefined) => cfg && Number.isInteger(cfg.row)
    && cfg.row >= 0 && cfg.row < r && Number.isFinite(cfg.frames) && cfg.frames >= 1;
  const cfg = valid(states?.[state]) ? states![state] : valid(states?.idle) ? states!.idle : undefined;
  return {
    row: cfg?.row ?? 0, frames: boundedInt(cfg?.frames, 1, 1, c),
    fps: boundedInt(cfg?.fps, 8, 1, 60), loop: cfg?.loop ?? (state === "idle" || state === "run"),
  };
}

/** All layers share progress, but each keeps its own atlas and number of frames. */
export function mapLayerFrame(masterFrame: number, master: StateConfig, layer: StateConfig) {
  if (master.frames <= 1 || layer.frames <= 1) return 0;
  const progress = masterFrame / (master.loop === false ? master.frames - 1 : master.frames);
  return Math.min(layer.frames - 1, Math.floor(progress * layer.frames));
}

export function atlasPosition(cols: number, rows: number, frame: number, row: number) {
  const c = boundedInt(cols, 1, 1, 64), r = boundedInt(rows, 1, 1, 64);
  const x = boundedInt(frame, 0, 0, c - 1), y = boundedInt(row, 0, 0, r - 1);
  return {
    backgroundSize: `${c * 100}% ${r * 100}%`,
    backgroundPosition: `${c === 1 ? 50 : x * 100 / (c - 1)}% ${r === 1 ? 50 : y * 100 / (r - 1)}%`,
  };
}

export function isAnimState(value: unknown): value is AnimState {
  return typeof value === "string" && Object.hasOwn(ANIM_STATE_LABEL, value);
}
export function isSpriteEnvironment(value: unknown): value is SpriteEnvironment {
  return value === "neutral" || value === "wind" || value === "rain" || value === "water";
}

/** An elemental action temporarily takes precedence over the location's ambience. */
export function resolveCombatEnvironment(scene: unknown, action?: unknown): SpriteEnvironment {
  if (isSpriteEnvironment(action) && action !== "neutral") return action;
  return isSpriteEnvironment(scene) ? scene : "neutral";
}
