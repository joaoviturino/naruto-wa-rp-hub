import baseAsset from "@/assets/sprite-test-base.png.asset.json";
import sideRightAsset from "@/assets/sprite-base-side-right.png.asset.json";
import sideLeftAsset from "@/assets/sprite-base-side-left.png.asset.json";

/**
 * ============================================================
 * SPRITE BASE OFICIAL (pixel art)
 * ============================================================
 * Todo o sistema de personalização (cabelo, rosto, roupa,
 * acessórios) é construído SOBRE este sprite. Sprites antigos
 * foram aposentados — qualquer peça nova deve ser desenhada
 * usando esta base como gabarito.
 *
 * Canvas: 512×512. O corpo ocupa:
 *   cabeça  → y 72..200
 *   tronco  → y 216..344
 *   pernas  → y 360..440
 *   largura → x 160..344 (centro ≈ 0.49)
 */

export const BASE_SPRITE_URL = (baseAsset as { url: string }).url;

/** Variantes direcionais do sprite base (mesmo canvas 512x512, sem olhos). */
export const BASE_SPRITE_SIDE_RIGHT_URL = (sideRightAsset as { url: string }).url;
export const BASE_SPRITE_SIDE_LEFT_URL = (sideLeftAsset as { url: string }).url;

export const BASE_SPRITE_DIRECTIONS = {
  front: BASE_SPRITE_URL,
  right: BASE_SPRITE_SIDE_RIGHT_URL,
  left: BASE_SPRITE_SIDE_LEFT_URL,
} as const;

export type SpriteDirection = keyof typeof BASE_SPRITE_DIRECTIONS;

export const BASE_CANVAS = { width: 512, height: 512 } as const;

/** Regiões do corpo em fração do canvas (0..1) — usadas para encaixe das peças. */
export const BASE_ANCHORS = {
  head:  { top: 0.14, bottom: 0.39, cx: 0.49 },
  torso: { top: 0.42, bottom: 0.67, cx: 0.49 },
  legs:  { top: 0.70, bottom: 0.86, cx: 0.49 },
} as const;

/** Estado padrão para sprites estáticos desta base (1 frame). */
export const BASE_STATIC_STATES = {
  idle: { row: 0, frames: 1, fps: 1, loop: true },
} as const;
