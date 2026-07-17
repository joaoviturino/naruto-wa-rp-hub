import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, Plus, Save } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { upsertMinigame, deleteMinigame } from "@/lib/minigame.functions";
import { useProficiencies } from "@/hooks/useProficiencies";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CleanupGame } from "@/components/minigame/CleanupGame";
import { SequenceGame } from "@/components/minigame/SequenceGame";
import { ForgeGame } from "@/components/minigame/ForgeGame";
import { TailoringGame } from "@/components/minigame/TailoringGame";
import { MiningGame } from "@/components/minigame/MiningGame";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboSelect } from "@/components/ui/combo-select";

type Item = { id: string; name: string; type?: string | null; meta?: any; image_url?: string | null };
type SkillLite = { id: string; name: string; rank: string };
type RewardItem = { item_id: string; qty: number };
type Minigame = {
  id: string; slug: string; kind: string; name: string; description: string | null;
  background_url: string | null; tileset_url: string | null; npc_portrait_url: string | null; npc_name: string | null;
  dialog_intro: string | null; dialog_outro: string | null;
  config: any; rewards: any; cooldown_hours: number; active: boolean;
  one_time?: boolean;
  required_rank?: string | null;
  required_profs?: Array<{ skill_class: string; nivel?: string | null; maestria?: string | null }>;
  reward_skills?: Array<{ skill_id: string }>;
};

const EMPTY: Minigame = {
  id: "", slug: "", kind: "cleanup", name: "", description: "",
  background_url: null, tileset_url: null, npc_portrait_url: null, npc_name: "",
  dialog_intro: "", dialog_outro: "",
  config: { duration_seconds: 60, spots: 12, target_score: 8 },
  rewards: { xp: 0, ryo: 0, ef: 0, em: 0, chakra: 0, items: [] },
  cooldown_hours: 24, active: true,
  one_time: false, required_rank: null, required_profs: [], reward_skills: [],
};

const NINJA_RANKS = ["estudante","genin","chunin","tokubetsu_jonin","jonin","anbu","sannin","kage"];
const SKILL_RANKS = ["E","D","C","B","A","S"];

export function MinigameManager() {
  const SKILL_CLASSES_ROWS = useProficiencies();
  const SKILL_CLASSES = SKILL_CLASSES_ROWS.map((c) => c.value);
  const [list, setList] = useState<Minigame[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [skills, setSkills] = useState<SkillLite[]>([]);
  const [selected, setSelected] = useState<Minigame | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ score: number; success: boolean } | null>(null);
  const upsert = useServerFn(upsertMinigame);
  const remove = useServerFn(deleteMinigame);

  async function load() {
    const [{ data: mg }, { data: it }, { data: sk }] = await Promise.all([
      supabase.from("minigames").select("*").order("name"),
      supabase.from("items").select("id,name,type,meta,image_url").order("name"),
      supabase.from("skills").select("id,name,rank").order("name"),
    ]);
    setList(((mg as any[]) ?? []) as Minigame[]);
    setItems((it as Item[]) ?? []);
    setSkills((sk as SkillLite[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function newOne() { setSelected({ ...EMPTY }); }
  function edit(m: Minigame) { setSelected({ ...m, config: m.config ?? EMPTY.config, rewards: m.rewards ?? EMPTY.rewards }); }

  async function save() {
    if (!selected) return;
    try {
      const payload: any = {
        ...(selected.id ? { id: selected.id } : {}),
        slug: selected.slug, kind: selected.kind || "cleanup", name: selected.name,
        description: selected.description || null,
        background_url: selected.background_url, tileset_url: selected.tileset_url,
        npc_portrait_url: selected.npc_portrait_url, npc_name: selected.npc_name || null,
        dialog_intro: selected.dialog_intro || null, dialog_outro: selected.dialog_outro || null,
        config: selected.config, rewards: selected.rewards,
        cooldown_hours: Number(selected.cooldown_hours) || 0, active: selected.active,
        one_time: !!selected.one_time,
        required_rank: selected.required_rank || null,
        required_profs: (selected.required_profs ?? []).filter((p) => p.skill_class),
        reward_skills: (selected.reward_skills ?? []).filter((s) => s.skill_id),
      };
      const r = await upsert({ data: payload });
      toast.success("Minigame salvo.");
      setSelected(null);
      await load();
      const fresh = (await supabase.from("minigames").select("*").eq("id", r.id).maybeSingle()).data as Minigame | null;
      if (fresh) setSelected(fresh);
    } catch (e: any) { toast.error(e.message); }
  }

  async function del(id: string) {
    if (!confirm("Apagar este minigame?")) return;
    try { await remove({ data: { id } }); toast.success("Removido."); setSelected(null); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <Button onClick={newOne} className="w-full"><Plus size={14} className="mr-1" /> Novo minigame</Button>
        <div className="scroll-panel rounded-lg p-2 max-h-[560px] overflow-y-auto">
          {list.map((m) => (
            <div key={m.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selected?.id===m.id?"bg-secondary":"hover:bg-secondary/50"}`}
              onClick={() => edit(m)}>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{m.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{m.slug} · CD {m.cooldown_hours}h</div>
              </div>
              <span className={`text-[10px] px-1.5 rounded ${m.active ? "bg-emerald-900 text-emerald-200" : "bg-secondary text-muted-foreground"}`}>{m.active ? "on" : "off"}</span>
            </div>
          ))}
          {list.length === 0 && <div className="text-xs text-muted-foreground p-3">Nenhum minigame ainda.</div>}
        </div>
      </div>

      {selected ? (
        <div className="space-y-4">
          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Tipo</Label>
                <ComboSelect
                  value={selected.kind || "cleanup"}
                  onChange={(kind) => {
                    const config = kind === "sequence"
                      ? { duration_seconds: 60, max_mistakes: 2, tiles: [] }
                      : (kind === "forge" || kind === "tailoring")
                      ? { duration_seconds: 90, difficulty: 2, hammer_hits: 8, heat_target: 70, temper_target: 40, recipe_item_id: "", source: "inventory" }
                      : (kind === "mining" || kind === "logging")
                      ? { node_hp: 4, swing_cooldown_ms: 500, min_break_interval_ms: 800, xp_per_break: 1, required_items: [], drops: [] }
                      : { duration_seconds: 60, spots: 12, target_score: 8 };
                    setSelected({ ...selected, kind, config });
                  }}
                  options={[
                    { value: "cleanup", label: "Limpeza (clique)" },
                    { value: "sequence", label: "Sequência (acerto)" },
                    { value: "forge", label: "Forja (fabricação)" },
                    { value: "tailoring", label: "Confecção (costura)" },
                    { value: "mining", label: "Mineração (idle)" },
                    { value: "logging", label: "Coleta de Madeira (idle)" },
                  ]}
                />
              </div>
              <div><Label>Nome</Label><Input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} /></div>
              <div><Label>Slug (único, a-z, 0-9, _, -)</Label><Input value={selected.slug} onChange={(e) => setSelected({ ...selected, slug: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={2} value={selected.description ?? ""} onChange={(e) => setSelected({ ...selected, description: e.target.value })} /></div>
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label>Cooldown (horas)</Label><Input type="number" min={0} value={selected.cooldown_hours} onChange={(e) => setSelected({ ...selected, cooldown_hours: Number(e.target.value) })} /></div>
              <label className="flex items-center gap-2 mt-6 text-sm">
                <input type="checkbox" checked={selected.active} onChange={(e) => setSelected({ ...selected, active: e.target.checked })} /> Ativo
              </label>
              <label className="flex items-center gap-2 mt-6 text-sm">
                <input type="checkbox" checked={!!selected.one_time} onChange={(e) => setSelected({ ...selected, one_time: e.target.checked })} /> Feito uma única vez
              </label>
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold">Requisitos</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Patente mínima</Label>
                <ComboSelect
                  value={selected.required_rank ?? ""}
                  onChange={(v) => setSelected({ ...selected, required_rank: v || null })}
                  placeholder="— Nenhuma —"
                  options={[
                    { value: "", label: "— Nenhuma —" },
                    ...NINJA_RANKS.map((r) => ({ value: r, label: r })),
                  ]}
                />
              </div>
            </div>
            <div>
              <Label>Proficiências requeridas</Label>
              <div className="space-y-1">
                {(selected.required_profs ?? []).map((p, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 items-center">
                    <div className="flex-1 min-w-[160px]">
                      <ComboSelect
                        value={p.skill_class}
                        onChange={(v) => {
                          const next = [...(selected.required_profs ?? [])]; next[idx] = { ...p, skill_class: v };
                          setSelected({ ...selected, required_profs: next });
                        }}
                        placeholder="— classe —"
                        options={[
                          { value: "", label: "— classe —" },
                          ...SKILL_CLASSES.map((c) => ({ value: c, label: c })),
                        ]}
                      />
                    </div>
                    <div className="w-32">
                      <ComboSelect
                        value={p.nivel ?? ""}
                        onChange={(v) => { const next = [...(selected.required_profs ?? [])]; next[idx] = { ...p, nivel: (v || null) as any }; setSelected({ ...selected, required_profs: next }); }}
                        placeholder="Nível —"
                        options={[
                          { value: "", label: "Nível —" },
                          ...SKILL_RANKS.map((r) => ({ value: r, label: `Nível ${r}` })),
                        ]}
                      />
                    </div>
                    <div className="w-36">
                      <ComboSelect
                        value={p.maestria ?? ""}
                        onChange={(v) => { const next = [...(selected.required_profs ?? [])]; next[idx] = { ...p, maestria: (v || null) as any }; setSelected({ ...selected, required_profs: next }); }}
                        placeholder="Maestria —"
                        options={[
                          { value: "", label: "Maestria —" },
                          ...SKILL_RANKS.map((r) => ({ value: r, label: `Maestria ${r}` })),
                        ]}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = [...(selected.required_profs ?? [])]; next.splice(idx, 1);
                      setSelected({ ...selected, required_profs: next });
                    }}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSelected({ ...selected, required_profs: [...(selected.required_profs ?? []), { skill_class: "", nivel: null, maestria: null }] })}>
                  <Plus size={14} className="mr-1" /> Adicionar proficiência
                </Button>
              </div>
            </div>
          </div>

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold">Assets</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <ImgSlot label="Fundo (cena)" url={selected.background_url}
                onChange={(u) => setSelected({ ...selected, background_url: u })} folder={selected.slug || "new"} />
              {selected.kind !== "sequence" && (
                <ImgSlot label="Tileset (itens de limpeza)" url={selected.tileset_url}
                  onChange={(u) => setSelected({ ...selected, tileset_url: u })} folder={selected.slug || "new"} />
              )}
              <ImgSlot label="Retrato NPC" url={selected.npc_portrait_url}
                onChange={(u) => setSelected({ ...selected, npc_portrait_url: u })} folder={selected.slug || "new"} />
            </div>
            <div><Label>Nome do NPC</Label><Input value={selected.npc_name ?? ""} onChange={(e) => setSelected({ ...selected, npc_name: e.target.value })} /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Diálogo de início</Label><Textarea rows={4} value={selected.dialog_intro ?? ""} onChange={(e) => setSelected({ ...selected, dialog_intro: e.target.value })} /></div>
              <div><Label>Diálogo final</Label><Textarea rows={4} value={selected.dialog_outro ?? ""} onChange={(e) => setSelected({ ...selected, dialog_outro: e.target.value })} /></div>
            </div>
          </div>

          {selected.kind === "sequence" ? (
            <SequenceConfigEditor selected={selected} setSelected={setSelected} />
          ) : (selected.kind === "forge" || selected.kind === "tailoring") ? (
            <ForgeConfigEditor selected={selected} setSelected={setSelected} items={items} kind={selected.kind} />
          ) : (selected.kind === "mining" || selected.kind === "logging") ? (
            <MiningConfigEditor selected={selected} setSelected={setSelected} items={items} />
          ) : (
            <div className="scroll-panel rounded-lg p-4 space-y-3">
              <h4 className="font-display text-lg text-gold">Configuração da limpeza</h4>
              <div className="grid gap-3 md:grid-cols-3">
                <div><Label>Duração (s)</Label><Input type="number" min={15} max={600} value={selected.config?.duration_seconds ?? 60} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, duration_seconds: Number(e.target.value) } })} /></div>
                <div><Label>Sujeiras na cena</Label><Input type="number" min={3} max={40} value={selected.config?.spots ?? 12} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, spots: Number(e.target.value) } })} /></div>
                <div><Label>Alvo p/ sucesso</Label><Input type="number" min={1} max={40} value={selected.config?.target_score ?? 8} onChange={(e) => setSelected({ ...selected, config: { ...selected.config, target_score: Number(e.target.value) } })} /></div>
              </div>
            </div>
          )}

          <div className="scroll-panel rounded-lg p-4 space-y-3">
            <h4 className="font-display text-lg text-gold">Recompensas (ao concluir com sucesso)</h4>
            <div className="grid gap-3 md:grid-cols-5">
              {(["xp","ryo","ef","em","chakra"] as const).map((k) => (
                <div key={k}><Label>{k.toUpperCase()}</Label>
                  <Input type="number" min={0} value={selected.rewards?.[k] ?? 0}
                    onChange={(e) => setSelected({ ...selected, rewards: { ...selected.rewards, [k]: Number(e.target.value) } })} />
                </div>
              ))}
            </div>
            <div>
              <Label>Itens recompensa</Label>
              <div className="space-y-1">
                {(selected.rewards?.items ?? []).map((ri: RewardItem, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <ComboSelect
                        value={ri.item_id}
                        onChange={(v) => {
                          const next = [...(selected.rewards.items ?? [])]; next[idx] = { ...ri, item_id: v };
                          setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                        }}
                        placeholder="— item —"
                        options={[
                          { value: "", label: "— item —" },
                          ...items.map((it) => ({ value: it.id, label: it.name })),
                        ]}
                      />
                    </div>
                    <Input type="number" min={1} className="w-20" value={ri.qty}
                      onChange={(e) => {
                        const next = [...(selected.rewards.items ?? [])]; next[idx] = { ...ri, qty: Number(e.target.value) };
                        setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                      }} />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = [...(selected.rewards.items ?? [])]; next.splice(idx, 1);
                      setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                    }}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => {
                  const next = [...(selected.rewards?.items ?? []), { item_id: "", qty: 1 }];
                  setSelected({ ...selected, rewards: { ...selected.rewards, items: next } });
                }}><Plus size={14} className="mr-1" /> Adicionar item</Button>
              </div>
            </div>

            <div>
              <Label>Habilidades concedidas</Label>
              <div className="space-y-1">
                {(selected.reward_skills ?? []).map((rs, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <ComboSelect
                        value={rs.skill_id}
                        onChange={(v) => {
                          const next = [...(selected.reward_skills ?? [])]; next[idx] = { skill_id: v };
                          setSelected({ ...selected, reward_skills: next });
                        }}
                        placeholder="— habilidade —"
                        options={[
                          { value: "", label: "— habilidade —" },
                          ...skills.map((s) => ({ value: s.id, label: `[${s.rank}] ${s.name}` })),
                        ]}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = [...(selected.reward_skills ?? [])]; next.splice(idx, 1);
                      setSelected({ ...selected, reward_skills: next });
                    }}><Trash2 size={14} /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSelected({ ...selected, reward_skills: [...(selected.reward_skills ?? []), { skill_id: "" }] })}>
                  <Plus size={14} className="mr-1" /> Adicionar habilidade
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={save}><Save size={14} className="mr-1" /> Salvar</Button>
            <Button variant="secondary" onClick={() => { setTestResult(null); setTesting(true); }}>▶ Testar</Button>
            {selected.id && <Button variant="destructive" onClick={() => del(selected.id)}><Trash2 size={14} className="mr-1" /> Apagar</Button>}
            <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm p-6">Selecione ou crie um minigame à esquerda.</div>
      )}

      {selected && (
        <Dialog open={testing} onOpenChange={(v) => { if (!v) { setTesting(false); setTestResult(null); } }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Teste — {selected.name || "sem nome"}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Modo de teste: sem cooldown, sem recompensas, sem gravar histórico.
            </p>
            {testResult ? (
              <div className="space-y-3">
                <div className={`rounded p-3 text-sm ${testResult.success ? "bg-emerald-950/50 text-emerald-200" : "bg-red-950/50 text-red-200"}`}>
                  {testResult.success ? "✔ Sucesso" : "✘ Falhou"} · Pontuação: <b>{testResult.score}</b>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setTestResult(null)}>Jogar de novo</Button>
                  <Button variant="outline" onClick={() => { setTesting(false); setTestResult(null); }}>Fechar</Button>
                </div>
              </div>
            ) : selected.kind === "sequence" ? (
              <SequenceGame background={selected.background_url} config={selected.config ?? {}} onFinish={(r) => setTestResult(r)} />
            ) : selected.kind === "mining" ? (
              <MiningGame
                runId="test"
                background={selected.background_url}
                config={selected.config ?? {}}
                testMode
                onExit={(b: number) => setTestResult({ score: b, success: true })}
              />
            ) : selected.kind === "forge" ? (
              <ForgeGame
                background={selected.background_url}
                config={selected.config ?? {}}
                preview={(() => {
                  const it = items.find((i) => i.id === selected.config?.recipe_item_id);
                  return it ? { name: it.name, icon: (it as any).image_url ?? null } : undefined;
                })()}
                onFinish={(r) => setTestResult(r)}
              />
            ) : selected.kind === "tailoring" ? (
              <TailoringGame
                background={selected.background_url}
                config={selected.config ?? {}}
                preview={(() => {
                  const it = items.find((i) => i.id === selected.config?.recipe_item_id);
                  return it ? { name: it.name, icon: (it as any).image_url ?? null } : undefined;
                })()}
                onFinish={(r) => setTestResult(r)}
              />
            ) : (
              <CleanupGame background={selected.background_url} tileset={selected.tileset_url} config={selected.config ?? {}} onFinish={(r) => setTestResult(r)} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ImgSlot({ label, url, onChange, folder }: { label: string; url: string | null; onChange: (u: string | null) => void; folder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // component below
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Máx 10MB.");
    setBusy(true);
    try {
      const ext = f.name.split(".").pop() ?? "png";
      const path = `${folder}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("minigames").upload(path, f, { upsert: true, contentType: f.type });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("minigames").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!signed.data?.signedUrl) throw new Error("Falha ao gerar URL.");
      onChange(signed.data.signedUrl);
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 aspect-square rounded bg-secondary overflow-hidden flex items-center justify-center">
        {url ? <img src={url} className="w-full h-full object-contain" alt="" /> : <span className="text-xs text-muted-foreground">Nenhuma</span>}
      </div>
      <div className="flex gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy}>
          <Upload size={12} className="mr-1" /> {busy ? "…" : "Enviar"}
        </Button>
        {url && <Button variant="ghost" size="sm" onClick={() => onChange(null)}><Trash2 size={12} /></Button>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}

type Tile = { slot: number; image_url: string; correct: boolean; order: number | null; description?: string | null };

function SequenceConfigEditor({ selected, setSelected }: { selected: any; setSelected: (s: any) => void }) {
  const cfg = selected.config ?? { duration_seconds: 60, max_mistakes: 2, tiles: [] as Tile[] };
  const tiles: Tile[] = Array.isArray(cfg.tiles) ? cfg.tiles : [];
  const byslot = new Map<number, Tile>();
  tiles.forEach((t) => byslot.set(t.slot, t));
  const fileRefs = useRef<Array<HTMLInputElement | null>>([]);

  function updateCfg(patch: any) { setSelected({ ...selected, config: { ...cfg, ...patch } }); }
  function setTile(slot: number, patch: Partial<Tile> | null) {
    let next = tiles.filter((t) => t.slot !== slot);
    if (patch !== null) {
      const cur = byslot.get(slot) ?? { slot, image_url: "", correct: false, order: null };
      next.push({ ...cur, ...patch, slot });
    }
    next.sort((a, b) => a.slot - b.slot);
    updateCfg({ tiles: next });
  }

  async function uploadTo(slot: number, file: File) {
    if (file.size > 10 * 1024 * 1024) return toast.error("Máx 10MB.");
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${selected.slug || "seq"}/tile-${slot}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("minigames").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) return toast.error(up.error.message);
    const signed = await supabase.storage.from("minigames").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed.data?.signedUrl) setTile(slot, { image_url: signed.data.signedUrl });
  }

  return (
    <div className="scroll-panel rounded-lg p-4 space-y-3">
      <h4 className="font-display text-lg text-gold">Configuração da sequência</h4>
      <div className="grid gap-3 md:grid-cols-3">
        <div><Label>Duração (s)</Label><Input type="number" min={10} max={600}
          value={cfg.duration_seconds ?? 60}
          onChange={(e) => updateCfg({ duration_seconds: Number(e.target.value) })} /></div>
        <div><Label>Erros permitidos</Label><Input type="number" min={0} max={10}
          value={cfg.max_mistakes ?? 2}
          onChange={(e) => updateCfg({ max_mistakes: Number(e.target.value) })} /></div>
      </div>
      <div className="text-xs text-muted-foreground">
        Configure o grid 4×4. Marque quais tiles são corretos e a ordem em que devem ser clicados (1, 2, 3…).
      </div>
      <div className="grid grid-cols-4 gap-2 max-w-[520px]">
        {Array.from({ length: 16 }, (_, slot) => {
          const t = byslot.get(slot);
          return (
            <div key={slot} className="rounded border border-border bg-secondary/40 p-1 space-y-1">
              <div className="text-[10px] text-muted-foreground text-center">#{slot + 1}</div>
              <div className="aspect-square rounded overflow-hidden bg-black/30 flex items-center justify-center">
                {t?.image_url
                  ? <img src={t.image_url} className="w-full h-full object-cover" alt="" />
                  : <span className="text-[10px] text-muted-foreground">vazio</span>}
              </div>
              <input ref={(el) => { fileRefs.current[slot] = el; }} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTo(slot, f); if (e.target) e.target.value = ""; }} />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7"
                  onClick={() => fileRefs.current[slot]?.click()}>Img</Button>
                {t && <Button size="sm" variant="ghost" className="h-7" onClick={() => setTile(slot, null)}><Trash2 size={12} /></Button>}
              </div>
              <label className="flex items-center gap-1 text-[10px]">
                <input type="checkbox" checked={!!t?.correct} disabled={!t?.image_url}
                  onChange={(e) => setTile(slot, { correct: e.target.checked, order: e.target.checked ? (t?.order ?? nextOrder(tiles)) : null })} />
                correto
              </label>
              <Input type="number" min={1} className="h-7 text-xs"
                placeholder="ordem"
                value={t?.correct && t?.order != null ? t.order + 1 : ""}
                disabled={!t?.correct}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTile(slot, { order: v > 0 ? v - 1 : 0 });
                }} />
              <Input className="h-7 text-xs" placeholder="descrição"
                defaultValue={t?.description ?? ""}
                disabled={!t?.image_url}
                onBlur={(e) => setTile(slot, { description: e.target.value || null })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function nextOrder(tiles: Tile[]) {
  const orders = tiles.filter((t) => t.correct && t.order != null).map((t) => t.order as number);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function MiningConfigEditor({ selected, setSelected, items }: { selected: any; setSelected: (s: any) => void; items: Item[] }) {
  const cfg = selected.config ?? {};
  const required: Array<{ item_id: string; qty: number }> = Array.isArray(cfg.required_items) ? cfg.required_items : [];
  const drops: Array<{ item_id: string; chance: number; min_qty: number; max_qty: number }> = Array.isArray(cfg.drops) ? cfg.drops : [];
  function set(patch: any) { setSelected({ ...selected, config: { ...cfg, ...patch } }); }
  return (
    <div className="scroll-panel rounded-lg p-4 space-y-4">
      <h4 className="font-display text-lg text-gold">Configuração da mineração</h4>

      <div className="grid gap-3 md:grid-cols-4">
        <div><Label>HP da rocha (golpes)</Label>
          <Input type="number" min={1} max={20} value={cfg.node_hp ?? 4}
            onChange={(e) => set({ node_hp: Math.max(1, Math.min(20, Number(e.target.value) || 4)) })} />
        </div>
        <div><Label>Cooldown do golpe (ms)</Label>
          <Input type="number" min={150} max={5000} value={cfg.swing_cooldown_ms ?? 500}
            onChange={(e) => set({ swing_cooldown_ms: Math.max(150, Number(e.target.value) || 500) })} />
        </div>
        <div><Label>Intervalo mín. entre quebras (ms)</Label>
          <Input type="number" min={300} max={10000} value={cfg.min_break_interval_ms ?? 800}
            onChange={(e) => set({ min_break_interval_ms: Math.max(300, Number(e.target.value) || 800) })} />
        </div>
        <div><Label>XP por quebra</Label>
          <Input type="number" min={0} max={1000} value={cfg.xp_per_break ?? 1}
            onChange={(e) => set({ xp_per_break: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ferramentas necessárias no inventário</Label>
          <Button size="sm" variant="outline" onClick={() => set({ required_items: [...required, { item_id: "", qty: 1 }] })}>
            <Plus size={14} className="mr-1" /> Item
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Deixe vazio no ambiente de teste. No futuro, exija picareta etc.</p>
        {required.map((r, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <div className="flex-1">
              <ComboSelect
                value={r.item_id}
                onChange={(v) => { const next = [...required]; next[idx] = { ...r, item_id: v }; set({ required_items: next }); }}
                placeholder="— item —"
                options={[
                  { value: "", label: "— item —" },
                  ...items.map((it) => ({ value: it.id, label: it.name })),
                ]}
              />
            </div>
            <Input type="number" min={1} max={99} className="w-20" value={r.qty}
              onChange={(e) => { const next = [...required]; next[idx] = { ...r, qty: Math.max(1, Number(e.target.value) || 1) }; set({ required_items: next }); }} />
            <Button variant="ghost" size="icon" onClick={() => { const next = [...required]; next.splice(idx, 1); set({ required_items: next }); }}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tabela de drops</Label>
          <Button size="sm" variant="outline" onClick={() => set({ drops: [...drops, { item_id: "", chance: 50, min_qty: 1, max_qty: 1 }] })}>
            <Plus size={14} className="mr-1" /> Drop
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Cada linha é rolada independentemente por quebra. Chance em %.</p>
        <div className="space-y-1">
          <div className="hidden md:grid grid-cols-[1fr_90px_80px_80px_40px] gap-2 text-[10px] uppercase tracking-widest text-muted-foreground px-1">
            <span>Item</span><span>Chance %</span><span>Min</span><span>Max</span><span></span>
          </div>
          {drops.map((d, idx) => (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-[1fr_90px_80px_80px_40px] gap-2 items-center">
              <Select
                value={d.item_id || undefined}
                onValueChange={(v) => { const next = [...drops]; next[idx] = { ...d, item_id: v }; set({ drops: next }); }}
              >
                <SelectTrigger className="col-span-2 md:col-span-1 h-9 text-sm">
                  <SelectValue placeholder="— material —" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {items.filter((it) => (it.type ?? "").toLowerCase() === "material").length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground italic">
                      Nenhum item do tipo "material" cadastrado.
                    </div>
                  )}
                  {items
                    .filter((it) => (it.type ?? "").toLowerCase() === "material")
                    .map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        <div className="flex items-center gap-2">
                          {it.image_url && <img src={it.image_url} alt="" className="w-4 h-4 object-contain" />}
                          <span>{it.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input type="number" min={0} max={100} step={0.1} value={d.chance}
                onChange={(e) => { const next = [...drops]; next[idx] = { ...d, chance: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }; set({ drops: next }); }} />
              <Input type="number" min={1} max={99} value={d.min_qty}
                onChange={(e) => { const next = [...drops]; next[idx] = { ...d, min_qty: Math.max(1, Number(e.target.value) || 1) }; set({ drops: next }); }} />
              <Input type="number" min={1} max={99} value={d.max_qty}
                onChange={(e) => { const next = [...drops]; next[idx] = { ...d, max_qty: Math.max(1, Number(e.target.value) || 1) }; set({ drops: next }); }} />
              <Button variant="ghost" size="icon" onClick={() => { const next = [...drops]; next.splice(idx, 1); set({ drops: next }); }}>
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          {!drops.length && <div className="text-xs text-muted-foreground italic p-2">Nenhum drop configurado — o jogador não ganhará nada por quebra.</div>}
        </div>
      </div>
    </div>
  );
}

function ForgeConfigEditor({ selected, setSelected, items, kind }: { selected: any; setSelected: (s: any) => void; items: Item[]; kind?: string }) {
  const cfg = selected.config ?? {};
  const craftable = items.filter((it) => Array.isArray((it as any)?.meta?.recipe) && (it as any).meta.recipe.length > 0);
  const target = items.find((it) => it.id === cfg.recipe_item_id);
  const recipe: Array<{ item_id: string; qty: number }> = Array.isArray((target as any)?.meta?.recipe) ? (target as any).meta.recipe : [];
  const nameById = new Map(items.map((it) => [it.id, it.name]));
  const imgById = new Map(items.map((it) => [it.id, (it as any).image_url ?? null]));
  const isTailoring = kind === "tailoring";
  function set(patch: any) { setSelected({ ...selected, config: { ...cfg, ...patch } }); }
  return (
    <div className="scroll-panel rounded-lg p-4 space-y-3">
      <h4 className="font-display text-lg text-gold">{isTailoring ? "Configuração da confecção" : "Configuração da forja"}</h4>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Item padrão (opcional — jogador pode escolher materiais livres)</Label>
          <ComboSelect
            value={cfg.recipe_item_id ?? ""}
            onChange={(v) => set({ recipe_item_id: v })}
            placeholder="— livre (qualquer receita cadastrada) —"
            options={[
              { value: "", label: "— livre (qualquer receita cadastrada) —" },
              ...craftable.map((it) => ({ value: it.id, label: it.name })),
            ]}
          />
          {!craftable.length
            ? <div className="text-xs text-muted-foreground mt-1">Nenhum item com receita. Adicione uma receita na aba Itens.</div>
            : <div className="text-xs text-muted-foreground mt-1">Deixe vazio para que o jogador escolha materiais na bolsa e o sistema descubra o item forjado.</div>}
        </div>
        <div>
          <Label>Origem dos materiais</Label>
          <ComboSelect
            value={cfg.source ?? "inventory"}
            onChange={(v) => set({ source: v })}
            options={[
              { value: "inventory", label: "Apenas mochila" },
              { value: "inventory_or_equipped", label: "Mochila ou equipados" },
            ]}
          />
        </div>
      </div>

      {target && (
        <div className="rounded border border-border p-3 bg-secondary/30">
          <div className="flex items-center gap-3 mb-2">
            {imgById.get(target.id) && <img src={imgById.get(target.id) as string} className="w-12 h-12 object-contain" alt="" />}
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Prévia</div>
              <div className="font-display text-gold">{target.name}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mb-1">Materiais consumidos:</div>
          <ul className="text-sm space-y-1">
            {recipe.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                {imgById.get(r.item_id) && <img src={imgById.get(r.item_id) as string} className="w-5 h-5 object-contain" alt="" />}
                <span>{nameById.get(r.item_id) ?? r.item_id}</span>
                <span className="text-muted-foreground">× {r.qty}</span>
              </li>
            ))}
            {!recipe.length && <li className="text-muted-foreground">Sem receita definida.</li>}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div><Label>Dificuldade (1–5)</Label>
          <Input type="number" min={1} max={5} value={cfg.difficulty ?? 2}
            onChange={(e) => set({ difficulty: Math.max(1, Math.min(5, Number(e.target.value) || 2)) })} />
        </div>
        <div><Label>Duração (s)</Label>
          <Input type="number" min={20} max={300} value={cfg.duration_seconds ?? 90}
            onChange={(e) => set({ duration_seconds: Number(e.target.value) })} />
        </div>
        <div><Label>{isTailoring ? "Pontos de costura" : "Marteladas"}</Label>
          <Input type="number" min={3} max={20} value={cfg.hammer_hits ?? 8}
            onChange={(e) => set({ hammer_hits: Number(e.target.value) })} />
        </div>
        <div><Label>{isTailoring ? "Alvo de corte (%)" : "Alvo de calor (%)"}</Label>
          <Input type="number" min={20} max={95} value={cfg.heat_target ?? 70}
            onChange={(e) => set({ heat_target: Number(e.target.value) })} />
        </div>
        <div><Label>{isTailoring ? "Alvo de acabamento (%)" : "Alvo de têmpera (%)"}</Label>
          <Input type="number" min={5} max={95} value={cfg.temper_target ?? 40}
            onChange={(e) => set({ temper_target: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}