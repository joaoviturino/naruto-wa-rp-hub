import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StatesMap } from "@/components/AnimatedSprite";

export type BodySprite = {
  sheet_url: string | null;
  sheet_cols: number | null;
  sheet_rows: number | null;
  sheet_states: StatesMap | null;
  image_url: string | null;
};

const cache = new Map<string, BodySprite>();
const listeners = new Map<string, Set<(v: BodySprite) => void>>();

async function fetchBody(characterId: string) {
  const { data } = await supabase
    .from("characters")
    .select("body_sheet_url,body_sheet_cols,body_sheet_rows,body_sheet_states,inventory_bg_url")
    .eq("id", characterId)
    .maybeSingle();
  const b: BodySprite = {
    sheet_url: (data as any)?.body_sheet_url ?? null,
    sheet_cols: (data as any)?.body_sheet_cols ?? null,
    sheet_rows: (data as any)?.body_sheet_rows ?? null,
    sheet_states: (data as any)?.body_sheet_states ?? null,
    image_url: (data as any)?.inventory_bg_url ?? null,
  };
  cache.set(characterId, b);
  listeners.get(characterId)?.forEach((cb) => cb(b));
}

export function useBodySprite(characterId: string | null | undefined): BodySprite | null {
  const [body, setBody] = useState<BodySprite | null>(() =>
    characterId ? cache.get(characterId) ?? null : null,
  );
  useEffect(() => {
    if (!characterId) { setBody(null); return; }
    if (!listeners.has(characterId)) listeners.set(characterId, new Set());
    const set = listeners.get(characterId)!;
    const cb = (v: BodySprite) => setBody(v);
    set.add(cb);
    if (cache.has(characterId)) setBody(cache.get(characterId)!);
    void fetchBody(characterId);
    return () => { set.delete(cb); };
  }, [characterId]);
  return body;
}