import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Compass, Drama, Sparkles, Package, Backpack, Zap } from "lucide-react";
import { TravelDialog } from "./TravelDialog";
import { toast } from "sonner";

type Props = { currentLocationId: string | null; onArrived: () => void; disabled?: boolean; };

export function ActionHotkey({ currentLocationId, onArrived, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);

  function openTravel() {
    if (disabled) { toast.error("Ação bloqueada agora."); return; }
    setOpen(false);
    setTravelOpen(true);
  }
  function soon(label: string) { toast.info(`${label} — em breve.`); }

  return (
    <>
      <div className="fixed right-4 bottom-24 md:bottom-6 z-40">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="Ações"
              className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-gold via-amber-400 to-blood text-background shadow-lg shadow-black/50 hover:scale-105 active:scale-95 transition ring-2 ring-background">
              <Zap size={22} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-64 p-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 pt-1 pb-2">Ações</div>
            <ActionButton icon={Compass} label="Mover-se" onClick={openTravel} />
            <ActionButton icon={Drama} label="Cenar" onClick={() => soon("Cenar")} soon />
            <ActionButton icon={Sparkles} label="Usar habilidade" onClick={() => soon("Usar habilidade")} soon />
            <ActionButton icon={Package} label="Usar item" onClick={() => soon("Usar item")} soon />
            <ActionButton icon={Backpack} label="Ver inventário" onClick={() => soon("Ver inventário")} soon />
          </PopoverContent>
        </Popover>
      </div>
      <TravelDialog open={travelOpen} onOpenChange={setTravelOpen}
        currentLocationId={currentLocationId} onArrived={onArrived} />
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