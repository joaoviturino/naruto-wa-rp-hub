import { z } from "zod";
import { atlasPosition, boundedInt } from "./sprite-animation";

export const cleanupConfigSchema = z.object({
  duration_seconds: z.number().int().min(15).max(600).default(60),
  spots: z.number().int().min(3).max(40).default(12),
  target_score: z.number().int().min(1).max(40).default(8),
  tileset_cols: z.number().int().min(1).max(32).optional(),
  tileset_rows: z.number().int().min(1).max(32).optional(),
}).refine((c) => c.target_score <= c.spots, { message: "O alvo não pode exceder o número de sujeiras.", path: ["target_score"] });
export type CleanupConfig = z.infer<typeof cleanupConfigSchema>;
export type CleanupSpot = { id: number; x: number; y: number; variant: number; cleaned: boolean };
export type CleanupState = { spots: CleanupSpot[]; score: number; remaining: number; finished: boolean };
export function normalizeCleanupConfig(input: Partial<CleanupConfig>): CleanupConfig {
  const spots = boundedInt(input.spots, 12, 3, 40);
  return { duration_seconds: boundedInt(input.duration_seconds, 60, 15, 600), spots,
    target_score: boundedInt(input.target_score, Math.min(8, spots), 1, spots),
    tileset_cols: input.tileset_cols ? boundedInt(input.tileset_cols, 1, 1, 32) : undefined,
    tileset_rows: input.tileset_rows ? boundedInt(input.tileset_rows, 1, 1, 32) : undefined };
}
export function createCleanupState(config: CleanupConfig, random = Math.random): CleanupState {
  const columns = Math.ceil(Math.sqrt(config.spots * 1.3));
  const rows = Math.ceil(config.spots / columns);
  const spots = Array.from({ length: config.spots }, (_, id) => ({ id,
    x: (id % columns + 0.5 + (random() - 0.5) * 0.2) * 100 / columns,
    y: (Math.floor(id / columns) + 0.5 + (random() - 0.5) * 0.2) * 100 / rows,
    variant: random(), cleaned: false }));
  return { spots, score: 0, remaining: config.duration_seconds, finished: false };
}
export function cleanupReducer(state: CleanupState, action: { type: "clean"; id: number } | { type: "tick"; remaining: number } | { type: "finish" }): CleanupState {
  if (state.finished) return state;
  if (action.type === "finish") return { ...state, finished: true };
  if (action.type === "tick" && action.remaining === state.remaining) return state;
  if (action.type === "tick") return { ...state, remaining: Math.max(0, action.remaining), finished: action.remaining <= 0 };
  if (!state.spots.some((s) => s.id === action.id && !s.cleaned)) return state;
  const score = state.score + 1;
  return { ...state, score, finished: score === state.spots.length,
    spots: state.spots.map((s) => s.id === action.id ? { ...s, cleaned: true } : s) };
}
export function cleanupTileStyle(variant: number, cols: number, rows: number) {
  const index = Math.max(0, Math.min(cols * rows - 1, Math.floor(variant * cols * rows)));
  return atlasPosition(cols, rows, index % cols, Math.floor(index / cols));
}
