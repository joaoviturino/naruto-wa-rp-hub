import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listLibrary, completeBookRead } from "@/lib/library.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { NINJA_RANKS } from "@/components/admin/shared";
import { useProficiencies } from "@/hooks/useProficiencies";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
  head: () => ({ meta: [{ title: "Biblioteca — Naruto RPG" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ location: typeof s.location === "string" ? s.location : undefined }),
  errorComponent: ({ error }) => <div className="p-6 text-red-400">{String(error?.message ?? error)}</div>,
  notFoundComponent: () => <div className="p-6">Nada por aqui.</div>,
});

type Section = { id: string; name: string; description: string | null; cover_url: string | null };
type Block = { id: string; kind: "text" | "image"; text?: string | null; image_url?: string | null };
type Book = {
  id: string; section_id: string | null; title: string; author: string | null; cover_url: string | null;
  summary: string | null; content: string; min_read_seconds: number; rewards: any; proficiency_grants: any;
  blocks?: Block[]; required_level?: number; required_rank?: string | null; required_profs?: any;
  missing_requirements?: string[];
};

function LibraryPage() {
  const load = useServerFn(listLibrary);
  const { location } = Route.useSearch();
  const [sections, setSections] = useState<Section[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState<Book | null>(null);

  async function refresh() {
    try {
      const r: any = await load({ data: { location_id: location ?? null } });
      setSections(r.sections ?? []); setBooks(r.books ?? []); setReadIds(r.read_ids ?? []);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [location]);

  const shown = useMemo(
    () => selectedSection ? books.filter((b) => b.section_id === selectedSection) : books,
    [books, selectedSection],
  );

  return (
    <TooltipProvider delayDuration={150}><div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-black flex items-center gap-2"><BookOpen className="text-gold" /> Biblioteca</h1>
          <p className="text-xs text-muted-foreground">Leia livros para ganhar XP, Ryo, itens e evoluir suas proficiências.</p>
        </div>
        <Link to="/character"><Button variant="outline" size="sm"><ArrowLeft size={14}/> Ficha</Button></Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!selectedSection ? "default" : "outline"} onClick={() => setSelectedSection(null)}>Todas</Button>
        {sections.map((s) => (
          <Button key={s.id} size="sm" variant={selectedSection === s.id ? "default" : "outline"} onClick={() => setSelectedSection(s.id)}>
            {s.name}
          </Button>
        ))}
      </div>

      {selectedSection && (() => {
        const s = sections.find((x) => x.id === selectedSection);
        return s?.description ? <div className="text-sm text-muted-foreground italic">{s.description}</div> : null;
      })()}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {shown.map((b) => {
          const read = readIds.includes(b.id);
          const missing = b.missing_requirements ?? [];
          const locked = !read && missing.length > 0;
          const card = (
            <button key={b.id} onClick={() => setOpenBook(b)}
              className={"scroll-panel rounded-lg overflow-hidden text-left hover:ring-2 hover:ring-gold transition relative " + (locked ? "opacity-70" : "")}>
              <div className="aspect-[3/4] bg-secondary relative">
                {b.cover_url
                  ? <img src={b.cover_url} className="w-full h-full object-cover" alt="" />
                  : <div className="w-full h-full grid place-items-center text-muted-foreground"><BookOpen /></div>}
                {read && <div className="absolute top-1 right-1 rounded-full bg-emerald-500 text-white p-1"><CheckCircle2 size={14}/></div>}
                {locked && <div className="absolute top-1 left-1 rounded-full bg-black/70 text-red-300 p-1"><Lock size={14}/></div>}
              </div>
              <div className="p-2">
                <div className="font-semibold text-sm truncate">{b.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{b.author ?? "—"}</div>
              </div>
            </button>
          );
          if (!locked) return card;
          return (
            <Tooltip key={b.id}>
              <TooltipTrigger asChild>{card}</TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <div className="text-xs font-semibold text-red-300 mb-1">Requisitos faltantes</div>
                <ul className="text-[11px] text-muted-foreground list-disc pl-4">
                  {missing.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {shown.length === 0 && <div className="col-span-full text-sm text-muted-foreground p-6 text-center">Nenhum livro nesta seção ainda.</div>}
      </div>

      {openBook && (
        <BookReader book={openBook} alreadyRead={readIds.includes(openBook.id)}
          onClose={() => setOpenBook(null)} onCompleted={refresh} />
      )}
    </div></TooltipProvider>
  );
}

function BookReader({ book, alreadyRead, onClose, onCompleted }: {
  book: Book; alreadyRead: boolean; onClose: () => void; onCompleted: () => void;
}) {
  const SKILL_CLASSES = useProficiencies();
  const complete = useServerFn(completeBookRead);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(alreadyRead);
  const [reward, setReward] = useState<any>(null);

  useEffect(() => {
    if (alreadyRead) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onVis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [alreadyRead]);

  const elapsed = Math.floor((now - startedAt) / 1000);
  const remaining = Math.max(0, book.min_read_seconds - elapsed);
  const canClaim = !claimed && remaining <= 0;

  async function claim() {
    setClaiming(true);
    try {
      const r: any = await complete({ data: { book_id: book.id } });
      setReward(r.rewards ?? {}); setClaimed(true); onCompleted();
      if (r.alreadyRead) toast.info("Você já leu este livro.");
      else toast.success("Livro concluído!");
    } catch (e: any) { toast.error(e.message); }
    finally { setClaiming(false); }
  }

  const grants: any[] = Array.isArray(book.proficiency_grants) ? book.proficiency_grants : [];
  const rewards: any = book.rewards ?? {};
  const rewardItems: any[] = Array.isArray(rewards.items) ? rewards.items : [];
  const missing = book.missing_requirements ?? [];
  const locked = !alreadyRead && missing.length > 0;
  const reqProfs: any[] = Array.isArray(book.required_profs) ? book.required_profs : [];
  const rankLabel = book.required_rank ? (NINJA_RANKS.find((r) => r.value === book.required_rank)?.label ?? book.required_rank) : null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {book.title} {alreadyRead && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12}/> lido</span>}
          </DialogTitle>
          {book.author && <div className="text-xs text-muted-foreground">por {book.author}</div>}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {book.cover_url && <img src={book.cover_url} className="w-full max-h-64 object-cover rounded" alt="" />}
          {book.summary && <p className="italic text-gold text-sm">{book.summary}</p>}
          {((book.required_level ?? 1) > 1 || rankLabel || reqProfs.length > 0) && (
            <div className={"rounded border p-3 " + (locked ? "border-red-500/40 bg-red-500/10" : "border-border bg-secondary/30")}>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Requisitos</div>
              <div className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                {(book.required_level ?? 1) > 1 && <span>Nível ≥ <b>{book.required_level}</b></span>}
                {rankLabel && <span>Patente ≥ <b>{rankLabel}</b></span>}
                {reqProfs.map((p, i) => {
                  const label = SKILL_CLASSES.find((c) => c.value === p.skill_class)?.label ?? p.skill_class;
                  const parts = [p.nivel && `Nv ${p.nivel}`, p.maestria && `Ms ${p.maestria}`].filter(Boolean).join(" · ");
                  return <span key={i}>{label}{parts ? ` (${parts})` : ""}</span>;
                })}
              </div>
              {locked && (
                <div className="text-xs text-red-300 mt-2">Faltando: {missing.join(", ")}</div>
              )}
            </div>
          )}
          <BookBody book={book} />

          {(rewards.xp || rewards.ryo || rewardItems.length > 0 || grants.length > 0) && (
            <div className="rounded border border-border p-3 bg-secondary/30">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Recompensa ao concluir</div>
              <div className="flex flex-wrap gap-2 text-sm text-gold">
                {rewards.xp ? <span>+{rewards.xp} XP</span> : null}
                {rewards.ryo ? <span>+{rewards.ryo} Ryo 💰</span> : null}
                {rewardItems.length ? <span>+{rewardItems.length} item(ns)</span> : null}
              </div>
              {grants.length > 0 && (
                <div className="text-xs mt-2 text-muted-foreground">
                  Proficiências: {grants.map((g: any, i: number) => {
                    const label = SKILL_CLASSES.find((c) => c.value === g.skill_class)?.label ?? g.skill_class;
                    const parts = [g.nivel && `Nv ${g.nivel}`, g.maestria && `Ms ${g.maestria}`].filter(Boolean).join(" · ");
                    return <span key={i} className="mr-2">{label}{parts ? ` (${parts})` : ""}</span>;
                  })}
                </div>
              )}
            </div>
          )}

          {claimed && reward && (
            <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <div className="text-emerald-400 font-semibold mb-1">Recompensas aplicadas!</div>
              <div className="text-muted-foreground text-xs">
                {reward.xp && <div>+{reward.xp} XP</div>}
                {reward.ryo && <div>+{reward.ryo} Ryo</div>}
                {reward.items?.length && <div>+{reward.items.length} item(ns) na bolsa</div>}
                {reward.items_error && <div className="text-red-400">Itens não entregues: {reward.items_error}</div>}
                {reward.proficiencies?.length && <div>Proficiências elevadas: {reward.proficiencies.length}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {alreadyRead
              ? "Recompensa já resgatada."
              : locked
                ? <span className="flex items-center gap-1 text-red-300"><Lock size={12}/> Você não cumpre os requisitos.</span>
                : canClaim
                ? "Leitura completa. Confirme abaixo para receber a recompensa."
                : <span className="flex items-center gap-1"><Lock size={12}/> Continue lendo por mais {formatRemaining(remaining)}…</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {!alreadyRead && (
              <Button onClick={claim} disabled={!canClaim || claiming || claimed || locked}>
                {claiming ? "…" : claimed ? "Resgatado" : "Confirmar leitura"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatRemaining(sec: number) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60); const s = sec % 60;
    return `${m}min${s ? ` ${s}s` : ""}`;
  }
  return `${sec}s`;
}

function BookBody({ book }: { book: Book }) {
  const blocks: Block[] = Array.isArray(book.blocks) && book.blocks.length
    ? book.blocks
    : (book.content ? [{ id: "legacy", kind: "text", text: book.content }] : []);
  if (blocks.length === 0) return <div className="text-sm text-muted-foreground">—</div>;
  return (
    <div className="space-y-3">
      {blocks.map((b) => b.kind === "text"
        ? <div key={b.id} className="whitespace-pre-wrap text-sm leading-relaxed">{b.text ?? ""}</div>
        : (b.image_url ? <img key={b.id} src={b.image_url} className="w-full rounded" alt="" /> : null)
      )}
    </div>
  );
}