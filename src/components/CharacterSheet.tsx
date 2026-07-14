import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InventoryView } from "@/components/InventoryView";
import { Databook } from "@/components/Databook";
import { RARITY_COLOR, RARITY_LABEL, VILLAGES, ELEMENTS, stats, type Rarity } from "@/lib/game";
import { Progress } from "@/components/ui/progress";
import { ImageUpload } from "@/components/ImageUpload";
import { SceneImagesManager } from "@/components/SceneImagesManager";
import { DailyMissionsPanel } from "@/components/DailyMissionsPanel";
import { updateCharacter } from "@/lib/character.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getLevelConfig } from "@/lib/level.functions";
import { levelProgress, DEFAULT_LEVEL_CONFIG, type LevelConfig } from "@/lib/level";
import { listMyPoses, listMySkillPoses, setSkillPose } from "@/lib/pose.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Character = {
  id: string; user_id: string; nickname: string; phone_e164: string;
  village: keyof typeof VILLAGES_MAP; element_primary: string; age: number | null;
  appearance: string | null; personality: string | null; history: string | null; bio: string | null;
  avatar_url: string | null; banner_url: string | null; inventory_bg_url: string | null;
  xp: number; ryo: number | null; hp_current: number | null;
  ef_current: number | null; em_current: number | null; chakra_current: number | null;
  clan: { name: string; rarity: string; element_bonus: string | null } | null;
};
const VILLAGES_MAP = Object.fromEntries(VILLAGES.map((v) => [v.id, v]));
const ELEMENTS_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));

export function CharacterSheet({ characterId }: { characterId: string }) {
  const [char, setChar] = useState<Character | null>(null);
  const [levelCfg, setLevelCfg] = useState<LevelConfig>(DEFAULT_LEVEL_CONFIG);
  const update = useServerFn(updateCharacter);
  const fetchLevelCfg = useServerFn(getLevelConfig);

  async function load() {
    const { data } = await supabase
      .from("characters")
      .select("id,user_id,nickname,phone_e164,village,element_primary,age,appearance,personality,history,bio,avatar_url,banner_url,inventory_bg_url,xp,ryo,hp_current,ef_current,em_current,chakra_current,clan:clans(name,rarity,element_bonus)")
      .eq("id", characterId).single();
    setChar(data as any);
  }
  useEffect(() => { load(); }, [characterId]);
  useEffect(() => { fetchLevelCfg({}).then(setLevelCfg).catch(() => {}); }, []);

  if (!char) return <div className="p-10 text-center text-muted-foreground">Carregando ficha…</div>;

  const village = (VILLAGES_MAP as any)[char.village];
  const element = (ELEMENTS_MAP as any)[char.element_primary];
  const s = stats(char.xp);
  const lp = levelProgress(char.xp, levelCfg);
  const rarity = ((char.clan?.rarity as Rarity) ?? "common");
  const efCur = char.ef_current == null ? s.ef : Math.min(s.ef, char.ef_current);
  const emCur = char.em_current == null ? s.em : Math.min(s.em, char.em_current);
  const ckCur = char.chakra_current == null ? s.chakra : Math.min(s.chakra, char.chakra_current);
  const hpMax = Math.max(1, char.xp);
  const hpCur = char.hp_current == null ? hpMax : Math.max(0, Math.min(hpMax, char.hp_current));

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
      <div className="relative h-44 sm:h-72 overflow-hidden bg-secondary">
        {char.banner_url ? (
          <img src={char.banner_url} className="w-full h-full object-cover opacity-70" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blood/40 via-background to-background" />
        )}
        <div className="absolute top-3 right-3">
          <ImageUpload label="Trocar banner" bucket="banners" userId={char.user_id}
            onUploaded={(url) => updateField("banner_url", url)} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 flex items-end gap-3 sm:gap-4">
          <div className="relative">
            <div className="h-20 w-20 sm:h-28 sm:w-28 rounded-lg border-2 border-gold overflow-hidden bg-card shrink-0">
              {char.avatar_url && <img src={char.avatar_url} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="absolute -bottom-2 -right-2">
              <ImageUpload label="Avatar" bucket="avatars" userId={char.user_id} compact
                onUploaded={(url) => updateField("avatar_url", url)} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-xs uppercase tracking-widest text-gold truncate">{village?.name} · {village?.kanji}</div>
            <h1 className="font-display text-2xl sm:text-4xl font-black truncate">{char.nickname}</h1>
            <div className="mt-1 text-xs sm:text-sm truncate">
              <span className={RARITY_COLOR[rarity]}>{RARITY_LABEL[rarity]}</span>
              {" · "}
              <span className="text-gold">{char.clan?.name ?? "Sem clã"}</span>
              {" · "}
              <span style={{ color: element?.color }}>{element?.kanji} {element?.name}</span>
            </div>
            {char.clan && (
              <a href="/clan-tree" className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:underline">
                🌳 Árvore do Clã
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-6">
        <div className="sm:col-span-3 scroll-panel rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">Vida (HP = XP)</div>
            <div className="text-xs tabular-nums text-emerald-400">{hpCur.toLocaleString("pt-BR")} / {hpMax.toLocaleString("pt-BR")}</div>
          </div>
          <div className="h-2 rounded overflow-hidden bg-input">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(hpCur / hpMax) * 100}%` }} />
          </div>
        </div>
        <StatBlock label="Energia Física (EF)" value={`${efCur} / ${s.ef}`} accent="oklch(0.55 0.22 25)" />
        <StatBlock label="Energia Mental (EM)" value={`${emCur} / ${s.em}`} accent="oklch(0.6 0.15 220)" />
        <StatBlock label="Chakra total" value={`${ckCur} / ${s.chakra}`} accent="oklch(0.78 0.15 80)" />
      </div>
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gold font-semibold">Nível {lp.level}{lp.maxed && " (máx)"}</span>
          <span className="text-muted-foreground">
            {lp.maxed
              ? `XP: ${char.xp.toLocaleString("pt-BR")}`
              : `XP: ${char.xp.toLocaleString("pt-BR")} / ${lp.nextFloor.toLocaleString("pt-BR")}`}
          </span>
        </div>
        <Progress value={lp.pct} />
        <div className="text-xs text-gold mt-2">Ryo: {char.ryo ?? 0} 💰</div>
      </div>

      <Tabs defaultValue="ficha" className="p-4 sm:p-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
          <TabsTrigger value="ficha" className="text-xs sm:text-sm">Ficha</TabsTrigger>
          <TabsTrigger value="inventario" className="text-xs sm:text-sm">Inventário</TabsTrigger>
          <TabsTrigger value="databook" className="text-xs sm:text-sm">Databook</TabsTrigger>
          <TabsTrigger value="poses" className="text-xs sm:text-sm">Poses</TabsTrigger>
        </TabsList>
        <TabsContent value="ficha" className="mt-4">
          <div className="scroll-panel rounded-lg p-4 sm:p-6 space-y-4">
            <div className="flex justify-end">
              <SceneImagesManager characterId={characterId} userId={char.user_id} />
            </div>
            {char.bio && <p className="italic text-gold">"{char.bio}"</p>}
            <FichaBlock title="Aparência" text={char.appearance} />
            <FichaBlock title="Personalidade" text={char.personality} />
            <FichaBlock title="História" text={char.history} />
            <div className="text-xs text-muted-foreground break-words">Idade: {char.age ?? "—"} · WhatsApp: {char.phone_e164}</div>
          </div>
          <div className="mt-4"><DailyMissionsPanel characterId={characterId} /></div>
        </TabsContent>
        <TabsContent value="inventario" className="mt-4">
          <InventoryView characterId={characterId} userId={char.user_id}
            bgUrl={char.inventory_bg_url}
            onBgChange={(url) => updateField("inventory_bg_url", url)} />
        </TabsContent>
        <TabsContent value="databook" className="mt-4">
          <Databook characterId={characterId} />
        </TabsContent>
        <TabsContent value="poses" className="mt-4">
          <PosesTab characterId={characterId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PosesTab({ characterId }: { characterId: string }) {
  const listPoses = useServerFn(listMyPoses);
  const listMap = useServerFn(listMySkillPoses);
  const setPose = useServerFn(setSkillPose);
  const [poses, setPoses] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});

  async function loadAll() {
    try {
      const [p, m, cs] = await Promise.all([
        listPoses({} as any),
        listMap({} as any),
        supabase.from("character_skills").select("skill_id, skills(id,name,rank)").eq("character_id", characterId),
      ]);
      setPoses(p as any);
      const mp: Record<string, string> = {};
      (m as any[]).forEach((r) => { if (r.pose_id) mp[r.skill_id] = r.pose_id; });
      setMap(mp);
      setSkills(((cs.data ?? []) as any[]).map((r) => r.skills).filter(Boolean));
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { loadAll(); }, [characterId]);

  async function assign(skillId: string, poseId: string | null) {
    try {
      await setPose({ data: { skill_id: skillId, pose_id: poseId } } as any);
      setMap((m) => {
        const n = { ...m };
        if (poseId) n[skillId] = poseId; else delete n[skillId];
        return n;
      });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="scroll-panel rounded-lg p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg text-gold">Minhas poses</h3>
        <p className="text-xs text-muted-foreground">Poses são concedidas pelos admins. Durante o combate, seu sprite troca para a pose atribuída à habilidade usada.</p>
      </div>
      {poses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pose disponível. Peça a um admin.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {poses.map((p) => (
            <div key={p.id} className="border border-border rounded p-2 bg-input/30">
              <div className="h-24 flex items-center justify-center bg-black/30 rounded overflow-hidden">
                <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="text-[11px] text-center mt-1 truncate">{p.name}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="font-display text-lg text-gold mt-4">Atribuir por habilidade</h3>
        {skills.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma habilidade aprendida.</p>}
        <div className="grid gap-2 mt-2">
          {skills.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border border-border rounded p-2 bg-input/20">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">Rank {s.rank}</div>
              </div>
              <Select value={map[s.id] ?? "__none__"} onValueChange={(v) => assign(s.id, v === "__none__" ? null : v)}>
                <SelectTrigger className="w-40 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {poses.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="scroll-panel rounded-lg p-3 sm:p-4">
      <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl sm:text-3xl font-black" style={{ color: accent }}>{value}</div>
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