import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { updatePlayer, grantSkill, revokeSkill, grantItem, revokeItem, completeMission, uncompleteMission } from "@/lib/admin.functions";
import { toast } from "sonner";
import { NINJA_RANKS, PROFICIENCIES, VILLAGES, ELEMENTS, labelize } from "./shared";
import { X, Plus } from "lucide-react";

export function PlayerEditor({ characterId, open, onOpenChange, onSaved }: {
  characterId: string | null; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const [char, setChar] = useState<any>(null);
  const [clans, setClans] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [charSkills, setCharSkills] = useState<any[]>([]);
  const [charMissions, setCharMissions] = useState<any[]>([]);
  const [inv, setInv] = useState<any>(null);

  const save = useServerFn(updatePlayer);
  const gSkill = useServerFn(grantSkill);
  const rSkill = useServerFn(revokeSkill);
  const gItem = useServerFn(grantItem);
  const rItem = useServerFn(revokeItem);
  const cMission = useServerFn(completeMission);
  const uMission = useServerFn(uncompleteMission);

  async function load() {
    if (!characterId) return;
    const [c, cl, it, sk, mi, cs, cm, iv] = await Promise.all([
      supabase.from("characters").select("*").eq("id", characterId).single(),
      supabase.from("clans").select("id,name,village"),
      supabase.from("items").select("id,name,type,rank"),
      supabase.from("skills").select("id,name,rank,clan_id"),
      supabase.from("missions").select("id,name,rank"),
      supabase.from("character_skills").select("skill_id").eq("character_id", characterId),
      supabase.from("character_missions").select("mission_id").eq("character_id", characterId),
      supabase.from("inventory").select("*").eq("character_id", characterId).maybeSingle(),
    ]);
    setChar(c.data); setClans(cl.data ?? []); setItems(it.data ?? []); setSkills(sk.data ?? []); setMissions(mi.data ?? []);
    setCharSkills(cs.data ?? []); setCharMissions(cm.data ?? []); setInv(iv.data);
  }
  useEffect(() => { if (open) load(); }, [open, characterId]);

  if (!char) return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Carregando...</DialogTitle></DialogHeader></DialogContent></Dialog>
  );

  function up(k: string, v: any) { setChar((p: any) => ({ ...p, [k]: v })); }
  function upProf(k: string, v: number) { setChar((p: any) => ({ ...p, proficiencies: { ...p.proficiencies, [k]: v } })); }

  const skillIds = new Set(charSkills.map((s) => s.skill_id));
  const missionIds = new Set(charMissions.map((m) => m.mission_id));
  const itemById = new Map(items.map((i) => [i.id, i]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar: {char.nickname}</DialogTitle></DialogHeader>
        <Tabs defaultValue="stats">
          <TabsList>
            <TabsTrigger value="stats">Ficha</TabsTrigger>
            <TabsTrigger value="prof">Proficiências</TabsTrigger>
            <TabsTrigger value="skills">Habilidades</TabsTrigger>
            <TabsTrigger value="items">Itens</TabsTrigger>
            <TabsTrigger value="missions">Missões</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>XP</Label><Input type="number" min={0} value={char.xp} onChange={(e) => up("xp", Number(e.target.value))} /></div>
            <div><Label>Patente</Label>
              <Select value={char.rank} onValueChange={(v) => up("rank", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NINJA_RANKS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Vila</Label>
              <Select value={char.village} onValueChange={(v) => up("village", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VILLAGES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Clã</Label>
              <Select value={char.clan_id ?? "__none__"} onValueChange={(v) => up("clan_id", v === "__none__" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem clã —</SelectItem>
                  {clans.filter((c) => c.village === char.village).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Afinidade elemental</Label>
              <Select value={char.element_primary} onValueChange={(v) => up("element_primary", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ELEMENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={async () => {
                try {
                  await save({ data: { character_id: char.id, xp: char.xp, rank: char.rank, village: char.village, clan_id: char.clan_id, element_primary: char.element_primary } } as any);
                  toast.success("Ficha atualizada."); onSaved();
                } catch (e: any) { toast.error(e.message); }
              }}>Salvar ficha</Button>
            </div>
          </TabsContent>

          <TabsContent value="prof" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {PROFICIENCIES.map((p) => (
                <div key={p}>
                  <Label className="capitalize">{p}</Label>
                  <Input type="number" min={0} max={100} value={char.proficiencies?.[p] ?? 0}
                    onChange={(e) => upProf(p, Number(e.target.value))} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={async () => {
                try {
                  await save({ data: { character_id: char.id, proficiencies: char.proficiencies } } as any);
                  toast.success("Proficiências atualizadas."); onSaved();
                } catch (e: any) { toast.error(e.message); }
              }}>Salvar proficiências</Button>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {skills.filter((s) => skillIds.has(s.id)).map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                  {s.name} ({s.rank})
                  <button onClick={async () => { await rSkill({ data: { character_id: char.id, skill_id: s.id } } as any); load(); }}><X size={12} /></button>
                </span>
              ))}
              {skillIds.size === 0 && <p className="text-xs text-muted-foreground">Nenhuma habilidade.</p>}
            </div>
            <GrantPicker
              placeholder="Conceder habilidade..."
              options={skills.filter((s) => !skillIds.has(s.id)).map((s) => ({ value: s.id, label: `${s.name} (${s.rank})` }))}
              onPick={async (id) => { await gSkill({ data: { character_id: char.id, skill_id: id } } as any); load(); }}
            />
          </TabsContent>

          <TabsContent value="items" className="mt-4 space-y-4">
            {(["ninja_bag","secondary_slots"] as const).map((slot) => (
              <div key={slot}>
                <h4 className="text-sm font-semibold text-gold mb-2">{slot === "ninja_bag" ? "Bolsa ninja" : "Slots secundários"}</h4>
                <div className="flex flex-wrap gap-2">
                  {((inv?.[slot] as any[]) ?? []).map((entry: any, idx: number) => {
                    const it = itemById.get(entry.item_id);
                    return (
                      <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                        {it?.name ?? "Item removido"}
                        <button onClick={async () => { await rItem({ data: { character_id: char.id, index: idx, slot } } as any); load(); }}><X size={12} /></button>
                      </span>
                    );
                  })}
                  {((inv?.[slot] as any[]) ?? []).length === 0 && <p className="text-xs text-muted-foreground">Vazio.</p>}
                </div>
                <div className="mt-2">
                  <GrantPicker
                    placeholder={`Conceder para ${slot}...`}
                    options={items.map((i) => ({ value: i.id, label: `${i.name} (${labelize(i.type)})` }))}
                    onPick={async (id) => { await gItem({ data: { character_id: char.id, item_id: id, slot } } as any); load(); }}
                  />
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="missions" className="mt-4 space-y-3">
            <div className="space-y-1">
              {missions.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm border-b border-border py-1">
                  <input type="checkbox" checked={missionIds.has(m.id)} onChange={async (e) => {
                    if (e.target.checked) await cMission({ data: { character_id: char.id, mission_id: m.id } } as any);
                    else await uMission({ data: { character_id: char.id, mission_id: m.id } } as any);
                    load();
                  }} />
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-xs text-muted-foreground">({m.rank})</span>
                </label>
              ))}
              {missions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma missão criada. Vá em Missões.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function GrantPicker({ placeholder, options, onPick }: { placeholder: string; options: { value: string; label: string }[]; onPick: (id: string) => void | Promise<void> }) {
  const [value, setValue] = useState<string>("");
  return (
    <div className="flex gap-2">
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" disabled={!value} onClick={async () => { if (value) { await onPick(value); setValue(""); } }}><Plus size={14} /></Button>
    </div>
  );
}