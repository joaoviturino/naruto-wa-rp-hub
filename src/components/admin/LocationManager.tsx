import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Upload, Link2, Plus, Skull, Gamepad2, Store, Gift, BookOpen, GraduationCap, Box } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateLocationDangerZone, setLocationNpcs } from "@/lib/npc.functions";
import { setLocationSpawnGroups } from "@/lib/npc.functions";
import { setLocationMinigames } from "@/lib/minigame.functions";
import { setLocationLibraries } from "@/lib/library.functions";
import { LocationMapEditor } from "./LocationMapEditor";

type Loc = { id: string; name: string; description: string | null; image_url: string | null;
  map_x?: number; map_y?: number;
  parent_id?: string | null;
  is_danger_zone?: boolean; spawn_chance?: number; spawn_tick_seconds?: number;
  spawn_group_ids?: string[];
  battle_bg_url?: string | null; music_url?: string | null };
type Conn = { id: string; a_id: string; b_id: string };
type Npc = { id: string; name: string; kind: "aggressive" | "shop" | "reward" | "learning" | "object" };
type NpcGroup = { id: string; name: string };
type Minigame = { id: string; name: string; active: boolean };
type LibSection = { id: string; name: string; active: boolean };

export function LocationManager() {
  const [locs, setLocs] = useState<Loc[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [locNpcs, setLocNpcs] = useState<Record<string, Set<string>>>({});
  const [minigames, setMinigames] = useState<Minigame[]>([]);
  const [locMinigames, setLocMinigames] = useState<Record<string, Set<string>>>({});
  const [libSections, setLibSections] = useState<LibSection[]>([]);
  const [locLibs, setLocLibs] = useState<Record<string, Set<string>>>({});
  const [groups, setGroups] = useState<NpcGroup[]>([]);
  const [dzTab, setDzTab] = useState<"solo" | "group">("solo");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [linkTo, setLinkTo] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const updateDz = useServerFn(updateLocationDangerZone);
  const setLocNpcsFn = useServerFn(setLocationNpcs);
  const setLocGroupsFn = useServerFn(setLocationSpawnGroups);
  const setLocMgFn = useServerFn(setLocationMinigames);
  const setLocLibFn = useServerFn(setLocationLibraries);

  async function load() {
    const [l, c, n, ln, mg, lmg, ls, llb, gr] = await Promise.all([
      supabase.from("locations").select("id,name,description,image_url,map_x,map_y,parent_id,is_danger_zone,spawn_chance,spawn_tick_seconds,spawn_group_ids,battle_bg_url,music_url").order("name"),
      supabase.from("location_connections").select("id,a_id,b_id"),
      supabase.from("npcs").select("id,name,kind").order("name"),
      supabase.from("location_npcs").select("location_id,npc_id"),
      supabase.from("minigames").select("id,name,active").eq("active", true).order("name"),
      supabase.from("location_minigames").select("location_id,minigame_id"),
      supabase.from("library_sections").select("id,name,active").eq("active", true).order("name"),
      supabase.from("location_libraries").select("location_id,section_id"),
      supabase.from("npc_groups").select("id,name").order("name"),
    ]);
    setLocs((l.data as Loc[]) ?? []);
    setConns((c.data as Conn[]) ?? []);
    setNpcs((n.data as Npc[]) ?? []);
    setMinigames((mg.data as Minigame[]) ?? []);
    setLibSections((ls.data as LibSection[]) ?? []);
    setGroups((gr.data as NpcGroup[]) ?? []);
    const map: Record<string, Set<string>> = {};
    (ln.data ?? []).forEach((r: any) => {
      if (!map[r.location_id]) map[r.location_id] = new Set();
      map[r.location_id].add(r.npc_id);
    });
    setLocNpcs(map);
    const map2: Record<string, Set<string>> = {};
    (lmg.data ?? []).forEach((r: any) => {
      if (!map2[r.location_id]) map2[r.location_id] = new Set();
      map2[r.location_id].add(r.minigame_id);
    });
    setLocMinigames(map2);
    const map3: Record<string, Set<string>> = {};
    (llb.data ?? []).forEach((r: any) => {
      if (!map3[r.location_id]) map3[r.location_id] = new Set();
      map3[r.location_id].add(r.section_id);
    });
    setLocLibs(map3);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    const { error } = await supabase.from("locations").insert({ name: name.trim(), description: desc.trim() || null });
    if (error) return toast.error(error.message);
    setName(""); setDesc(""); toast.success("Local criado."); load();
  }
  async function remove(id: string) {
    if (!confirm("Apagar este local e todas as mensagens dele?")) return;
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected === id) setSelected(null);
    load();
  }
  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !selected) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Máx 5MB.");
    const ext = f.name.split(".").pop() ?? "png";
    const path = `${selected}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("locations").upload(path, f, { upsert: true, contentType: f.type });
    if (up.error) return toast.error(up.error.message);
    const signed = await supabase.storage.from("locations").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed.data?.signedUrl) return;
    await supabase.from("locations").update({ image_url: signed.data.signedUrl }).eq("id", selected);
    if (fileRef.current) fileRef.current.value = "";
    load();
  }
  async function linkAdd() {
    if (!selected || !linkTo || linkTo === selected) return;
    const [a, b] = [selected, linkTo].sort();
    const { error } = await supabase.from("location_connections").insert({ a_id: a, b_id: b });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    setLinkTo(""); load();
  }
  async function linkRemove(id: string) {
    await supabase.from("location_connections").delete().eq("id", id);
    load();
  }

  const sel = locs.find((l) => l.id === selected);
  const neighborIds = new Set(conns.filter((c) => c.a_id === selected || c.b_id === selected).map((c) => c.a_id === selected ? c.b_id : c.a_id));
  const availableToLink = locs.filter((l) => l.id !== selected && !neighborIds.has(l.id));
  const selNpcs = selected ? locNpcs[selected] ?? new Set<string>() : new Set<string>();
  const selMg = selected ? locMinigames[selected] ?? new Set<string>() : new Set<string>();
  const selLibs = selected ? locLibs[selected] ?? new Set<string>() : new Set<string>();
  const aggressiveNpcs = npcs.filter((n) => (n.kind ?? "aggressive") === "aggressive");
  const shopNpcs = npcs.filter((n) => n.kind === "shop");
  const rewardNpcs = npcs.filter((n) => n.kind === "reward");
  const learningNpcs = npcs.filter((n) => n.kind === "learning");
  const objectNpcs = npcs.filter((n) => n.kind === "object");
  async function toggleNpc(npcId: string, on: boolean) {
    if (!sel) return;
    const next = new Set(selNpcs);
    if (on) next.add(npcId); else next.delete(npcId);
    await setLocNpcsFn({ data: { location_id: sel.id, npc_ids: Array.from(next) } });
    load();
  }
  const selGroups = new Set<string>((sel?.spawn_group_ids ?? []) as string[]);
  async function toggleGroup(groupId: string, on: boolean) {
    if (!sel) return;
    const next = new Set(selGroups);
    if (on) next.add(groupId); else next.delete(groupId);
    await setLocGroupsFn({ data: { location_id: sel.id, group_ids: Array.from(next) } });
    load();
  }
  const avgSpawnSec = sel?.is_danger_zone && (sel.spawn_chance ?? 0) > 0
    ? Math.round((sel.spawn_tick_seconds ?? 60) / ((sel.spawn_chance ?? 0) / 100))
    : null;

  return (
    <div className="space-y-4">
      <LocationMapEditor
        locations={locs.map((l) => ({ id: l.id, name: l.name, image_url: l.image_url, map_x: l.map_x ?? 0, map_y: l.map_y ?? 0, parent_id: l.parent_id ?? null }))}
        connections={conns}
        selectedId={selected}
        onSelect={setSelected}
        onChange={load}
      />
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="scroll-panel rounded-lg p-4 space-y-2">
          <h3 className="font-display text-lg text-gold">Novo local</h3>
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          <Button onClick={create} className="w-full"><Plus size={14} className="mr-1" /> Criar</Button>
        </div>
        <div className="scroll-panel rounded-lg p-2 max-h-[500px] overflow-y-auto">
          {locs.map((l) => (
            <div key={l.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selected===l.id?"bg-secondary":"hover:bg-secondary/50"}`}
              onClick={() => setSelected(l.id)}>
              <div className="flex-1 text-sm truncate">{l.name}</div>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove(l.id); }}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          {locs.length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhum local ainda.</div>}
        </div>
      </div>

      {sel ? (
        <div className="space-y-4">
          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 rounded bg-secondary overflow-hidden shrink-0">
                {sel.image_url && <img src={sel.image_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input key={`name-${sel.id}`} defaultValue={sel.name}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (!v || v === sel.name) return;
                      const { error } = await supabase.from("locations").update({ name: v }).eq("id", sel.id);
                      if (error) toast.error(error.message); else { toast.success("Nome atualizado."); load(); }
                    }} />
                </div>
                <Label className="text-xs">Descrição</Label>
                <Textarea key={`desc-${sel.id}`} defaultValue={sel.description ?? ""} rows={3}
                  onBlur={async (e) => { await supabase.from("locations").update({ description: e.target.value }).eq("id", sel.id); load(); }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" /> Imagem do local
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                {sel.parent_id && (
                  <p className="text-xs text-muted-foreground">
                    Este local pertence ao grupo <span className="text-gold">{locs.find((l) => l.id === sel.parent_id)?.name ?? "—"}</span>.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><Link2 size={16} /> Conexões</h4>
            <div className="flex flex-wrap gap-2">
              {conns.filter((c) => c.a_id === sel.id || c.b_id === sel.id).map((c) => {
                const other = locs.find((l) => l.id === (c.a_id === sel.id ? c.b_id : c.a_id));
                return (
                  <div key={c.id} className="flex items-center gap-1 bg-secondary rounded px-2 py-1 text-sm">
                    <span>{other?.name}</span>
                    <button onClick={() => linkRemove(c.id)} className="text-blood hover:text-blood/70"><Trash2 size={12} /></button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm">
                <option value="">— conectar a…</option>
                {availableToLink.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <Button size="sm" onClick={linkAdd} disabled={!linkTo}><Plus size={14} /></Button>
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><Skull size={16} /> Danger Zone</h4>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!sel.is_danger_zone}
                onChange={async (e) => {
                  await updateDz({ data: { id: sel.id, is_danger_zone: e.target.checked,
                    spawn_chance: sel.spawn_chance ?? 0, spawn_tick_seconds: sel.spawn_tick_seconds ?? 60 } });
                  load();
                }} />
              Este local é uma danger zone (NPCs podem aparecer)
            </label>
            {sel.is_danger_zone && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Chance de spawn por tick (%)</Label>
                    <Input type="number" min={0} max={100} defaultValue={sel.spawn_chance ?? 0}
                      onBlur={async (e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value)));
                        await updateDz({ data: { id: sel.id, is_danger_zone: true, spawn_chance: v, spawn_tick_seconds: sel.spawn_tick_seconds ?? 60 } });
                        load();
                      }} />
                  </div>
                  <div>
                    <Label>Tick (segundos)</Label>
                    <Input type="number" min={10} defaultValue={sel.spawn_tick_seconds ?? 60}
                      onBlur={async (e) => {
                        const v = Math.max(10, Number(e.target.value));
                        await updateDz({ data: { id: sel.id, is_danger_zone: true, spawn_chance: sel.spawn_chance ?? 0, spawn_tick_seconds: v } });
                        load();
                      }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tempo médio estimado até um encontro: <span className="text-gold">{avgSpawnSec ? `${avgSpawnSec}s (${(avgSpawnSec/60).toFixed(1)} min)` : "—"}</span>
                </p>
                <div>
                  <Label>O que pode aparecer aqui</Label>
                  <div className="flex gap-1 mt-1 mb-2">
                    <button type="button" onClick={() => setDzTab("solo")}
                      className={`px-3 py-1 rounded text-xs font-semibold border ${dzTab==="solo" ? "bg-gold text-background border-gold" : "border-border text-muted-foreground hover:bg-secondary/40"}`}>
                      NPCs solos ({aggressiveNpcs.length})
                    </button>
                    <button type="button" onClick={() => setDzTab("group")}
                      className={`px-3 py-1 rounded text-xs font-semibold border ${dzTab==="group" ? "bg-gold text-background border-gold" : "border-border text-muted-foreground hover:bg-secondary/40"}`}>
                      Grupos ({groups.length})
                    </button>
                  </div>
                  {dzTab === "solo" ? (
                    <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
                      {aggressiveNpcs.map((n) => (
                        <label key={n.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                          <input type="checkbox" checked={selNpcs.has(n.id)}
                            onChange={(e) => toggleNpc(n.id, e.target.checked)} />
                          <span>{n.name}</span>
                        </label>
                      ))}
                      {aggressiveNpcs.length === 0 && <p className="text-xs text-muted-foreground">Cadastre NPCs agressivos primeiro.</p>}
                    </div>
                  ) : (
                    <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
                      {groups.map((g) => (
                        <label key={g.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                          <input type="checkbox" checked={selGroups.has(g.id)}
                            onChange={(e) => toggleGroup(g.id, e.target.checked)} />
                          <span>{g.name}</span>
                        </label>
                      ))}
                      {groups.length === 0 && <p className="text-xs text-muted-foreground">Nenhum grupo criado. Vá em NPCs → Grupos.</p>}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Quando há grupos marcados, o spawn prioriza grupos. Se nenhum for marcado, cai no sorteio de NPCs solos.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><Store size={16} /> NPCs de Loja neste local</h4>
            <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
              {shopNpcs.map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                  <input type="checkbox" checked={selNpcs.has(n.id)} onChange={(e) => toggleNpc(n.id, e.target.checked)} />
                  <span>{n.name}</span>
                </label>
              ))}
              {shopNpcs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum NPC do tipo Loja cadastrado.</p>}
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><Gift size={16} /> NPCs de Recompensa neste local</h4>
            <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
              {rewardNpcs.map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                  <input type="checkbox" checked={selNpcs.has(n.id)} onChange={(e) => toggleNpc(n.id, e.target.checked)} />
                  <span>{n.name}</span>
                </label>
              ))}
              {rewardNpcs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum NPC do tipo Recompensa cadastrado.</p>}
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><GraduationCap size={16} /> NPCs de Aprendizagem neste local</h4>
            <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
              {learningNpcs.map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                  <input type="checkbox" checked={selNpcs.has(n.id)} onChange={(e) => toggleNpc(n.id, e.target.checked)} />
                  <span>{n.name}</span>
                </label>
              ))}
              {learningNpcs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum NPC do tipo Aprendizagem cadastrado.</p>}
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><Box size={16} /> Objetos neste local</h4>
            <p className="text-xs text-muted-foreground">Objetos interativos (vinculados a minigames) que aparecerão para os jogadores neste local.</p>
            <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
              {objectNpcs.map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                  <input type="checkbox" checked={selNpcs.has(n.id)} onChange={(e) => toggleNpc(n.id, e.target.checked)} />
                  <span>{n.name}</span>
                </label>
              ))}
              {objectNpcs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum NPC do tipo Objeto cadastrado.</p>}
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><Gamepad2 size={16} /> Minigames disponíveis aqui</h4>
            <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
              {minigames.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                  <input type="checkbox" checked={selMg.has(m.id)}
                    onChange={async (e) => {
                      const next = new Set(selMg);
                      if (e.target.checked) next.add(m.id); else next.delete(m.id);
                      await setLocMgFn({ data: { location_id: sel.id, minigame_ids: Array.from(next) } });
                      load();
                    }} />
                  <span>{m.name}</span>
                </label>
              ))}
              {minigames.length === 0 && <p className="text-xs text-muted-foreground">Crie minigames ativos na aba Minigames primeiro.</p>}
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold flex items-center gap-2"><BookOpen size={16} /> Bibliotecas neste local</h4>
            <p className="text-xs text-muted-foreground">Marque quais seções da biblioteca podem ser lidas quando o jogador estiver aqui.</p>
            <div className="grid gap-1 max-h-[220px] overflow-y-auto pr-2">
              {libSections.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm p-1 hover:bg-secondary/40 rounded">
                  <input type="checkbox" checked={selLibs.has(s.id)}
                    onChange={async (e) => {
                      const next = new Set(selLibs);
                      if (e.target.checked) next.add(s.id); else next.delete(s.id);
                      await setLocLibFn({ data: { location_id: sel.id, section_ids: Array.from(next) } });
                      load();
                    }} />
                  <span>{s.name}</span>
                </label>
              ))}
              {libSections.length === 0 && <p className="text-xs text-muted-foreground">Crie seções ativas na aba Biblioteca primeiro.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm p-6">Selecione um local à esquerda para editar suas conexões.</div>
      )}
      </div>
    </div>
  );
}