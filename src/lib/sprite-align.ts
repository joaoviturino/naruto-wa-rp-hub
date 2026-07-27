// Normaliza PNGs enviados como peças cosméticas para uma canvas do tamanho do sprite
// base, aparando o bounding box transparente e reposicionando pelo slot. Assim, ao
// renderizar com `object-contain` sobre o sprite base, a peça encaixa perfeitamente.

export type CosmeticSlot = "hair" | "face" | "clothing" | "accessory";

// Dimensões e regiões de alvo por slot (em fração do canvas 0..1).
// cx/cy = centro da peça; maxW/maxH = tamanho máximo (a peça é ajustada mantendo aspecto).
const SLOT_LAYOUT: Record<CosmeticSlot, { cx: number; cy: number; maxW: number; maxH: number }> = {
  hair:      { cx: 0.5, cy: 0.14, maxW: 0.55, maxH: 0.25 },
  face:      { cx: 0.5, cy: 0.20, maxW: 0.32, maxH: 0.18 },
  clothing:  { cx: 0.5, cy: 0.52, maxW: 0.70, maxH: 0.55 },
  accessory: { cx: 0.5, cy: 0.50, maxW: 1.00, maxH: 1.00 },
};

// Aspecto do sprite base (largura/altura). Aproxima 512×768 do shinobi base.
const CANVAS_W = 512;
const CANVAS_H = 768;
const ALPHA_THRESHOLD = 8; // pixels com alpha < 8 são considerados transparentes

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function trimTransparent(img: HTMLImageElement): { canvas: HTMLCanvasElement; w: number; h: number } {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const a = data[(y * c.width + x) * 4 + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    // Imagem toda transparente; devolve original.
    return { canvas: c, w: c.width, h: c.height };
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const trimmed = document.createElement("canvas");
  trimmed.width = w;
  trimmed.height = h;
  trimmed.getContext("2d")!.drawImage(c, minX, minY, w, h, 0, 0, w, h);
  return { canvas: trimmed, w, h };
}

export async function normalizeCosmetic(file: File, slot: CosmeticSlot): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { canvas: trimmed, w, h } = trimTransparent(img);
    const layout = SLOT_LAYOUT[slot];

    const out = document.createElement("canvas");
    out.width = CANVAS_W;
    out.height = CANVAS_H;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = false; // preserva pixel art

    const targetW = CANVAS_W * layout.maxW;
    const targetH = CANVAS_H * layout.maxH;
    const scale = Math.min(targetW / w, targetH / h);
    const drawW = w * scale;
    const drawH = h * scale;
    const cx = CANVAS_W * layout.cx;
    const cy = CANVAS_H * layout.cy;
    const dx = Math.round(cx - drawW / 2);
    const dy = Math.round(cy - drawH / 2);
    ctx.drawImage(trimmed, dx, dy, drawW, drawH);

    return await new Promise<Blob>((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG normalizado."))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const COSMETIC_CANVAS = { width: CANVAS_W, height: CANVAS_H };