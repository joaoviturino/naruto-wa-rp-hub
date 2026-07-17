import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { updatePlayer, grantSkill, revokeSkill, grantItem, revokeItem, completeMission, uncompleteMission, giftRyo } from "@/lib/admin.functions";
import { adminListPoses, adminUpsertPose, adminDeletePose } from "@/lib/pose.functions";
import { toast } from "sonner";
import { NINJA_RANKS, SKILL_RANKS, VILLAGES, ELEMENTS, labelize, elementLimitForRank, countElementProficiencies } from "./shared";
import { useProficiencies } from "@/hooks/useProficiencies";
import { X, Plus } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";

export function PlayerEditor({ characterId, open, onOpenChange, onSaved }: {
  characterId: string | null; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const SKILL_CLASSES = useProficiencies();
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
  const gift = useServerFn(giftRyo);
  const [ryoDelta, setRyoDelta] = useState<number>(100);

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
  function upProf(k: string, field: "nivel" | "maestria", v: string | null) {
    setChar((p: any) => {
      const profs = { ...(p.proficiencies ?? {}) };
      const current = { ...(profs[k] ?? {}), [field]: v };
      // Se for elemento e estamos ativando (não limpando), respeita o limite por patente.
      if (v && (ELEMENTS as readonly string[]).includes(k)) {
        const prev = profs[k] ?? {};
        const wasActive = !!(prev.nivel || prev.maestria);
        if (!wasActive) {
          const active = countElementProficiencies(profs);
          const limit = elementLimitForRank(p.rank);
          if (active >= limit) {
            toast.error(`Esta patente permite apenas ${limit} elemento(s). Remova outro antes.`);
            return p;
          }
        }
      }
      profs[k] = current;
      return { ...p, proficiencies: profs };
    });
  }

  const skillIds = new Set(charSkills.map((s) => s.skill_id));
  const missionIds = new Set(charMissions.map((m) => m.mission_id));
  const itemById = new Map(items.map((i) => [i.id, i]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Editar: {char.nickname}</DialogTitle></DialogHeader>
        <Tabs defaultValue="stats">
          <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1">
            <TabsTrigger value="stats">Ficha</TabsTrigger>
            <TabsTrigger value="prof">Proficiências</TabsTrigger>
            <TabsTrigger value="skills">Habilidades</TabsTrigger>
            <TabsTrigger value="items">Itens</TabsTrigger>
            <TabsTrigger value="missions">Missões</TabsTrigger>
            <TabsTrigger value="poses">Poses</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 border border-border rounded p-3">
              <Label className="text-gold">Imagens do jogador</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {([
                  { key: "avatar_url", label: "Avatar", bucket: "avatars" as const },
                  { key: "banner_url", label: "Banner", bucket: "banners" as const },
                  { key: "inventory_bg_url", label: "PNG do inventário (combate)", bucket: "inventory" as const },
                  { key: "eyes_frame_url", label: "Frame dos olhos (HUD)", bucket: "avatars" as const },
                ]).map((f) => (
                  <div key={f.key} className="space-y-2">
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <div className="h-24 w-full rounded bg-secondary/40 border border-border overflow-hidden flex items-center justify-center">
                      {char[f.key] ? <img src={char[f.key]} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                    <div className="flex gap-2">
                      <ImageUpload label="Enviar" bucket={f.bucket} userId={char.user_id}
                        onUploaded={async (url) => {
                          try {
                            await save({ data: { character_id: char.id, [f.key]: url } } as any);
                            up(f.key, url); toast.success("Imagem atualizada."); onSaved();
                          } catch (e: any) { toast.error(e.message); }
                        }} />
                      {char[f.key] && (
                        <Button size="sm" variant="ghost" onClick={async () => {
                          try {
                            await save({ data: { character_id: char.id, [f.key]: null } } as any);
                            up(f.key, null); toast.success("Imagem removida."); onSaved();
                          } catch (e: any) { toast.error(e.message); }
                        }}>Remover</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
            <div className="sm:col-span-2 border-t border-border pt-3">
              <Label className="text-gold">Ryo (moeda) — saldo atual: {char.ryo ?? 0}</Label>
              <div className="flex gap-2 mt-1">
                <Input type="number" value={ryoDelta} onChange={(e) => setRyoDelta(Number(e.target.value))} className="w-32" />
                <Button variant="secondary" onClick={async () => {
                  try { await gift({ data: { character_id: char.id, amount: ryoDelta } } as any); toast.success(`${ryoDelta >= 0 ? "Presenteado" : "Removido"}: ${Math.abs(ryoDelta)} Ryo`); load(); }
                  catch (e: any) { toast.error(e.message); }
                }}>Aplicar</Button>
                <span className="text-xs text-muted-foreground self-center">Use valor negativo para descontar.</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prof" className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Cada classe tem <b>Nível</b> (proficiência geral) e <b>Rank de Maestria</b> (domínio prático). Deixe em branco se o jogador não pratica a classe.
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              <b>Limite elemental para {NINJA_RANKS.find((r)=>r.value===char.rank)?.label ?? char.rank}:</b>{" "}
              {countElementProficiencies(char.proficiencies)} / {elementLimitForRank(char.rank)} elemento(s) ativos.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
              {SKILL_CLASSES.map((c) => {
                const entry = char.proficiencies?.[c.value] ?? {};
                return (
                  <div key={c.value} className="border border-border rounded p-2">
                    <div className="text-sm font-semibold">{c.label}</div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <LetterRankSelect label="Nível" value={entry.nivel ?? null} onChange={(v) => upProf(c.value, "nivel", v)} />
                      <LetterRankSelect label="Maestria" value={entry.maestria ?? null} onChange={(v) => upProf(c.value, "maestria", v)} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={async () => {
                try {
                  // Limpa entradas vazias antes de enviar
                  const cleaned: any = {};
                  Object.entries(char.proficiencies ?? {}).forEach(([k, v]: any) => {
                    if (v && (v.nivel || v.maestria)) cleaned[k] = { nivel: v.nivel ?? null, maestria: v.maestria ?? null };
                  });
                  const elCount = countElementProficiencies(cleaned);
                  const elLimit = elementLimitForRank(char.rank);
                  if (elCount > elLimit) {
                    toast.error(`Esta patente permite apenas ${elLimit} elemento(s). Você tem ${elCount}.`);
                    return;
                  }
                  await save({ data: { character_id: char.id, proficiencies: cleaned } } as any);
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

          <TabsContent value="poses" className="mt-4">
            <PosesTab characterId={char.id} adminUserId={char.user_id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function PosesTab({ characterId, adminUserId }: { characterId: string; adminUserId: string }) {
  const listFn = useServerFn(adminListPoses);
  const upFn = useServerFn(adminUpsertPose);
  const delFn = useServerFn(adminDeletePose);
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  async function load() {
    try { setRows(await listFn({ data: { character_id: characterId } } as any) as any); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, [characterId]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Poses são PNGs que o jogador pode atribuir às suas habilidades. Durante o golpe, o sprite dele troca para a pose por ~1,4s.
      </p>
      <div className="border border-border rounded p-3 space-y-2 bg-secondary/20">
        <Label>Nova pose</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Nome (ex: Rasengan pose)" value={name} onChange={(e) => setName(e.target.value)} className="sm:flex-1" />
          <ImageUpload label="Enviar imagem" bucket="skills" userId={adminUserId}
            accept="image/png,image/webp" maxMb={5}
            onUploaded={async (url) => {
              const nm = name.trim() || "Pose";
              try {
                await upFn({ data: { character_id: characterId, name: nm, image_url: url, sort_order: rows.length } } as any);
                toast.success("Pose adicionada."); setName(""); load();
              } catch (e: any) { toast.error(e.message); }
            }} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {rows.map((p) => (
          <div key={p.id} className="border border-border rounded p-2 space-y-2 bg-input/40">
            <div className="h-28 bg-black/30 rounded flex items-center justify-center overflow-hidden">
              <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain" />
            </div>
            <Input value={p.name} onChange={(e) => setRows((rs) => rs.map((r) => r.id === p.id ? { ...r, name: e.target.value } : r))}
              onBlur={async () => {
                try { await upFn({ data: { id: p.id, character_id: characterId, name: p.name, image_url: p.image_url } } as any); }
                catch (e: any) { toast.error(e.message); }
              }} className="h-7 text-xs" />
            <Button size="sm" variant="ghost" className="w-full text-red-400 hover:text-red-300" onClick={async () => {
              if (!confirm(`Remover pose "${p.name}"?`)) return;
              try { await delFn({ data: { id: p.id } } as any); toast.success("Removida."); load(); }
              catch (e: any) { toast.error(e.message); }
            }}>Remover</Button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted-foreground col-span-full">Nenhuma pose ainda.</p>}
      </div>
    </div>
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

function LetterRankSelect({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest">{label}</Label>
      <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">—</SelectItem>
          {SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}