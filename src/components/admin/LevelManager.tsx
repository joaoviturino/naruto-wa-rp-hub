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
        <table className="w-full text-sm mt-3">
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
    </div>
  );
}