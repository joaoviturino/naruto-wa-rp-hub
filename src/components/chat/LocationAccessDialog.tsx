import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import {
  listLocationPermissions, grantLocationAccess, revokeLocationAccess, setLocationOwnership,
} from "@/lib/location-ownership.functions";
import { toast } from "sonner";
import { Lock, Trash2, UserPlus, Tag } from "lucide-react";

type Loc = {
  id: string; name: string;
  is_private: boolean; is_for_sale: boolean; sale_price: number;
};

export function LocationAccessDialog({ open, onOpenChange, location, onChanged }: {
  open: boolean; onOpenChange: (v: boolean) => void; location: Loc | null; onChanged: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [nick, setNick] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [forSale, setForSale] = useState(false);
  const [price, setPrice] = useState(0);

  const list = useServerFn(listLocationPermissions);
  const grant = useServerFn(grantLocationAccess);
  const revoke = useServerFn(revokeLocationAccess);
  const setOwn = useServerFn(setLocationOwnership);

  useEffect(() => {
    if (!open || !location) return;
    setIsPrivate(location.is_private);
    setForSale(location.is_for_sale);
    setPrice(location.sale_price);
    list({ data: { location_id: location.id } } as any).then(setRows).catch(() => setRows([]));
  }, [open, location?.id]);

  if (!location) return null;

  async function refresh() {
    if (!location) return;
    const r = await list({ data: { location_id: location.id } } as any);
    setRows(r as any);
  }
  async function doGrant() {
    if (!nick.trim() || !location) return;
    try { await grant({ data: { location_id: location.id, nickname: nick.trim() } } as any); toast.success("Acesso concedido."); setNick(""); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function doRevoke(cid: string) {
    if (!location) return;
    try { await revoke({ data: { location_id: location.id, character_id: cid } } as any); toast.info("Acesso removido."); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function saveFlags() {
    if (!location) return;
    try {
      await setOwn({ data: { location_id: location.id, is_private: isPrivate, is_for_sale: forSale, sale_price: price } } as any);
      toast.success("Configurações salvas.");
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock size={16} className="text-gold" /> Acesso ao local</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Privado</Label>
                <p className="text-[11px] text-muted-foreground">Apenas você e permitidos podem entrar.</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm flex items-center gap-1"><Tag size={12} /> À venda</Label>
                <p className="text-[11px] text-muted-foreground">Coloca no mercado. Locais à venda são privados por natureza.</p>
              </div>
              <Switch checked={forSale} onCheckedChange={(v) => { setForSale(v); if (v) setIsPrivate(true); }} />
            </div>
            {forSale && (
              <div className="flex items-center gap-2">
                <Label className="text-xs w-24">Preço (ryō)</Label>
                <Input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            )}
            <Button size="sm" onClick={saveFlags} className="w-full">Salvar configurações</Button>
          </div>

          <div className="rounded border border-border p-3 space-y-2">
            <Label className="text-sm">Personagens com acesso ({rows.length})</Label>
            <div className="flex gap-2">
              <Input placeholder="Nickname do personagem…" value={nick} onChange={(e) => setNick(e.target.value)} />
              <Button size="sm" onClick={doGrant}><UserPlus size={14} className="mr-1" />Conceder</Button>
            </div>
            <ul className="divide-y divide-border max-h-52 overflow-auto">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span>{r.nickname}</span>
                  <Button size="sm" variant="ghost" onClick={() => doRevoke(r.character_id)}>
                    <Trash2 size={14} className="text-blood" />
                  </Button>
                </li>
              ))}
              {rows.length === 0 && <li className="py-2 text-xs text-muted-foreground italic">Ninguém tem acesso além de você.</li>}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}