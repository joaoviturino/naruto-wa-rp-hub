import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InventoryView } from "@/components/InventoryView";
import { Databook } from "@/components/Databook";
import { RARITY_LABEL, VILLAGES, ELEMENTS, stats, type Rarity } from "@/lib/game";
import { Progress } from "@/components/ui/progress";
import { NINJA_RANKS } from "@/components/admin/shared";

const VILLAGES_MAP = Object.fromEntries(VILLAGES.map((v) => [v.id, v]));
const ELEMENTS_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));

export function AdminPlayerViewer({
  characterId, open, onOpenChange,
}: { characterId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [char, setChar] = useState<any>(null);

  useEffect(() => {
    if (!open || !characterId) { setChar(null); return; }
    (async () => {
      const { data } = await supabase
        .from("characters")
        .select("id,user_id,nickname,phone_e164,village,element_primary,age,appearance,personality,history,bio,avatar_url,banner_url,inventory_bg_url,xp,ryo,rank,hp_current,ef_current,em_current,chakra_current,clan:clans(name,rarity,element_bonus)")
        .eq("id", characterId).single();
      setChar(data);
    })();
  }, [open, characterId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="font-display text-gold">
            {char ? `Visualizar: ${char.nickname}` : "Carregando..."}
          </DialogTitle>
        </DialogHeader>
        {!char ? (
          <div className="p-10 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="p-4">
            <Tabs defaultValue="sheet">
              <TabsList className="mb-3">
                <TabsTrigger value="sheet">Ficha</TabsTrigger>
                <TabsTrigger value="inventory">Inventário</TabsTrigger>
                <TabsTrigger value="databook">Databook</TabsTrigger>
              </TabsList>
              <TabsContent value="sheet">
                <SheetSummary char={char} />
              </TabsContent>
              <TabsContent value="inventory">
                <div className="pointer-events-auto">
                  <InventoryView characterId={char.id} userId={char.user_id} bgUrl={char.inventory_bg_url} onBgChange={() => {}} />
                </div>
              </TabsContent>
              <TabsContent value="databook">
                <Databook characterId={char.id} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SheetSummary({ char }: { char: any }) {
  const village = (VILLAGES_MAP as any)[char.village];
  const element = (ELEMENTS_MAP as any)[char.element_primary];
  const s = stats(char.xp);
  const rarity: Rarity = (char.clan?.rarity as Rarity) ?? "common";
  const efCur = char.ef_current == null ? s.ef : Math.min(s.ef, char.ef_current);
  const emCur = char.em_current == null ? s.em : Math.min(s.em, char.em_current);
  const ckCur = char.chakra_current == null ? s.chakra : Math.min(s.chakra, char.chakra_current);
  const hpMax = Math.max(1, char.xp);
  const hpCur = char.hp_current == null ? hpMax : Math.max(0, Math.min(hpMax, char.hp_current));
  const rankLabel = NINJA_RANKS.find((r) => r.value === char.rank)?.label ?? char.rank;

  return (
    <div className="space-y-4">
      <div className="relative h-32 sm:h-44 rounded-lg overflow-hidden bg-secondary">
        {char.banner_url && <img src={char.banner_url} className="w-full h-full object-cover opacity-70" alt="" />}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end gap-3">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-gold overflow-hidden bg-background">
            {char.avatar_url && <img src={char.avatar_url} className="w-full h-full object-cover" alt="" />}
          </div>
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-white">{char.nickname}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {village?.name ?? char.village} • {element?.name ?? char.element_primary} • {rankLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Info label="XP" value={char.xp} />
        <Info label="Ryō" value={char.ryo ?? 0} />
        <Info label="Clã" value={char.clan?.name ?? "—"} sub={char.clan ? RARITY_LABEL[rarity] : undefined} />
        <Info label="Idade" value={char.age ?? "—"} />
      </div>

      <div className="space-y-2">
        <Bar label={`HP ${hpCur}/${hpMax}`} value={(hpCur / hpMax) * 100} />
        <Bar label={`EF ${efCur}/${s.ef}`} value={(efCur / Math.max(1, s.ef)) * 100} />
        <Bar label={`EM ${emCur}/${s.em}`} value={(emCur / Math.max(1, s.em)) * 100} />
        <Bar label={`Chakra ${ckCur}/${s.chakra}`} value={(ckCur / Math.max(1, s.chakra)) * 100} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Block title="Bio" text={char.bio} />
        <Block title="Aparência" text={char.appearance} />
        <Block title="Personalidade" text={char.personality} />
        <Block title="História" text={char.history} />
      </div>

      <div className="text-xs text-muted-foreground">WhatsApp: {char.phone_e164 || "—"}</div>
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs mb-1 flex justify-between"><span>{label}</span></div>
      <Progress value={value} />
    </div>
  );
}
function Block({ title, text }: { title: string; text: string | null }) {
  return (
    <div className="rounded-lg bg-secondary/30 border border-border p-3">
      <div className="text-xs uppercase tracking-wider text-gold mb-1">{title}</div>
      <div className="text-sm whitespace-pre-wrap">{text || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}