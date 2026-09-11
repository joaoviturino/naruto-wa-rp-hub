import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createResourceCache } from "@/lib/resource-cache";
import type { StatesMap } from "@/lib/sprite-animation";

export type BodySprite = {
  sheet_url: string | null; sheet_cols: number | null; sheet_rows: number | null;
  sheet_states: StatesMap | null; image_url: string | null;
};
const cache = createResourceCache<BodySprite>(async (id) => {
  const { data, error } = await supabase.from("characters")
    .select("body_sheet_url,body_sheet_cols,body_sheet_rows,body_sheet_states,inventory_bg_url")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return { sheet_url: data?.body_sheet_url ?? null, sheet_cols: data?.body_sheet_cols ?? null,
    sheet_rows: data?.body_sheet_rows ?? null, sheet_states: (data?.body_sheet_states ?? null) as StatesMap | null,
    image_url: data?.inventory_bg_url ?? null };
});
export function refreshBodySprite(id: string) { return cache.load(id, true); }
export function useBodySprite(id: string | null | undefined): BodySprite | null {
  const subscribe = useCallback((cb: () => void) => id ? cache.subscribe(id, cb) : () => {}, [id]);
  const snapshot = useCallback(() => id ? cache.get(id) ?? null : null, [id]);
  const body = useSyncExternalStore(subscribe, snapshot, () => null);
  useEffect(() => { if (id) void cache.load(id).catch(() => {}); }, [id]);
  return body;
}
