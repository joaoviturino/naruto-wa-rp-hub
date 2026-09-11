import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { refreshCharacterCosmetics, useCharacterCosmetics, type EquippedPiece } from "@/hooks/useCharacterCosmetics";
import { useBodySprite, refreshBodySprite } from "@/hooks/useBodySprite";
import { setCharacterCosmetic } from "@/lib/cosmetics.functions";
import { BASE_SPRITE_URL } from "@/lib/sprite-base";
import { CharacterPreview } from "@/components/CharacterPreview";
import { SpriteColorDialog } from "@/components/SpriteColorDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Search, Shirt, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const SLOTS = { hair: "Cabelo", face: "Rosto", clothing: "Roupa", accessory: "Acessório" } as const;
type Slot = keyof typeof SLOTS;
type Piece = EquippedPiece & { id: string; customizable: boolean };
export function CharacterStudio({ characterId, baseSprite, userId, onSpriteChange }:
  { characterId: string; baseSprite: string | null; userId: string; onSpriteChange: (url: string) => void | Promise<void> }) {
  const equipped = useCharacterCosmetics(characterId);
  const body = useBodySprite(characterId);
  const [slot, setSlot] = useState<Slot>("clothing");
  const [draftId, setDraftId] = useState<string | null | undefined>();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(setCharacterCosmetic);
  const { data: catalog = [], isPending, error, refetch } = useQuery({
    queryKey: ["cosmetic-catalog", userId], staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("cosmetic_pieces").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Piece[];
    },
  });
  const current = equipped.find((p) => p.slot === slot);
  const selectedId = draftId === undefined ? current?.id ?? null : draftId;
  const selected = catalog.find((p) => p.id === selectedId) ?? equipped.find((p) => p.id === selectedId);
  const changed = selectedId !== (current?.id ?? null);
  const previewPieces = useMemo(() => [...equipped.filter((p) => p.slot !== slot), ...(selected ? [selected] : [])], [equipped, slot, selected]);
  const visible = catalog.filter((p) => p.slot === slot && (p.customizable !== false || p.id === current?.id)
    && p.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  async function equip() {
    if (busy || !changed) return;
    setBusy(true);
    try {
      await save({ data: { characterId, slot, pieceId: selectedId } });
      await refreshCharacterCosmetics(characterId);
      setDraftId(undefined);
      toast.success(selectedId ? "Aparência equipada." : "Peça removida.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a aparência."); }
    finally { setBusy(false); }
  }
  return <section className="character-studio grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
    <aside className="space-y-4 lg:sticky lg:top-4 self-start min-w-0">
      <CharacterPreview body={{ imageUrl: baseSprite ?? body?.image_url ?? BASE_SPRITE_URL,
        sheetUrl: body?.sheet_url, cols: body?.sheet_cols, rows: body?.sheet_rows, states: body?.sheet_states }} pieces={previewPieces} />
      <SpriteColorDialog userId={userId} onSaved={async (url) => {
        await onSpriteChange(url); await refreshBodySprite(characterId);
      }} />
    </aside>
    <div className="min-w-0 space-y-4">
      <div><div className="text-xs tracking-widest uppercase text-gold">Ateliê shinobi</div>
        <h3 className="font-display text-2xl mt-1">Seu estilo. Sua presença.</h3>
        <p className="text-sm text-muted-foreground mt-2">Experimente uma peça e veja como ela acompanha as ações. Confirme em Equipar para usar no jogo.</p></div>
      <Tabs value={slot} onValueChange={(v) => { setSlot(v as Slot); setDraftId(undefined); setSearch(""); }}>
        <TabsList className="grid grid-cols-4 w-full h-auto">{Object.entries(SLOTS).map(([id, label]) =>
          <TabsTrigger key={id} value={id} disabled={busy} className="min-h-11 text-sm">{label}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted-foreground" />
        <Input className="pl-9 h-11" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${SLOTS[slot].toLowerCase()}`} aria-label="Buscar peças" /></div>
      {error ? <div className="rounded-lg border border-blood p-4 text-sm">Não foi possível carregar as peças. <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div>
        : isPending ? <div role="status" className="py-8 text-muted-foreground">Abrindo o guarda-roupa…</div>
        : <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          <button type="button" onClick={() => setDraftId(null)} aria-pressed={selectedId === null} disabled={busy}
            className={`wardrobe-piece ${selectedId === null ? "is-selected" : ""}`}>
            <div className="h-24 grid place-items-center"><Shirt size={28} className="text-muted-foreground" /></div><span>Sem peça</span>
          </button>
          {visible.map((p) => <button type="button" key={p.id} disabled={busy} aria-pressed={selectedId === p.id}
            onClick={() => setDraftId(p.id)} className={`wardrobe-piece ${selectedId === p.id ? "is-selected" : ""}`}>
            <img src={p.image_url} alt="" className="h-24 w-full object-contain" loading="lazy" decoding="async" />
            <span className="line-clamp-2">{p.name}</span>
            {p.id === current?.id && <span className="text-xs text-gold inline-flex items-center gap-1"><Check size={12} /> Equipada</span>}
          </button>)}
        </div>}
      {!isPending && !error && !visible.length && <p className="text-sm text-muted-foreground">Nenhuma peça encontrada nesta categoria. A administração pode cadastrar novas peças.</p>}
      <div className="sticky bottom-0 rounded-xl border border-gold/30 bg-card p-3 flex gap-3 items-center flex-wrap shadow-lg">
        <div className="flex-1 min-w-32"><div className="text-xs text-muted-foreground">{changed ? "Experimentando" : "Em uso"}</div>
          <div className="text-sm font-semibold">{selected?.name ?? "Sem peça"}</div></div>
        {changed && <Button variant="ghost" aria-label="Descartar prévia" disabled={busy} onClick={() => setDraftId(undefined)}><RotateCcw size={16} /></Button>}
        <Button className="min-h-11" onClick={equip} disabled={busy || !changed}>{busy ? "Equipando…" : selectedId ? `Equipar ${SLOTS[slot].toLowerCase()}` : "Remover peça"}</Button>
      </div>
    </div>
  </section>;
}
