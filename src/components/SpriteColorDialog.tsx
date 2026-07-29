import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Palette } from "lucide-react";
import { BASE_SPRITE_URL } from "@/lib/sprite-base";
import {
  DEFAULT_EYES, DEFAULT_SKIN, EYE_COLORS, SKIN_TONES,
  paintRecolored, sampleSpriteColors, type Swap,
} from "@/lib/sprite-recolor";

/**
 * Personalização de cores do boneco padrão (pele e olhos).
 * O resultado é exportado como PNG e salvo como sprite do personagem.
 */
export function SpriteColorDialog({
  userId, onSaved,
}: { userId: string; onSaved: (url: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [skin, setSkin] = useState<Swap>(DEFAULT_SKIN);
  const [eyes, setEyes] = useState<Swap>(DEFAULT_EYES);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: cfg } = await supabase
        .from("server_config").select("default_sprite_url").eq("id", "main").maybeSingle();
      const src = (cfg as any)?.default_sprite_url || BASE_SPRITE_URL;
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => {
        if (cancelled) return;
        setImg(i);
        const sampled = sampleSpriteColors(i);
        if (sampled.skin) setSkin((p) => ({ ...p, src: sampled.skin! }));
        if (sampled.eyes) setEyes((p) => ({ ...p, src: sampled.eyes! }));
      };
      i.onerror = () => toast.error("Não foi possível carregar o boneco padrão.");
      i.src = src;
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    paintRecolored(canvasRef.current, img, [eyes, skin]);
  }, [img, eyes, skin]);

  async function save() {
    const c = canvasRef.current;
    if (!c) return;
    setBusy(true);
    try {
      const blob: Blob = await new Promise((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao gerar PNG"))), "image/png"),
      );
      const path = `${userId}/sprite-${Date.now()}.png`;
      const { error } = await supabase.storage.from("inventory").upload(path, blob, {
        upsert: true, contentType: "image/png",
      });
      if (error) throw error;
      const { data } = await supabase.storage.from("inventory").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!data?.signedUrl) throw new Error("Falha ao obter URL");
      await onSaved(data.signedUrl);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Palette className="h-3.5 w-3.5" /> Personalizar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[96vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-gold">Personalizar boneco</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-lg bg-black/40 border border-border p-3 grid place-items-center min-h-[280px]">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto"
              style={{ imageRendering: "pixelated", width: "min(100%, 420px)" }}
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-amber-300">Tom de pele</div>
              <div className="grid grid-cols-4 gap-2">
                {SKIN_TONES.map((t) => (
                  <button
                    key={t.hex}
                    type="button"
                    title={t.name}
                    onClick={() => setSkin({ ...skin, dst: t.hex })}
                    className={`aspect-square rounded-md border-2 transition ${
                      t.hex.toLowerCase() === skin.dst.toLowerCase()
                        ? "border-gold scale-105 shadow-lg"
                        : "border-white/10 hover:border-white/40"
                    }`}
                    style={{ backgroundColor: t.hex }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">Personalizado</Label>
                <Input type="color" className="h-8 w-16 p-1" value={skin.dst}
                  onChange={(e) => setSkin({ ...skin, dst: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-emerald-400">Cor dos olhos</div>
              <div className="grid grid-cols-4 gap-2">
                {EYE_COLORS.map((t) => (
                  <button
                    key={t.hex}
                    type="button"
                    title={t.name}
                    onClick={() => setEyes({ ...eyes, dst: t.hex })}
                    className={`aspect-square rounded-md border-2 transition ${
                      t.hex.toLowerCase() === eyes.dst.toLowerCase()
                        ? "border-gold scale-105 shadow-lg"
                        : "border-white/10 hover:border-white/40"
                    }`}
                    style={{ backgroundColor: t.hex }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">Personalizado</Label>
                <Input type="color" className="h-8 w-16 p-1" value={eyes.dst}
                  onChange={(e) => setEyes({ ...eyes, dst: e.target.value })} />
              </div>
            </div>

            <Button className="w-full" onClick={save} disabled={busy || !img}>
              {busy ? "Salvando..." : "Salvar aparência"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}