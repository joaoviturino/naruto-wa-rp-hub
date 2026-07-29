/**
 * Recoloração de sprites em HSL preservando o sombreamento.
 * Usado tanto no laboratório admin (Teste de Sprite) quanto na
 * personalização de cores do jogador na ficha.
 */

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hk(h + 1 / 3) * 255, hk(h) * 255, hk(h - 1 / 3) * 255];
}

export type Swap = {
  /** Cor de origem amostrada automaticamente do sprite. */
  src: string;
  /** Nova cor escolhida. */
  dst: string;
  hueTol: number;
  satMin: number;
  /** Faixa de matiz (com wrap em 360) — usada para a pele. */
  hueMin?: number;
  hueMax?: number;
};

/** Paleta de tons de pele: do mais claro (porcelana) ao mais escuro (ébano). */
export const SKIN_TONES: { name: string; hex: string }[] = [
  { name: "Porcelana", hex: "#f7d7be" },
  { name: "Marfim",    hex: "#f1c9a5" },
  { name: "Areia",     hex: "#e6b48a" },
  { name: "Mel",       hex: "#d69a6c" },
  { name: "Caramelo",  hex: "#b87a4e" },
  { name: "Bronze",    hex: "#8f5a34" },
  { name: "Cacau",     hex: "#6b4023" },
  { name: "Ébano",     hex: "#3d2416" },
];

export const EYE_COLORS: { name: string; hex: string }[] = [
  { name: "Esmeralda", hex: "#4ed88c" },
  { name: "Céu",       hex: "#5bb6ff" },
  { name: "Âmbar",     hex: "#e8a33d" },
  { name: "Rubi",      hex: "#e0455a" },
  { name: "Ametista",  hex: "#a267e8" },
  { name: "Ônix",      hex: "#5a5a66" },
];

export const DEFAULT_SKIN: Swap = {
  src: "#f5c57a", dst: SKIN_TONES[2].hex, hueTol: 28, satMin: 0.15, hueMin: 340, hueMax: 55,
};
export const DEFAULT_EYES: Swap = { src: "#4ed88c", dst: "#4ed88c", hueTol: 30, satMin: 0.35 };

/** Amostra as cores dominantes de pele (tons quentes) e olhos (verdes) da imagem. */
export function sampleSpriteColors(img: HTMLImageElement): { skin: string | null; eyes: string | null } {
  const off = document.createElement("canvas");
  off.width = img.naturalWidth; off.height = img.naturalHeight;
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return { skin: null, eyes: null };
  octx.drawImage(img, 0, 0);
  const px = octx.getImageData(0, 0, off.width, off.height).data;
  type Bucket = Record<number, { r: number; g: number; b: number; n: number }>;
  const skinBuckets: Bucket = {};
  const eyeBuckets: Bucket = {};
  for (let k = 0; k < px.length; k += 4) {
    if (px[k + 3] < 128) continue;
    const r = px[k], g = px[k + 1], b = px[k + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.25 || l < 0.15 || l > 0.9) continue;
    const hb = Math.round(h / 5) * 5;
    const isWarm = (h >= 340 && h <= 360) || (h >= 0 && h <= 55);
    if (isWarm) {
      const bkt = (skinBuckets[hb] ||= { r: 0, g: 0, b: 0, n: 0 });
      bkt.r += r; bkt.g += g; bkt.b += b; bkt.n += 1;
    } else if (h >= 90 && h <= 170) {
      const bkt = (eyeBuckets[hb] ||= { r: 0, g: 0, b: 0, n: 0 });
      bkt.r += r; bkt.g += g; bkt.b += b; bkt.n += 1;
    }
  }
  const dominant = (b: Bucket) => {
    const entry = Object.values(b).sort((a, z) => z.n - a.n)[0];
    if (!entry) return null;
    return rgbToHex(entry.r / entry.n, entry.g / entry.n, entry.b / entry.n);
  };
  return { skin: dominant(skinBuckets), eyes: dominant(eyeBuckets) };
}

/** Desenha a imagem recolorida no canvas informado. */
export function paintRecolored(canvas: HTMLCanvasElement, img: HTMLImageElement, swaps: Swap[]) {
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const parsed = swaps.map((s) => {
    const src = hexToRgb(s.src); const dst = hexToRgb(s.dst);
    const [sh, ss, sl] = rgbToHsl(src[0], src[1], src[2]);
    const [dh, ds, dl] = rgbToHsl(dst[0], dst[1], dst[2]);
    return { srcH: sh, srcS: ss, srcL: sl, dstH: dh, dstS: ds, dstL: dl, hueTol: s.hueTol, satMin: s.satMin, hueMin: s.hueMin, hueMax: s.hueMax };
  });
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    if (s < 0.12) continue; // ignora contornos (preto/branco)
    let best: (typeof parsed)[number] | null = null;
    let bestD = Infinity;
    for (const p of parsed) {
      if (s < p.satMin - 0.05) continue;
      let match = false;
      let score = 0;
      if (p.hueMin !== undefined && p.hueMax !== undefined) {
        const inRange = p.hueMin <= p.hueMax ? (h >= p.hueMin && h <= p.hueMax) : (h >= p.hueMin || h <= p.hueMax);
        if (inRange) { match = true; score = 0; }
      } else {
        const dh = Math.min(Math.abs(h - p.srcH), 360 - Math.abs(h - p.srcH));
        if (dh <= p.hueTol) { match = true; score = dh; }
      }
      if (match && score < bestD) { best = p; bestD = score; }
    }
    if (!best) continue;
    const satRatio = best.srcS > 0.05 ? best.dstS / best.srcS : 1;
    const newS = Math.max(0, Math.min(1, s * satRatio));
    const delta = l - best.srcL;
    const newL = Math.max(0.03, Math.min(0.97, best.dstL + delta));
    const [nr, ng, nb] = hslToRgb(best.dstH, newS, newL);
    px[i] = nr; px[i + 1] = ng; px[i + 2] = nb;
  }
  ctx.putImageData(data, 0, 0);
}