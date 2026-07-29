import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Palette } from "lucide-react";
import { BASE_SPRITE_URL } from "@/lib/sprite-base";
import { refreshCharacterCosmetics } from "@/hooks/useCharacterCosmetics";
import {
  DEFAULT_EYES, DEFAULT_SKIN, EYE_COLORS, SKIN_TONES,
  paintRecolored, sampleSpriteColors, type Swap,
} from "@/lib/sprite-recolor";

type Slot = "hair" | "face" | "clothing" | "accessory";
const SLOTS: { id: Slot; label: string }[] = [
  { id: "hair", label: "Cabelo" },
  { id: "face", label: "Rosto" },
  { id: "clothing", label: "Roupa" },
  { id: "accessory", label: "Acessório" },
];

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
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [pieces, setPieces] = useState<any[]>([]);
  const [equipped, setEquipped] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: char } = await supabase
        .from("characters").select("id").eq("user_id", userId).maybeSingle();
      if (cancelled || !char?.id) return;
      setCharacterId(char.id);
      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase.from("cosmetic_pieces").select("*").eq("active", true).order("slot").order("sort_order"),
        supabase.from("character_cosmetics").select("slot, piece_id").eq("character_id", char.id),
      ]);
      if (cancelled) return;
      const map: Record<string, string> = {};
      (mine ?? []).forEach((r: any) => { map[r.slot] = r.piece_id; });
      const equippedIds = new Set(Object.values(map));
      setPieces(((all ?? []) as any[]).filter((p) => p.customizable !== false || equippedIds.has(p.id)));
      setEquipped(map);
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  async function equip(slot: Slot, pieceId: string | null) {
    if (!characterId) return;
    if (pieceId) {
      const { error } = await supabase.from("character_cosmetics").upsert(
        { character_id: characterId, slot, piece_id: pieceId },
        { onConflict: "character_id,slot" },
      );
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("character_cosmetics").delete()
        .eq("character_id", characterId).eq("slot", slot);
      if (error) return toast.error(error.message);
    }
    setEquipped((m) => { const n = { ...m }; if (pieceId) n[slot] = pieceId; else delete n[slot]; return n; });
    refreshCharacterCosmetics(characterId);
  }

  const overlays = pieces
    .filter((p) => equipped[p.slot] === p.id)
    .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));

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
            <div className="relative" style={{ width: "min(100%, 420px)" }}>
              <canvas
                ref={canvasRef}
                className="w-full h-auto block"
                style={{ imageRendering: "pixelated" }}
              />
              {overlays.map((p) => (
                <img
                  key={p.id}
                  src={p.image_url}
                  alt={p.name}
                  className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                  style={{ imageRendering: "pixelated", zIndex: p.z_index ?? 0 }}
                />
              ))}
            </div>
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

        {characterId && (
          <div className="space-y-4 pt-2 border-t border-border">
            {SLOTS.map((slot) => {
              const slotPieces = pieces.filter((p) => p.slot === slot.id);
              if (slotPieces.length === 0) return null;
              return (
                <div key={slot.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-widest text-gold">{slot.label}</div>
                    {equipped[slot.id] && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => equip(slot.id, null)}>Remover</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slotPieces.map((p) => {
                      const isOn = equipped[slot.id] === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => equip(slot.id, isOn ? null : p.id)}
                          className={`border rounded p-1.5 transition-all ${isOn ? "border-gold ring-2 ring-gold/50 bg-gold/10" : "border-border bg-input/30 hover:border-gold/60"}`}
                        >
                          <div className="h-16 flex items-center justify-center bg-black/30 rounded overflow-hidden">
                            <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain"
                              style={{ imageRendering: "pixelated" }} />
                          </div>
                          <div className="text-[10px] text-center mt-1 truncate">{p.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}