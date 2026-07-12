import { useEffect, useRef, useState } from "react";
import { Music, Play, Pause, X, Upload, Link as LinkIcon, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const LS_KEY = "bgm-player-v1";

type Saved = { src: string | null; name: string | null; volume: number; playing: boolean };

export function BackgroundMusicPlayer() {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        setSrc(s.src ?? null);
        setName(s.name ?? null);
        setVolume(typeof s.volume === "number" ? s.volume : 0.5);
      }
    } catch { /* noop */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const save: Saved = { src, name, volume, playing };
    try { localStorage.setItem(LS_KEY, JSON.stringify({ ...save, src: src?.startsWith("data:") ? null : src })); } catch { /* noop */ }
  }, [src, name, volume, playing, hydrated]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function handleFile(f: File) {
    if (f.size > 15 * 1024 * 1024) { toast.error("Arquivo grande demais (máx. 15MB)."); return; }
    const url = URL.createObjectURL(f);
    setSrc(url); setName(f.name); setPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }

  function applyUrl() {
    if (!urlInput.trim()) return;
    setSrc(urlInput.trim()); setName(urlInput.trim().split("/").pop() ?? "Trilha"); setUrlInput(""); setPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }

  function toggle() {
    if (!audioRef.current || !src) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => toast.error("Não foi possível reproduzir. Verifique o link.")); }
  }

  function clearTrack() {
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false); setSrc(null); setName(null);
  }

  if (!hydrated) return null;

  return (
    <>
      {src && (
        <audio ref={audioRef} src={src} loop autoPlay
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      )}
      <div className="fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2">
        {open && (
          <div className="w-72 max-w-[85vw] bg-card border border-border rounded-lg shadow-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-display text-gold flex items-center gap-1"><Music size={14} /> Música de fundo</div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            {name && (
              <div className="text-[11px] text-muted-foreground truncate" title={name}>▶ {name}</div>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" variant={playing ? "secondary" : "default"} className="flex-1" disabled={!src} onClick={toggle}>
                {playing ? <><Pause size={12} className="mr-1" /> Pausar</> : <><Play size={12} className="mr-1" /> Tocar</>}
              </Button>
              {src && <Button size="sm" variant="ghost" onClick={clearTrack}><X size={12} /></Button>}
            </div>
            <div className="flex items-center gap-2">
              {volume === 0 ? <VolumeX size={14} className="text-muted-foreground" /> : <Volume2 size={14} className="text-muted-foreground" />}
              <Slider value={[Math.round(volume * 100)]} min={0} max={100} step={1}
                onValueChange={(v) => setVolume((v[0] ?? 0) / 100)} className="flex-1" />
            </div>
            <div className="pt-1 border-t border-border space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><LinkIcon size={10} /> Link direto (mp3/ogg)</label>
              <div className="flex gap-1">
                <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                <Button size="sm" onClick={applyUrl} disabled={!urlInput.trim()}>OK</Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Upload size={10} /> Upload local</label>
              <input type="file" accept="audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="text-xs w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-secondary file:text-foreground" />
              <div className="text-[10px] text-muted-foreground">Uploads ficam apenas nesta aba (não são salvos).</div>
            </div>
          </div>
        )}
        <Button size="icon" variant={playing ? "default" : "outline"} className="rounded-full shadow-lg h-10 w-10"
          onClick={() => setOpen((v) => !v)} title="Música de fundo">
          <Music size={16} className={playing ? "animate-pulse" : ""} />
        </Button>
      </div>
    </>
  );
}