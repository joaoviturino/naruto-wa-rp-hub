import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EquippedPiece = {
  slot: "hair" | "face" | "clothing" | "accessory";
  image_url: string;
  z_index: number;
  name: string;
};

// Cache simples por characterId para evitar múltiplos fetchs.
const cache = new Map<string, EquippedPiece[]>();
const listeners = new Map<string, Set<(v: EquippedPiece[]) => void>>();

function notify(id: string, v: EquippedPiece[]) {
  cache.set(id, v);
  listeners.get(id)?.forEach((cb) => cb(v));
}

export async function refreshCharacterCosmetics(id: string) {
  const { data, error } = await supabase
    .from("character_cosmetics")
    .select("slot, piece:cosmetic_pieces(image_url, z_index, name, slot)")
    .eq("character_id", id);
  if (error) return;
  const list: EquippedPiece[] = (data ?? [])
    .map((r: any) => r.piece ? { slot: r.piece.slot, image_url: r.piece.image_url, z_index: r.piece.z_index, name: r.piece.name } : null)
    .filter(Boolean) as EquippedPiece[];
  list.sort((a, b) => a.z_index - b.z_index);
  notify(id, list);
}

export function useCharacterCosmetics(characterId: string | null | undefined) {
  const [pieces, setPieces] = useState<EquippedPiece[]>(() =>
    characterId ? cache.get(characterId) ?? [] : [],
  );

  useEffect(() => {
    if (!characterId) { setPieces([]); return; }
    if (!listeners.has(characterId)) listeners.set(characterId, new Set());
    const set = listeners.get(characterId)!;
    const cb = (v: EquippedPiece[]) => setPieces(v);
    set.add(cb);
    if (cache.has(characterId)) setPieces(cache.get(characterId)!);
    else void refreshCharacterCosmetics(characterId);
    return () => { set.delete(cb); };
  }, [characterId]);

  return pieces;
}