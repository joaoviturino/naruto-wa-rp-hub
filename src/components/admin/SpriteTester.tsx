import { useEffect, useMemo, useRef, useState } from "react";
import baseSheet from "@/assets/sprite-test-base.png.asset.json";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Ferramenta de teste de sprite — recoloração por HSL preservando luminância.
 * Auto-detecta os clusters de pele (tons quentes) e olhos (verde) direto dos
 * pixels do sprite base, e substitui via hue/saturation mantendo o shading.
 */

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

function hslToRgb(h: number, s: number, l: number): RGB {
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

type Swap = { src: string; dst: string; hueTol: number; satMin: number };

// Paleta de tons de pele: do mais claro (porcelana) ao mais escuro (ébano).
const SKIN_TONES: { name: string; hex: string }[] = [
  { name: "Porcelana", hex: "#f7d7be" },
  { name: "Marfim",    hex: "#f1c9a5" },
  { name: "Areia",     hex: "#e6b48a" },
  { name: "Mel",       hex: "#d69a6c" },
  { name: "Caramelo",  hex: "#b87a4e" },
  { name: "Bronze",    hex: "#8f5a34" },
  { name: "Cacau",     hex: "#6b4023" },
  { name: "Ébano",     hex: "#3d2416" },
];

export function SpriteTester() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  // A cor "src" é auto-amostrada do sprite base e nunca aparece na UI.
  const [eyes, setEyes] = useState<Swap>({ src: "#4ed88c", dst: "#4ed88c", hueTol: 30, satMin: 0.35 });
  const [skin, setSkin] = useState<Swap>({ src: "#f5c57a", dst: SKIN_TONES[2].hex, hueTol: 28, satMin: 0.18 });

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => {
      setImg(i);
      // Auto-amostragem: separa clusters por matiz para pele (30–55°) e olhos (100–170°)
      const off = document.createElement("canvas");
      off.width = i.naturalWidth; off.height = i.naturalHeight;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.drawImage(i, 0, 0);
      const px = octx.getImageData(0, 0, off.width, off.height).data;
      const skinBuckets: Record<number, { r: number; g: number; b: number; n: number }> = {};
      const eyeBuckets: Record<number, { r: number; g: number; b: number; n: number }> = {};
      for (let k = 0; k < px.length; k += 4) {
        if (px[k + 3] < 128) continue;
        const r = px[k], g = px[k + 1], b = px[k + 2];
        const [h, s, l] = rgbToHsl(r, g, b);
        if (s < 0.25 || l < 0.15 || l > 0.9) continue;
        const hb = Math.round(h / 5) * 5;
        if (h >= 20 && h <= 55) {
          const bkt = (skinBuckets[hb] ||= { r: 0, g: 0, b: 0, n: 0 });
          bkt.r += r; bkt.g += g; bkt.b += b; bkt.n += 1;
        } else if (h >= 90 && h <= 170) {
          const bkt = (eyeBuckets[hb] ||= { r: 0, g: 0, b: 0, n: 0 });
          bkt.r += r; bkt.g += g; bkt.b += b; bkt.n += 1;
        }
      }
      const dominant = (b: typeof skinBuckets) => {
        const entry = Object.values(b).sort((a, z) => z.n - a.n)[0];
        if (!entry) return null;
        return rgbToHex(entry.r / entry.n, entry.g / entry.n, entry.b / entry.n);
      };
      const s = dominant(skinBuckets);
      const e = dominant(eyeBuckets);
      // Só atualiza a cor de origem (interna) — a nova cor escolhida pelo usuário permanece.
      if (s) setSkin((prev) => ({ ...prev, src: s }));
      if (e) setEyes((prev) => ({ ...prev, src: e }));
    };
    i.src = baseSheet.url;
  }, []);

  const swaps = useMemo(() => [eyes, skin], [eyes, skin]);

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    const parsed = swaps.map((s) => {
      const src = hexToRgb(s.src); const dst = hexToRgb(s.dst);
      const [sh, ss, sl] = rgbToHsl(src[0], src[1], src[2]);
      const [dh, ds, dl] = rgbToHsl(dst[0], dst[1], dst[2]);
      return { srcH: sh, srcS: ss, srcL: sl, dstH: dh, dstS: ds, dstL: dl, hueTol: s.hueTol, satMin: s.satMin };
    });
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
      if (s < 0.12) continue; // ignora preto/branco (contornos e olho branco)
      let best: (typeof parsed)[number] | null = null;
      let bestD = Infinity;
      for (const p of parsed) {
        if (s < p.satMin - 0.05) continue;
        const dh = Math.min(Math.abs(h - p.srcH), 360 - Math.abs(h - p.srcH));
        if (dh <= p.hueTol && dh < bestD) { best = p; bestD = dh; }
      }
      if (!best) continue;
      // Preserva luminância (shading) e transporta hue/sat do destino
      // Recoloração: matiz vai para destino, saturação escala proporcional, e
      // a luminância é deslocada em torno da luminância do destino — assim tons
      // escuros (pele negra) mantêm sombras profundas e highlights coerentes.
      const satRatio = best.srcS > 0.05 ? best.dstS / best.srcS : 1;
      const newS = Math.max(0, Math.min(1, s * satRatio));
      const delta = l - best.srcL;
      const newL = Math.max(0.03, Math.min(0.97, best.dstL + delta));
      const [nr, ng, nb] = hslToRgb(best.dstH, newS, newL);
      px[i] = nr; px[i + 1] = ng; px[i + 2] = nb;
    }
    ctx.putImageData(data, 0, 0);
  }, [img, swaps]);

  function exportPng() {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "sprite-tinted.png";
    a.click();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-xl text-gold">Teste de Sprite — Color Swap</h3>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Ferramenta de laboratório usando o sprite base oficial. As cores originais são
          amostradas automaticamente da imagem (pele quente e olhos verdes). A troca é feita
          em HSL — a matiz e a saturação vão para a nova cor, mas a luminância original é
          preservada, mantendo intacto todo o sombreamento pixel a pixel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="admin-card p-3 flex items-center justify-center bg-black/40 min-h-[320px]">
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto"
            style={{ imageRendering: "pixelated", width: "min(100%, 640px)" }}
          />
        </div>

        <div className="space-y-4">
          <SwapControls title="Olhos" swap={eyes} setSwap={setEyes} accent="text-emerald-400" />
          <SwapControls title="Pele (interior)" swap={skin} setSwap={setSkin} accent="text-amber-300" />
          <Button onClick={exportPng} className="w-full">Exportar PNG</Button>
        </div>
      </div>
    </div>
  );
}

function SwapControls({
  title, swap, setSwap, accent,
}: { title: string; swap: Swap; setSwap: (s: Swap) => void; accent: string }) {
  return (
    <div className="admin-card p-3 space-y-2">
      <div className={`text-xs uppercase tracking-widest ${accent}`}>{title}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Cor original (auto)</Label>
          <Input type="color" className="h-10 p-1" value={swap.src}
            onChange={(e) => setSwap({ ...swap, src: e.target.value })} />
        </div>
        <div>
          <Label className="text-[10px]">Nova cor</Label>
          <Input type="color" className="h-10 p-1" value={swap.dst}
            onChange={(e) => setSwap({ ...swap, dst: e.target.value })} />
        </div>
      </div>
      <div>
        <Label className="text-[10px]">Tolerância de matiz: {swap.hueTol}°</Label>
        <input
          type="range" min={0} max={90} value={swap.hueTol}
          onChange={(e) => setSwap({ ...swap, hueTol: Number(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  );
}