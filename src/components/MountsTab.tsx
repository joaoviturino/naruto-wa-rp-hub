import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ComboSelect } from "@/components/ui/combo-select";
import { listMyOwnedMounts, configureMountPose } from "@/lib/mounts.functions";
import { listMyPoses } from "@/lib/pose.functions";
import { Rabbit, Save, RotateCcw } from "lucide-react";

type Mount = {
  id: string; name: string; image_url: string | null; travel_gif_url: string | null;
  description: string | null; rank: string | null; speed_multiplier: number;
};
type OwnedMount = {
  id: string; mount_id: string;
  pose_id: string | null; pose_offset_x: number; pose_offset_y: number; pose_scale: number;
  mount: Mount;
};
type Pose = { id: string; name: string; image_url: string };

const DEFAULT_CFG = { poseId: null as string | null, offsetX: 0, offsetY: 0, scale: 1 };

export function MountsTab() {
  const listOwned = useServerFn(listMyOwnedMounts);
  const listPoses = useServerFn(listMyPoses);
  const saveCfg = useServerFn(configureMountPose);

  const [mounts, setMounts] = useState<OwnedMount[]>([]);
  const [poses, setPoses] = useState<Pose[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(DEFAULT_CFG);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [r, p] = await Promise.all([listOwned({} as any), listPoses({} as any)]);
      const list = (r?.mounts ?? []) as OwnedMount[];
      setMounts(list);
      setPoses(p as Pose[]);
      if (!selectedId && list.length > 0) selectMount(list[0]);
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function selectMount(m: OwnedMount) {
    setSelectedId(m.mount_id);
    setDraft({
      poseId: m.pose_id,
      offsetX: Number(m.pose_offset_x ?? 0),
      offsetY: Number(m.pose_offset_y ?? 0),
      scale: Number(m.pose_scale ?? 1),
    });
  }

  const selected = useMemo(() => mounts.find((m) => m.mount_id === selectedId) ?? null, [mounts, selectedId]);
  const pose = poses.find((p) => p.id === draft.poseId) ?? null;

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await saveCfg({ data: {
        mountId: selected.mount_id,
        poseId: draft.poseId,
        offsetX: draft.offsetX,
        offsetY: draft.offsetY,
        scale: draft.scale,
      } });
      toast.success("Configuração salva.");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  function reset() { setDraft({ ...DEFAULT_CFG, poseId: draft.poseId }); }

  if (mounts.length === 0) {
    return (
      <div className="scroll-panel rounded-lg p-6 text-center text-muted-foreground text-sm">
        <Rabbit className="mx-auto mb-2 text-gold" size={24} />
        Você ainda não possui montarias. Peça a um admin.
      </div>
    );
  }

  return (
    <div className="scroll-panel rounded-lg p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg text-gold flex items-center gap-2">
          <Rabbit size={18} /> Minhas montarias
        </h3>
        <p className="text-xs text-muted-foreground">
          Escolha a pose que você exibirá em cima da montaria e ajuste posição e tamanho
          para centralizá-la na sela.
        </p>
      </div>

      {/* Lista de montarias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {mounts.map((m) => {
          const isSel = m.mount_id === selectedId;
          return (
            <button key={m.id} type="button" onClick={() => selectMount(m)}
              className={`text-left rounded border-2 p-2 transition ${isSel ? "border-gold bg-gold/10" : "border-border bg-input/30 hover:border-gold/60"}`}>
              <div className="h-20 flex items-center justify-center bg-black/30 rounded overflow-hidden">
                {m.mount.image_url && <img src={m.mount.image_url} alt="" className="max-h-full max-w-full object-contain" />}
              </div>
              <div className="mt-1 text-xs font-semibold truncate">{m.mount.name}</div>
              {m.mount.rank && <div className="text-[10px] text-muted-foreground">Rank {m.mount.rank}</div>}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      {selected && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* Preview */}
          <div className="relative rounded-lg border border-border bg-black/40 overflow-hidden aspect-[4/3]"
            style={{ backgroundImage: "radial-gradient(oklch(0.4 0.02 260 / 0.35) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
            {selected.mount.image_url && (
              <img src={selected.mount.image_url} alt=""
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[95%] max-w-[95%] object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)]" />
            )}
            {pose && (
              <img src={pose.image_url} alt=""
                className="absolute left-1/2 top-1/2 pointer-events-none max-h-[70%] max-w-[70%] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                style={{
                  transform: `translate(calc(-50% + ${draft.offsetX}%), calc(-50% + ${draft.offsetY}%)) scale(${draft.scale})`,
                  transformOrigin: "center",
                }} />
            )}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="uppercase tracking-widest">Prévia</span>
              <span>{selected.mount.name}</span>
            </div>
          </div>

          {/* Controles */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Pose usada em cima da montaria</Label>
              <ComboSelect
                value={poses.some((p) => p.id === draft.poseId) ? (draft.poseId ?? "") : ""}
                onChange={(v) => setDraft((d) => ({ ...d, poseId: v === "" ? null : v }))}
                placeholder="— Nenhuma —"
                triggerClassName="h-9 text-sm"
                options={[
                  { value: "", label: "— Nenhuma —" },
                  ...poses.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              {poses.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">Nenhuma pose disponível. Peça a um admin.</p>
              )}
            </div>

            <SliderRow label="Ajuste horizontal" value={draft.offsetX} min={-60} max={60} step={0.5} unit="%"
              onChange={(v) => setDraft((d) => ({ ...d, offsetX: v }))} />
            <SliderRow label="Ajuste vertical" value={draft.offsetY} min={-60} max={60} step={0.5} unit="%"
              onChange={(v) => setDraft((d) => ({ ...d, offsetY: v }))} />
            <SliderRow label="Escala" value={draft.scale} min={0.3} max={2.5} step={0.02} unit="×"
              onChange={(v) => setDraft((d) => ({ ...d, scale: v }))} />

            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1">
                <Save size={14} className="mr-1" /> {saving ? "Salvando…" : "Salvar"}
              </Button>
              <Button variant="outline" onClick={reset} title="Reiniciar ajustes">
                <RotateCcw size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-[11px] tabular-nums text-gold">{value.toFixed(unit === "×" ? 2 : 1)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 accent-[oklch(0.78_0.15_80)]" />
    </div>
  );
}