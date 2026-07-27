import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AnimatedSprite, ANIM_STATE_LABEL, DEFAULT_STATES, type AnimState, type StatesMap } from "@/components/AnimatedSprite";
import { ImageUpload } from "@/components/ImageUpload";

const STATE_ORDER: AnimState[] = ["idle", "run", "punch", "kick", "hurt", "cast", "death"];

/**
 * Editor de configuração de spritesheet.
 * O usuário faz upload de UMA PNG (a spritesheet), define quantas colunas e linhas
 * a grade tem, e para cada estado (idle, run, punch...) define qual linha da grade
 * corresponde e quantos frames dessa linha usar.
 */
export function SpriteSheetConfig({
  label = "Spritesheet",
  userId,
  bucket,
  sheetUrl,
  cols,
  rows,
  states,
  fallbackImageUrl,
  onChange,
}: {
  label?: string;
  userId: string;
  bucket: "avatars" | "inventory" | "cosmetics";
  sheetUrl: string | null | undefined;
  cols: number | null | undefined;
  rows: number | null | undefined;
  states: StatesMap | null | undefined;
  fallbackImageUrl?: string | null;
  onChange: (patch: {
    sheet_url?: string | null;
    sheet_cols?: number | null;
    sheet_rows?: number | null;
    sheet_states?: StatesMap | null;
  }) => void;
}) {
  const [preview, setPreview] = useState<AnimState>("idle");
  const effective = useMemo<StatesMap>(() => states ?? {}, [states]);

  function updateState(name: AnimState, patch: Partial<{ row: number; frames: number; fps: number; loop: boolean }>) {
    const cur = effective[name] ?? DEFAULT_STATES[name] ?? { row: 0, frames: 1, fps: 8, loop: true };
    const next: StatesMap = { ...effective, [name]: { ...cur, ...patch } };
    onChange({ sheet_states: next });
  }

  function removeState(name: AnimState) {
    const next = { ...effective };
    delete next[name];
    onChange({ sheet_states: Object.keys(next).length ? next : null });
  }

  return (
    <div className="space-y-3 border border-border rounded-md p-3">
      <div className="flex items-center justify-between">
        <Label className="text-gold">{label}</Label>
        <div className="text-[10px] text-muted-foreground">
          PNG única com grade de frames (todas as animações em uma imagem).
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
        {/* Preview */}
        <div className="space-y-2">
          <div className="aspect-square w-full max-w-[220px] rounded-md bg-black/40 border border-border overflow-hidden relative">
            {(sheetUrl || fallbackImageUrl) ? (
              <AnimatedSprite
                sheetUrl={sheetUrl ?? null}
                cols={cols ?? null}
                rows={rows ?? null}
                states={effective}
                fallbackUrl={fallbackImageUrl ?? null}
                state={preview}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Sem sprite</div>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {STATE_ORDER.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={preview === s ? "default" : "outline"}
                className="h-6 px-2 text-[10px]"
                onClick={() => setPreview(s)}
              >{s}</Button>
            ))}
          </div>
          <ImageUpload
            label={sheetUrl ? "Trocar spritesheet" : "Enviar spritesheet"}
            bucket={bucket}
            userId={userId}
            onUploaded={(url) => onChange({ sheet_url: url })}
          />
          {sheetUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs w-full"
              onClick={() => onChange({ sheet_url: null })}
            >Remover spritesheet</Button>
          )}
        </div>

        {/* Config */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Colunas (frames por linha)</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={cols ?? ""}
                onChange={(e) => onChange({ sheet_cols: e.target.value ? Number(e.target.value) : null })}
                placeholder="ex: 8"
              />
            </div>
            <div>
              <Label className="text-xs">Linhas (nº de estados na grade)</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={rows ?? ""}
                onChange={(e) => onChange({ sheet_rows: e.target.value ? Number(e.target.value) : null })}
                placeholder="ex: 7"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Estados de animação</div>
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onChange({ sheet_states: { ...DEFAULT_STATES } })}>
                Aplicar padrão
              </Button>
            </div>
            <div className="grid gap-1">
              <div className="grid grid-cols-[1fr_60px_60px_60px_44px_28px] gap-1 text-[10px] text-muted-foreground px-1">
                <div>Estado</div><div>Linha</div><div>Frames</div><div>FPS</div><div>Loop</div><div></div>
              </div>
              {STATE_ORDER.map((s) => {
                const cfg = effective[s];
                const enabled = !!cfg;
                return (
                  <div key={s} className={`grid grid-cols-[1fr_60px_60px_60px_44px_28px] gap-1 items-center rounded p-1 ${enabled ? "bg-input/40" : "bg-transparent opacity-60"}`}>
                    <div className="text-xs truncate">{ANIM_STATE_LABEL[s]}</div>
                    <Input type="number" min={0} className="h-7 text-xs" value={cfg?.row ?? ""} placeholder="-"
                      onChange={(e) => updateState(s, { row: Number(e.target.value || 0) })} />
                    <Input type="number" min={1} className="h-7 text-xs" value={cfg?.frames ?? ""} placeholder="-"
                      onChange={(e) => updateState(s, { frames: Number(e.target.value || 1) })} />
                    <Input type="number" min={1} max={60} className="h-7 text-xs" value={cfg?.fps ?? ""} placeholder="8"
                      onChange={(e) => updateState(s, { fps: Number(e.target.value || 8) })} />
                    <div className="flex justify-center">
                      <Switch checked={cfg?.loop ?? true} onCheckedChange={(v) => updateState(s, { loop: v })} />
                    </div>
                    {enabled ? (
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400"
                        onClick={() => removeState(s)}>×</Button>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400"
                        onClick={() => updateState(s, DEFAULT_STATES[s] ?? { row: 0, frames: 1, fps: 8, loop: true })}>+</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}