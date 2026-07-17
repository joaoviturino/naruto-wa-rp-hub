import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, Plus, Search, Swords, Store, ShoppingBag, Gift, GraduationCap, MessageCircle, Package, Users, ChevronDown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { upsertNpc, deleteNpc, setNpcSkills, setNpcLocations } from "@/lib/npc.functions";
import { setNpcLearningSteps } from "@/lib/minigame.functions";
import { toast } from "sonner";
import { NpcGroupManager } from "./NpcGroupManager";
import { ComboSelect } from "@/components/ui/combo-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type DropRow = { item_id: string; qty: number; chance: number };
type ShopRow = { item_id: string; price: number; stock: number };
type BuyRow = { item_id: string; price: number; max_per_day: number };
type RewardRow = { item_id: string; qty: number };
type NpcKind = "aggressive" | "shop" | "reward" | "learning" | "object" | "dialogue" | "buyer" | "employer";
type LearnBlock = { id: string; kind: "text" | "image"; text?: string | null; image_url?: string | null };
type Npc = {
  id: string; name: string; image_url: string | null; description: string | null;
  battle_bg_url: string | null;
  music_url: string | null;
  hp_max: number; xp: number; energy_max: number;
  reward_xp: number; reward_ryo: number; drop_table: DropRow[];
  avg_damage?: number; crit_chance?: number; crit_multiplier?: number;
  defense?: number;
  kind: NpcKind; dialog_intro: string | null; dialog_outro: string | null;
  shop_items: ShopRow[]; reward_items: RewardRow[]; reward_cooldown_hours: number;
  buy_items: BuyRow[];
  required_mission_id: string | null;
  offer_mission_id: string | null;
  tutorial_blocks?: LearnBlock[];
  learning_min_read_seconds?: number;
  linked_minigame_id?: string | null;
};
type Skill = { id: string; name: string; rank: string };
type Item = { id: string; name: string; type: string };
type Mission = { id: string; name: string; rank: string };
type MinigameLite = { id: string; name: string; kind: string };
type LocationLite = { id: string; name: string };

type LearningStep = { id?: string; minigame_id: string; position: number; required_rank: string | null; required_profs: Array<{ skill_class: string; nivel?: string | null; maestria?: string | null }> };

const NINJA_RANKS_ = ["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"];
const SKILL_RANKS_ = ["E","D","C","B","A","S"];
const SKILL_CLASSES_ = [
  "genjutsu","ninjutsu","taijutsu","shinjutsu","armadilha","boujutsu","bukijutsu","bunshinjutsu",
  "doujutsu","fluxo_de_chakra","formacao","estilo_de_luta","fuuinjutsu","gijutsu","hiden","juinjutsu",
  "jujutsu","jutsu_basico","kaijutsu","kekkaijutsu","kekkei_genkai","kekkei_moura","kekkei_touta",
  "kenjutsu","kinjutsu","kinkojutsu","konbijutsu","kugutsujutsu","kyuuinjutsu","ninjutsu_espaco_tempo",
  "ninjutsu_medico","nintaijutsu","saiseijutsu","senjutsu","shurikenjutsu","tansakujutsu",
  "tenseijutsu","tonjutsu","yuugoujutsu",
];

const KIND_META: Record<NpcKind, { label: string; icon: any; color: string }> = {
  aggressive: { label: "Agressivo", icon: Swords, color: "text-red-400 border-red-500/40 bg-red-500/10" },
  shop:       { label: "Loja",      icon: Store, color: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  buyer:      { label: "Comprador", icon: ShoppingBag, color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  reward:     { label: "Recompensa",icon: Gift, color: "text-gold border-gold/40 bg-gold/10" },
  learning:   { label: "Aprendizado", icon: GraduationCap, color: "text-sky-400 border-sky-500/40 bg-sky-500/10" },
  dialogue:   { label: "Diálogo",   icon: MessageCircle, color: "text-violet-400 border-violet-500/40 bg-violet-500/10" },
  object:     { label: "Objeto",    icon: Package, color: "text-slate-300 border-slate-500/40 bg-slate-500/10" },
  employer:   { label: "Empregador", icon: MessageCircle, color: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10" },
};

export function NpcManager() {
  // (EmployerJobPicker defined at file bottom)
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [minigames, setMinigames] = useState<MinigameLite[]>([]);
  const [assigned, setAssigned] = useState<Record<string, Set<string>>>({});
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [npcLocs, setNpcLocs] = useState<Record<string, Set<string>>>({});
  const [locQuery, setLocQuery] = useState("");
  const [learningSteps, setLearningSteps] = useState<Record<string, LearningStep[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<NpcKind | "all">("all");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);
  const save = useServerFn(upsertNpc);
  const del = useServerFn(deleteNpc);
  const setSkillsFn = useServerFn(setNpcSkills);
  const setLocsFn = useServerFn(setNpcLocations);
  const saveSteps = useServerFn(setNpcLearningSteps);

  async function load() {
    const [n, s, ns, it, mi, mg, locs, lnpcs] = await Promise.all([
      supabase.from("npcs").select("*").order("name"),
      supabase.from("skills").select("id,name,rank").order("name"),
      supabase.from("npc_skills").select("npc_id,skill_id"),
      supabase.from("items").select("id,name,type").order("name"),
      supabase.from("missions").select("id,name,rank").order("name"),
      supabase.from("minigames").select("id,name,kind").order("name"),
      supabase.from("locations").select("id,name").order("name"),
      supabase.from("location_npcs").select("location_id,npc_id"),
    ]);
    setNpcs(((n.data as any[]) ?? []).map((r) => ({
      ...r,
      kind: (r.kind ?? "aggressive") as NpcKind,
      battle_bg_url: r.battle_bg_url ?? null,
      music_url: r.music_url ?? null,
      drop_table: Array.isArray(r.drop_table) ? r.drop_table : [],
      shop_items: Array.isArray(r.shop_items) ? r.shop_items : [],
      buy_items: Array.isArray(r.buy_items) ? r.buy_items : [],
      reward_items: Array.isArray(r.reward_items) ? r.reward_items : [],
      reward_cooldown_hours: Number(r.reward_cooldown_hours ?? 24),
      required_mission_id: r.required_mission_id ?? null,
      offer_mission_id: r.offer_mission_id ?? null,
      tutorial_blocks: Array.isArray(r.tutorial_blocks) ? r.tutorial_blocks : [],
      learning_min_read_seconds: Number(r.learning_min_read_seconds ?? 30),
      linked_minigame_id: r.linked_minigame_id ?? null,
    })));
    setSkills((s.data as Skill[]) ?? []);
    setItems((it.data as Item[]) ?? []);
    setMissions((mi.data as Mission[]) ?? []);
    setMinigames((mg.data as MinigameLite[]) ?? []);
    setLocations((locs.data as LocationLite[]) ?? []);
    const lmap: Record<string, Set<string>> = {};
    ((lnpcs.data as any[]) ?? []).forEach((r) => {
      (lmap[r.npc_id] ??= new Set<string>()).add(r.location_id);
    });
    setNpcLocs(lmap);
    const map: Record<string, Set<string>> = {};
    (ns.data ?? []).forEach((r: any) => {
      if (!map[r.npc_id]) map[r.npc_id] = new Set();
      map[r.npc_id].add(r.skill_id);
    });
    setAssigned(map);
    // Learning steps
    const { data: ls } = await supabase.from("npc_learning_steps").select("id,npc_id,minigame_id,position,required_rank,required_profs").order("position");
    const bynpc: Record<string, LearningStep[]> = {};
    for (const r of (ls as any[]) ?? []) {
      const step: LearningStep = { id: r.id, minigame_id: r.minigame_id, position: r.position, required_rank: r.required_rank ?? null, required_profs: Array.isArray(r.required_profs) ? r.required_profs : [] };
      (bynpc[r.npc_id] ??= []).push(step);
    }
    setLearningSteps(bynpc);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    try {
      const { id } = await save({ data: { name: name.trim(), hp_max: 100, xp: 100, energy_max: 100, reward_xp: 50, reward_ryo: 20, drop_table: [] } } as any);
      setName(""); toast.success("NPC criado."); setSelected(id); load();
    } catch (e: any) { toast.error(e.message); }
  }
  async function remove(id: string) {
    if (!confirm("Remover este NPC?")) return;
    try { await del({ data: { id } }); if (selected === id) setSelected(null); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !selected) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Máx 5MB.");
    const ext = f.name.split(".").pop() ?? "png";
    const path = `${selected}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("npcs").upload(path, f, { upsert: true, contentType: f.type });
    if (up.error) return toast.error(up.error.message);
    const signed = await supabase.storage.from("npcs").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed.data?.signedUrl) return;
    const npc = npcs.find((x) => x.id === selected)!;
    await save({ data: { ...npc, image_url: signed.data.signedUrl } } as any);
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function uploadBattleBg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !selected) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Máx 8MB.");
    const ext = f.name.split(".").pop() ?? "png";
    const path = `${selected}/bg/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("npcs").upload(path, f, { upsert: true, contentType: f.type });
    if (up.error) return toast.error(up.error.message);
    const signed = await supabase.storage.from("npcs").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed.data?.signedUrl) return;
    const npc = npcs.find((x) => x.id === selected)!;
    await save({ data: { ...npc, battle_bg_url: signed.data.signedUrl } } as any);
    if (bgRef.current) bgRef.current.value = "";
    load();
  }

  async function uploadMusic(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !selected) return;
    if (f.size > 15 * 1024 * 1024) return toast.error("Máx 15MB.");
    const ext = f.name.split(".").pop() ?? "mp3";
    const path = `${selected}/music/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("npcs").upload(path, f, { upsert: true, contentType: f.type });
    if (up.error) return toast.error(up.error.message);
    const signed = await supabase.storage.from("npcs").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed.data?.signedUrl) return;
    const npc = npcs.find((x) => x.id === selected)!;
    await save({ data: { ...npc, music_url: signed.data.signedUrl } } as any);
    if (musicRef.current) musicRef.current.value = "";
    load();
  }

  const sel = npcs.find((n) => n.id === selected);
  const selSkills = selected ? assigned[selected] ?? new Set<string>() : new Set<string>();
  const filtered = npcs.filter((n) => {
    if (kindFilter !== "all" && n.kind !== kindFilter) return false;
    if (query && !n.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const kindCounts = npcs.reduce<Record<string, number>>((acc, n) => { acc[n.kind] = (acc[n.kind] ?? 0) + 1; return acc; }, {});

  return (
    <div className="space-y-4">
      <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen} className="scroll-panel rounded-lg">
        <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 hover:bg-secondary/40 rounded-lg">
          <Users size={16} className="text-gold" />
          <span className="font-display text-sm">Grupos de NPCs</span>
          <Badge variant="outline" className="text-[10px]">gerenciar</Badge>
          <ChevronDown size={16} className={`ml-auto transition-transform ${groupsOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 pt-0">
          <NpcGroupManager npcs={npcs.map((n) => ({ id: n.id, name: n.name, kind: n.kind }))} />
        </CollapsibleContent>
      </Collapsible>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="scroll-panel rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input placeholder="Nome do novo NPC" value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
              <Button onClick={create} size="icon" title="Criar"><Plus size={16} /></Button>
            </div>
          </div>
          <div className="scroll-panel rounded-lg p-3 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className="pl-7 h-8 text-sm" />
            </div>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => setKindFilter("all")}
                className={`text-[10px] px-2 py-0.5 rounded border ${kindFilter === "all" ? "bg-gold text-background border-gold" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                Todos <span className="opacity-60">({npcs.length})</span>
              </button>
              {(Object.keys(KIND_META) as NpcKind[]).map((k) => {
                const meta = KIND_META[k];
                const active = kindFilter === k;
                const count = kindCounts[k] ?? 0;
                if (!count && !active) return null;
                return (
                  <button key={k} type="button" onClick={() => setKindFilter(active ? "all" : k)}
                    className={`text-[10px] px-2 py-0.5 rounded border inline-flex items-center gap-1 ${active ? "bg-gold text-background border-gold" : `${meta.color}`}`}>
                    <meta.icon size={10} /> {meta.label} <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="scroll-panel rounded-lg p-2 max-h-[520px] overflow-y-auto">
            {filtered.map((n) => {
              const meta = KIND_META[n.kind] ?? KIND_META.aggressive;
              const Icon = meta.icon;
              return (
                <div key={n.id} className={`group flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selected===n.id?"bg-secondary ring-1 ring-gold/40":"hover:bg-secondary/50"}`}
                  onClick={() => setSelected(n.id)}>
                  <div className="w-9 h-9 rounded bg-input overflow-hidden shrink-0 border border-border">
                    {n.image_url ? <img src={n.image_url} alt="" className="w-full h-full object-cover" /> : <Icon size={16} className="w-full h-full p-2 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{n.name}</div>
                    <div className={`text-[9px] px-1 py-px rounded border inline-flex items-center gap-0.5 ${meta.color}`}>
                      <Icon size={8} /> {meta.label}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={(e) => { e.stopPropagation(); remove(n.id); }}><Trash2 size={12} /></Button>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="text-xs text-muted-foreground p-3 text-center">{npcs.length === 0 ? "Nenhum NPC ainda." : "Nada com esse filtro."}</div>}
          </div>
      </div>

      {sel ? (
        <div className="space-y-4">
          {/* Sticky header: identidade rápida + tipo */}
          <div className="scroll-panel rounded-lg p-3 sticky top-2 z-10 backdrop-blur bg-background/80 border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-secondary overflow-hidden shrink-0 border border-border">
                {sel.image_url && <img src={sel.image_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <Input value={sel.name} className="flex-1 font-display text-lg h-10"
                onChange={async (e) => { await save({ data: { ...sel, name: e.target.value } } as any); load(); }} />
              <div className="w-44">
                <ComboSelect
                  value={sel.kind}
                  onChange={async (v) => { await save({ data: { ...sel, kind: v as NpcKind } } as any); load(); }}
                  triggerClassName="h-10 text-sm"
                  options={(Object.keys(KIND_META) as NpcKind[]).map((k) => ({ value: k, label: KIND_META[k].label }))}
                />
              </div>
            </div>
          </div>

          <Tabs defaultValue="identidade" className="space-y-4">
            <TabsList className="w-full flex-wrap h-auto justify-start">
              <TabsTrigger value="identidade">Identidade</TabsTrigger>
              {sel.kind === "aggressive" && <TabsTrigger value="combate">Combate</TabsTrigger>}
              {sel.kind === "aggressive" && <TabsTrigger value="drops">Drops & Skills</TabsTrigger>}
              {sel.kind !== "aggressive" && sel.kind !== "object" && <TabsTrigger value="dialogo">Diálogo & Missão</TabsTrigger>}
              {sel.kind === "shop" && <TabsTrigger value="loja">Loja</TabsTrigger>}
              {sel.kind === "buyer" && <TabsTrigger value="compra">Compra</TabsTrigger>}
              {sel.kind === "reward" && <TabsTrigger value="recompensa">Recompensa</TabsTrigger>}
              {sel.kind === "learning" && <TabsTrigger value="aprendizagem">Aprendizagem</TabsTrigger>}
              {sel.kind === "object" && <TabsTrigger value="objeto">Objeto</TabsTrigger>}
              {sel.kind === "employer" && <TabsTrigger value="emprego">Emprego</TabsTrigger>}
            </TabsList>

            <TabsContent value="identidade" className="space-y-4 mt-0">
          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-4">
              <div className="w-40 h-40 rounded bg-secondary overflow-hidden shrink-0">
                {sel.image_url && <img src={sel.image_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="flex-1 space-y-2">
                <Textarea defaultValue={sel.description ?? ""} rows={2} placeholder="Descrição"
                  onBlur={async (e) => { await save({ data: { ...sel, description: e.target.value } } as any); load(); }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" /> PNG do NPC (aparece no combate)
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                <div className="pt-2 border-t border-border/40">
                  <div className="text-xs text-muted-foreground mb-1">Música de fundo (toca ao interagir)</div>
                  <Input
                    placeholder="Link direto mp3/ogg (opcional)"
                    defaultValue={sel.music_url ?? ""}
                    onBlur={async (e) => {
                      const v = e.target.value.trim() || null;
                      if ((sel.music_url ?? null) === v) return;
                      await save({ data: { ...sel, music_url: v } } as any);
                      load();
                    }}
                    className="mb-2"
                  />
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => musicRef.current?.click()}>
                      <Upload size={14} className="mr-1" /> Upload áudio
                    </Button>
                    {sel.music_url && (
                      <Button variant="ghost" size="sm" onClick={async () => { await save({ data: { ...sel, music_url: null } } as any); load(); }}>Remover</Button>
                    )}
                    {sel.music_url && <audio src={sel.music_url} controls className="h-8 max-w-[220px]" />}
                  </div>
                  <input ref={musicRef} type="file" accept="audio/*" className="hidden" onChange={uploadMusic} />
                </div>
              </div>
            </div>
          </div>
          <div className="scroll-panel rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-sm text-gold">Locais deste NPC</h4>
              <Badge variant="outline" className="text-[10px]">
                {(npcLocs[sel.id]?.size ?? 0)} selecionado(s)
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Marque os locais em que este NPC deve aparecer. Vale para todos os tipos (agressivo, loja, recompensa, aprendizado, diálogo, objeto).
            </p>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={locQuery} onChange={(e) => setLocQuery(e.target.value)} placeholder="Buscar local…" className="pl-7 h-8 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-64 overflow-y-auto rounded border border-border/50 p-2 bg-input/20">
              {locations
                .filter((l) => !locQuery || l.name.toLowerCase().includes(locQuery.toLowerCase()))
                .map((l) => {
                  const set = npcLocs[sel.id] ?? new Set<string>();
                  const checked = set.has(l.id);
                  return (
                    <label key={l.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer ${checked ? "bg-gold/15 border border-gold/40" : "hover:bg-secondary/50 border border-transparent"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={async (e) => {
                          const cur = new Set(npcLocs[sel.id] ?? new Set<string>());
                          if (e.target.checked) cur.add(l.id); else cur.delete(l.id);
                          setNpcLocs((prev) => ({ ...prev, [sel.id]: cur }));
                          try {
                            await setLocsFn({ data: { npc_id: sel.id, location_ids: Array.from(cur) } } as any);
                          } catch (err: any) {
                            toast.error(err.message ?? "Falha ao salvar");
                            load();
                          }
                        }}
                      />
                      <span className="truncate">{l.name}</span>
                    </label>
                  );
                })}
              {locations.length === 0 && (
                <div className="text-xs text-muted-foreground p-2 col-span-full italic">Nenhum local cadastrado.</div>
              )}
            </div>
          </div>
            </TabsContent>

            {sel.kind === "aggressive" && (
            <TabsContent value="combate" className="space-y-4 mt-0">
              <div className="scroll-panel rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <NumField label="HP máximo" value={sel.hp_max} onSave={(v) => save({ data: { ...sel, hp_max: v } } as any).then(load)} />
              <NumField label="XP (define stats)" value={sel.xp} onSave={(v) => save({ data: { ...sel, xp: v } } as any).then(load)} />
              <NumField label="Energia máxima" value={sel.energy_max} onSave={(v) => save({ data: { ...sel, energy_max: v } } as any).then(load)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Recompensa XP" value={sel.reward_xp ?? 0} onSave={(v) => save({ data: { ...sel, reward_xp: v } } as any).then(load)} />
              <NumField label="Recompensa Ryo" value={sel.reward_ryo ?? 0} onSave={(v) => save({ data: { ...sel, reward_ryo: v } } as any).then(load)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Dano médio" value={sel.avg_damage ?? 0} onSave={(v) => save({ data: { ...sel, avg_damage: v } } as any).then(load)} />
              <NumField label="Crítico (%)" value={sel.crit_chance ?? 10} onSave={(v) => save({ data: { ...sel, crit_chance: Math.max(0, Math.min(100, v)) } } as any).then(load)} />
              <NumField label="Mult. crítico (×)" value={Number(sel.crit_multiplier ?? 1.5)} onSave={(v) => save({ data: { ...sel, crit_multiplier: Math.max(1, v) } } as any).then(load)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Se o dano médio for &gt; 0, o NPC usa esse valor como base (variação ±20%). Ao acertar um crítico ({sel.crit_chance ?? 10}%), o dano é multiplicado por {Number(sel.crit_multiplier ?? 1.5).toFixed(2)}×.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Defesa (%) — reduz dano recebido" value={sel.defense ?? 0} onSave={(v) => save({ data: { ...sel, defense: Math.max(0, Math.min(90, v)) } } as any).then(load)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Defesa {sel.defense ?? 0}% reduz o dano recebido.
            </p>
            <p className="text-xs text-muted-foreground">
              XP {sel.xp} → EF {Math.floor(sel.xp/2)}, EM {sel.xp - Math.floor(sel.xp/2)}, Chakra {sel.xp}.
            </p>
                <div className="pt-3 border-t border-border/40">
                  <div className="text-xs text-muted-foreground mb-1">Cenário de fundo (combate)</div>
                  {sel.battle_bg_url && (
                    <img src={sel.battle_bg_url} alt="" className="w-full max-w-[240px] rounded border border-border mb-2 object-cover" />
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => bgRef.current?.click()}>
                      <Upload size={14} className="mr-1" /> Enviar fundo
                    </Button>
                    {sel.battle_bg_url && (
                      <Button variant="ghost" size="sm" onClick={async () => { await save({ data: { ...sel, battle_bg_url: null } } as any); load(); }}>Remover</Button>
                    )}
                  </div>
                  <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={uploadBattleBg} />
                </div>
              </div>
            </TabsContent>
            )}

            {sel.kind !== "aggressive" && sel.kind !== "object" && (
            <TabsContent value="dialogo" className="space-y-4 mt-0">
          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold">Diálogos</h4>
              <div className="grid gap-2">
                <Label>Diálogo de introdução</Label>
                <Textarea rows={2} defaultValue={sel.dialog_intro ?? ""}
                  onBlur={async (e) => { await save({ data: { ...sel, dialog_intro: e.target.value } } as any); load(); }} />
                <Label>Diálogo de despedida</Label>
                <Textarea rows={2} defaultValue={sel.dialog_outro ?? ""}
                  onBlur={async (e) => { await save({ data: { ...sel, dialog_outro: e.target.value } } as any); load(); }} />
                <div>
                  <Label>Missão oferecida ao jogador (opcional)</Label>
                  <ComboSelect
                    value={sel.offer_mission_id ?? ""}
                    onChange={async (v) => {
                      await save({ data: { ...sel, offer_mission_id: v || null } } as any); load();
                    }}
                    triggerClassName="mt-1 h-9 text-sm"
                    placeholder="— Não oferece missão —"
                    options={[
                      { value: "", label: "— Não oferece missão —" },
                      ...missions.map((m) => ({ value: m.id, label: `[${m.rank}] ${m.name}` })),
                    ]}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    O jogador aceita a missão com este NPC, faz os objetivos e retorna aqui para entregar. Recompensa da missão é definida na aba <b>Missões</b> — evite duplicar em "Recompensa do NPC" para não pagar duas vezes.
                  </p>
                </div>
              </div>
          </div>
            </TabsContent>
            )}

          {sel.kind === "shop" && (
            <TabsContent value="loja" className="space-y-4 mt-0">
            <div className="scroll-panel rounded-lg p-4 space-y-2">
              <h4 className="font-display text-lg text-gold">Itens da loja</h4>
              {(sel.shop_items ?? []).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboSelect
                      value={s.item_id}
                      onChange={async (v) => {
                        const next = [...sel.shop_items]; next[i] = { ...s, item_id: v };
                        await save({ data: { ...sel, shop_items: next } } as any); load();
                      }}
                      triggerClassName="h-9 text-sm"
                      options={items.map((it) => ({ value: it.id, label: it.name }))}
                    />
                  </div>
                  <Input type="number" min={0} className="w-24" defaultValue={s.price}
                    onBlur={async (e) => {
                      const next = [...sel.shop_items]; next[i] = { ...s, price: Math.max(0, Number(e.target.value)) };
                      await save({ data: { ...sel, shop_items: next } } as any); load();
                    }} />
                  <span className="text-xs text-muted-foreground">Ryo</span>
                  <Input type="number" min={-1} className="w-20" defaultValue={s.stock}
                    title="-1 = ilimitado"
                    onBlur={async (e) => {
                      const next = [...sel.shop_items]; next[i] = { ...s, stock: Number(e.target.value) };
                      await save({ data: { ...sel, shop_items: next } } as any); load();
                    }} />
                  <span className="text-xs text-muted-foreground">estoque</span>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    const next = sel.shop_items.filter((_, j) => j !== i);
                    await save({ data: { ...sel, shop_items: next } } as any); load();
                  }}><Trash2 size={14} /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={async () => {
                if (!items.length) return toast.error("Cadastre um item primeiro.");
                const next = [...(sel.shop_items ?? []), { item_id: items[0].id, price: 100, stock: -1 }];
                await save({ data: { ...sel, shop_items: next } } as any); load();
              }}><Plus size={14} className="mr-1" /> Adicionar item</Button>
              <p className="text-xs text-muted-foreground">Use estoque -1 para vender ilimitado.</p>
            </div>
            </TabsContent>
          )}

          {sel.kind === "buyer" && (
            <TabsContent value="compra" className="space-y-4 mt-0">
            <div className="scroll-panel rounded-lg p-4 space-y-2">
              <h4 className="font-display text-lg text-gold">Itens que este NPC compra</h4>
              <p className="text-xs text-muted-foreground">Configure quais itens o comprador aceita e o preço pago por unidade.</p>
              {(sel.buy_items ?? []).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboSelect
                      value={s.item_id}
                      onChange={async (v) => {
                        const next = [...(sel.buy_items ?? [])]; next[i] = { ...s, item_id: v };
                        await save({ data: { ...sel, buy_items: next } } as any); load();
                      }}
                      triggerClassName="h-9 text-sm"
                      options={items.map((it) => ({ value: it.id, label: it.name }))}
                    />
                  </div>
                  <Input type="number" min={0} className="w-24" defaultValue={s.price}
                    onBlur={async (e) => {
                      const next = [...(sel.buy_items ?? [])]; next[i] = { ...s, price: Math.max(0, Number(e.target.value)) };
                      await save({ data: { ...sel, buy_items: next } } as any); load();
                    }} />
                  <span className="text-xs text-muted-foreground">Ryo/un.</span>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    const next = (sel.buy_items ?? []).filter((_, j) => j !== i);
                    await save({ data: { ...sel, buy_items: next } } as any); load();
                  }}><Trash2 size={14} /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={async () => {
                if (!items.length) return toast.error("Cadastre um item primeiro.");
                const next = [...(sel.buy_items ?? []), { item_id: items[0].id, price: 10, max_per_day: -1 }];
                await save({ data: { ...sel, buy_items: next } } as any); load();
              }}><Plus size={14} className="mr-1" /> Adicionar item</Button>
            </div>
            </TabsContent>
          )}

          {sel.kind === "reward" && (
            <TabsContent value="recompensa" className="space-y-4 mt-0">
            <div className="scroll-panel rounded-lg p-4 space-y-2">
              <h4 className="font-display text-lg text-gold">Recompensas</h4>
              <div className="grid grid-cols-3 gap-3">
                <NumField label="XP" value={sel.reward_xp ?? 0} onSave={(v) => save({ data: { ...sel, reward_xp: v } } as any).then(load)} />
                <NumField label="Ryo" value={sel.reward_ryo ?? 0} onSave={(v) => save({ data: { ...sel, reward_ryo: v } } as any).then(load)} />
                <NumField label="Cooldown (h)" value={sel.reward_cooldown_hours ?? 24} onSave={(v) => save({ data: { ...sel, reward_cooldown_hours: v } } as any).then(load)} />
              </div>
              {(sel.reward_items ?? []).map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboSelect
                      value={r.item_id}
                      onChange={async (v) => {
                        const next = [...sel.reward_items]; next[i] = { ...r, item_id: v };
                        await save({ data: { ...sel, reward_items: next } } as any); load();
                      }}
                      triggerClassName="h-9 text-sm"
                      options={items.map((it) => ({ value: it.id, label: it.name }))}
                    />
                  </div>
                  <Input type="number" min={1} className="w-20" defaultValue={r.qty}
                    onBlur={async (e) => {
                      const next = [...sel.reward_items]; next[i] = { ...r, qty: Math.max(1, Number(e.target.value)) };
                      await save({ data: { ...sel, reward_items: next } } as any); load();
                    }} />
                  <Button variant="ghost" size="icon" onClick={async () => {
                    const next = sel.reward_items.filter((_, j) => j !== i);
                    await save({ data: { ...sel, reward_items: next } } as any); load();
                  }}><Trash2 size={14} /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={async () => {
                if (!items.length) return toast.error("Cadastre um item primeiro.");
                const next = [...(sel.reward_items ?? []), { item_id: items[0].id, qty: 1 }];
                await save({ data: { ...sel, reward_items: next } } as any); load();
              }}><Plus size={14} className="mr-1" /> Adicionar item</Button>
              <div>
                <label className="text-xs text-muted-foreground">Missão obrigatória (opcional)</label>
                <ComboSelect
                  value={sel.required_mission_id ?? ""}
                  onChange={async (v) => {
                    await save({ data: { ...sel, required_mission_id: v || null } } as any); load();
                  }}
                  triggerClassName="mt-1 h-9 text-sm"
                  placeholder="— Sem requisito —"
                  options={[
                    { value: "", label: "— Sem requisito —" },
                    ...missions.map((m) => ({ value: m.id, label: `[${m.rank}] ${m.name}` })),
                  ]}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Só poderá receber a recompensa quem já concluiu esta missão.</p>
              </div>
            </div>
            </TabsContent>
          )}

          {sel.kind === "learning" && (
            <TabsContent value="aprendizagem" className="space-y-4 mt-0">
            <div className="scroll-panel rounded-lg p-4 space-y-3">
              <h4 className="font-display text-lg text-gold">Aprendizagem</h4>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Leitura mínima do tutorial (min)</Label>
                  <Input type="number" min={1}
                    defaultValue={Math.max(1, Math.round((sel.learning_min_read_seconds ?? 30) / 60))}
                    onBlur={async (e) => { await save({ data: { ...sel, learning_min_read_seconds: Math.max(5, Number(e.target.value) * 60) } } as any); load(); }} />
                </div>
              </div>
              <LearnBlocksEditor
                blocks={sel.tutorial_blocks ?? []}
                onChange={async (bs) => { await save({ data: { ...sel, tutorial_blocks: bs } } as any); load(); }}
                npcId={sel.id}
              />
              <LearningStepsEditor
                steps={learningSteps[sel.id] ?? []}
                minigames={minigames}
                onSave={async (steps) => {
                  try {
                    await saveSteps({ data: { npc_id: sel.id, steps: steps.map((s, i) => ({ minigame_id: s.minigame_id, position: i, required_rank: s.required_rank ?? null, required_profs: s.required_profs ?? [] })) } });
                    toast.success("Passos salvos.");
                    load();
                  } catch (e: any) { toast.error(e.message); }
                }}
              />
            </div>
            </TabsContent>
          )}

          {sel.kind === "object" && (
            <TabsContent value="objeto" className="space-y-4 mt-0">
            <div className="scroll-panel rounded-lg p-4 space-y-3">
              <h4 className="font-display text-lg text-gold">Objeto interativo</h4>
              <p className="text-xs text-muted-foreground">
                Objetos aparecem no chat com um botão central em dispositivos móveis. Ao clicar, o jogador inicia o minigame vinculado.
              </p>
              <div>
                <Label>Minigame vinculado</Label>
                <ComboSelect
                  value={sel.linked_minigame_id ?? ""}
                  onChange={async (v) => {
                    await save({ data: { ...sel, linked_minigame_id: v || null } } as any); load();
                  }}
                  triggerClassName="mt-1 h-9 text-sm"
                  placeholder="— Nenhum —"
                  options={[
                    { value: "", label: "— Nenhum —" },
                    ...minigames.map((m) => ({ value: m.id, label: `[${m.kind}] ${m.name}` })),
                  ]}
                />
              </div>
            </div>
            </TabsContent>
          )}

          {sel.kind === "aggressive" && (
          <TabsContent value="drops" className="space-y-4 mt-0">
          <div className="scroll-panel rounded-lg p-4 space-y-2">
            <h4 className="font-display text-lg text-gold">Tabela de drop</h4>
            {/* drop table below */}
            <div className="space-y-2">
              {(sel.drop_table ?? []).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboSelect
                      value={d.item_id}
                      onChange={async (v) => {
                        const next = [...sel.drop_table]; next[i] = { ...d, item_id: v };
                        await save({ data: { ...sel, drop_table: next } } as any); load();
                      }}
                      triggerClassName="h-9 text-sm"
                      options={items.map((it) => ({ value: it.id, label: it.name }))}
                    />
                  </div>
                  <Input type="number" min={1} className="w-20" defaultValue={d.qty}
                    onBlur={async (e) => {
                      const v = Math.max(1, Number(e.target.value));
                      const next = [...sel.drop_table]; next[i] = { ...d, qty: v };
                      await save({ data: { ...sel, drop_table: next } } as any); load();
                    }} />
                  <Input type="number" min={0} max={100} step={0.1} className="w-24" defaultValue={d.chance}
                    onBlur={async (e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)));
                      const next = [...sel.drop_table]; next[i] = { ...d, chance: v };
                      await save({ data: { ...sel, drop_table: next } } as any); load();
                    }} />
                  <span className="text-xs text-muted-foreground">% chance</span>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    const next = sel.drop_table.filter((_, j) => j !== i);
                    await save({ data: { ...sel, drop_table: next } } as any); load();
                  }}><Trash2 size={14} /></Button>
                </div>
              ))}
              {(sel.drop_table ?? []).length === 0 && <p className="text-xs text-muted-foreground">Sem drops configurados.</p>}
            </div>
            <Button size="sm" variant="outline" onClick={async () => {
              if (!items.length) { toast.error("Cadastre um item primeiro."); return; }
              const next = [...(sel.drop_table ?? []), { item_id: items[0].id, qty: 1, chance: 25 }];
              await save({ data: { ...sel, drop_table: next } } as any); load();
            }}><Plus size={14} className="mr-1" /> Adicionar drop</Button>
          </div>
          <div className="scroll-panel rounded-lg p-4 space-y-2">
            <h4 className="font-display text-lg text-gold">Habilidades ({selSkills.size})</h4>
            <div className="grid gap-1 max-h-[300px] overflow-y-auto pr-2">
              {skills.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                  <input type="checkbox" checked={selSkills.has(s.id)}
                    onChange={async (e) => {
                      const next = new Set(selSkills);
                      if (e.target.checked) next.add(s.id); else next.delete(s.id);
                      await setSkillsFn({ data: { npc_id: sel.id, skill_ids: Array.from(next) } });
                      load();
                    }} />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.rank}</span>
                </label>
              ))}
              {skills.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma habilidade cadastrada.</p>}
            </div>
          </div>
          </TabsContent>
          )}
          {sel.kind === "employer" && (
          <TabsContent value="emprego" className="space-y-4 mt-0">
            <div className="scroll-panel rounded-lg p-4 space-y-3">
              <div className="text-sm font-display flex items-center gap-2">Emprego oferecido</div>
              <EmployerJobPicker
                value={(sel as any).offered_job_id ?? null}
                onChange={async (v) => { await save({ data: { ...sel, offered_job_id: v } } as any); load(); }}
              />
              <p className="text-[11px] text-muted-foreground">
                O jogador se apresenta a este NPC para ser contratado e volta aqui para receber o salário.
                A inatividade é medida por minigames vinculados a este emprego.
              </p>
            </div>
          </TabsContent>
          )}
          </Tabs>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm p-8 text-center border border-dashed border-border rounded-lg">
          Selecione um NPC à esquerda para editar, ou crie um novo acima.
        </div>
      )}
      </div>
    </div>
  );
}

function NumField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" defaultValue={value} onBlur={(e) => { const v = Number(e.target.value); if (v !== value) onSave(v); }} />
    </div>
  );
}
function LearnBlocksEditor({ blocks, onChange, npcId }: { blocks: LearnBlock[]; onChange: (bs: LearnBlock[]) => void; npcId: string }) {
  const uid = () => (globalThis.crypto?.randomUUID?.() ?? String(Math.random()));
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= blocks.length) return;
    const arr = [...blocks]; const [it] = arr.splice(i, 1); arr.splice(j, 0, it); onChange(arr);
  }
  async function upload(i: number, file: File) {
    if (file.size > 10 * 1024 * 1024) return toast.error("Máx 10MB.");
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${npcId}/tutorial/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("npcs").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) return toast.error(up.error.message);
    const signed = await supabase.storage.from("npcs").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed.data?.signedUrl) return;
    const arr = [...blocks]; arr[i] = { ...arr[i], image_url: signed.data.signedUrl }; onChange(arr);
  }
  return (
    <div className="rounded border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Tutorial (blocos de texto/imagem)</div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => onChange([...blocks, { id: uid(), kind: "text", text: "" }])}>+ Texto</Button>
          <Button size="sm" variant="outline" onClick={() => onChange([...blocks, { id: uid(), kind: "image", image_url: "" }])}>+ Imagem</Button>
        </div>
      </div>
      {blocks.length === 0 && <div className="text-xs text-muted-foreground">Explique o passo a passo do minigame usando blocos.</div>}
      {blocks.map((b, i) => (
        <div key={b.id} className="rounded bg-secondary/40 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bloco {i + 1} · {b.kind}</div>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
              <Button size="sm" variant="outline" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>↓</Button>
              <Button size="sm" variant="destructive" onClick={() => onChange(blocks.filter((_, idx) => idx !== i))}><Trash2 size={12}/></Button>
            </div>
          </div>
          {b.kind === "text" ? (
            <Textarea rows={4} defaultValue={b.text ?? ""}
              onBlur={(e) => { const arr = [...blocks]; arr[i] = { ...arr[i], text: e.target.value }; onChange(arr); }} />
          ) : (
            <div className="flex items-center gap-2">
              {b.image_url && <img src={b.image_url} className="w-24 h-24 rounded object-cover" alt="" />}
              <label className="inline-flex items-center gap-1 text-xs cursor-pointer bg-secondary px-2 py-1 rounded">
                <Upload size={12} /> Enviar imagem
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(i, f); if (e.target) e.target.value = ""; }} />
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LearningStepsEditor({ steps, minigames, onSave }: { steps: LearningStep[]; minigames: MinigameLite[]; onSave: (steps: LearningStep[]) => void }) {
  const [draft, setDraft] = useState<LearningStep[]>(steps);
  useEffect(() => { setDraft(steps); }, [steps]);
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= draft.length) return;
    const arr = [...draft]; const [it] = arr.splice(i, 1); arr.splice(j, 0, it); setDraft(arr);
  }
  return (
    <div className="rounded border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Passos de aprendizagem (ordem)</div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => {
            if (!minigames.length) return toast.error("Cadastre um minigame primeiro.");
            setDraft([...draft, { minigame_id: minigames[0].id, position: draft.length, required_rank: null, required_profs: [] }]);
          }}><Plus size={12} className="mr-1" /> Passo</Button>
          <Button size="sm" onClick={() => onSave(draft)}>Salvar passos</Button>
        </div>
      </div>
      {draft.length === 0 && <div className="text-xs text-muted-foreground">Nenhum passo. Adicione os minigames que este NPC ensina, em ordem.</div>}
      {draft.map((s, i) => (
        <div key={i} className="rounded bg-secondary/40 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">#{i + 1}</div>
            <div className="flex-1 min-w-[160px]">
              <ComboSelect
                value={s.minigame_id}
                onChange={(v) => { const arr = [...draft]; arr[i] = { ...s, minigame_id: v }; setDraft(arr); }}
                triggerClassName="h-9 text-sm"
                options={minigames.map((m) => ({ value: m.id, label: `${m.name} (${m.kind})` }))}
              />
            </div>
            <div className="w-32">
              <ComboSelect
                value={s.required_rank ?? ""}
                onChange={(v) => { const arr = [...draft]; arr[i] = { ...s, required_rank: v || null }; setDraft(arr); }}
                triggerClassName="h-9 text-sm"
                placeholder="— patente —"
                options={[
                  { value: "", label: "— patente —" },
                  ...NINJA_RANKS_.map((r) => ({ value: r, label: r })),
                ]}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
            <Button size="sm" variant="outline" onClick={() => move(i, 1)} disabled={i === draft.length - 1}>↓</Button>
            <Button size="sm" variant="destructive" onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}><Trash2 size={12}/></Button>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">Proficiências extras exigidas neste passo</div>
            {(s.required_profs ?? []).map((p, pi) => (
              <div key={pi} className="flex flex-wrap gap-1 items-center">
                <div className="flex-1 min-w-[140px]">
                  <ComboSelect
                    value={p.skill_class}
                    onChange={(v) => { const arr = [...draft]; const rp = [...s.required_profs]; rp[pi] = { ...p, skill_class: v }; arr[i] = { ...s, required_profs: rp }; setDraft(arr); }}
                    triggerClassName="h-8 text-xs"
                    placeholder="— classe —"
                    options={[
                      { value: "", label: "— classe —" },
                      ...SKILL_CLASSES_.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                </div>
                <div className="w-28">
                  <ComboSelect
                    value={p.nivel ?? ""}
                    onChange={(v) => { const arr = [...draft]; const rp = [...s.required_profs]; rp[pi] = { ...p, nivel: (v || null) as any }; arr[i] = { ...s, required_profs: rp }; setDraft(arr); }}
                    triggerClassName="h-8 text-xs"
                    placeholder="Nível —"
                    options={[
                      { value: "", label: "Nível —" },
                      ...SKILL_RANKS_.map((r) => ({ value: r, label: `N ${r}` })),
                    ]}
                  />
                </div>
                <div className="w-28">
                  <ComboSelect
                    value={p.maestria ?? ""}
                    onChange={(v) => { const arr = [...draft]; const rp = [...s.required_profs]; rp[pi] = { ...p, maestria: (v || null) as any }; arr[i] = { ...s, required_profs: rp }; setDraft(arr); }}
                    triggerClassName="h-8 text-xs"
                    placeholder="Maestria —"
                    options={[
                      { value: "", label: "Maestria —" },
                      ...SKILL_RANKS_.map((r) => ({ value: r, label: `M ${r}` })),
                    ]}
                  />
                </div>
                <Button size="icon" variant="ghost" onClick={() => { const arr = [...draft]; arr[i] = { ...s, required_profs: s.required_profs.filter((_, x) => x !== pi) }; setDraft(arr); }}><Trash2 size={12}/></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => { const arr = [...draft]; arr[i] = { ...s, required_profs: [...(s.required_profs ?? []), { skill_class: "", nivel: null, maestria: null }] }; setDraft(arr); }}>
              <Plus size={12} className="mr-1" /> Proficiência
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
