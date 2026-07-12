import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Plus, BookOpen, FolderTree } from "lucide-react";
import { ArrowUp, ArrowDown, Image as ImageIcon, Type } from "lucide-react";
import { SKILL_CLASSES, SKILL_RANKS, NINJA_RANKS } from "@/components/admin/shared";
import {
  upsertLibrarySection, deleteLibrarySection,
  upsertLibraryBook, deleteLibraryBook,
} from "@/lib/library.functions";

type Section = { id: string; name: string; description: string | null; cover_url: string | null; sort_order: number; active: boolean };
type Book = {
  id: string; section_id: string | null; title: string; author: string | null; cover_url: string | null;
  summary: string | null; content: string; min_read_seconds: number; rewards: any;
  proficiency_grants: any; sort_order: number; active: boolean;
  blocks?: Block[];
  required_level?: number | null;
  required_rank?: string | null;
  required_profs?: any;
};
type Block = { id: string; kind: "text" | "image"; text?: string | null; image_url?: string | null };
type Item = { id: string; name: string };

export function LibraryManager() {
  const [adminUserId, setAdminUserId] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? "")); }, []);
  const [sections, setSections] = useState<Section[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<"section" | "book" | null>(null);
  const [sec, setSec] = useState<Partial<Section>>({});
  const [book, setBook] = useState<Partial<Book>>({});

  const saveSec = useServerFn(upsertLibrarySection);
  const delSec = useServerFn(deleteLibrarySection);
  const saveBook = useServerFn(upsertLibraryBook);
  const delBook = useServerFn(deleteLibraryBook);

  async function load() {
    const [{ data: s }, { data: b }, { data: it }] = await Promise.all([
      supabase.from("library_sections").select("*").order("sort_order").order("name"),
      supabase.from("library_books").select("*").order("sort_order").order("title"),
      supabase.from("items").select("id,name").order("name"),
    ]);
    setSections((s ?? []) as any); setBooks((b ?? []) as any); setItems((it ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  function newSection() { setSec({ name: "", sort_order: 0, active: true }); setEditing("section"); }
  function editSection(x: Section) { setSec(x); setEditing("section"); }
  function newBook() { setBook({ title: "", content: "", min_read_seconds: 60, rewards: {}, proficiency_grants: [], sort_order: 0, active: true, blocks: [], required_level: 1, required_rank: null, required_profs: [] }); setEditing("book"); }
  function editBook(x: Book) {
    const blocks: Block[] = Array.isArray(x.blocks) && x.blocks.length
      ? x.blocks
      : (x.content ? [{ id: crypto.randomUUID(), kind: "text", text: x.content }] : []);
    setBook({ ...x, rewards: x.rewards ?? {}, proficiency_grants: x.proficiency_grants ?? [], required_profs: Array.isArray(x.required_profs) ? x.required_profs : [], blocks });
    setEditing("book");
  }

  async function submitSection() {
    try {
      await saveSec({ data: {
        id: sec.id, name: sec.name!, description: sec.description ?? null, cover_url: sec.cover_url ?? null,
        sort_order: Number(sec.sort_order ?? 0), active: sec.active ?? true,
      } as any });
      toast.success("Seção salva."); setEditing(null); load();
    } catch (e: any) { toast.error(e.message); }
  }
  async function submitBook() {
    try {
      const blocks: Block[] = Array.isArray(book.blocks) ? book.blocks : [];
      const plainContent = blocks.filter((b) => b.kind === "text").map((b) => b.text ?? "").join("\n\n");
      await saveBook({ data: {
        id: book.id, section_id: book.section_id ?? null, title: book.title!,
        author: book.author ?? null, cover_url: book.cover_url ?? null,
        summary: book.summary ?? null, content: plainContent || (book.content ?? ""),
        blocks,
        min_read_seconds: Number(book.min_read_seconds ?? 30),
        rewards: book.rewards ?? {}, proficiency_grants: book.proficiency_grants ?? [],
        sort_order: Number(book.sort_order ?? 0), active: book.active ?? true,
        required_level: Math.max(1, Number(book.required_level ?? 1)),
        required_rank: book.required_rank ?? null,
        required_profs: Array.isArray(book.required_profs) ? book.required_profs : [],
      } as any });
      toast.success("Livro salvo."); setEditing(null); load();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Left: lists */}
      <div className="space-y-4">
        <div className="scroll-panel rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-gold flex items-center gap-2"><FolderTree size={16}/> Seções</h3>
            <Button size="sm" onClick={newSection}><Plus size={14}/> Nova seção</Button>
          </div>
          <div className="space-y-1">
            {sections.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-secondary/40">
                {s.cover_url && <img src={s.cover_url} className="w-8 h-8 rounded object-cover" alt="" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.active ? "Ativa" : "Oculta"} · ordem {s.sort_order}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => editSection(s)}>Editar</Button>
                <Button size="sm" variant="destructive" onClick={async () => {
                  if (!confirm(`Remover seção "${s.name}"?`)) return;
                  try { await delSec({ data: { id: s.id } }); toast.success("Removida."); load(); }
                  catch (e: any) { toast.error(e.message); }
                }}><Trash2 size={14}/></Button>
              </div>
            ))}
            {sections.length === 0 && <div className="text-xs text-muted-foreground p-2">Nenhuma seção ainda.</div>}
          </div>
        </div>

        <div className="scroll-panel rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-gold flex items-center gap-2"><BookOpen size={16}/> Livros</h3>
            <Button size="sm" onClick={newBook}><Plus size={14}/> Novo livro</Button>
          </div>
          <div className="space-y-1">
            {books.map((b) => {
              const secName = sections.find((s) => s.id === b.section_id)?.name;
              return (
                <div key={b.id} className="flex items-center gap-2 p-2 rounded bg-secondary/40">
                  {b.cover_url && <img src={b.cover_url} className="w-8 h-10 rounded object-cover" alt="" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{b.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{secName ?? "Sem seção"} · {Math.max(1, Math.round((b.min_read_seconds ?? 0) / 60))} min de leitura</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => editBook(b)}>Editar</Button>
                  <Button size="sm" variant="destructive" onClick={async () => {
                    if (!confirm(`Remover livro "${b.title}"?`)) return;
                    try { await delBook({ data: { id: b.id } }); toast.success("Removido."); load(); }
                    catch (e: any) { toast.error(e.message); }
                  }}><Trash2 size={14}/></Button>
                </div>
              );
            })}
            {books.length === 0 && <div className="text-xs text-muted-foreground p-2">Nenhum livro ainda.</div>}
          </div>
        </div>
      </div>

      {/* Right: editor */}
      <div className="scroll-panel rounded-lg p-4">
        {editing === "section" && (
          <div className="space-y-3">
            <h3 className="font-display text-lg text-gold">{sec.id ? "Editar seção" : "Nova seção"}</h3>
            <div><Label>Nome</Label><Input value={sec.name ?? ""} onChange={(e) => setSec({ ...sec, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={sec.description ?? ""} onChange={(e) => setSec({ ...sec, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Ordem</Label><Input type="number" value={sec.sort_order ?? 0} onChange={(e) => setSec({ ...sec, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-end gap-2"><Switch checked={sec.active ?? true} onCheckedChange={(v) => setSec({ ...sec, active: v })} /><Label>Ativa</Label></div>
            </div>
            <div className="flex items-center gap-2">
              {sec.cover_url && <img src={sec.cover_url} className="w-12 h-12 rounded object-cover" alt="" />}
              {adminUserId && <ImageUpload label="Capa" bucket="library" userId={adminUserId} onUploaded={(url) => setSec({ ...sec, cover_url: url })} />}
            </div>
            <div className="flex gap-2"><Button onClick={submitSection}>Salvar</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button></div>
          </div>
        )}
        {editing === "book" && (
          <BookEditor
            book={book} setBook={setBook} sections={sections} items={items}
            adminUserId={adminUserId} onSave={submitBook} onCancel={() => setEditing(null)}
          />
        )}
        {!editing && <div className="text-sm text-muted-foreground">Selecione ou crie uma seção / livro para editar.</div>}
      </div>
    </div>
  );
}

function BlocksEditor({ blocks, setBlocks, adminUserId }: { blocks: Block[]; setBlocks: (b: Block[]) => void; adminUserId: string }) {
  const uid = () => (globalThis.crypto?.randomUUID?.() ?? String(Math.random()));
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= blocks.length) return;
    const arr = [...blocks]; const [it] = arr.splice(i, 1); arr.splice(j, 0, it); setBlocks(arr);
  }
  function remove(i: number) { setBlocks(blocks.filter((_, idx) => idx !== i)); }
  function update(i: number, patch: Partial<Block>) {
    const arr = [...blocks]; arr[i] = { ...arr[i], ...patch }; setBlocks(arr);
  }
  return (
    <div className="rounded border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Conteúdo do livro (blocos)</div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setBlocks([...blocks, { id: uid(), kind: "text", text: "" }])}><Type size={14}/> Texto</Button>
          <Button size="sm" variant="outline" onClick={() => setBlocks([...blocks, { id: uid(), kind: "image", image_url: "" }])}><ImageIcon size={14}/> Imagem</Button>
        </div>
      </div>
      {blocks.length === 0 && <div className="text-xs text-muted-foreground">Adicione blocos de texto e imagem na ordem que quiser.</div>}
      {blocks.map((b, i) => (
        <div key={b.id} className="rounded bg-secondary/40 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bloco {i + 1} · {b.kind === "text" ? "Texto" : "Imagem"}</div>
            <div className="ml-auto flex gap-1">
              <Button size="icon" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14}/></Button>
              <Button size="icon" variant="outline" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><ArrowDown size={14}/></Button>
              <Button size="icon" variant="destructive" onClick={() => remove(i)}><Trash2 size={14}/></Button>
            </div>
          </div>
          {b.kind === "text" ? (
            <Textarea rows={5} value={b.text ?? ""} onChange={(e) => update(i, { text: e.target.value })} />
          ) : (
            <div className="flex items-center gap-2">
              {b.image_url && <img src={b.image_url} className="w-24 h-24 rounded object-cover" alt="" />}
              <div className="flex-1 space-y-1">
                <Input placeholder="URL da imagem" value={b.image_url ?? ""} onChange={(e) => update(i, { image_url: e.target.value })} />
                {adminUserId && <ImageUpload label="Enviar imagem" bucket="library" userId={adminUserId} onUploaded={(url) => update(i, { image_url: url })} />}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BookEditor({ book, setBook, sections, items, adminUserId, onSave, onCancel }: {
  book: Partial<Book>; setBook: (b: Partial<Book>) => void;
  sections: Section[]; items: Item[]; adminUserId: string; onSave: () => void; onCancel: () => void;
}) {
  const grants: any[] = Array.isArray(book.proficiency_grants) ? book.proficiency_grants : [];
  const rewards: any = book.rewards ?? {};
  const rewardItems: any[] = Array.isArray(rewards.items) ? rewards.items : [];
  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-gold">{book.id ? "Editar livro" : "Novo livro"}</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><Label>Título</Label><Input value={book.title ?? ""} onChange={(e) => setBook({ ...book, title: e.target.value })} /></div>
        <div><Label>Autor</Label><Input value={book.author ?? ""} onChange={(e) => setBook({ ...book, author: e.target.value })} /></div>
        <div>
          <Label>Seção</Label>
          <Select value={book.section_id ?? "none"} onValueChange={(v) => setBook({ ...book, section_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem seção —</SelectItem>
              {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Resumo</Label><Textarea rows={2} value={book.summary ?? ""} onChange={(e) => setBook({ ...book, summary: e.target.value })} /></div>
      <BlocksEditor blocks={(book.blocks as Block[]) ?? []} setBlocks={(bs) => setBook({ ...book, blocks: bs })} adminUserId={adminUserId} />
      <div className="grid grid-cols-3 gap-2">
        <div><Label>Leitura mínima (min)</Label><Input type="number" min={1} value={Math.max(1, Math.round((book.min_read_seconds ?? 60) / 60))} onChange={(e) => setBook({ ...book, min_read_seconds: Math.max(5, Number(e.target.value) * 60) })} /></div>
        <div><Label>Ordem</Label><Input type="number" value={book.sort_order ?? 0} onChange={(e) => setBook({ ...book, sort_order: Number(e.target.value) })} /></div>
        <div className="flex items-end gap-2"><Switch checked={book.active ?? true} onCheckedChange={(v) => setBook({ ...book, active: v })} /><Label>Ativo</Label></div>
      </div>
      <div className="flex items-center gap-2">
        {book.cover_url && <img src={book.cover_url} className="w-12 h-16 rounded object-cover" alt="" />}
        {adminUserId && <ImageUpload label="Capa" bucket="library" userId={adminUserId} onUploaded={(url) => setBook({ ...book, cover_url: url })} />}
      </div>

      <div className="rounded border border-border p-3 space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Recompensas ao concluir a leitura</div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>XP</Label><Input type="number" value={rewards.xp ?? 0} onChange={(e) => setBook({ ...book, rewards: { ...rewards, xp: Number(e.target.value) || 0 } })} /></div>
          <div><Label>Ryo</Label><Input type="number" value={rewards.ryo ?? 0} onChange={(e) => setBook({ ...book, rewards: { ...rewards, ryo: Number(e.target.value) || 0 } })} /></div>
        </div>
        <div className="space-y-1">
          <Label>Itens</Label>
          {rewardItems.map((it: any, i: number) => (
            <div key={i} className="flex gap-2">
              <Select value={it.item_id ?? ""} onValueChange={(v) => {
                const arr = [...rewardItems]; arr[i] = { ...arr[i], item_id: v };
                setBook({ ...book, rewards: { ...rewards, items: arr } });
              }}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Item..." /></SelectTrigger>
                <SelectContent>{items.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" className="w-20" value={it.qty ?? 1} onChange={(e) => {
                const arr = [...rewardItems]; arr[i] = { ...arr[i], qty: Number(e.target.value) || 1 };
                setBook({ ...book, rewards: { ...rewards, items: arr } });
              }} />
              <Button size="icon" variant="destructive" onClick={() => {
                const arr = rewardItems.filter((_, idx) => idx !== i);
                setBook({ ...book, rewards: { ...rewards, items: arr } });
              }}><Trash2 size={14}/></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setBook({ ...book, rewards: { ...rewards, items: [...rewardItems, { item_id: "", qty: 1 }] } })}>
            <Plus size={14}/> Adicionar item
          </Button>
        </div>
      </div>

      <div className="rounded border border-border p-3 space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Concessão de proficiência (sobe se maior que a atual)</div>
        {grants.map((g: any, i: number) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] gap-2 items-center">
            <Select value={g.skill_class ?? ""} onValueChange={(v) => {
              const arr = [...grants]; arr[i] = { ...arr[i], skill_class: v };
              setBook({ ...book, proficiency_grants: arr });
            }}>
              <SelectTrigger><SelectValue placeholder="Classe..." /></SelectTrigger>
              <SelectContent className="max-h-72">{SKILL_CLASSES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={g.nivel ?? "none"} onValueChange={(v) => {
              const arr = [...grants]; arr[i] = { ...arr[i], nivel: v === "none" ? null : v };
              setBook({ ...book, proficiency_grants: arr });
            }}>
              <SelectTrigger><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>Nv {r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={g.maestria ?? "none"} onValueChange={(v) => {
              const arr = [...grants]; arr[i] = { ...arr[i], maestria: v === "none" ? null : v };
              setBook({ ...book, proficiency_grants: arr });
            }}>
              <SelectTrigger><SelectValue placeholder="Maestria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>Ms {r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="destructive" onClick={() => {
              const arr = grants.filter((_, idx) => idx !== i);
              setBook({ ...book, proficiency_grants: arr });
            }}><Trash2 size={14}/></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setBook({ ...book, proficiency_grants: [...grants, { skill_class: "", nivel: null, maestria: null }] })}>
          <Plus size={14}/> Adicionar concessão
        </Button>
      </div>

      <div className="flex gap-2"><Button onClick={onSave}>Salvar</Button><Button variant="outline" onClick={onCancel}>Cancelar</Button></div>
    </div>
  );
}