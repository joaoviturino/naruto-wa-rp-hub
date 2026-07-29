import { useEffect, useMemo, useRef, useState } from "react";
import baseSheet from "@/assets/shinobi-base-sheet.png.asset.json";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Ferramenta de teste de sprite (color-swap por tolerância).
 * Usa o sprite base oficial e permite trocar a cor dos olhos (verde padrão)
 * e a cor da pele (interior). Renderiza no canvas em tempo real.
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function dist(a: [number, number, number], b: [number, number, number]) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

type Swap = { src: string; dst: string; tol: number };

export function SpriteTester() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [eyes, setEyes] = useState<Swap>({ src: "#3fa34d", dst: "#3fa34d", tol: 70 });
  const [skin, setSkin] = useState<Swap>({ src: "#f2c9a1", dst: "#f2c9a1", tol: 55 });

  useEffect(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
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
    const parsed = swaps.map((s) => ({ src: hexToRgb(s.src), dst: hexToRgb(s.dst), tol: s.tol }));
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      const rgb: [number, number, number] = [px[i], px[i + 1], px[i + 2]];
      let best: (typeof parsed)[number] | null = null;
      let bestD = Infinity;
      for (const s of parsed) {
        const d = dist(rgb, s.src);
        if (d <= s.tol && d < bestD) { best = s; bestD = d; }
      }
      if (!best) continue;
      // preserva sombreamento aplicando o delta do pixel em relação ao src
      const dR = rgb[0] - best.src[0];
      const dG = rgb[1] - best.src[1];
      const dB = rgb[2] - best.src[2];
      px[i]     = Math.max(0, Math.min(255, best.dst[0] + dR));
      px[i + 1] = Math.max(0, Math.min(255, best.dst[1] + dG));
      px[i + 2] = Math.max(0, Math.min(255, best.dst[2] + dB));
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
          Ferramenta de laboratório usando o sprite base oficial. Ajuste a cor dos olhos (verde
          padrão) e da pele (interior). A tolerância controla quantos tons próximos são incluídos
          na troca — mantendo o sombreamento pixel a pixel.
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
          <Label className="text-[10px]">Cor original</Label>
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
        <Label className="text-[10px]">Tolerância: {swap.tol}</Label>
        <input
          type="range" min={0} max={180} value={swap.tol}
          onChange={(e) => setSwap({ ...swap, tol: Number(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  );
}