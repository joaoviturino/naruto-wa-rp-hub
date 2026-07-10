import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RARITY_COLOR, RARITY_LABEL, VILLAGES, ELEMENTS, type Rarity } from "@/lib/game";

const V = Object.fromEntries(VILLAGES.map((v) => [v.id, v]));
const E = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));

export function PublicCharacterView({
  characterId, open, onOpenChange,
}: { characterId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [char, setChar] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !characterId) return;
    setChar(null);
    (async () => {
      const { data } = await supabase
        .from("characters")
        .select("nickname,village,element_primary,age,appearance,personality,history,bio,avatar_url,banner_url,clan:clans(name,rarity)")
        .eq("id", characterId).single();
      setChar(data);
    })();
  }, [open, characterId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="relative h-40 bg-secondary">
          {char?.banner_url ? <img src={char.banner_url} className="w-full h-full object-cover opacity-70" alt="" /> :
            <div className="absolute inset-0 bg-gradient-to-br from-blood/40 via-background to-background" />}
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end gap-3">
            <div className="h-20 w-20 rounded-lg border-2 border-gold overflow-hidden bg-card shrink-0">
              {char?.avatar_url && <img src={char.avatar_url} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-black truncate">{char?.nickname ?? "…"}</DialogTitle>
              </DialogHeader>
              {char && (
                <div className="text-xs truncate">
                  <span className="text-gold">{(V as any)[char.village]?.name}</span>
                  {char.clan && <> · <span className={RARITY_COLOR[(char.clan.rarity as Rarity) ?? "common"]}>{RARITY_LABEL[(char.clan.rarity as Rarity) ?? "common"]}</span> · <span className="text-gold">{char.clan.name}</span></>}
                  {" · "}<span style={{ color: (E as any)[char.element_primary]?.color }}>{(E as any)[char.element_primary]?.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {char && (
          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {char.bio && <p className="italic text-gold">"{char.bio}"</p>}
            <Block title="Aparência" text={char.appearance} />
            <Block title="Personalidade" text={char.personality} />
            <Block title="História" text={char.history} />
            <div className="text-xs text-muted-foreground">Idade: {char.age ?? "—"}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Block({ title, text }: { title: string; text: string | null }) {
  return (
    <div>
      <h3 className="font-display text-lg text-gold">{title}</h3>
      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{text || "—"}</p>
    </div>
  );
}