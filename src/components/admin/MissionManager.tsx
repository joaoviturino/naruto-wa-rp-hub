import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { upsertMission, deleteMission } from "@/lib/admin.functions";
import { toast } from "sonner";
import { NINJA_RANKS } from "./shared";
import { Trash2, Pencil, Plus, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { OBJECTIVE_TYPES } from "@/lib/missions.functions";

type Ref = { id: string; name?: string; label?: string };
const SKILL_RANKS = ["E","D","C","B","A","S"] as const;
const CATEGORIES = [
  { value: "daily", label: "Diária" },
  { value: "common", label: "Comum" },
  { value: "special", label: "Especial" },
] as const;

export function MissionManager() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"daily"|"common"|"special">("daily");

  async function load() {
    const { data } = await supabase.from("missions").select("*").order("category").order("rank");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => (r.category ?? "daily") === tab);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}s</TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map((c) => (
          <TabsContent key={c.value} value={c.value} className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl text-gold">Missões {c.label.toLowerCase()}s ({filtered.length})</h3>
              <Button size="sm" onClick={() => { setEditing({ category: c.value }); setOpen(true); }}>
                <Plus size={14} className="mr-1" /> Nova missão
              </Button>
            </div>
            <div className="scroll-panel rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Patente</th>
                    <th className="text-left p-2">Objetivos</th>
                    <th className="text-left p-2">XP / Ryō</th>
                    <th className="text-left p-2">Ativa</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 font-semibold">{r.name}</td>
                      <td className="p-2">{r.rank}</td>
                      <td className="p-2">{Array.isArray(r.objectives) ? r.objectives.length : 0}</td>
                      <td className="p-2 text-xs">{r.reward_xp ?? 0} XP / {r.reward_ryo ?? 0} Ryō</td>
                      <td className="p-2">{r.active === false ? "—" : "✓"}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil size={14} /></Button>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm(`Remover ${r.name}?`)) return;
                          try { await deleteMission({ data: { id: r.id } } as any); toast.success("Removida."); load(); }
                          catch (e: any) { toast.error(e.message); }
                        }}><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Nenhuma missão desta categoria.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <MissionDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function useRefs() {
  const [npcs, setNpcs] = useState<Ref[]>([]);
  const [groups, setGroups] = useState<Ref[]>([]);
  const [minigames, setMinigames] = useState<Ref[]>([]);
  const [books, setBooks] = useState<Ref[]>([]);
  const [locations, setLocations] = useState<Ref[]>([]);
  const [skills, setSkills] = useState<Ref[]>([]);
  const [items, setItems] = useState<Ref[]>([]);
  const [profClasses, setProfClasses] = useState<Ref[]>([]);
  const [missions, setMissions] = useState<Ref[]>([]);
  useEffect(() => {
    (async () => {
      const [n, g, m, b, l, s, it, p, ms] = await Promise.all([
        supabase.from("npcs").select("id,name").order("name"),
        supabase.from("npc_groups").select("id,name").order("name"),
        supabase.from("minigames").select("id,name").order("name"),
        supabase.from("library_books").select("id,title").order("title"),
        supabase.from("locations").select("id,name").order("name"),
        supabase.from("skills").select("id,name").order("name"),
        supabase.from("items").select("id,name").order("name"),
        supabase.from("proficiencies").select("value,label").eq("active", true).order("sort_order"),
        supabase.from("missions").select("id,name").order("name"),
      ]);
      setNpcs((n.data ?? []) as any);
      setGroups((g.data ?? []) as any);
      setMinigames((m.data ?? []) as any);
      setBooks(((b.data ?? []) as any[]).map((x) => ({ id: x.id, name: x.title })));
      setLocations((l.data ?? []) as any);
      setSkills((s.data ?? []) as any);
      setItems((it.data ?? []) as any);
      setProfClasses(((p.data ?? []) as any[]).map((x) => ({ id: x.value, name: x.label })));
      setMissions((ms.data ?? []) as any);
    })();
  }, []);
  return { npcs, groups, minigames, books, locations, skills, items, profClasses, missions };
}

function newObjectiveId() { return "obj_" + Math.random().toString(36).slice(2, 10); }

function MissionDialog({ open, onOpenChange, initial, onSaved }: any) {
  const save = useServerFn(upsertMission);
  const [f, setF] = useState<any>(initial ?? {});
  const refs = useRefs();
  useEffect(() => {
    const src = initial ?? {};
    setF({
      category: "daily", rank: "genin", active: true, repeatable: true, cooldown_hours: 24,
      reward_xp: 0, reward_ryo: 0,
      objectives: [], rewards: { xp: 0, ryo: 0, items: [], skill_ids: [], proficiency_grants: [] },
      requirements: {},
      ...src,
    });
  }, [initial, open]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }
  function upR(k: string, v: any) { setF((p: any) => ({ ...p, rewards: { ...(p.rewards ?? {}), [k]: v } })); }
  function upReq(k: string, v: any) { setF((p: any) => ({ ...p, requirements: { ...(p.requirements ?? {}), [k]: v } })); }

  const objectives: any[] = f.objectives ?? [];
  function setObj(idx: number, patch: any) {
    const next = [...objectives];
    next[idx] = { ...next[idx], ...patch };
    up("objectives", next);
  }
  function removeObj(idx: number) { up("objectives", objectives.filter((_, i) => i !== idx)); }
  function addObj() {
    up("objectives", [...objectives, { id: newObjectiveId(), type: "kill_npc", target_id: null, target_ref: null, count: 1, description: "" }]);
  }

  const items: any[] = f.rewards?.items ?? [];
  const skillIds: string[] = f.rewards?.skill_ids ?? [];
  const grants: any[] = f.rewards?.proficiency_grants ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar missão" : "Criar missão"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Básico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} /></div>
            <div><Label>Categoria</Label>
              <Select value={f.category ?? "daily"} onValueChange={(v: any) => up("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Patente</Label>
              <Select value={f.rank ?? "genin"} onValueChange={(v: any) => up("rank", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NINJA_RANKS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cooldown (h)</Label>
              <Input type="number" min={0} value={f.cooldown_hours ?? 24} onChange={(e) => up("cooldown_hours", Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch checked={f.repeatable ?? true} onCheckedChange={(v) => up("repeatable", !!v)} />
              <Label>Repetível</Label>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch checked={f.active ?? true} onCheckedChange={(v) => up("active", !!v)} />
              <Label>Ativa</Label>
            </div>
          </div>
          <div><Label>Descrição</Label><Textarea rows={3} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} /></div>

          {/* Objetivos */}
          <div className="scroll-panel rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gold">Objetivos</h4>
              <Button size="sm" variant="outline" onClick={addObj}><Plus size={14} className="mr-1" /> Adicionar</Button>
            </div>
            {objectives.length === 0 && <p className="text-xs text-muted-foreground">Adicione um ou mais objetivos. A missão só é concluída quando todos forem cumpridos.</p>}
            {objectives.map((o, i) => (
              <ObjectiveRow key={o.id} o={o} refs={refs} onChange={(patch) => setObj(i, patch)} onRemove={() => removeObj(i)} />
            ))}
          </div>

          {/* Recompensas */}
          <div className="scroll-panel rounded-lg p-3 space-y-3">
            <h4 className="font-semibold text-gold">Recompensas</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>XP</Label><Input type="number" min={0} value={f.reward_xp ?? 0} onChange={(e) => up("reward_xp", Number(e.target.value))} /></div>
              <div><Label>Ryō</Label><Input type="number" min={0} value={f.reward_ryo ?? 0} onChange={(e) => up("reward_ryo", Number(e.target.value))} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Itens</Label>
                <Button size="sm" variant="outline" onClick={() => upR("items", [...items, { item_id: refs.items[0]?.id ?? "", qty: 1 }])}>
                  <Plus size={12} /> Adicionar
                </Button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <Select value={it.item_id} onValueChange={(v) => { const c = [...items]; c[i] = { ...c[i], item_id: v }; upR("items", c); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>{refs.items.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={1} className="w-24" value={it.qty} onChange={(e) => { const c = [...items]; c[i] = { ...c[i], qty: Number(e.target.value) }; upR("items", c); }} />
                  <Button size="icon" variant="ghost" onClick={() => upR("items", items.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Habilidades concedidas</Label>
                <Button size="sm" variant="outline" onClick={() => upR("skill_ids", [...skillIds, refs.skills[0]?.id ?? ""])}>
                  <Plus size={12} /> Adicionar
                </Button>
              </div>
              {skillIds.map((sid, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <Select value={sid} onValueChange={(v) => { const c = [...skillIds]; c[i] = v; upR("skill_ids", c); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Habilidade" /></SelectTrigger>
                    <SelectContent>{refs.skills.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => upR("skill_ids", skillIds.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Proficiências concedidas</Label>
                <Button size="sm" variant="outline" onClick={() => upR("proficiency_grants", [...grants, { skill_class: refs.profClasses[0]?.id ?? "", nivel: "E", maestria: null }])}>
                  <Plus size={12} /> Adicionar
                </Button>
              </div>
              {grants.map((g, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 mb-1">
                  <Select value={g.skill_class} onValueChange={(v) => { const c = [...grants]; c[i] = { ...c[i], skill_class: v }; upR("proficiency_grants", c); }}>
                    <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                    <SelectContent>{refs.profClasses.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={g.nivel ?? "none"} onValueChange={(v) => { const c = [...grants]; c[i] = { ...c[i], nivel: v === "none" ? null : v }; upR("proficiency_grants", c); }}>
                    <SelectTrigger><SelectValue placeholder="Nível" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">— nível —</SelectItem>{SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={g.maestria ?? "none"} onValueChange={(v) => { const c = [...grants]; c[i] = { ...c[i], maestria: v === "none" ? null : v }; upR("proficiency_grants", c); }}>
                    <SelectTrigger><SelectValue placeholder="Maestria" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">— maestria —</SelectItem>{SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => upR("proficiency_grants", grants.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
          </div>

          {/* Requisitos */}
          <div className="scroll-panel rounded-lg p-3 space-y-3">
            <h4 className="font-semibold text-gold">Requisitos (opcional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Patente mínima</Label>
                <Select value={f.requirements?.min_rank ?? "none"} onValueChange={(v) => upReq("min_rank", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— nenhuma —</SelectItem>{NINJA_RANKS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nível mínimo</Label>
                <Input type="number" min={0} value={f.requirements?.min_level ?? 0} onChange={(e) => upReq("min_level", Number(e.target.value) || null)} />
              </div>
              <div>
                <Label className="text-xs">Missão pré-requisito</Label>
                <Select value={f.requirements?.previous_mission_id ?? "none"} onValueChange={(v) => upReq("previous_mission_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— nenhuma —</SelectItem>{refs.missions.filter((m) => m.id !== f.id).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => {
            if (!f.name?.trim()) { toast.error("Informe o nome da missão."); return; }
            try {
              const payload: any = {
                id: f.id, name: f.name, rank: f.rank ?? "genin", description: f.description || null,
                category: f.category ?? "daily",
                reward_xp: Number(f.reward_xp ?? 0), reward_ryo: Number(f.reward_ryo ?? 0),
                objectives: (f.objectives ?? []).map((o: any) => ({
                  id: o.id, type: o.type,
                  target_id: o.target_id || null, target_ref: o.target_ref || null,
                  count: Math.max(1, Number(o.count ?? 1)),
                  description: o.description || null,
                })),
                rewards: f.rewards ?? {},
                requirements: f.requirements ?? {},
                cooldown_hours: Number(f.cooldown_hours ?? 24),
                repeatable: !!(f.repeatable ?? true),
                active: !!(f.active ?? true),
              };
              await save({ data: payload } as any);
              toast.success("Missão salva.");
              onSaved();
            } catch (e: any) { toast.error(e.message ?? "Erro ao salvar."); }
          }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ObjectiveRow({ o, refs, onChange, onRemove }: { o: any; refs: ReturnType<typeof useRefs>; onChange: (p: any) => void; onRemove: () => void }) {
  const meta = useMemo(() => OBJECTIVE_TYPES.find((t) => t.value === o.type), [o.type]);
  const needs = meta?.needs ?? "none";

  function targetField() {
    switch (needs) {
      case "npc":
        return (
          <Select value={o.target_id ?? ""} onValueChange={(v) => onChange({ target_id: v })}>
            <SelectTrigger><SelectValue placeholder="NPC" /></SelectTrigger>
            <SelectContent>{refs.npcs.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "npc_group":
        return (
          <Select value={o.target_id ?? ""} onValueChange={(v) => onChange({ target_id: v })}>
            <SelectTrigger><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent>{refs.groups.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "npc_kind":
        return (
          <Select value={o.target_ref ?? ""} onValueChange={(v) => onChange({ target_ref: v })}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aggressive">Agressivo</SelectItem>
              <SelectItem value="shop">Loja</SelectItem>
              <SelectItem value="reward">Recompensa</SelectItem>
              <SelectItem value="learning">Aprendizagem</SelectItem>
              <SelectItem value="object">Objeto</SelectItem>
            </SelectContent>
          </Select>
        );
      case "minigame":
        return (
          <Select value={o.target_id ?? ""} onValueChange={(v) => onChange({ target_id: v })}>
            <SelectTrigger><SelectValue placeholder="Minigame" /></SelectTrigger>
            <SelectContent>{refs.minigames.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "book":
        return (
          <Select value={o.target_id ?? ""} onValueChange={(v) => onChange({ target_id: v })}>
            <SelectTrigger><SelectValue placeholder="Livro" /></SelectTrigger>
            <SelectContent>{refs.books.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "location":
        return (
          <Select value={o.target_id ?? ""} onValueChange={(v) => onChange({ target_id: v })}>
            <SelectTrigger><SelectValue placeholder="Local" /></SelectTrigger>
            <SelectContent>{refs.locations.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "skill":
        return (
          <Select value={o.target_id ?? ""} onValueChange={(v) => onChange({ target_id: v })}>
            <SelectTrigger><SelectValue placeholder="Habilidade" /></SelectTrigger>
            <SelectContent>{refs.skills.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "item":
        return (
          <Select value={o.target_id ?? ""} onValueChange={(v) => onChange({ target_id: v })}>
            <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
            <SelectContent>{refs.items.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "rank":
        return (
          <Select value={o.target_ref ?? ""} onValueChange={(v) => onChange({ target_ref: v })}>
            <SelectTrigger><SelectValue placeholder="Patente" /></SelectTrigger>
            <SelectContent>{NINJA_RANKS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "level":
        return <Input type="number" min={1} placeholder="Nível" value={o.target_ref ?? ""} onChange={(e) => onChange({ target_ref: e.target.value })} />;
      case "proficiency": {
        const [cls, rank] = String(o.target_ref ?? "|").split("|");
        return (
          <div className="flex gap-2">
            <Select value={cls} onValueChange={(v) => onChange({ target_ref: `${v}|${rank ?? "E"}` })}>
              <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
              <SelectContent>{refs.profClasses.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={rank || "E"} onValueChange={(v) => onChange({ target_ref: `${cls ?? ""}|${v}` })}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        );
      }
      default:
        return <div className="text-xs text-muted-foreground self-center">Sem alvo — marcação manual/direta.</div>;
    }
  }

  return (
    <div className="rounded-md border border-border/60 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Select value={o.type} onValueChange={(v) => onChange({ type: v, target_id: null, target_ref: null })}>
          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>{OBJECTIVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" min={1} className="w-20" value={o.count ?? 1} onChange={(e) => onChange({ count: Number(e.target.value) })} />
        <Button size="icon" variant="ghost" onClick={onRemove}><X size={14} /></Button>
      </div>
      <div>{targetField()}</div>
      <Input placeholder="Descrição opcional para o jogador" value={o.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
    </div>
  );
}
