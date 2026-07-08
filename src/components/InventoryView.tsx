import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NINJA_BAG_CAPACITY, SECONDARY_SLOTS } from "@/lib/game";
import { ImageUpload } from "@/components/ImageUpload";
import { ShieldHalf, Shirt, Footprints, Swords, Sword, Backpack, Lock } from "lucide-react";

type Item = { id: string; name: string; type: string; slot_size: number };
type Inv = {
  character_id: string;
  ninja_bag: { item_id: string; qty: number }[];
  secondary_slots: (string | null)[];
  helmet_id: string | null; vest_id: string | null; pants_id: string | null; boots_id: string | null;
  primary_weapon_id: string | null; primary_unlocked: boolean;
  secondary_weapon_id: string | null; secondary_unlocked: boolean;
};

export function InventoryView({ characterId, userId, bgUrl, onBgChange }: {
  characterId: string; userId: string; bgUrl: string | null; onBgChange: (url: string) => void;
}) {
  const [inv, setInv] = useState<Inv | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});

  useEffect(() => {
    (async () => {
      const { data: iv } = await supabase.from("inventory").select("*").eq("character_id", characterId).maybeSingle();
      const { data: it } = await supabase.from("items").select("*");
      setInv(iv as any);
      setItems(Object.fromEntries((it ?? []).map((i) => [i.id, i as Item])));
    })();
  }, [characterId]);

  if (!inv) return <div className="p-6 text-muted-foreground">Sem inventário ainda.</div>;

  const bagUsed = inv.ninja_bag.reduce((s, e) => s + (items[e.item_id]?.slot_size ?? 1) * e.qty, 0);
  const secondary = Array.from({ length: SECONDARY_SLOTS }, (_, i) => inv.secondary_slots[i] ?? null);

  return (
    <div className="scroll-panel rounded-lg p-6">
      {/* Equipamentos ao redor do personagem */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <div className="space-y-3">
          <EquipSlot icon={<ShieldHalf />} label="Elmo / Bandana" itemId={inv.helmet_id} items={items} />
          <EquipSlot icon={<Shirt />} label="Colete" itemId={inv.vest_id} items={items} />
          <EquipSlot icon={<Sword />} label="Arma Primária" itemId={inv.primary_weapon_id} items={items} locked={!inv.primary_unlocked} />
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
          <EquipSlot icon={<Shirt className="rotate-180" />} label="Calça" itemId={inv.pants_id} items={items} />
          <EquipSlot icon={<Footprints />} label="Botas" itemId={inv.boots_id} items={items} />
          <EquipSlot icon={<Swords />} label="Arma Secundária" itemId={inv.secondary_weapon_id} items={items} locked={!inv.secondary_unlocked} />
        </div>
      </div>

      {/* Bolsa ninja */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg text-gold flex items-center gap-2"><Backpack size={18} /> Bolsa Ninja</h3>
          <span className="text-xs text-muted-foreground">{bagUsed} / {NINJA_BAG_CAPACITY}</span>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: NINJA_BAG_CAPACITY }, (_, i) => {
            let used = 0;
            let content: string | null = null;
            for (const entry of inv.ninja_bag) {
              const size = items[entry.item_id]?.slot_size ?? 1;
              for (let q = 0; q < entry.qty; q++) {
                for (let s = 0; s < size; s++) {
                  if (used === i) content = items[entry.item_id]?.name ?? "?";
                  used++;
                }
              }
            }
            return (
              <div key={i} className="aspect-square rounded border border-border bg-input/40 flex items-center justify-center text-[10px] text-center p-1">
                {content ?? ""}
              </div>
            );
          })}
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

function EquipSlot({ icon, label, itemId, items, locked }: { icon: React.ReactNode; label: string; itemId: string | null; items: Record<string, Item>; locked?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${locked ? "opacity-40 border-dashed" : "border-border"}`}>
      <div className="text-gold">{locked ? <Lock size={18} /> : icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{locked ? "Bloqueado" : itemId ? items[itemId]?.name ?? "—" : "Vazio"}</div>
      </div>
    </div>
  );
}