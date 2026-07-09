import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BatteryCharging } from "lucide-react";

export type RestoreEffect = {
  pool: "ef" | "em" | "chakra" | "all";
  mode: "flat" | "percent";
  amount: number;
};

export function RestoreEffectFields({
  value,
  onChange,
  title = "Restauração de energia",
}: {
  value: RestoreEffect | null | undefined;
  onChange: (v: RestoreEffect | null) => void;
  title?: string;
}) {
  const enabled = !!value;
  const v: RestoreEffect = value ?? { pool: "chakra", mode: "flat", amount: 10 };

  return (
    <div className="sm:col-span-2 rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-display text-gold flex items-center gap-1">
          <BatteryCharging size={14} /> {title}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Ativar</Label>
          <Switch checked={enabled} onCheckedChange={(c) => onChange(c ? v : null)} />
        </div>
      </div>
      {enabled && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Energia</Label>
            <Select value={v.pool} onValueChange={(p: any) => onChange({ ...v, pool: p })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ef">EF (Física)</SelectItem>
                <SelectItem value="em">EM (Mental)</SelectItem>
                <SelectItem value="chakra">Chakra</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modo</Label>
            <Select value={v.mode} onValueChange={(m: any) => onChange({ ...v, mode: m })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Quantidade fixa</SelectItem>
                <SelectItem value="percent">Porcentagem (%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{v.mode === "percent" ? "% do máximo" : "Quantidade"}</Label>
            <Input
              type="number"
              min={0}
              max={v.mode === "percent" ? 100 : 100000}
              value={v.amount}
              onChange={(e) => onChange({ ...v, amount: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}