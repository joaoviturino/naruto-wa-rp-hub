import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Sword, Heart, ScrollText } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { invitePartyMember } from "@/lib/party.functions";
import { toast } from "sonner";
import { PublicCharacterView } from "./PublicCharacterView";

export function PlayerActionMenu({
  target, open, onOpenChange,
}: {
  target: { id: string; nickname: string; avatar_url: string | null } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const invite = useServerFn(invitePartyMember);
  const [viewOpen, setViewOpen] = useState(false);
  if (!target) return null;
  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden">
              {target.avatar_url && <img src={target.avatar_url} className="w-full h-full object-cover" alt="" />}
            </div>
            {target.nickname}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Button variant="secondary" className="w-full justify-start" onClick={() => { setViewOpen(true); }}>
            <ScrollText size={14} className="mr-2" /> Ver ficha
          </Button>
          <Button className="w-full justify-start" onClick={async () => {
            try { await invite({ data: { to_character_id: target.id } }); toast.success("Convite enviado."); onOpenChange(false); }
            catch (e: any) { toast.error(e.message); }
          }}>
            <Users size={14} className="mr-2" /> Convidar para um time
          </Button>
          <Button variant="outline" className="w-full justify-start" disabled>
            <Sword size={14} className="mr-2" /> Batalhar <span className="ml-auto text-xs text-muted-foreground">em breve</span>
          </Button>
          <Button variant="outline" className="w-full justify-start" disabled>
            <Heart size={14} className="mr-2" /> Criar relacionamento <span className="ml-auto text-xs text-muted-foreground">em breve</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <PublicCharacterView characterId={target.id} open={viewOpen} onOpenChange={setViewOpen} />
    </>
  );
}