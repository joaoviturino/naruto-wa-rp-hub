import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NINJA_BAG_CAPACITY, SECONDARY_SLOTS } from "@/lib/game";
import { ImageUpload } from "@/components/ImageUpload";
import { ShieldHalf, Shirt, Footprints, Swords, Sword, Backpack, Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { equipItem, unequipItem, consumeItem, dropItem } from "@/lib/character.functions";
import { toast } from "sonner";

type Item = { id: string; name: string; type: string; slot_size: number; image_url?: string | null; description?: string | null };
type Inv = {
  character_id: string;
  ninja_bag: { item_id: string; qty: number }[];
  secondary_slots: (string | null)[];
  helmet_id: string | null; vest_id: string | null; pants_id: string | null; boots_id: string | null;
  primary_weapon_id: string | null; primary_unlocked: boolean;
  secondary_weapon_id: string | null; secondary_unlocked: boolean;
};

type SlotKey = "helmet_id" | "vest_id" | "pants_id" | "boots_id" | "primary_weapon_id" | "secondary_weapon_id";

export function InventoryView({ characterId, userId, bgUrl, onBgChange }: {
  characterId: string; userId: string; bgUrl: string | null; onBgChange: (url: string) => void;
}) {
  const [inv, setInv] = useState<Inv | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});

  const load = useCallback(async () => {
    const { data: iv } = await supabase.from("inventory").select("*").eq("character_id", characterId).maybeSingle();
    const { data: it } = await supabase.from("items").select("*");
    const bag = Array.isArray((iv as any)?.ninja_bag)
      ? (iv as any).ninja_bag.map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }))
      : [];
    setInv({ ...(iv as any), ninja_bag: bag });
    setItems(Object.fromEntries((it ?? []).map((i) => [i.id, i as Item])));
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const equip = useServerFn(equipItem);
  const unequip = useServerFn(unequipItem);
  const consume = useServerFn(consumeItem);
  const drop = useServerFn(dropItem);

  async function run(fn: () => Promise<any>, okMsg: string) {
    try { await fn(); toast.success(okMsg); await load(); }
    catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  if (!inv) return <div className="p-6 text-muted-foreground">Sem inventário ainda.</div>;

  const bagUsed = inv.ninja_bag.reduce((s, e) => s + (items[e.item_id]?.slot_size ?? 1) * e.qty, 0);
  const secondary = Array.from({ length: SECONDARY_SLOTS }, (_, i) => inv.secondary_slots[i] ?? null);

  return (
    <div className="scroll-panel rounded-lg p-6">
      {/* Equipamentos ao redor do personagem */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <div className="space-y-3">
          <EquipSlot icon={<ShieldHalf />} label="Elmo / Bandana" slot="helmet_id" itemId={inv.helmet_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "helmet_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Shirt />} label="Colete" slot="vest_id" itemId={inv.vest_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "vest_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Sword />} label="Arma Primária" slot="primary_weapon_id" itemId={inv.primary_weapon_id} items={items} locked={!inv.primary_unlocked}
            onUnequip={() => run(() => unequip({ data: { slot: "primary_weapon_id" } } as any), "Desequipado.")} />
        </div>

        <div className="relative w-64 h-80 border-2 border-gold/50 rounded-lg overflow-hidden bg-gradient-to-b from-secondary to-background flex items-center justify-center">
          {bgUrl ? (
            <img src={bgUrl} alt="Personagem" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-muted-foreground text-sm text-center px-4">
              Envie um PNG sem fundo do seu shinobi
            </div>
          )}
          <div className="absolute bottom-2 right-2">
            <ImageUpload label="PNG do personagem" bucket="inventory" userId={userId} compact
              onUploaded={onBgChange} />
          </div>
        </div>

        <div className="space-y-3">
          <EquipSlot icon={<Shirt className="rotate-180" />} label="Calça" slot="pants_id" itemId={inv.pants_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "pants_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Footprints />} label="Botas" slot="boots_id" itemId={inv.boots_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "boots_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Swords />} label="Arma Secundária" slot="secondary_weapon_id" itemId={inv.secondary_weapon_id} items={items} locked={!inv.secondary_unlocked}
            onUnequip={() => run(() => unequip({ data: { slot: "secondary_weapon_id" } } as any), "Desequipado.")} />
        </div>
      </div>

      {/* Bolsa ninja */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg text-gold flex items-center gap-2"><Backpack size={18} /> Bolsa Ninja</h3>
          <span className="text-xs text-muted-foreground">{bagUsed} / {NINJA_BAG_CAPACITY}</span>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {(() => {
            const cells: (Item | null)[] = [];
            for (const entry of inv.ninja_bag) {
              const it = items[entry.item_id];
              const size = it?.slot_size ?? 1;
              for (let q = 0; q < entry.qty; q++) for (let s = 0; s < size; s++) cells.push(it ?? null);
            }
            while (cells.length < NINJA_BAG_CAPACITY) cells.push(null);
            return cells.slice(0, NINJA_BAG_CAPACITY).map((it, i) => (
              <BagCell key={i} item={it}
                onEquip={() => it && run(() => equip({ data: { item_id: it.id } } as any), `${it.name} equipado.`)}
                onConsume={() => it && run(() => consume({ data: { item_id: it.id } } as any), `${it.name} usado.`)}
                onDrop={() => it && run(() => drop({ data: { item_id: it.id } } as any), `${it.name} descartado.`)}
              />
            ));
          })()}
        </div>
      </div>

      {/* Slots secundários */}
      <div className="mt-6">
        <h3 className="font-display text-lg text-gold mb-2">Slots Secundários</h3>
        <div className="grid grid-cols-10 gap-1">
          {secondary.map((sid, i) => (
            <div key={i} className="aspect-square rounded border border-border bg-input/40 flex items-center justify-center text-[10px] p-1">
              {sid ? items[sid]?.name ?? "?" : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EquipSlot({ icon, label, slot, itemId, items, locked, onUnequip }: {
  icon: React.ReactNode; label: string; slot: SlotKey; itemId: string | null;
  items: Record<string, Item>; locked?: boolean; onUnequip: () => void;
}) {
  const item = itemId ? items[itemId] : null;
  const disabled = locked || !item;
  const inner = (
    <div className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition ${locked ? "opacity-40 border-dashed" : "border-border"} ${item && !locked ? "hover:border-gold cursor-pointer" : ""}`}>
      <div className="text-gold">{locked ? <Lock size={18} /> : icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{locked ? "Bloqueado" : item?.name ?? "Vazio"}</div>
      </div>
    </div>
  );
  if (disabled) return inner;
  return (
    <Popover>
      <PopoverTrigger asChild><button className="w-full">{inner}</button></PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1">
        <div className="text-xs font-semibold px-2 py-1">{item!.name}</div>
        {item!.description && <div className="text-[11px] text-muted-foreground px-2 pb-1">{item!.description}</div>}
        <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onUnequip}>Desequipar</Button>
      </PopoverContent>
    </Popover>
  );
}

function BagCell({ item, onEquip, onConsume, onDrop }: {
  item: Item | null; onEquip: () => void; onConsume: () => void; onDrop: () => void;
}) {
  if (!item) {
    return <div className="aspect-square rounded border border-border bg-input/40" />;
  }
  const canEquip = item.type?.startsWith("armor_") || item.type === "weapon_primary" || item.type === "weapon_secondary";
  const canConsume = item.type === "consumable";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="aspect-square rounded border border-border bg-input/60 hover:border-gold hover:bg-input flex items-center justify-center text-[10px] text-center p-1 overflow-hidden transition"
          title={item.name}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className="truncate">{item.name}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1">
        <div className="text-xs font-semibold px-2 py-1">{item.name}</div>
        {item.description && <div className="text-[11px] text-muted-foreground px-2 pb-1">{item.description}</div>}
        {canEquip && <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onEquip}>Equipar</Button>}
        {canConsume && <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onConsume}>Consumir</Button>}
        <Button variant="destructive" size="sm" className="w-full justify-start" onClick={onDrop}>Descartar</Button>
      </PopoverContent>
    </Popover>
  );
}