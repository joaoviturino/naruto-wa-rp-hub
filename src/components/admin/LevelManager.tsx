import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLevelConfig, updateLevelConfig } from "@/lib/level.functions";
import { totalXpForLevel, DEFAULT_LEVEL_CONFIG, type LevelConfig } from "@/lib/level";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { applyNpcTemplate, listNpcsBasic } from "@/lib/npc.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RankKey =
  | "estudante" | "genin" | "chunin" | "tokubetsu_jonin"
  | "jonin" | "anbu" | "sannin" | "kage";

type Difficulty = "Fácil" | "Médio" | "Difícil";

const RANK_TABLE: { key: RankKey; label: string; difficulty: Difficulty; ratio: number; dmgPct: number; xpPct: number; ryoBase: number; crit: number; critMul: number }[] = [
  { key: "estudante",       label: "Estudante",       difficulty: "Fácil",   ratio: 0.05, dmgPct: 0.05, xpPct: 0.07, ryoBase: 15,  crit: 3,  critMul: 1.5 },
  { key: "genin",           label: "Genin",           difficulty: "Fácil",   ratio: 0.15, dmgPct: 0.06, xpPct: 0.08, ryoBase: 25,  crit: 5,  critMul: 1.5 },
  { key: "chunin",          label: "Chunin",          difficulty: "Fácil",   ratio: 0.30, dmgPct: 0.08, xpPct: 0.10, ryoBase: 45,  crit: 7,  critMul: 1.6 },
  { key: "tokubetsu_jonin", label: "Tokubetsu Jōnin", difficulty: "Médio",   ratio: 0.45, dmgPct: 0.10, xpPct: 0.12, ryoBase: 80,  crit: 10, critMul: 1.7 },
  { key: "jonin",           label: "Jōnin",           difficulty: "Médio",   ratio: 0.60, dmgPct: 0.12, xpPct: 0.14, ryoBase: 120, crit: 12, critMul: 1.8 },
  { key: "anbu",            label: "ANBU",            difficulty: "Difícil", ratio: 0.75, dmgPct: 0.14, xpPct: 0.17, ryoBase: 180, crit: 15, critMul: 1.9 },
  { key: "sannin",          label: "Sannin",          difficulty: "Difícil", ratio: 0.90, dmgPct: 0.16, xpPct: 0.20, ryoBase: 260, crit: 18, critMul: 2.0 },
  { key: "kage",            label: "Kage",            difficulty: "Difícil", ratio: 1.00, dmgPct: 0.18, xpPct: 0.24, ryoBase: 400, crit: 20, critMul: 2.2 },
];

const DIFF_STYLE: Record<Difficulty, string> = {
  "Fácil":   "border-emerald-600/50 bg-emerald-950/20",
  "Médio":   "border-amber-600/50 bg-amber-950/20",
  "Difícil": "border-rose-600/50 bg-rose-950/20",
};

type NpcStats = {
  hp_max: number; energy_max: number; xp: number;
  avg_damage: number; crit_chance: number; crit_multiplier: number;
  reward_xp: number; reward_ryo: number;
};

export function LevelManager() {
  const get = useServerFn(getLevelConfig);
  const save = useServerFn(updateLevelConfig);
  const applyTpl = useServerFn(applyNpcTemplate);
  const listNpcs = useServerFn(listNpcsBasic);
  const [cfg, setCfg] = useState<LevelConfig>(DEFAULT_LEVEL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedNpc, setPickedNpc] = useState<string>("");
  const [pendingStats, setPendingStats] = useState<{ stats: NpcStats; label: string } | null>(null);
  const [npcs, setNpcs] = useState<{ id: string; name: string; kind: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      try { setCfg(await get({})); } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const preview = useMemo(() => {
    const rows: { level: number; total: number; delta: number }[] = [];
    let prev = 0;
    const points = [1, 2, 3, 5, 10, 20, 30, 50, 75, 100].filter((n) => n <= cfg.max_level);
    if (!points.includes(cfg.max_level)) points.push(cfg.max_level);
    for (const lv of points) {
      const total = totalXpForLevel(lv, cfg);
      rows.push({ level: lv, total, delta: total - prev });
      prev = total;
    }
    return rows;
  }, [cfg]);

  const rankCards = useMemo(() => {
    const max = cfg.max_level;
    return RANK_TABLE.map((r) => {
      const lv = Math.max(1, Math.round(max * r.ratio));
      const hp = Math.max(10, totalXpForLevel(lv, cfg));
      const stats: NpcStats = {
        hp_max: hp,
        energy_max: Math.max(50, Math.round(hp * 0.5)),
        xp: hp,
        avg_damage: Math.max(5, Math.round(hp * r.dmgPct)),
        crit_chance: r.crit,
        crit_multiplier: r.critMul,
        reward_xp: Math.max(10, Math.round(hp * r.xpPct)),
        reward_ryo: Math.max(5, Math.round(r.ryoBase * lv)),
      };
      return { ...r, lv, stats };
    });
  }, [cfg]);

  async function refreshNpcs() {
    try { setNpcs(await listNpcs({}) as any); } catch (e: any) { toast.error(e.message); }
  }

  async function handleApplyAll(label: string, stats: NpcStats) {
    if (!confirm(`Aplicar template "${label}" a TODOS os NPCs agressivos? Isso sobrescreve HP, energia, dano, crítico e recompensas.`)) return;
    setApplying(label + "-all");
    try {
      const r: any = await applyTpl({ data: { target: "all", only_aggressive: true, stats } });
      toast.success(`Template "${label}" aplicado a ${r.updated} NPC(s).`);
    } catch (e: any) { toast.error(e.message); }
    finally { setApplying(null); }
  }

  function openPicker(label: string, stats: NpcStats) {
    setPendingStats({ label, stats });
    setPickedNpc("");
    setPickerOpen(true);
    if (npcs.length === 0) refreshNpcs();
  }

  async function confirmPicker() {
    if (!pendingStats || !pickedNpc) { toast.error("Selecione um NPC."); return; }
    setApplying(pendingStats.label + "-one");
    try {
      await applyTpl({ data: { target: "one", npc_id: pickedNpc, only_aggressive: false, stats: pendingStats.stats } });
      toast.success(`Template "${pendingStats.label}" aplicado ao NPC.`);
      setPickerOpen(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setApplying(null); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: cfg });
      toast.success("Curva global de níveis atualizada.");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="scroll-panel rounded-lg p-6 space-y-4">
        <div>
          <h3 className="font-display text-xl text-gold">Curva Global de Níveis</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Fórmula: <code>XP até o nível N = base_xp × (N-1)^growth_factor</code>. A mesma métrica vale para todos os jogadores.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>XP base</Label>
            <Input type="number" min={1} value={cfg.base_xp}
              onChange={(e) => setCfg({ ...cfg, base_xp: Math.max(1, Number(e.target.value) || 1) })} />
            <p className="text-[10px] text-muted-foreground mt-1">XP necessário para o nível 2.</p>
          </div>
          <div>
            <Label>Fator de crescimento</Label>
            <Input type="number" step="0.05" min={1} max={5} value={cfg.growth_factor}
              onChange={(e) => setCfg({ ...cfg, growth_factor: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
            <p className="text-[10px] text-muted-foreground mt-1">1.0 = linear · 1.6 = padrão · 2.0 = íngreme.</p>
          </div>
          <div>
            <Label>Nível máximo (limitador)</Label>
            <Input type="number" min={1} max={1000} value={cfg.max_level}
              onChange={(e) => setCfg({ ...cfg, max_level: Math.min(1000, Math.max(1, Number(e.target.value) || 1)) })} />
            <p className="text-[10px] text-muted-foreground mt-1">Teto global. Ninguém passa disso.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar curva"}</Button>
          <Button variant="outline" onClick={() => setCfg(DEFAULT_LEVEL_CONFIG)}>Restaurar padrão</Button>
        </div>
      </div>

      <div className="scroll-panel rounded-lg p-6">
        <h3 className="font-display text-xl text-gold">Prévia da curva</h3>
        <table className="w-full text-sm mt-3 min-w-[420px]">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-2">Nível</th>
              <th className="text-right p-2">XP acumulado</th>
              <th className="text-right p-2">Δ do anterior</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={r.level} className="border-t border-border">
                <td className="p-2 font-semibold">{r.level}</td>
                <td className="p-2 text-right text-gold">{r.total.toLocaleString("pt-BR")}</td>
                <td className="p-2 text-right text-muted-foreground">+{r.delta.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="scroll-panel rounded-lg p-6 lg:col-span-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display text-xl text-gold">Templates de NPC por patente</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Cada patente tem uma dificuldade e estatísticas derivadas da curva atual. Use os botões para aplicar em massa (todos os NPCs agressivos) ou em um NPC específico.
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground max-w-xs text-right">
            "Aplicar a todos" atualiza somente NPCs agressivos.<br />
            "Escolher NPC" permite aplicar em qualquer um.
          </div>
        </div>

        {(["Fácil","Médio","Difícil"] as Difficulty[]).map((diff) => (
          <div key={diff} className="mt-6">
            <h4 className="font-display text-lg mb-2">
              Dificuldade: <span className={diff === "Fácil" ? "text-emerald-400" : diff === "Médio" ? "text-amber-400" : "text-rose-400"}>{diff}</span>
            </h4>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rankCards.filter((c) => c.difficulty === diff).map((c) => (
                <div key={c.key} className={`rounded-md border p-4 ${DIFF_STYLE[c.difficulty]}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg text-gold">{c.label}</span>
                    <span className="text-xs text-muted-foreground">Nível ~{c.lv}</span>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">HP</dt><dd className="font-semibold">{c.stats.hp_max.toLocaleString("pt-BR")}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Energia</dt><dd>{c.stats.energy_max.toLocaleString("pt-BR")}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Dano médio</dt><dd>{c.stats.avg_damage.toLocaleString("pt-BR")}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Crítico</dt><dd>{c.stats.crit_chance}% × {c.stats.crit_multiplier}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Recompensa XP</dt><dd className="text-gold">+{c.stats.reward_xp.toLocaleString("pt-BR")}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Recompensa Ryō</dt><dd className="text-gold">+{c.stats.reward_ryo.toLocaleString("pt-BR")}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Button size="sm" className="flex-1" disabled={applying !== null} onClick={() => handleApplyAll(c.label, c.stats)}>
                      {applying === c.label + "-all" ? "Aplicando…" : "Aplicar a todos"}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" disabled={applying !== null} onClick={() => openPicker(c.label, c.stats)}>
                      Escolher NPC
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar "{pendingStats?.label}" a um NPC</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Selecione o NPC</Label>
            <Select value={pickedNpc} onValueChange={setPickedNpc}>
              <SelectTrigger><SelectValue placeholder={npcs.length ? "Escolha um NPC" : "Carregando…"} /></SelectTrigger>
              <SelectContent>
                {npcs.map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.name} <span className="text-muted-foreground">({n.kind ?? "—"})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pendingStats && (
              <p className="text-xs text-muted-foreground">
                HP {pendingStats.stats.hp_max} · Energia {pendingStats.stats.energy_max} · Dano {pendingStats.stats.avg_damage} · Crit {pendingStats.stats.crit_chance}%×{pendingStats.stats.crit_multiplier} · +{pendingStats.stats.reward_xp} XP · +{pendingStats.stats.reward_ryo} Ryō
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPicker} disabled={!pickedNpc || applying !== null}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}