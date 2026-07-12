import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLevelConfig, updateLevelConfig } from "@/lib/level.functions";
import { totalXpForLevel, DEFAULT_LEVEL_CONFIG, type LevelConfig } from "@/lib/level";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function LevelManager() {
  const get = useServerFn(getLevelConfig);
  const save = useServerFn(updateLevelConfig);
  const [cfg, setCfg] = useState<LevelConfig>(DEFAULT_LEVEL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const npcTiers = useMemo(() => {
    const max = cfg.max_level;
    const easyLv = Math.max(1, Math.round(max * 0.1));
    const mediumLv = Math.max(easyLv + 1, Math.round(max * 0.4));
    const hardLv = Math.max(mediumLv + 1, Math.round(max * 0.75));

    const build = (label: string, lv: number, dmgPct: number, xpPct: number, ryoBase: number, drops: string) => {
      const hp = totalXpForLevel(lv, cfg); // HP = XP acumulado (regra do jogo)
      const damage = Math.max(5, Math.round(hp * dmgPct));
      const xpReward = Math.max(10, Math.round(hp * xpPct));
      const ryo = Math.round(ryoBase * lv);
      return { label, lv, hp, damage, xpReward, ryo, drops };
    };

    return [
      build("Fácil", easyLv, 0.06, 0.08, 25, "Consumíveis comuns (5–15%) · Ryo baixo"),
      build("Médio", mediumLv, 0.09, 0.12, 60, "Itens incomuns (3–10%) · Pergaminhos raros (1–3%)"),
      build("Difícil", hardLv, 0.14, 0.18, 150, "Itens raros (2–6%) · Habilidades exclusivas (0.5–2%)"),
    ];
  }, [cfg]);

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
            <h3 className="font-display text-xl text-gold">Recomendações de NPCs por dificuldade</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Sugestões calculadas a partir da curva atual. Use como base ao configurar NPCs em <em>Danger Zones</em> — ajuste conforme necessário.
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground">
            HP = XP acumulado do nível · Dano por turno é uma média sugerida.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mt-4">
          {npcTiers.map((t) => (
            <div key={t.label} className="rounded-md border border-border p-4 bg-background/40">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg text-gold">{t.label}</span>
                <span className="text-xs text-muted-foreground">Nível ~{t.lv}</span>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">HP recomendado</dt><dd className="font-semibold">{t.hp.toLocaleString("pt-BR")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Dano médio/turno</dt><dd>{t.damage.toLocaleString("pt-BR")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">XP concedido</dt><dd className="text-gold">+{t.xpReward.toLocaleString("pt-BR")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Ryo</dt><dd className="text-gold">+{t.ryo.toLocaleString("pt-BR")}</dd></div>
              </dl>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Loot sugerido</div>
                <p className="text-xs">{t.drops}</p>
              </div>
              <div className="mt-3 text-[10px] text-muted-foreground">
                {t.label === "Fácil" && "Ideal para Genin iniciantes. Spawn frequente (60–80%)."}
                {t.label === "Médio" && "Chunin em campo. Spawn moderado (25–40%), grupos de 2–3."}
                {t.label === "Difícil" && "Elite Jounin/S-rank. Spawn raro (5–10%), recompense parties."}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}