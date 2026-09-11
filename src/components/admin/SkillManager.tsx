import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { upsertSkill, deleteSkill } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { NINJA_RANKS, SKILL_RANKS, ELEMENTS, CLASSIFICATIONS, RANGES, labelize } from "./shared";
import { useProficiencies } from "@/hooks/useProficiencies";
import { Trash2, Pencil, Plus, Swords, FlaskConical, Search, Copy, Download, Upload } from "lucide-react";
import { RestoreEffectFields } from "./RestoreEffectFields";
import { SkillTestDialog } from "./SkillTestDialog";
import { SkillVisualFields } from "./SkillVisualFields";
import { SKILL_BLUEPRINTS, copySkillBlueprint, exportSkillBlueprint, importSkillBlueprint, skillBalanceNotes } from "@/lib/skill-blueprints";

export function SkillManager({ adminUserId }: { adminUserId: string }) {
  const [skills, setSkills] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [clans, setClans] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rank, setRank] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const remove = useServerFn(deleteSkill);
  async function load() {
    setLoading(true); setError(null);
    try {
      const [s, m, c, it] = await Promise.all([
        supabase.from("skills").select("*").order("name"),
        supabase.from("missions").select("id,name"),
        supabase.from("clans").select("id,name,village"),
        supabase.from("items").select("id,name,category,rank").order("name"),
      ]);
      for (const result of [s, m, c, it]) if (result.error) throw result.error;
      setSkills(s.data ?? []); setMissions(m.data ?? []); setClans(c.data ?? []); setItems(it.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar o catálogo."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  function edit(skill: any) { setEditing(skill); setOpen(true); }
  function download(skill: any) {
    try {
      const url = URL.createObjectURL(new Blob([exportSkillBlueprint(skill)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "shinobi-habilidade.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast.error("Não foi possível exportar: revise os campos da habilidade."); }
  }
  const filtered = skills.filter((s) => (rank === "all" || s.rank === rank)
    && `${s.name} ${s.skill_class ?? ""} ${s.element ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const activePage = Math.min(page, pages - 1);
  const visible = filtered.slice(activePage * 12, (activePage + 1) * 12);
  const toReview = skills.filter((skill) => skillBalanceNotes(skill).length > 0).length;
  return <div className="skill-workshop space-y-5">
    <div className="flex justify-between gap-3 flex-wrap items-start">
      <div><div className="text-xs uppercase tracking-widest text-gold">Oficina de jutsus</div>
        <h3 className="font-display text-2xl mt-1">Banco de habilidades</h3>
        <p className="text-sm text-muted-foreground mt-1">{skills.length} técnicas · {toReview} com sugestões de balanceamento</p></div>
      <div className="flex gap-2 flex-wrap">
        <input type="file" accept="application/json,.json" ref={fileRef} className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = "";
          if (!file) return;
          if (file.size > 200_000) return toast.error("O arquivo deve ter até 200 KB.");
          try { edit(importSkillBlueprint(await file.text())); toast.info("Modelo aberto para revisão. Salve para adicionar ao catálogo."); }
          catch (error) { toast.error(error instanceof Error ? error.message : "Modelo inválido."); }
        }} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={16} /> Importar modelo</Button>
        <Button onClick={() => edit({ name: "", rank: "E", energy_type: "chakra" })}><Plus size={16} /> Nova habilidade</Button>
      </div>
    </div>
    <div className="rounded-xl border border-gold/25 bg-gold/5 p-4 space-y-3">
      <div className="font-semibold text-sm">Começar com uma ideia</div>
      <div className="flex gap-2 flex-wrap">{SKILL_BLUEPRINTS.map((b) => <Button key={b.id} variant="outline" size="sm"
        onClick={() => edit(structuredClone(b.skill))}>{b.label}</Button>)}</div>
      <p className="text-sm text-muted-foreground">Os modelos abrem um rascunho. Ajuste requisitos, custo e recarga e teste antes de adicionar ao jogo.</p>
    </div>
    <div className="flex gap-3">
      <div className="relative flex-1"><Search size={16} className="absolute top-3.5 left-3 text-muted-foreground" />
        <Input aria-label="Buscar habilidades" placeholder="Buscar nome, classe ou elemento" className="pl-9 h-11" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div>
      <Select value={rank} onValueChange={(v) => { setRank(v); setPage(0); }}><SelectTrigger className="w-28 h-11" aria-label="Filtrar por rank"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todos</SelectItem>{SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>Rank {r}</SelectItem>)}</SelectContent></Select>
    </div>
    {error ? <div role="alert" className="rounded-lg border border-blood p-4 text-sm">{error}<Button variant="outline" className="ml-2" onClick={() => void load()}>Tentar novamente</Button></div>
      : loading ? <p role="status" className="py-8 text-muted-foreground">Consultando os pergaminhos…</p>
      : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{visible.map((s) => <article key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex gap-3"><div className="h-12 w-12 rounded-lg bg-secondary shrink-0 grid place-items-center overflow-hidden">
          {s.image_url ? <img src={s.image_url} className="w-full h-full object-cover" alt="" loading="lazy" /> : <Swords size={22} className="text-gold" />}</div>
          <div className="min-w-0"><span className="text-xs text-gold uppercase">Rank {s.rank} · {labelize(s.classification ?? "suplementar")}</span>
            <h4 className="font-semibold break-words">{s.name}</h4></div></div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{s.cost_percent}% {s.energy_type?.toUpperCase()}</span><span>Precisão {s.accuracy}%</span><span>Recarga {s.cooldown_turns}t</span></div>
        {skillBalanceNotes(s).length > 0 && <p className="text-xs text-amber-300">{skillBalanceNotes(s).length} sugestões ao editar</p>}
        <div className="flex gap-1 border-t border-border pt-2">
          <Button variant="outline" size="sm" className="mr-auto" onClick={() => edit(s)}><Pencil size={14} /> Editar</Button>
          <Button aria-label={`Duplicar ${s.name}`} variant="ghost" size="icon" onClick={() => {
            try { edit(copySkillBlueprint(s)); } catch { toast.error("Revise os campos desta habilidade antes de duplicar."); }
          }}><Copy size={16} /></Button>
          <Button aria-label={`Exportar ${s.name}`} variant="ghost" size="icon" onClick={() => download(s)}><Download size={16} /></Button>
          <Button aria-label={`Excluir ${s.name}`} disabled={!!deleting} variant="ghost" size="icon" onClick={async () => {
            if (!confirm(`Remover ${s.name}?`)) return;
            setDeleting(s.id);
            try { await remove({ data: { id: s.id } }); toast.success("Habilidade removida."); await load(); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível remover."); }
            finally { setDeleting(null); }
          }}><Trash2 size={16} /></Button>
        </div>
      </article>)}</div>}
    {!loading && !error && !filtered.length && <p className="py-6 text-muted-foreground">Nenhuma habilidade encontrada. Crie uma técnica ou escolha um modelo.</p>}
    {pages > 1 && <div className="flex gap-3 items-center justify-center"><Button variant="outline" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Anterior</Button>
      <span className="text-sm">{activePage + 1} / {pages}</span><Button variant="outline" disabled={activePage + 1 === pages} onClick={() => setPage(activePage + 1)}>Próxima</Button></div>}
    <SkillDialog open={open} onOpenChange={setOpen} initial={editing} missions={missions} clans={clans} allSkills={skills} items={items}
      adminUserId={adminUserId} onSaved={() => { setOpen(false); void load(); }} />
  </div>;
}

function SkillDialog({ open, onOpenChange, initial, missions, clans, allSkills, items, adminUserId, onSaved }: any) {
  const SKILL_CLASSES = useProficiencies();
  const save = useServerFn(upsertSkill);
  const [f, setF] = useState<any>(initial ?? {});
  const [testOpen, setTestOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF(initial ?? {}); }, [initial]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="skill-workshop max-w-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar habilidade" : "Criar habilidade"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <SkillVisualFields skill={f} onChange={(meta) => up("meta", meta)} />
          <Field label="Nome"><Input value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} /></Field>
          <Field label="Rank">
            <Select value={f.rank ?? "E"} onValueChange={(v: any) => up("rank", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SKILL_RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Classificação">
            <NullableSelect value={f.classification} onChange={(v: any) => up("classification", v)} options={CLASSIFICATIONS.map((c) => ({ value: c, label: labelize(c) }))} />
          </Field>
          <Field label="Classe">
            <NullableSelect
              value={f.skill_class}
              onChange={(v: any) => up("skill_class", v)}
              options={SKILL_CLASSES.map((c) => ({ value: c.value, label: c.label }))}
            />
            {f.skill_class && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {SKILL_CLASSES.find((c) => c.value === f.skill_class)?.description}
              </p>
            )}
          </Field>
          <Field label="Alcance">
            <NullableSelect value={f.range} onChange={(v: any) => up("range", v)} options={RANGES.map((r) => ({ value: r, label: labelize(r) }))} />
          </Field>
          <Field label="Elemento">
            <NullableSelect value={f.element} onChange={(v: any) => up("element", v)} options={ELEMENTS.map((e) => ({ value: e, label: e }))} />
          </Field>
          <Field label="Imagem">
            <div className="flex items-center gap-2">
              {f.image_url && <img src={f.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="skills" userId={adminUserId} onUploaded={(url) => up("image_url", url)} />
            </div>
          </Field>
          <Field label="Som (MP3/OGG/WAV — sonoplastia)">
            <div className="flex items-center gap-2">
              {f.sound_url && <audio controls src={f.sound_url} className="h-8 max-w-[180px]" />}
              <ImageUpload label="Enviar" bucket="skills" userId={adminUserId}
                accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav" maxMb={5}
                onUploaded={(url) => up("sound_url", url)} />
              {f.sound_url && <Button size="sm" variant="ghost" onClick={() => up("sound_url", null)}>Remover</Button>}
            </div>
          </Field>
          <Field label="Animação (GIF/PNG/MP4/WebM)">
            <div className="flex items-center gap-2">
              {f.animation_url && /\.(mp4|webm)$/i.test(f.animation_url)
                ? <video src={f.animation_url} className="w-12 h-12 rounded object-cover" muted loop autoPlay />
                : f.animation_url && <img src={f.animation_url} alt="" className="w-12 h-12 rounded object-cover" />}
              <ImageUpload label="Enviar" bucket="skills" userId={adminUserId}
                accept="image/gif,image/png,image/webp,video/mp4,video/webm" maxMb={8}
                onUploaded={(url) => up("animation_url", url)} />
              {f.animation_url && <Button size="sm" variant="ghost" onClick={() => up("animation_url", null)}>Remover</Button>}
            </div>
          </Field>
          <Field label="Modo de animação">
            <Select value={f.animation_mode ?? "overlay"} onValueChange={(v: any) => up("animation_mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="projectile">Projétil (sai do usuário até o inimigo)</SelectItem>
                <SelectItem value="front">Em frente ao inimigo</SelectItem>
                <SelectItem value="overlay">Sobreposto ao inimigo (mesmo frame)</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-[10px] text-muted-foreground mt-1">
              Define como o GIF/vídeo aparece no combate. Sem animação carregada, o valor é ignorado.
            </div>
          </Field>
          <div className="sm:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!f.is_dash}
                onChange={(e) => up("is_dash", e.target.checked)} />
              <span className="font-display text-amber-300">Dash / Teletransporte</span>
            </label>
            <p className="text-[11px] text-muted-foreground">
              Quando ativo, o personagem se desloca rapidamente até a frente do inimigo antes de trocar de pose e aplicar o golpe. Ideal para técnicas físicas de investida.
            </p>
          </div>
          <Field label="Clã (opcional, define técnica de clã)">
            <NullableSelect value={f.clan_id} onChange={(v: any) => up("clan_id", v)} options={clans.map((c: any) => ({ value: c.id, label: `${c.name} (${c.village})` }))} />
          </Field>
          <Field label="Patente mínima">
            <NullableSelect value={f.req_rank} onChange={(v: any) => up("req_rank", v)} options={NINJA_RANKS.map((r) => ({ value: r.value, label: r.label }))} />
          </Field>
          <Field label="Classe requerida">
            <NullableSelect value={f.req_class} onChange={(v: any) => up("req_class", v)} options={SKILL_CLASSES.map((c) => ({ value: c.value, label: c.label }))} />
          </Field>
          <Field label="Nível mínimo">
            <NullableSelect value={f.req_nivel} onChange={(v: any) => up("req_nivel", v)} options={SKILL_RANKS.map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Maestria mínima">
            <NullableSelect value={f.req_maestria} onChange={(v: any) => up("req_maestria", v)} options={SKILL_RANKS.map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Requer missão">
            <NullableSelect value={f.req_mission_id} onChange={(v: any) => up("req_mission_id", v)} options={missions.map((m: any) => ({ value: m.id, label: m.name }))} />
          </Field>
          <Field label="Habilidade pré-requisito">
            <NullableSelect value={f.req_prereq_skill_id} onChange={(v: any) => up("req_prereq_skill_id", v)}
              options={allSkills.filter((x: any) => x.id !== f.id).map((s: any) => ({ value: s.id, label: `${s.name} (${s.rank})` }))} />
          </Field>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} />
          </div>

          <div className="sm:col-span-2 mt-2 border-t border-border pt-3">
            <div className="text-xs font-display text-gold flex items-center gap-1"><Swords size={14} /> Combate</div>
          </div>
          <Field label="Tipo de energia">
            <Select value={f.energy_type ?? "chakra"} onValueChange={(v: any) => up("energy_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ef">EF (Física)</SelectItem>
                <SelectItem value="em">EM (Mental)</SelectItem>
                <SelectItem value="chakra">Chakra</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Custo máximo (% da pool)">
            <Input type="number" min={1} max={100} value={f.cost_percent ?? 20} onChange={(e) => up("cost_percent", Math.max(1, Math.min(100, Number(e.target.value))))} />
            <div className="text-[10px] text-muted-foreground mt-1">O jogador pode gastar de 1 até esse % da pool escolhida.</div>
          </Field>
          <Field label="Bônus de velocidade">
            <Input type="number" step="0.1" min={0} value={f.bonus_speed ?? 1} onChange={(e) => up("bonus_speed", Number(e.target.value))} />
          </Field>
          <Field label="Bônus crítico (multiplica dano)">
            <Input type="number" step="0.1" min={0} value={f.bonus_critical ?? 1} onChange={(e) => up("bonus_critical", Number(e.target.value))} />
          </Field>
          <Field label="Bônus energético (multiplica energia usada)">
            <Input type="number" step="0.1" min={0} value={f.bonus_energetic ?? 1} onChange={(e) => up("bonus_energetic", Number(e.target.value))} />
          </Field>
          <Field label="Cooldown (turnos)">
            <Input type="number" min={0} max={50} value={f.cooldown_turns ?? 0} onChange={(e) => up("cooldown_turns", Number(e.target.value))} />
          </Field>
          <Field label="Precisão (chance de acertar %)">
            <Input type="number" min={1} max={100} value={f.accuracy ?? 100}
              onChange={(e) => up("accuracy", Math.max(1, Math.min(100, Number(e.target.value))))} />
            <div className="text-[10px] text-muted-foreground mt-1">
              Ex.: 90 = 10% de chance de errar. Energia e cooldown são gastos mesmo ao errar.
            </div>
          </Field>
          <div className="sm:col-span-2 rounded-md border border-sky-500/40 bg-sky-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-display text-sky-300">Habilidade defensiva</div>
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!!f.is_defensive}
                  onChange={(e) => up("is_defensive", e.target.checked)} />
                Marcar como defensiva
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Habilidades defensivas aparecem no menu <b>Defender</b> do combate. Quando ativadas,
              reduzem o dano do próximo golpe recebido pela % configurada.
            </p>
            {f.is_defensive && (
              <div>
                <Label>Redução de dano (%)</Label>
                <Input type="number" min={0} max={100} value={f.defense_percent ?? 50}
                  onChange={(e) => up("defense_percent", Math.max(0, Math.min(100, Number(e.target.value))))} />
              </div>
            )}
          </div>
          {(f.req_class === "shurikenjutsu" || f.skill_class === "shurikenjutsu") && (
            <>
            <Field label="Item de shurikenjutsu utilizado">
              <Select
                value={f.required_item_id ?? "__none__"}
                onValueChange={(v: string) => up("required_item_id", v === "__none__" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum (consome qualquer shuriken/kunai) —</SelectItem>
                  {(items ?? [])
                    .filter((it: any) => ["shuriken","kunai","tool","weapon","consumable","material"].includes(it.category ?? "") || true)
                    .map((it: any) => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.name}{it.rank ? ` · ${it.rank}` : ""}{it.category ? ` · ${it.category}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="text-[10px] text-muted-foreground mt-1">
                Se definido, a técnica só pode ser executada quando o jogador possuir este item na bolsa, e ele será consumido no lugar do padrão.
              </div>
            </Field>
            <Field label="Qtd. de ferramentas consumidas por uso">
              <Input type="number" min={1} max={999}
                value={f.meta?.tool_qty ?? 1}
                onChange={(e) => up("meta", { ...(f.meta ?? {}), tool_qty: Math.max(1, Number(e.target.value)) })}
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Ex.: 1 (shuriken simples), 5 (grande chuva de shurikens). Consome de kunais/shurikens da bolsa.
              </div>
            </Field>
            </>
          )}
          {(f.req_class === "kenjutsu" || f.skill_class === "kenjutsu") && (
            <Field label="Desgaste da espada por golpe (% da durabilidade máx.)">
              <Input type="number" min={1} max={100}
                value={f.meta?.durability_cost_pct ?? 10}
                onChange={(e) => up("meta", { ...(f.meta ?? {}), durability_cost_pct: Math.max(1, Math.min(100, Number(e.target.value))) })}
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Cada uso desta técnica reduz esse percentual da durabilidade máxima da(s) espada(s) equipada(s).
              </div>
            </Field>
          )}
          {f.classification === "suplementar" && (
            <RestoreEffectFields
              value={f.meta?.restore ?? null}
              onChange={(r) => up("meta", { ...(f.meta ?? {}), restore: r })}
              title="Restauração de energia (habilidade suplementar)"
            />
          )}
          {(f.skill_class === "genjutsu" || f.req_class === "genjutsu") && (
            <GenjutsuFields
              value={f.meta?.genjutsu ?? null}
              onChange={(g) => up("meta", { ...(f.meta ?? {}), genjutsu: g })}
              adminUserId={adminUserId}
            />
          )}
          {f.classification === "suplementar" &&
            (f.skill_class === "ninjutsu_medico" || f.req_class === "ninjutsu_medico") && (
              <div className="sm:col-span-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                <div className="text-xs font-display text-emerald-300">
                  Ninjutsu Médico — cura de HP
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A quantidade de HP recuperada é igual à energia gasta, ampliada
                  por buffs de clã (poder) e maestria em Iryo. A animação
                  padrão são partículas verdes subindo do alvo — nenhum GIF é
                  necessário.
                </p>
                <div>
                  <Label>Alvo da cura</Label>
                  <Select
                    value={f.meta?.heal?.target ?? "__none__"}
                    onValueChange={(v: any) =>
                      up("meta", {
                        ...(f.meta ?? {}),
                        heal:
                          v === "__none__"
                            ? undefined
                            : { target: v },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Não é cura" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Não é cura —</SelectItem>
                      <SelectItem value="single">Único alvo do time</SelectItem>
                      <SelectItem value="team">Time inteiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => setTestOpen(true)}>
            <FlaskConical size={14} /> Testar
          </Button>
          <Button disabled={saving || !f.name?.trim()} onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              // Normaliza meta.restore e faz cura HP roteada pelo sistema Iryo.
              const meta = { ...(f.meta ?? {}) } as any;
              const VALID_POOLS = ["hp", "ef", "em", "chakra", "all"];
              if (meta.restore) {
                if (!VALID_POOLS.includes(meta.restore.pool)) meta.restore.pool = "chakra";
                if (!["flat", "percent"].includes(meta.restore.mode)) meta.restore.mode = "flat";
                meta.restore.amount = Math.max(0, Number(meta.restore.amount ?? 0));
                // Restore com pool=hp em skill = cura. Roteia para o motor Iryo
                // (meta.heal) para que o combate aplique a cura corretamente.
                if (meta.restore.pool === "hp" && !meta.heal) {
                  meta.heal = { target: "single" };
                }
              }
              await save({ data: {
                ...f,
                rank: f.rank ?? "E",
                description: f.description || null,
                image_url: f.image_url || null,
                animation_url: f.animation_url || null,
                animation_mode: f.animation_mode ?? "overlay",
                sound_url: f.sound_url || null,
                skill_class: f.skill_class || null,
                required_item_id: f.required_item_id || null,
                energy_type: f.energy_type ?? "chakra",
                base_cost: 0,
                cost_percent: Math.max(1, Math.min(100, Number(f.cost_percent ?? 20))),
                bonus_speed: Number(f.bonus_speed ?? 1),
                bonus_critical: Number(f.bonus_critical ?? 1),
                bonus_energetic: Number(f.bonus_energetic ?? 1),
                cooldown_turns: Number(f.cooldown_turns ?? 0),
                accuracy: Math.max(1, Math.min(100, Number(f.accuracy ?? 100))),
                is_defensive: !!f.is_defensive,
                defense_percent: Math.max(0, Math.min(100, Number(f.defense_percent ?? 50))),
                is_dash: !!f.is_dash,
                meta,
              } } as any);
              toast.success("Habilidade salva."); onSaved();
            } catch (e: any) { toast.error(e.message); }
            finally { setSaving(false); }
          }}>{saving ? "Salvando…" : "Salvar"}</Button>
        </div>
        <SkillTestDialog open={testOpen} onOpenChange={setTestOpen} skill={f} />
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: any) { return <div><Label>{label}</Label>{children}</div>; }
function NullableSelect({ value, onChange, options }: any) {
  return (
    <Select value={value ?? "__none__"} onValueChange={(v: string) => onChange(v === "__none__" ? null : v)}>
      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Nenhum —</SelectItem>
        {options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

type GenjutsuMeta = {
  scenery_url?: string | null;
  scenery_turns?: number;
  accuracy_debuff?: number;
  accuracy_turns?: number;
  paralyze_turns?: number;
};

function GenjutsuFields({
  value, onChange, adminUserId,
}: {
  value: GenjutsuMeta | null;
  onChange: (g: GenjutsuMeta | null) => void;
  adminUserId: string;
}) {
  const g: GenjutsuMeta = value ?? {};
  function set<K extends keyof GenjutsuMeta>(k: K, v: GenjutsuMeta[K]) {
    const next: GenjutsuMeta = { ...g, [k]: v };
    // limpa se tudo zerado/vazio
    const empty = !next.scenery_url
      && !Number(next.scenery_turns ?? 0)
      && !Number(next.accuracy_debuff ?? 0)
      && !Number(next.accuracy_turns ?? 0)
      && !Number(next.paralyze_turns ?? 0);
    onChange(empty ? null : next);
  }
  return (
    <div className="sm:col-span-2 rounded-md border border-fuchsia-500/40 bg-fuchsia-500/5 p-3 space-y-3">
      <div className="text-xs font-display text-fuchsia-300">Genjutsu — efeitos de ilusão</div>
      <p className="text-[11px] text-muted-foreground">
        Combine livremente: trocar o cenário do combate, reduzir a precisão do alvo
        e/ou paralisá-lo por N turnos. Deixe em 0 os campos que não deve usar.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Cenário ilusório (imagem)</Label>
          <div className="flex items-center gap-2 mt-1">
            {g.scenery_url && (
              <img src={g.scenery_url} alt="" className="w-14 h-10 rounded object-cover border border-border" />
            )}
            <ImageUpload label="Enviar" bucket="skills" userId={adminUserId}
              onUploaded={(url) => set("scenery_url", url)} />
            {g.scenery_url && (
              <Button size="sm" variant="ghost" onClick={() => set("scenery_url", null)}>Remover</Button>
            )}
          </div>
        </div>
        <div>
          <Label>Duração do cenário (turnos)</Label>
          <Input type="number" min={0} max={20} value={g.scenery_turns ?? 0}
            onChange={(e) => set("scenery_turns", Math.max(0, Math.min(20, Number(e.target.value))))} />
          <div className="text-[10px] text-muted-foreground mt-1">0 = não troca o cenário.</div>
        </div>
        <div>
          <Label>Redução de precisão do alvo (%)</Label>
          <Input type="number" min={0} max={100} value={g.accuracy_debuff ?? 0}
            onChange={(e) => set("accuracy_debuff", Math.max(0, Math.min(100, Number(e.target.value))))} />
        </div>
        <div>
          <Label>Duração da redução (turnos)</Label>
          <Input type="number" min={0} max={20} value={g.accuracy_turns ?? 0}
            onChange={(e) => set("accuracy_turns", Math.max(0, Math.min(20, Number(e.target.value))))} />
          <div className="text-[10px] text-muted-foreground mt-1">Precisa duração &gt; 0 para valer.</div>
        </div>
        <div className="sm:col-span-2">
          <Label>Paralisar alvo por (turnos)</Label>
          <Input type="number" min={0} max={20} value={g.paralyze_turns ?? 0}
            onChange={(e) => set("paralyze_turns", Math.max(0, Math.min(20, Number(e.target.value))))} />
          <div className="text-[10px] text-muted-foreground mt-1">
            O alvo perde os N próximos turnos sem poder agir. 0 = sem paralisia.
          </div>
        </div>
      </div>
    </div>
  );
}