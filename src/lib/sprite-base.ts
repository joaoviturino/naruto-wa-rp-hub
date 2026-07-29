import baseAsset from "@/assets/sprite-test-base.png.asset.json";

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
