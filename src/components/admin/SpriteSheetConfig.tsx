import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AnimatedSprite, ANIM_STATE_LABEL, DEFAULT_STATES, type AnimState, type StatesMap } from "@/components/AnimatedSprite";
import { ImageUpload } from "@/components/ImageUpload";
import { validateSpriteSheet, type SheetValidation } from "@/lib/sprite-validate";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

const STATE_ORDER: AnimState[] = ["idle", "run", "punch", "kick", "hurt", "cast", "death", "guard"];

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
  const [restartKey, setRestartKey] = useState(0);
  const [manualFrame, setManualFrame] = useState<number | undefined>();
  const [preview, setPreview] = useState<AnimState>("idle");
  const effective = useMemo<StatesMap>(() => states ?? {}, [states]);
  const [validation, setValidation] = useState<SheetValidation | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sheetUrl) { setValidation(null); setValidating(false); return; }
    setValidating(true);
    validateSpriteSheet(sheetUrl, cols, rows, effective)
      .then((v) => { if (!cancelled) setValidation(v); })
      .finally(() => { if (!cancelled) setValidating(false); });
    return () => { cancelled = true; };
  }, [sheetUrl, cols, rows, effective]);

  function updateState(name: AnimState, patch: Partial<{ row: number; frames: number; fps: number; loop: boolean }>) {
    const cur = effective[name] ?? { row: Math.min(DEFAULT_STATES[name]?.row ?? 0, Math.max(0, (rows ?? 1) - 1)), frames: Math.min(DEFAULT_STATES[name]?.frames ?? 1, cols ?? 1), fps: 8, loop: name === "idle" || name === "run" };
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
                restartKey={restartKey}
                frameOverride={manualFrame}
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
                className="min-h-11 px-2 text-xs"
                onClick={() => { setPreview(s); setManualFrame(undefined); setRestartKey((v) => v + 1); }}
              >{ANIM_STATE_LABEL[s]}</Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Inspecionar quadro {manualFrame === undefined ? "· reproduzindo" : manualFrame + 1}</Label>
            <Slider aria-label="Quadro da animação" min={0} max={Math.max(0, (effective[preview]?.frames ?? 1) - 1)} step={1}
              value={[manualFrame ?? 0]} onValueChange={([value]) => setManualFrame(value)} disabled={(effective[preview]?.frames ?? 1) <= 1} />
            <Button type="button" variant="outline" className="w-full" onClick={() => { setManualFrame(undefined); setRestartKey((v) => v + 1); }}>Reproduzir novamente</Button>
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
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onChange({ sheet_states: Object.fromEntries(Object.entries(DEFAULT_STATES)
                .filter(([, cfg]) => cfg.row < (rows ?? 1))
                .map(([name, cfg]) => [name, { ...cfg, frames: Math.min(cfg.frames, cols ?? 1) }])) })}>
                Aplicar padrão
              </Button>
            </div>
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">Linhas começam em 0. Corpo e roupas podem ter grades diferentes; mantenha a mesma proporção e o alinhamento do desenho.</p>
              {STATE_ORDER.map((s) => {
                const cfg = effective[s];
                const enabled = !!cfg;
                return (
                  <div key={s} className={`grid grid-cols-3 gap-2 items-center rounded p-1 ${enabled ? "bg-input/40" : "bg-transparent opacity-60"}`}>
                    <div className="col-span-3 text-sm font-medium">{ANIM_STATE_LABEL[s]}</div>
                    <Input aria-label={`${ANIM_STATE_LABEL[s]}: linha`} title="Linha" type="number" min={0} max={Math.max(0, (rows ?? 1) - 1)} className="h-11 text-sm" value={cfg?.row ?? ""} placeholder="-"
                      onChange={(e) => updateState(s, { row: Number(e.target.value || 0) })} />
                    <Input aria-label={`${ANIM_STATE_LABEL[s]}: frames`} title="Frames" type="number" min={1} max={cols ?? 1} className="h-11 text-sm" value={cfg?.frames ?? ""} placeholder="-"
                      onChange={(e) => updateState(s, { frames: Number(e.target.value || 1) })} />
                    <Input aria-label={`${ANIM_STATE_LABEL[s]}: FPS`} title="FPS" type="number" min={1} max={60} className="h-11 text-sm" value={cfg?.fps ?? ""} placeholder="8"
                      onChange={(e) => updateState(s, { fps: Number(e.target.value || 8) })} />
                    <div className="col-span-2 flex gap-2 items-center text-xs">Repetir
                      <Switch aria-label={`Repetir ${ANIM_STATE_LABEL[s]}`} checked={cfg?.loop ?? true} onCheckedChange={(v) => updateState(s, { loop: v })} />
                    </div>
                    {enabled ? (
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400"
                        onClick={() => removeState(s)}>×</Button>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400"
                        onClick={() => updateState(s, {})}>+</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {sheetUrl && (
        <div className="rounded-md border border-border bg-black/30 p-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            {validating ? (
              <><Loader2 size={12} className="animate-spin" /> Validando spritesheet…</>
            ) : validation?.ok ? (
              <><CheckCircle2 size={12} className="text-emerald-400" />
                <span className="text-emerald-400">Sheet válida</span>
                {validation.loaded && (
                  <span className="text-muted-foreground">
                    · {validation.width}×{validation.height}px · frame {Math.round(validation.frameWidth)}×{Math.round(validation.frameHeight)}px
                  </span>
                )}
              </>
            ) : validation ? (
              <><AlertTriangle size={12} className="text-red-400" />
                <span className="text-red-400">Problemas na spritesheet</span>
                {validation.loaded && (
                  <span className="text-muted-foreground">· {validation.width}×{validation.height}px</span>
                )}
              </>
            ) : null}
          </div>
          {validation?.errors.map((e, i) => (
            <div key={`e${i}`} className="text-red-400 pl-4">• {e}</div>
          ))}
          {validation?.warnings.map((w, i) => (
            <div key={`w${i}`} className="text-amber-400 pl-4">• {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}
