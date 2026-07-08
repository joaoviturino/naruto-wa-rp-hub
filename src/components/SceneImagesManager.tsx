import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Upload, ImagePlus } from "lucide-react";
import { toast } from "sonner";

type Scene = { id: string; image_url: string; label: string | null };

export function SceneImagesManager({ characterId, userId }: { characterId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase
      .from("scene_images").select("id,image_url,label")
      .eq("character_id", characterId).order("created_at");
    setScenes((data as Scene[]) ?? []);
  }
  useEffect(() => { if (open) load(); }, [open, characterId]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Máximo 10MB.");
    if (scenes.length >= 10) return toast.error("Limite de 10 imagens atingido.");
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() ?? "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("scenes").upload(path, f, { contentType: f.type });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("scenes").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!signed.data?.signedUrl) throw new Error("Falha ao obter URL");
      const { error } = await supabase.from("scene_images").insert({
        character_id: characterId, image_url: signed.data.signedUrl, label: f.name.slice(0, 40),
      });
      if (error) throw error;
      toast.success("Cena adicionada.");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function updateLabel(id: string, label: string) {
    await supabase.from("scene_images").update({ label }).eq("id", id);
  }
  async function remove(id: string) {
    if (!confirm("Remover esta cena?")) return;
    const { error } = await supabase.from("scene_images").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><ImagePlus size={14} className="mr-1" /> Configurações de cenas</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Galeria de cenas — {scenes.length}/10</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Envie até 10 imagens (máx. 10MB cada). Você poderá anexar uma delas em cada mensagem do chat para retratar a cena.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {scenes.map((s) => (
            <div key={s.id} className="scroll-panel rounded-lg overflow-hidden">
              <img src={s.image_url} alt={s.label ?? ""} className="w-full h-32 object-cover" />
              <div className="p-2 space-y-1">
                <Input defaultValue={s.label ?? ""} placeholder="Legenda"
                  onBlur={(e) => updateLabel(s.id, e.target.value)} className="h-7 text-xs" />
                <Button variant="destructive" size="sm" className="w-full h-7"
                  onClick={() => remove(s.id)}><Trash2 size={12} /></Button>
              </div>
            </div>
          ))}
          {scenes.length < 10 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="scroll-panel rounded-lg h-full min-h-[176px] flex flex-col items-center justify-center gap-1 border-dashed hover:bg-secondary/40 disabled:opacity-50"
            >
              <Upload />
              <span className="text-xs">{busy ? "Enviando..." : "Adicionar cena"}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
      </DialogContent>
    </Dialog>
  );
}