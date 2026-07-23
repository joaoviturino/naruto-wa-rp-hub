import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Drama, MessageCircle, Cloud, Zap, X, Plus, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { postScene } from "@/lib/chat.functions";
import { toast } from "sonner";

type Kind = "action" | "speech" | "thought";
type Entry = { kind: Kind; text: string };

const META: Record<Kind, { label: string; icon: any; color: string; placeholder: string; render: (t: string) => React.ReactNode }> = {
  action:  { label: "Ação",       icon: Zap,           color: "text-amber-400",  placeholder: "Ex.: saca a katana em um movimento fluido...",
             render: (t) => <><span>❕ </span><strong>{t}</strong></> },
  speech:  { label: "Fala",       icon: MessageCircle, color: "text-sky-400",    placeholder: 'Ex.: Você não deveria ter vindo aqui.',
             render: (t) => <>- {t}</> },
  thought: { label: "Pensamento", icon: Cloud,         color: "text-violet-400", placeholder: "Ex.: preciso terminar isso rápido...",
             render: (t) => <>💭 {t}</> },
};

export function SceneDialog({ open, onOpenChange, currentLocationId, onPosted }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  currentLocationId: string | null;
  onPosted?: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [composer, setComposer] = useState<{ kind: Kind; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const post = useServerFn(postScene);

  function reset() { setEntries([]); setComposer(null); }

  function openComposer(kind: Kind) { setComposer({ kind, text: "" }); }
  function commitComposer() {
    if (!composer) return;
    const t = composer.text.trim();
    if (!t) { setComposer(null); return; }
    setEntries((e) => [...e, { kind: composer.kind, text: t }]);
    setComposer(null);
  }

  const totalChars = entries.reduce((s, e) => s + e.text.length, 0);
  const kinds = new Set(entries.map((e) => e.kind)).size;
  const estXp = entries.length === 0 ? 0
    : Math.max(5, Math.min(80, Math.floor(totalChars / 15)) + kinds * 5 + Math.min(20, entries.length * 2));

  async function submit() {
    if (!currentLocationId) { toast.error("Você precisa estar em um local."); return; }
    if (entries.length === 0) { toast.error("Adicione ao menos uma ação, fala ou pensamento."); return; }
    setBusy(true);
    try {
      const res = await post({ data: { locationId: currentLocationId, entries } } as any);
      toast.success(`Cena publicada! +${(res as any).xpGain} XP`);
      reset();
      onOpenChange(false);
      onPosted?.();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao publicar cena."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); } onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Drama size={18} className="text-gold" /> Cenar
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Monte uma cena combinando ação, fala e pensamento. Quanto maior o empenho (variedade, detalhes), mais XP você ganha.
        </p>

        {/* Preview / sequência */}
        <div className="rounded-md border border-border bg-input/30 p-3 min-h-24 space-y-1.5 text-sm">
          {entries.length === 0 && !composer && (
            <div className="text-xs text-muted-foreground italic">Sua cena aparecerá aqui…</div>
          )}
          {entries.map((e, i) => {
            const m = META[e.kind];
            const Icon = m.icon;
            return (
              <div key={i} className="group flex items-start gap-2 py-1">
                <Icon size={14} className={`mt-0.5 shrink-0 ${m.color}`} />
                <div className="flex-1 whitespace-pre-wrap break-words">
                  <span className="text-foreground">{m.render(e.text)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEntries((es) => es.filter((_, j) => j !== i))}
                  className="opacity-40 hover:opacity-100 hover:text-blood transition"
                  aria-label="Remover">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Composer inline */}
        {composer && (
          <div className="rounded-md border border-gold/40 bg-black/30 p-3 space-y-2">
            <div className={`flex items-center gap-2 text-xs font-semibold ${META[composer.kind].color}`}>
              {(() => { const I = META[composer.kind].icon; return <I size={14} />; })()}
              {META[composer.kind].label}
            </div>
            <Textarea
              autoFocus
              value={composer.text}
              onChange={(e) => setComposer({ ...composer, text: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitComposer(); } }}
              placeholder={META[composer.kind].placeholder}
              className="min-h-20 text-sm"
              maxLength={1000} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setComposer(null)}>Cancelar</Button>
              <Button size="sm" onClick={commitComposer} className="gap-1.5">
                <Plus size={14} /> Adicionar
              </Button>
            </div>
          </div>
        )}

        {/* Botões de tipo */}
        {!composer && (
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(META) as Kind[]).map((k) => {
              const m = META[k]; const Icon = m.icon;
              return (
                <button key={k} type="button" onClick={() => openComposer(k)}
                  className="flex flex-col items-center gap-1 rounded-md border border-border bg-secondary/40 hover:bg-secondary/70 hover:border-gold/50 py-3 transition">
                  <Icon size={18} className={m.color} />
                  <span className="text-xs font-semibold">{m.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entrada" : "entradas"} · ~<span className="text-gold font-semibold">{estXp} XP</span>
          </div>
          <Button onClick={submit} disabled={busy || entries.length === 0} className="gap-1.5">
            <Send size={14} /> {busy ? "Publicando…" : "Publicar cena"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}