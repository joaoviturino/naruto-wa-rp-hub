import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export function ImageUpload({ label, bucket, userId, onUploaded, compact }: {
  label: string; bucket: "avatars" | "banners" | "inventory" | "items" | "skills"; userId: string;
  onUploaded: (url: string) => void; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB.");
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() ?? "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, f, { upsert: true, contentType: f.type });
      if (error) throw error;
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!data?.signedUrl) throw new Error("Falha ao obter URL");
      onUploaded(data.signedUrl);
      toast.success("Imagem enviada.");
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      <Button size={compact ? "icon" : "sm"} variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        <Upload size={14} /> {!compact && <span className="ml-1">{busy ? "..." : label}</span>}
      </Button>
    </>
  );
}