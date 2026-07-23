import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Compass, Drama, Sparkles, Package, Backpack, Zap } from "lucide-react";
import { TravelDialog } from "./TravelDialog";
import { SceneDialog } from "./SceneDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = { currentLocationId: string | null; onArrived: () => void; disabled?: boolean; };

export function ActionHotkey({ currentLocationId, onArrived, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from("server_config")
        .select("actions_hotkey_enabled")
        .eq("id", "main")
        .maybeSingle();
      if (alive && data) setEnabled((data as any).actions_hotkey_enabled !== false);
    }
    load();
    const ch = supabase
      .channel(`server_config-hotkey-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "server_config", filter: "id=eq.main" }, (payload: any) => {
        if (payload?.new) setEnabled(payload.new.actions_hotkey_enabled !== false);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  if (!enabled) return null;

  function openTravel() {
    if (disabled) { toast.error("Ação bloqueada agora."); return; }
    setOpen(false);
    setTravelOpen(true);
  }
  function openScene() {
    if (disabled) { toast.error("Ação bloqueada agora."); return; }
    if (!currentLocationId) { toast.error("Você precisa estar em um local."); return; }
    setOpen(false);
    setSceneOpen(true);
  }
  function soon(label: string) { toast.info(`${label} — em breve.`); }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Ações"
            disabled={disabled}
            title="Ações"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-gold hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none transition">
            <Zap size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-64 p-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 pt-1 pb-2">Ações</div>
            <ActionButton icon={Compass} label="Mover-se" onClick={openTravel} />
            <ActionButton icon={Drama} label="Cenar" onClick={openScene} />
            <ActionButton icon={Sparkles} label="Usar habilidade" onClick={() => soon("Usar habilidade")} soon />
            <ActionButton icon={Package} label="Usar item" onClick={() => soon("Usar item")} soon />
            <ActionButton icon={Backpack} label="Ver inventário" onClick={() => soon("Ver inventário")} soon />
        </PopoverContent>
      </Popover>
      <TravelDialog open={travelOpen} onOpenChange={setTravelOpen}
        currentLocationId={currentLocationId} onArrived={onArrived} />
      <SceneDialog open={sceneOpen} onOpenChange={setSceneOpen}
        currentLocationId={currentLocationId} />
    </>
  );
}

function ActionButton({ icon: Icon, label, onClick, soon }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; onClick: () => void; soon?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 rounded p-2 text-left text-sm hover:bg-secondary/60 transition ${soon ? "opacity-60" : ""}`}>
      <span className="grid h-8 w-8 place-items-center rounded bg-secondary text-gold"><Icon size={16} /></span>
      <span className="flex-1">{label}</span>
      {soon && <span className="text-[9px] uppercase tracking-widest text-muted-foreground border border-border rounded px-1 py-0.5">em breve</span>}
    </button>
  );
}