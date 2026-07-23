import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Compass, MapPin, Skull, Users } from "lucide-react";

type Loc = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_danger_zone?: boolean;
};

export function LocationPreviewDialog({
  open,
  onOpenChange,
  location,
  peopleCount,
  onGo,
  going,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  location: Loc | null;
  peopleCount?: number;
  onGo: () => void;
  going?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="relative h-40 bg-secondary/40">
          {location?.image_url ? (
            <img src={location.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <MapPin size={32} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Local</div>
              <div className="font-display text-xl text-gold truncate flex items-center gap-2">
                {location?.name ?? "—"}
                {location?.is_danger_zone && <Skull size={16} className="text-blood shrink-0" />}
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <DialogHeader className="p-0">
            <DialogTitle className="sr-only">{location?.name ?? "Local"}</DialogTitle>
          </DialogHeader>
          {location?.description ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{location.description}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sem descrição para este local.</p>
          )}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {location?.is_danger_zone && (
              <span className="rounded bg-blood/20 text-blood px-2 py-0.5 flex items-center gap-1">
                <Skull size={11} /> Zona de perigo
              </span>
            )}
            {typeof peopleCount === "number" && peopleCount > 0 && (
              <span className="rounded bg-secondary text-muted-foreground px-2 py-0.5 flex items-center gap-1">
                <Users size={11} /> {peopleCount} {peopleCount === 1 ? "pessoa" : "pessoas"} aqui
              </span>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={onGo} disabled={going || !location}>
              <Compass size={14} className="mr-1" /> Ir para cá
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}