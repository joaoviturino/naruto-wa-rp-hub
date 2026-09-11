import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createResourceCache } from "@/lib/resource-cache";
import type { StatesMap } from "@/lib/sprite-animation";

export type EquippedPiece = {
  id?: string;
  slot: "hair" | "face" | "clothing" | "accessory";
  image_url: string;
  z_index: number;
  name: string;
  sheet_url?: string | null;
  sheet_cols?: number | null;
  sheet_rows?: number | null;
  sheet_states?: StatesMap | null;
};
const EMPTY: EquippedPiece[] = [];
const cache = createResourceCache<EquippedPiece[]>(async (id) => {
  const { data, error } = await supabase.from("character_cosmetics")
    .select("slot, piece:cosmetic_pieces(id,image_url,z_index,name,slot,sheet_url,sheet_cols,sheet_rows,sheet_states)")
    .eq("character_id", id);
  if (error) throw error;
  return (data ?? []).flatMap((r) => r.piece ? [r.piece as unknown as EquippedPiece] : [])
    .sort((a, b) => a.z_index - b.z_index);
});

export function refreshCharacterCosmetics(id: string) { return cache.load(id, true); }

export function useCharacterCosmetics(id: string | null | undefined) {
  const subscribe = useCallback((cb: () => void) => id ? cache.subscribe(id, cb) : () => {}, [id]);
  const snapshot = useCallback(() => id ? cache.get(id) ?? EMPTY : EMPTY, [id]);
  const pieces = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  useEffect(() => { if (id) void cache.load(id).catch(() => {}); }, [id]);
  return pieces;
}
