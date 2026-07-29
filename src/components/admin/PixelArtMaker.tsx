import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Pencil, Eraser, PaintBucket, Pipette, Undo2, Redo2, Trash2, Save, Loader2, Grid3x3,
  FlipHorizontal2, FlipVertical2, Download, Image as ImageIcon, Move, Lock, LockOpen, X,
  Lasso, ZoomIn, ZoomOut, Maximize,
} from "lucide-react";
import { BASE_SPRITE_URL } from "@/lib/sprite-base";
import type { CosmeticSlot } from "@/lib/sprite-align";

type Tool = "pencil" | "eraser" | "bucket" | "picker" | "lasso";
type Grid = (string | null)[];
type Pt = { x: number; y: number };
type Floating = { pixels: { x: number; y: number; c: string }[]; dx: number; dy: number };
type MirrorMode = "off" | "h" | "v" | "both";
type RefState = {
  url: string;
  x: number; // %  (centro)
  y: number; // %
  scale: number; // 1 = cobre o canvas
  opacity: number; // 0-100
  flipX: boolean;
  above: boolean; // acima do desenho
  locked: boolean;
};

const EXPORT_SIZE = 512;
const RES_OPTIONS = [32, 48, 64, 96, 128] as const;

const PALETTE = [
  "#000000", "#1b1b23", "#3d3d4e", "#6b6b7e", "#9c9cb0", "#d5d5e0", "#ffffff",
  "#4a1f16", "#7a3b22", "#b4652f", "#e0913f", "#f5c97b", "#ffe8b8",
  "#f2c6a0", "#dda57c", "#b87b52", "#8a5636", "#5c3620", "#3a2015",
  "#5a0f18", "#8f1d24", "#c62f31", "#e85d3d", "#f79a54",
  "#123227", "#1f5c3a", "#2f8f4e", "#5ec46b", "#a8e06a",
  "#102a4a", "#1c4b7d", "#2b78b8", "#4aa7e0", "#8fd8f5",
  "#2c1240", "#4d1f6b", "#7b34a8", "#a765d6", "#d7a6f2",
  "#3a2c0d", "#6b511a", "#a37a24", "#d4a43a", "#f2d06b",
];

/**
 * Editor de pixel art embutido: desenha a peça cosmética diretamente
 * sobre o sprite base (gabarito), exporta em PNG 512×512 transparente
 * e envia para o bucket de cosméticos.
 */
export function PixelArtMaker({
  slot,
  userId,
  onSaved,
  initialUrl,
}: {
  slot: CosmeticSlot;
  userId: string;
  onSaved: (url: string) => void;
  initialUrl?: string | null;
}) {
  const [res, setRes] = useState<number>(64);
  const [grid, setGrid] = useState<Grid>(() => Array(64 * 64).fill(null));
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#1b1b23");
  const [showGrid, setShowGrid] = useState(true);
  const [mirrorMode, setMirrorMode] = useState<MirrorMode>("off");
  const [baseOpacity, setBaseOpacity] = useState(45);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<RefState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selection, setSelection] = useState<Set<number> | null>(null);
  const [floating, setFloating] = useState<Floating | null>(null);
  const [lassoPath, setLassoPath] = useState<Pt[] | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 });
  const refDragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const mirror = mirrorMode !== "off";

  const undoRef = useRef<Grid[]>([]);
  const redoRef = useRef<Grid[]>([]);
  const gridRef = useRef<Grid>(grid);
  gridRef.current = grid;
  const drawingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<"none" | "draw" | "lasso" | "move" | "pan">("none");
  const moveRef = useRef<{ sx: number; sy: number } | null>(null);
  const panRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const floatRef = useRef<Floating | null>(null);
  floatRef.current = floating;

  const cellPx = useMemo(() => EXPORT_SIZE / res, [res]);

  /** Reamostra o desenho atual ao trocar a resolução (nearest neighbour). */
  function changeRes(next: number) {
    const prev = res;
    const old = gridRef.current;
    const out: Grid = Array(next * next).fill(null);
    for (let y = 0; y < next; y++) {
      for (let x = 0; x < next; x++) {
        const sx = Math.floor((x * prev) / next);
        const sy = Math.floor((y * prev) / next);
        out[y * next + x] = old[sy * prev + sx] ?? null;
      }
    }
    undoRef.current = [];
    redoRef.current = [];
    setRes(next);
    setGrid(out);
  }

  function pushUndo() {
    undoRef.current.push(gridRef.current.slice());
    if (undoRef.current.length > 60) undoRef.current.shift();
    redoRef.current = [];
  }

  function undo() {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(gridRef.current.slice());
    setGrid(prev);
  }
  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(gridRef.current.slice());
    setGrid(next);
  }

  const paint = useCallback(
    (idx: number, value: string | null, g: Grid) => {
      const y = Math.floor(idx / res);
      const x = idx % res;
      const xs = mirrorMode === "h" || mirrorMode === "both" ? [x, res - 1 - x] : [x];
      const ys = mirrorMode === "v" || mirrorMode === "both" ? [y, res - 1 - y] : [y];
      for (const yy of ys) for (const xx of xs) g[yy * res + xx] = value;
    },
    [mirrorMode, res],
  );

  function floodFill(start: number, target: string | null, replacement: string | null) {
    if (target === replacement) return gridRef.current;
    const g = gridRef.current.slice();
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      if (g[i] !== target) continue;
      g[i] = replacement;
      const x = i % res;
      const y = Math.floor(i / res);
      if (x > 0) stack.push(i - 1);
      if (x < res - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - res);
      if (y < res - 1) stack.push(i + res);
    }
    return g;
  }

  function cellFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * res);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * res);
    if (x < 0 || y < 0 || x >= res || y >= res) return -1;
    return y * res + x;
  }

  function cellPointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Pt {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * res,
      y: ((e.clientY - rect.top) / rect.height) * res,
    };
  }

  /** Point-in-polygon (ray casting) sobre o centro de cada célula. */
  function maskFromPath(path: Pt[]): Set<number> {
    const out = new Set<number>();
    if (path.length < 3) return out;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of path) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const x0 = Math.max(0, Math.floor(minX)), x1 = Math.min(res - 1, Math.ceil(maxX));
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(res - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
          const a = path[i], b = path[j];
          if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
        }
        if (inside) out.add(y * res + x);
      }
    }
    return out;
  }

  /** Grava os pixels flutuantes na grade e devolve a nova seleção. */
  function commitFloating(f: Floating | null) {
    if (!f) return;
    const g = gridRef.current.slice();
    const next = new Set<number>();
    for (const p of f.pixels) {
      const x = p.x + f.dx, y = p.y + f.dy;
      if (x < 0 || y < 0 || x >= res || y >= res) continue;
      g[y * res + x] = p.c;
      next.add(y * res + x);
    }
    setGrid(g);
    setSelection(next.size ? next : null);
    setFloating(null);
  }

  function clearSelectionPixels() {
    if (!selection?.size) return;
    pushUndo();
    const g = gridRef.current.slice();
    selection.forEach((i) => { g[i] = null; });
    setGrid(g);
  }

  function applyAt(idx: number) {
    if (idx < 0) return;
    if (tool === "picker") {
      const c = gridRef.current[idx];
      if (c) setColor(c);
      setTool("pencil");
      return;
    }
    if (tool === "bucket") {
      pushUndo();
      setGrid(floodFill(idx, gridRef.current[idx], color));
      return;
    }
    const value = tool === "eraser" ? null : color;
    if (gridRef.current[idx] === value && !mirror) return;
    const g = gridRef.current.slice();
    paint(idx, value, g);
    setGrid(g);
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    // Pan: botão do meio ou Alt
    if (e.button === 1 || e.altKey) {
      modeRef.current = "pan";
      panRef.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
      return;
    }
    if (tool === "lasso") {
      const idx = cellFromEvent(e);
      if (selection?.size && idx >= 0 && selection.has(idx)) {
        // começa a mover a seleção
        pushUndo();
        const pixels: Floating["pixels"] = [];
        const g = gridRef.current.slice();
        selection.forEach((i) => {
          const c = g[i];
          if (c) pixels.push({ x: i % res, y: Math.floor(i / res), c });
          g[i] = null;
        });
        setGrid(g);
        const p = cellPointFromEvent(e);
        moveRef.current = { sx: p.x, sy: p.y };
        setFloating({ pixels, dx: 0, dy: 0 });
        modeRef.current = "move";
        return;
      }
      commitFloating(floatRef.current);
      setSelection(null);
      setLassoPath([cellPointFromEvent(e)]);
      modeRef.current = "lasso";
      return;
    }
    commitFloating(floatRef.current);
    modeRef.current = "draw";
    if (tool === "pencil" || tool === "eraser") pushUndo();
    drawingRef.current = true;
    applyAt(cellFromEvent(e));
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (modeRef.current === "pan" && panRef.current) {
      const d = panRef.current;
      setPan({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) });
      return;
    }
    if (modeRef.current === "lasso") {
      const p = cellPointFromEvent(e);
      setLassoPath((prev) => (prev ? [...prev, p] : [p]));
      return;
    }
    if (modeRef.current === "move" && moveRef.current) {
      const p = cellPointFromEvent(e);
      const dx = Math.round(p.x - moveRef.current.sx);
      const dy = Math.round(p.y - moveRef.current.sy);
      setFloating((f) => (f ? { ...f, dx, dy } : f));
      return;
    }
    if (!drawingRef.current) return;
    if (tool !== "pencil" && tool !== "eraser") return;
    applyAt(cellFromEvent(e));
  }
  function onUp() {
    if (modeRef.current === "pan") { panRef.current = null; modeRef.current = "none"; return; }
    if (modeRef.current === "lasso") {
      const path = lassoPath ?? [];
      const mask = maskFromPath(path);
      setSelection(mask.size ? mask : null);
      setLassoPath(null);
      modeRef.current = "none";
      if (!mask.size) toast.info("Desenhe um laço fechado para selecionar.");
      return;
    }
    if (modeRef.current === "move") {
      commitFloating(floatRef.current);
      moveRef.current = null;
      modeRef.current = "none";
      return;
    }
    modeRef.current = "none";
    drawingRef.current = false;
  }

  /** Zoom com a roda do mouse, ancorado no cursor. */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if ((ev.target as HTMLElement)?.closest?.('[data-ref-handle="1"]')) return;
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      setZoom((z) => {
        const next = Math.min(16, Math.max(1, z * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
        setPan((p) => ({
          x: cx - ((cx - p.x) * next) / z,
          y: cy - ((cy - p.y) * next) / z,
        }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** Render do canvas de edição. */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < grid.length; i++) {
      const c = grid[i];
      if (!c) continue;
      const x = (i % res) * cellPx;
      const y = Math.floor(i / res) * cellPx;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, cellPx, cellPx);
    }
    // pixels flutuantes (seleção sendo movida)
    if (floating) {
      for (const p of floating.pixels) {
        const x = p.x + floating.dx, y = p.y + floating.dy;
        if (x < 0 || y < 0 || x >= res || y >= res) continue;
        ctx.fillStyle = p.c;
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }
    // realce da seleção
    const sel = floating
      ? new Set(floating.pixels.map((p) => (p.y + floating.dy) * res + (p.x + floating.dx)))
      : selection;
    if (sel?.size) {
      ctx.fillStyle = "rgba(212,164,58,0.22)";
      sel.forEach((i) => {
        if (i < 0 || i >= res * res) return;
        ctx.fillRect((i % res) * cellPx, Math.floor(i / res) * cellPx, cellPx, cellPx);
      });
    }
    // traçado do laço em andamento
    if (lassoPath && lassoPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = "#f2d06b";
      ctx.lineWidth = Math.max(1, EXPORT_SIZE / 220);
      ctx.setLineDash([EXPORT_SIZE / 60, EXPORT_SIZE / 90]);
      ctx.beginPath();
      ctx.moveTo(lassoPath[0].x * cellPx, lassoPath[0].y * cellPx);
      for (const p of lassoPath.slice(1)) ctx.lineTo(p.x * cellPx, p.y * cellPx);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }, [grid, res, cellPx, selection, floating, lassoPath]);

  /** Carrega uma peça existente como ponto de partida. */
  async function importImage(url: string) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((ok, fail) => {
        img.onload = () => ok();
        img.onerror = () => fail(new Error("Não foi possível carregar a imagem."));
        img.src = url;
      });
      const tmp = document.createElement("canvas");
      tmp.width = res;
      tmp.height = res;
      const tctx = tmp.getContext("2d")!;
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(img, 0, 0, res, res);
      const data = tctx.getImageData(0, 0, res, res).data;
      const g: Grid = Array(res * res).fill(null);
      for (let i = 0; i < res * res; i++) {
        const a = data[i * 4 + 3];
        if (a < 24) continue;
        const hex = `#${[0, 1, 2]
          .map((k) => data[i * 4 + k].toString(16).padStart(2, "0"))
          .join("")}`;
        g[i] = hex;
      }
      pushUndo();
      setGrid(g);
      toast.success("Peça importada para o editor.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao importar.");
    }
  }

  /** ---- Referência (drag & drop) ---- */
  function loadRefFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem.");
    const url = URL.createObjectURL(file);
    setRef({ url, x: 50, y: 50, scale: 1, opacity: 55, flipX: false, above: false, locked: false });
    toast.success("Referência carregada — arraste para posicionar.");
  }

  function onRefPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (!ref || ref.locked) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    refDragRef.current = { px: e.clientX, py: e.clientY, ox: ref.x, oy: ref.y };
  }
  function onRefPointerMove(e: React.PointerEvent<HTMLElement>) {
    const d = refDragRef.current;
    if (!d || !ref || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setRef({
      ...ref,
      x: d.ox + ((e.clientX - d.px) / zoom / rect.width) * 100,
      y: d.oy + ((e.clientY - d.py) / zoom / rect.height) * 100,
    });
  }
  function onRefPointerUp() {
    refDragRef.current = null;
  }
  function onRefWheel(e: React.WheelEvent<HTMLElement>) {
    if (!ref || ref.locked) return;
    const next = Math.min(4, Math.max(0.1, ref.scale * (e.deltaY < 0 ? 1.08 : 0.92)));
    setRef({ ...ref, scale: next });
  }

  function exportBlob(): Promise<Blob> {
    const cv = document.createElement("canvas");
    cv.width = EXPORT_SIZE;
    cv.height = EXPORT_SIZE;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < grid.length; i++) {
      const c = grid[i];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect((i % res) * cellPx, Math.floor(i / res) * cellPx, cellPx, cellPx);
    }
    return new Promise((resolve, reject) =>
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG."))), "image/png"),
    );
  }

  async function save() {
    if (!grid.some(Boolean)) return toast.error("Desenhe algo antes de salvar.");
    setBusy(true);
    try {
      const blob = await exportBlob();
      const path = `${userId}/draw-${slot}-${Date.now()}.png`;
      const { error } = await supabase.storage
        .from("cosmetics")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("cosmetics")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!data?.signedUrl) throw new Error("Falha ao obter URL.");
      onSaved(data.signedUrl);
      toast.success("Peça desenhada salva.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    const blob = await exportBlob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slot}-pixelart.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <Button
      type="button"
      size="sm"
      variant={tool === t ? "default" : "outline"}
      className="h-8 px-2"
      title={label}
      onClick={() => setTool(t)}
    >
      {icon}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {toolBtn("pencil", <Pencil size={14} />, "Lápis")}
        {toolBtn("eraser", <Eraser size={14} />, "Borracha")}
        {toolBtn("bucket", <PaintBucket size={14} />, "Balde")}
        {toolBtn("picker", <Pipette size={14} />, "Conta-gotas")}
        {toolBtn("lasso", <Lasso size={14} />, "Laço de seleção (arraste dentro para mover)")}
        <div className="w-px h-6 bg-border mx-1" />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" title="Desfazer" onClick={undo}>
          <Undo2 size={14} />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" title="Refazer" onClick={redo}>
          <Redo2 size={14} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 text-red-400"
          title="Limpar"
          onClick={() => {
            pushUndo();
            setGrid(Array(res * res).fill(null));
          }}
        >
          <Trash2 size={14} />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          size="sm"
          variant={showGrid ? "default" : "outline"}
          className="h-8 px-2"
          title="Grade"
          onClick={() => setShowGrid((v) => !v)}
        >
          <Grid3x3 size={14} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mirrorMode === "h" || mirrorMode === "both" ? "default" : "outline"}
          className="h-8 px-2"
          title="Espelho horizontal"
          onClick={() =>
            setMirrorMode((m) => (m === "off" ? "h" : m === "h" ? "off" : m === "v" ? "both" : "v"))
          }
        >
          <FlipHorizontal2 size={14} />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mirrorMode === "v" || mirrorMode === "both" ? "default" : "outline"}
          className="h-8 px-2"
          title="Espelho vertical"
          onClick={() =>
            setMirrorMode((m) => (m === "off" ? "v" : m === "v" ? "off" : m === "h" ? "both" : "h"))
          }
        >
          <FlipVertical2 size={14} />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadRefFile(f); e.target.value = ""; }}
          />
          <span className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs cursor-pointer hover:bg-accent">
            <ImageIcon size={14} /> Referência
          </span>
        </label>
        <div className="w-px h-6 bg-border mx-1" />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" title="Afastar"
          onClick={() => setZoom((z) => Math.max(1, z / 1.3))}>
          <ZoomOut size={14} />
        </Button>
        <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" title="Aproximar"
          onClick={() => setZoom((z) => Math.min(16, z * 1.3))}>
          <ZoomIn size={14} />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" title="Resetar zoom"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
          <Maximize size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4">
        {/* Canvas */}
        <div
          ref={wrapRef}
          className={`relative w-full max-w-[520px] aspect-square rounded-md border overflow-hidden mx-auto lg:mx-0 bg-[#0d0d12] ${dragOver ? "border-gold" : "border-border"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) loadRefFile(f);
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#15151c 25%,transparent 25%),linear-gradient(-45deg,#15151c 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#15151c 75%),linear-gradient(-45deg,transparent 75%,#15151c 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
            }}
          />
          <div
            className="absolute inset-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
          >
          <img
            src={BASE_SPRITE_URL}
            alt="Gabarito"
            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
            style={{ imageRendering: "pixelated", opacity: baseOpacity / 100 }}
            draggable={false}
          />
          {ref && !ref.above && (
            <img
              src={ref.url}
              alt="Referência"
              className="absolute pointer-events-none"
              draggable={false}
              style={{
                left: `${ref.x}%`, top: `${ref.y}%`,
                width: `${ref.scale * 100}%`, height: `${ref.scale * 100}%`,
                objectFit: "contain",
                transform: `translate(-50%,-50%) scaleX(${ref.flipX ? -1 : 1})`,
                opacity: ref.opacity / 100,
                imageRendering: "pixelated",
              }}
            />
          )}
          <canvas
            ref={canvasRef}
            width={EXPORT_SIZE}
            height={EXPORT_SIZE}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
            style={{ imageRendering: "pixelated", cursor: tool === "lasso" ? "cell" : "crosshair" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(to right,rgba(255,255,255,.25) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.25) 1px,transparent 1px)",
                backgroundSize: `${100 / res}% ${100 / res}%`,
              }}
            />
          )}
          {ref && ref.above && (
            <img
              src={ref.url}
              alt="Referência"
              className="absolute pointer-events-none"
              draggable={false}
              style={{
                left: `${ref.x}%`, top: `${ref.y}%`,
                width: `${ref.scale * 100}%`, height: `${ref.scale * 100}%`,
                objectFit: "contain",
                transform: `translate(-50%,-50%) scaleX(${ref.flipX ? -1 : 1})`,
                opacity: ref.opacity / 100,
                imageRendering: "pixelated",
              }}
            />
          )}
          {ref && !ref.locked && (
            <div
              className="absolute rounded border-2 border-dashed border-gold/70 pointer-events-none"
              style={{
                left: `${ref.x}%`, top: `${ref.y}%`,
                width: `${ref.scale * 100}%`, height: `${ref.scale * 100}%`,
                transform: "translate(-50%,-50%)",
              }}
            >
              <span
                className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-black/80 px-1.5 py-1 text-[9px] text-gold cursor-move pointer-events-auto select-none"
                data-ref-handle="1"
                style={{ touchAction: "none" }}
                onPointerDown={onRefPointerDown}
                onPointerMove={onRefPointerMove}
                onPointerUp={onRefPointerUp}
                onPointerCancel={onRefPointerUp}
                onWheel={onRefWheel}
                title="Arraste para mover · roda do mouse para escalar"
              >
                <Move size={10} /> referência
              </span>
            </div>
          )}
          {mirror && (
            <div className="absolute inset-0 pointer-events-none">
              {(mirrorMode === "h" || mirrorMode === "both") && (
                <div className="absolute inset-y-0 left-1/2 w-px bg-gold/50" />
              )}
              {(mirrorMode === "v" || mirrorMode === "both") && (
                <div className="absolute inset-x-0 top-1/2 h-px bg-gold/50" />
              )}
            </div>
          )}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Cor</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded border border-border bg-transparent p-0.5"
              />
              <span className="text-xs font-mono text-muted-foreground">{color.toUpperCase()}</span>
            </div>
            <div className="mt-2 grid grid-cols-8 gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setTool("pencil");
                  }}
                  className={`h-5 w-full rounded-sm border ${color.toLowerCase() === c ? "border-gold" : "border-black/40"}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Resolução da grade</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {RES_OPTIONS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={res === r ? "default" : "outline"}
                  className="h-7 px-2 text-[10px]"
                  onClick={() => changeRes(r)}
                >
                  {r}×{r}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Opacidade do gabarito — {baseOpacity}%</Label>
            <Slider
              className="mt-2"
              min={0}
              max={100}
              step={5}
              value={[baseOpacity]}
              onValueChange={([v]) => setBaseOpacity(v)}
            />
          </div>

          <div className="rounded border border-border p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">Desenho espelhado</span>
              <Switch
                checked={mirror}
                onCheckedChange={(v) => setMirrorMode(v ? "h" : "off")}
              />
            </div>
            <div className="flex gap-1">
              {(["off", "h", "v", "both"] as MirrorMode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={mirrorMode === m ? "default" : "outline"}
                  className="h-7 flex-1 px-1 text-[10px]"
                  onClick={() => setMirrorMode(m)}
                >
                  {m === "off" ? "Off" : m === "h" ? "↔" : m === "v" ? "↕" : "↔↕"}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded border border-border p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs">Referência</span>
              {ref && (
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-6 px-1"
                    title={ref.locked ? "Destravar" : "Travar"}
                    onClick={() => setRef({ ...ref, locked: !ref.locked })}>
                    {ref.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-1 text-red-400"
                    title="Remover" onClick={() => setRef(null)}>
                    <X size={12} />
                  </Button>
                </div>
              )}
            </div>
            {!ref ? (
              <p className="text-[10px] text-muted-foreground leading-tight">
                Arraste uma imagem para o canvas (ou use o botão “Referência”) e posicione com o mouse.
              </p>
            ) : (
              <>
                <Label className="text-[10px]">Escala — {(ref.scale * 100).toFixed(0)}%</Label>
                <Slider min={10} max={400} step={5} value={[Math.round(ref.scale * 100)]}
                  onValueChange={([v]) => setRef({ ...ref, scale: v / 100 })} />
                <Label className="text-[10px]">Opacidade — {ref.opacity}%</Label>
                <Slider min={5} max={100} step={5} value={[ref.opacity]}
                  onValueChange={([v]) => setRef({ ...ref, opacity: v })} />
                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                    onClick={() => setRef({ ...ref, flipX: !ref.flipX })}>
                    <FlipHorizontal2 size={12} className="mr-1" /> Inverter
                  </Button>
                  <Button type="button" size="sm" variant={ref.above ? "default" : "outline"}
                    className="h-7 px-2 text-[10px]" onClick={() => setRef({ ...ref, above: !ref.above })}>
                    {ref.above ? "Acima" : "Abaixo"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                    onClick={() => setRef({ ...ref, x: 50, y: 50, scale: 1 })}>
                    Centralizar
                  </Button>
                </div>
              </>
            )}
          </div>

          {initialUrl && (
            <Button type="button" size="sm" variant="outline" className="w-full text-xs" onClick={() => importImage(initialUrl)}>
              Importar peça atual
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="w-full text-xs" onClick={download}>
            <Download size={14} className="mr-1" /> Baixar PNG
          </Button>
          <Button type="button" className="w-full" disabled={busy} onClick={save}>
            {busy ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            Usar esta peça
          </Button>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Desenhe por cima do gabarito. A peça é exportada em PNG 512×512 com fundo
            transparente, já alinhada ao sprite base.
          </p>
        </div>
      </div>
    </div>
  );
}