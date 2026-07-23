import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NINJA_BAG_CAPACITY, SECONDARY_SLOTS } from "@/lib/game";
import { ImageUpload } from "@/components/ImageUpload";
import { ShieldHalf, Shirt, Footprints, Swords, Sword, Backpack, Lock, HelpCircle, ArrowRightLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { equipItem, unequipItem, consumeItem, dropItem, moveItemBetweenBags } from "@/lib/character.functions";
import { toast } from "sonner";

type Item = { id: string; name: string; type: string; slot_size: number; image_url?: string | null; description?: string | null; rank?: string; durability?: number | null };
type BagEntry = { item_id: string; qty: number };
type Inv = {
  character_id: string;
  ninja_bag: BagEntry[];
  secondary_slots: BagEntry[];
  helmet_id: string | null; vest_id: string | null; pants_id: string | null; boots_id: string | null;
  primary_weapon_id: string | null; primary_unlocked: boolean;
  secondary_weapon_id: string | null; secondary_unlocked: boolean;
  primary_weapon_durability?: number | null;
  secondary_weapon_durability?: number | null;
};

type SlotKey = "helmet_id" | "vest_id" | "pants_id" | "boots_id" | "primary_weapon_id" | "secondary_weapon_id";
type BagSource = "ninja_bag" | "secondary_slots";

function normalizeBag(raw: any): BagEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e: any) => e && e.item_id)
    .map((e: any) => ({ item_id: e.item_id, qty: typeof e.qty === "number" && e.qty > 0 ? e.qty : 1 }));
}

export function InventoryView({ characterId, userId, bgUrl, onBgChange }: {
  characterId: string; userId: string; bgUrl: string | null; onBgChange: (url: string) => void; onChanged?: () => void;
}) {
  const [inv, setInv] = useState<Inv | null>(null);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [profs, setProfs] = useState<any>({});

  const load = useCallback(async () => {
    const { data: iv } = await supabase.from("inventory").select("*").eq("character_id", characterId).maybeSingle();
    const { data: it } = await supabase.from("items").select("*");
    const { data: ch } = await supabase.from("characters").select("proficiencies").eq("id", characterId).maybeSingle();
    const raw = (iv as any) ?? {};
    setInv({
      ...raw,
      ninja_bag: normalizeBag(raw.ninja_bag),
      secondary_slots: normalizeBag(raw.secondary_slots),
    });
    setItems(Object.fromEntries((it ?? []).map((i) => [i.id, i as Item])));
    setProfs((ch as any)?.proficiencies ?? {});
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const equip = useServerFn(equipItem);
  const unequip = useServerFn(unequipItem);
  const consume = useServerFn(consumeItem);
  const drop = useServerFn(dropItem);
  const move = useServerFn(moveItemBetweenBags);

  async function run(fn: () => Promise<any>, okMsg: string) {
    try { await fn(); toast.success(okMsg); await load(); try { (arguments as any); } catch {}; }
    catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  if (!inv) return <div className="p-6 text-muted-foreground">Sem inventário ainda.</div>;

  const kenj = (profs?.kenjutsu ?? {}) as { nivel?: string; maestria?: string };
  const RANKS = ["E","D","C","B","A","S"];
  const primaryUnlocked = RANKS.includes(kenj.nivel ?? "");
  const secondaryUnlocked = RANKS.includes(kenj.maestria ?? "");

  // Cada entrada da bolsa é UMA pilha e ocupa slot_size células, independente da quantidade.
  const bagUsed = inv.ninja_bag.reduce((s, e) => s + (items[e.item_id]?.slot_size ?? 1), 0);
  const secondaryUsed = inv.secondary_slots.reduce((s, e) => s + (items[e.item_id]?.slot_size ?? 1), 0);

  function renderCells(source: BagSource, capacity: number, entries: BagEntry[]) {
    type Cell = { item: Item | null; entry: BagEntry | null };
    const cells: Cell[] = [];
    for (const entry of entries) {
      const it = items[entry.item_id] ?? null;
      const size = it?.slot_size ?? 1;
      for (let s = 0; s < size; s++) cells.push({ item: it, entry });
    }
    while (cells.length < capacity) cells.push({ item: null, entry: null });
    return cells.slice(0, capacity).map((c, i) => (
      <BagCell key={`${source}-${i}`} item={c.item} entry={c.entry}
        onEquip={() => c.entry && run(() => equip({ data: { item_id: c.entry!.item_id, source } } as any), `Item equipado.`)}
        onConsume={() => c.entry && run(() => consume({ data: { item_id: c.entry!.item_id, source } } as any), `Item consumido.`)}
        onDrop={() => c.entry && run(() => drop({ data: { item_id: c.entry!.item_id, source } } as any), `Item descartado.`)}
        onMove={() => c.entry && run(() =>
          move({ data: { item_id: c.entry!.item_id, from: source, to: source === "ninja_bag" ? "secondary_slots" : "ninja_bag" } } as any),
          source === "ninja_bag" ? "Movido para slots secundários." : "Movido para a bolsa."
        )}
        moveLabel={source === "ninja_bag" ? "Mover para slots secundários" : "Mover para bolsa ninja"}
      />
    ));
  }

  return (
    <div className="scroll-panel rounded-lg p-4 sm:p-6">
      {/* Equipamentos ao redor do personagem */}
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-stretch">
        <div className="space-y-3 order-2 sm:order-1">
          <EquipSlot icon={<ShieldHalf />} label="Elmo / Bandana" slot="helmet_id" itemId={inv.helmet_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "helmet_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Shirt />} label="Colete" slot="vest_id" itemId={inv.vest_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "vest_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Sword />} label="Arma Primária" slot="primary_weapon_id" itemId={inv.primary_weapon_id} items={items} locked={!primaryUnlocked} lockedHint="Requer Kenjutsu Nível E"
            currentDurability={inv.primary_weapon_durability ?? null}
            onUnequip={() => run(() => unequip({ data: { slot: "primary_weapon_id" } } as any), "Desequipado.")} />
        </div>

        <div className="relative col-span-2 sm:col-span-1 mx-auto w-full max-w-xs sm:w-64 h-64 sm:h-80 border-2 border-gold/50 rounded-lg overflow-hidden bg-gradient-to-b from-secondary to-background flex items-center justify-center order-1 sm:order-2">
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

        <div className="space-y-3 order-3">
          <EquipSlot icon={<Shirt className="rotate-180" />} label="Calça" slot="pants_id" itemId={inv.pants_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "pants_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Footprints />} label="Botas" slot="boots_id" itemId={inv.boots_id} items={items}
            onUnequip={() => run(() => unequip({ data: { slot: "boots_id" } } as any), "Desequipado.")} />
          <EquipSlot icon={<Swords />} label="Arma Secundária" slot="secondary_weapon_id" itemId={inv.secondary_weapon_id} items={items} locked={!secondaryUnlocked} lockedHint="Requer Kenjutsu Maestria E"
            currentDurability={inv.secondary_weapon_durability ?? null}
            onUnequip={() => run(() => unequip({ data: { slot: "secondary_weapon_id" } } as any), "Desequipado.")} />
        </div>
      </div>

      {/* Bolsa ninja */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg text-gold flex items-center gap-2"><Backpack size={18} /> Bolsa Ninja</h3>
          <span className="text-xs text-muted-foreground">{bagUsed} / {NINJA_BAG_CAPACITY}</span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1">
          {renderCells("ninja_bag", NINJA_BAG_CAPACITY, inv.ninja_bag)}
        </div>
      </div>

      {/* Slots secundários */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg text-gold">Slots Secundários</h3>
          <span className="text-xs text-muted-foreground">{secondaryUsed} / {SECONDARY_SLOTS}</span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1">
          {renderCells("secondary_slots", SECONDARY_SLOTS, inv.secondary_slots)}
        </div>
      </div>
    </div>
  );
}

function EquipSlot({ icon, label, slot, itemId, items, locked, lockedHint, currentDurability, onUnequip }: {
  icon: React.ReactNode; label: string; slot: SlotKey; itemId: string | null;
  items: Record<string, Item>; locked?: boolean; lockedHint?: string;
  currentDurability?: number | null; onUnequip: () => void;
}) {
  const item = itemId ? items[itemId] : null;
  const disabled = locked || !item;
  const isWeaponSlot = slot === "primary_weapon_id" || slot === "secondary_weapon_id";
  const maxDur = item?.durability ?? null;
  const curDur = currentDurability;
  const durPct = isWeaponSlot && maxDur && curDur != null ? Math.max(0, Math.min(100, Math.round((curDur / maxDur) * 100))) : null;
  const inner = (
    <div className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition ${locked ? "opacity-60 border-dashed" : "border-border"} ${item && !locked ? "hover:border-gold cursor-pointer" : ""}`} title={locked ? lockedHint : undefined}>
      <div className="w-10 h-10 rounded flex items-center justify-center overflow-hidden bg-input/60 border border-border/50 shrink-0 text-gold">
        {locked ? (
          <Lock size={18} />
        ) : item?.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm truncate">{locked ? (lockedHint ?? "Bloqueado") : item?.name ?? "Vazio"}</div>
        {isWeaponSlot && item && durPct != null && (
          <div className="mt-1">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Durabilidade</span>
              <span className={durPct <= 20 ? "text-blood" : durPct <= 50 ? "text-gold" : ""}>{curDur}/{maxDur} ({durPct}%)</span>
            </div>
            <div className="h-1 bg-input rounded overflow-hidden">
              <div className={`h-full ${durPct <= 20 ? "bg-blood" : durPct <= 50 ? "bg-gold" : "bg-emerald-500"}`} style={{ width: `${durPct}%` }} />
            </div>
          </div>
        )}
        {isWeaponSlot && item && maxDur == null && (
          <div className="text-[9px] text-muted-foreground mt-0.5">Durabilidade infinita</div>
        )}
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
        {isWeaponSlot && durPct != null && (
          <div className="text-[11px] px-2 pb-1">
            Durabilidade: <span className={durPct <= 20 ? "text-blood font-semibold" : "font-semibold"}>{curDur}/{maxDur} ({durPct}%)</span>
          </div>
        )}
        <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onUnequip}>Desequipar</Button>
      </PopoverContent>
    </Popover>
  );
}

function BagCell({ item, entry, onEquip, onConsume, onDrop, onMove, moveLabel }: {
  item: Item | null;
  entry: BagEntry | null;
  onEquip: () => void;
  onConsume: () => void;
  onDrop: () => void;
  onMove: () => void;
  moveLabel: string;
}) {
  // Célula vazia
  if (!entry) {
    return <div className="aspect-square rounded border border-border bg-input/40" />;
  }
  // Célula com item desconhecido (deletado pelo admin)
  if (!item) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="aspect-square rounded border border-dashed border-blood/60 bg-blood/10 flex items-center justify-center text-blood" title="Item desconhecido">
            <HelpCircle size={18} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 space-y-1">
          <div className="text-xs font-semibold px-2 py-1">Item desconhecido</div>
          <div className="text-[11px] text-muted-foreground px-2 pb-1">Este item foi removido do jogo. Descarte para liberar o slot.</div>
          <Button variant="destructive" size="sm" className="w-full justify-start" onClick={onDrop}>Descartar</Button>
        </PopoverContent>
      </Popover>
    );
  }
  const canEquip = item.type?.startsWith("armor_") || item.type === "weapon_primary" || item.type === "weapon_secondary" || item.type === "weapon";
  const canConsume = item.type === "consumable";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative aspect-square rounded border border-border bg-input/60 hover:border-gold hover:bg-input flex items-center justify-center text-[10px] text-center p-1 overflow-hidden transition"
          title={item.name}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className="truncate leading-tight">{item.name}</span>
          )}
          {entry.qty > 1 && (
            <span className="absolute bottom-0 right-0 bg-background/80 text-[10px] px-1 rounded-tl font-bold text-gold">{entry.qty}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1">
        <div className="text-xs font-semibold px-2 py-1 flex items-center justify-between">
          <span>{item.name}</span>
          {item.rank && <span className="text-[10px] text-gold">{item.rank}</span>}
        </div>
        <div className="text-[10px] text-muted-foreground px-2 -mt-1 capitalize">{item.type?.replace(/_/g, " ")}</div>
        {item.description && <div className="text-[11px] text-muted-foreground px-2 pb-1">{item.description}</div>}
        {(item.type === "weapon" || item.type === "weapon_primary" || item.type === "weapon_secondary") && (
          <div className="text-[11px] px-2 pb-1">
            Durabilidade máx.: <span className="font-semibold">{item.durability ?? "∞"}</span>
          </div>
        )}
        {canEquip && <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onEquip}>Equipar</Button>}
        {canConsume && <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onConsume}>Consumir</Button>}
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onMove}>
          <ArrowRightLeft size={12} className="mr-1" /> {moveLabel}
        </Button>
        <Button variant="destructive" size="sm" className="w-full justify-start" onClick={onDrop}>Descartar</Button>
      </PopoverContent>
    </Popover>
  );
}