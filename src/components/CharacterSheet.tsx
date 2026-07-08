import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InventoryView } from "@/components/InventoryView";
import { Databook } from "@/components/Databook";
import { RARITY_COLOR, RARITY_LABEL, VILLAGES, ELEMENTS, stats, type Rarity } from "@/lib/game";
import { Progress } from "@/components/ui/progress";
import { ImageUpload } from "@/components/ImageUpload";
import { SceneImagesManager } from "@/components/SceneImagesManager";
import { updateCharacter } from "@/lib/character.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

type Character = {
  id: string; user_id: string; nickname: string; phone_e164: string;
  village: keyof typeof VILLAGES_MAP; element_primary: string; age: number | null;
  appearance: string | null; personality: string | null; history: string | null; bio: string | null;
  avatar_url: string | null; banner_url: string | null; inventory_bg_url: string | null;
  xp: number; ryo: number | null;
  ef_current: number | null; em_current: number | null; chakra_current: number | null;
  clan: { name: string; rarity: string; element_bonus: string | null } | null;
};
const VILLAGES_MAP = Object.fromEntries(VILLAGES.map((v) => [v.id, v]));
const ELEMENTS_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));

export function CharacterSheet({ characterId }: { characterId: string }) {
  const [char, setChar] = useState<Character | null>(null);
  const update = useServerFn(updateCharacter);

  async function load() {
    const { data } = await supabase
      .from("characters")
      .select("id,user_id,nickname,phone_e164,village,element_primary,age,appearance,personality,history,bio,avatar_url,banner_url,inventory_bg_url,xp,ryo,ef_current,em_current,chakra_current,clan:clans(name,rarity,element_bonus)")
      .eq("id", characterId).single();
    setChar(data as any);
  }
  useEffect(() => { load(); }, [characterId]);

  if (!char) return <div className="p-10 text-center text-muted-foreground">Carregando ficha…</div>;

  const village = (VILLAGES_MAP as any)[char.village];
  const element = (ELEMENTS_MAP as any)[char.element_primary];
  const s = stats(char.xp);
  const nextLevel = Math.max(100, Math.pow(Math.floor(char.xp / 100) + 1, 2) * 100);
  const rarity = ((char.clan?.rarity as Rarity) ?? "common");
  const efCur = char.ef_current == null ? s.ef : Math.min(s.ef, char.ef_current);
  const emCur = char.em_current == null ? s.em : Math.min(s.em, char.em_current);
  const ckCur = char.chakra_current == null ? s.chakra : Math.min(s.chakra, char.chakra_current);

  async function updateField(field: string, url: string) {
    try {
      await update({ data: { [field]: url } as any });
      toast.success("Imagem atualizada.");
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Banner */}
      <div className="relative h-56 sm:h-72 overflow-hidden bg-secondary">
        {char.banner_url ? (
          <img src={char.banner_url} className="w-full h-full object-cover opacity-70" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blood/40 via-background to-background" />
        )}
        <div className="absolute top-3 right-3">
          <ImageUpload label="Trocar banner" bucket="banners" userId={char.user_id}
            onUploaded={(url) => updateField("banner_url", url)} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          <div className="relative">
            <div className="h-28 w-28 rounded-lg border-2 border-gold overflow-hidden bg-card">
              {char.avatar_url && <img src={char.avatar_url} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="absolute -bottom-2 -right-2">
              <ImageUpload label="Avatar" bucket="avatars" userId={char.user_id} compact
                onUploaded={(url) => updateField("avatar_url", url)} />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">{village?.name} · {village?.kanji}</div>
            <h1 className="font-display text-4xl font-black">{char.nickname}</h1>
            <div className="mt-1 text-sm">
              <span className={RARITY_COLOR[rarity]}>{RARITY_LABEL[rarity]}</span>
              {" · "}
              <span className="text-gold">{char.clan?.name ?? "Sem clã"}</span>
              {" · "}
              <span style={{ color: element?.color }}>{element?.kanji} {element?.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-3 gap-4 p-6">
        <StatBlock label="Energia Física (EF)" value={`${efCur} / ${s.ef}`} accent="oklch(0.55 0.22 25)" />
        <StatBlock label="Energia Mental (EM)" value={`${emCur} / ${s.em}`} accent="oklch(0.6 0.15 220)" />
        <StatBlock label="Chakra total" value={`${ckCur} / ${s.chakra}`} accent="oklch(0.78 0.15 80)" />
      </div>
      <div className="px-6">
        <div className="text-xs text-muted-foreground mb-1">XP: {char.xp} / {nextLevel}</div>
        <Progress value={(char.xp / nextLevel) * 100} />
        <div className="text-xs text-gold mt-2">Ryo: {char.ryo ?? 0} 💰</div>
      </div>

      <Tabs defaultValue="ficha" className="p-6">
        <TabsList>
          <TabsTrigger value="ficha">Ficha</TabsTrigger>
          <TabsTrigger value="inventario">Inventário</TabsTrigger>
          <TabsTrigger value="databook">Databook</TabsTrigger>
        </TabsList>
        <TabsContent value="ficha" className="mt-4">
          <div className="scroll-panel rounded-lg p-6 space-y-4">
            <div className="flex justify-end">
              <SceneImagesManager characterId={characterId} userId={char.user_id} />
            </div>
            {char.bio && <p className="italic text-gold">"{char.bio}"</p>}
            <FichaBlock title="Aparência" text={char.appearance} />
            <FichaBlock title="Personalidade" text={char.personality} />
            <FichaBlock title="História" text={char.history} />
            <div className="text-xs text-muted-foreground">Idade: {char.age ?? "—"} · WhatsApp: {char.phone_e164}</div>
          </div>
        </TabsContent>
        <TabsContent value="inventario" className="mt-4">
          <InventoryView characterId={characterId} userId={char.user_id}
            bgUrl={char.inventory_bg_url}
            onBgChange={(url) => updateField("inventory_bg_url", url)} />
        </TabsContent>
        <TabsContent value="databook" className="mt-4">
          <Databook characterId={characterId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="scroll-panel rounded-lg p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-black" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function FichaBlock({ title, text }: { title: string; text: string | null }) {
  return (
    <div>
      <h3 className="font-display text-lg text-gold">{title}</h3>
      <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{text || "—"}</p>
    </div>
  );
}