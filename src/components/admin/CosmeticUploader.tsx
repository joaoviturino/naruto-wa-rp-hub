import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { normalizeCosmetic, type CosmeticSlot } from "@/lib/sprite-align";
import baseSprite from "@/assets/shinobi-base.png.asset.json";

/**
 * Uploader dedicado a peças cosméticas: valida o PNG, apara transparência, encaixa
 * na grade do sprite base pelo slot e só então envia. Mostra um preview alinhado.
 */
export function CosmeticUploader({
  slot,
  userId,
  onUploaded,
  currentUrl,
}: {
  slot: CosmeticSlot;
  userId: string;
  onUploaded: (url: string) => void;
  currentUrl?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/png|webp/i.test(f.type)) {
      toast.error("Envie um PNG (ou WEBP) com fundo transparente.");
      if (ref.current) ref.current.value = "";
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Máximo 8MB.");
      if (ref.current) ref.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const normalized = await normalizeCosmetic(f, slot);
      const path = `${userId}/${slot}-${Date.now()}.png`;
      const { error } = await supabase.storage.from("cosmetics").upload(path, normalized, {
        upsert: true,
        contentType: "image/png",
      });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("cosmetics")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!data?.signedUrl) throw new Error("Falha ao obter URL.");
      setPreviewUrl(data.signedUrl);
      onUploaded(data.signedUrl);
      toast.success("Peça alinhada e enviada.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no envio.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-40 w-28 rounded border border-border bg-black/40 overflow-hidden shrink-0">
        <img
          src={baseSprite.url}
          alt="Base"
          className="absolute inset-0 h-full w-full object-contain opacity-50"
          draggable={false}
        />
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Peça"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
            draggable={false}
          />
        )}
        {!previewUrl && (
          <div className="absolute inset-x-0 bottom-1 text-center text-[9px] text-muted-foreground">
            Preview alinhado
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={ref}
          type="file"
          accept="image/png,image/webp"
          className="hidden"
          onChange={pick}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <span className="ml-1">{busy ? "Alinhando…" : "Enviar PNG"}</span>
        </Button>
        <p className="text-[10px] text-muted-foreground max-w-[180px] leading-tight">
          O sistema apara o fundo transparente e centraliza a peça no slot
          <b className="text-gold"> {slot}</b> automaticamente.
        </p>
      </div>
    </div>
  );
}