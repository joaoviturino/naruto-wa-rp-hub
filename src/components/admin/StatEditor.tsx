import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { History, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getStatAudit } from "@/lib/admin.functions";
import { toast } from "sonner";

type Field = { key: string; label: string; min?: number };

export function StatEditor({
  targetId,
  scope,
  values,
  fields,
  onSave,
  onSaved,
  footer,
}: {
  targetId: string;
  scope: "character" | "npc";
  values: Record<string, number | null | undefined>;
  fields: Field[];
  onSave: (patch: Record<string, number>) => Promise<void>;
  onSaved?: () => void;
  footer?: React.ReactNode;
}) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [loadingHist, setLoadingHist] = useState(false);
  const fetchAudit = useServerFn(getStatAudit);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of fields) next[f.key] = String(values[f.key] ?? 0);
    setLocal(next);
  }, [targetId, JSON.stringify(values)]);

  async function commit(key: string) {
    const raw = local[key];
    const v = Number(raw);
    if (!Number.isFinite(v) || v < (fields.find((f) => f.key === key)?.min ?? 0)) {
      toast.error("Valor inválido.");
      setLocal((p) => ({ ...p, [key]: String(values[key] ?? 0) }));
      return;
    }
    if (v === Number(values[key] ?? 0)) return;
    setBusy(key);
    try {
      await onSave({ [key]: v });
      toast.success("Salvo.");
      onSaved?.();
      if (history) await loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
      setLocal((p) => ({ ...p, [key]: String(values[key] ?? 0) }));
    } finally {
      setBusy(null);
    }
  }

  async function loadHistory() {
    setLoadingHist(true);
    try {
      const rows = await fetchAudit({ data: { target_id: targetId, scope, limit: 30 } } as any);
      setHistory(rows as any[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar histórico.");
    } finally {
      setLoadingHist(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-gold">Stats · salvamento imediato</div>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => (history ? loadHistory() : loadHistory())}>
          <History size={12} /> {history ? "Atualizar histórico" : "Ver histórico"}
          {loadingHist && <RefreshCw size={12} className="animate-spin" />}
        </Button>
      </div>
      <div className={`grid gap-3 ${fields.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-xs">{f.label}</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={f.min ?? 0}
              value={local[f.key] ?? ""}
              disabled={busy === f.key}
              onChange={(e) => setLocal((p) => ({ ...p, [f.key]: e.target.value }))}
              onBlur={() => commit(f.key)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </div>
        ))}
      </div>
      {footer}
      {history !== null && (
        <div className="border-t border-border/60 pt-2 space-y-1.5 max-h-64 overflow-y-auto">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Histórico de alterações</div>
          {history.length === 0 && <div className="text-xs italic text-muted-foreground">Nenhuma alteração registrada.</div>}
          {history.map((row) => (
            <div key={row.id} className="text-xs rounded border border-border/60 bg-input/30 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
                <span>{new Date(row.created_at).toLocaleString()}</span>
                <span>por {row.admin}</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {Object.entries(row.changes as Record<string, { from: number | null; to: number }>).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="font-semibold uppercase text-[10px] text-gold">{k}</span>
                    <span className="text-muted-foreground">{v.from ?? "—"} → </span>
                    <span className="text-foreground font-semibold">{v.to}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}