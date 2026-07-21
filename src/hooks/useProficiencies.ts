import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_CLASSES as STATIC_SKILL_CLASSES } from "@/components/admin/shared";

export type Proficiency = { value: string; label: string; description: string | null; sort_order: number; active: boolean; is_element: boolean };

let cache: Proficiency[] | null = null;
const listeners = new Set<(v: Proficiency[]) => void>();
let inflight: Promise<Proficiency[]> | null = null;

function fallback(): Proficiency[] {
  const ELEMENT_VALUES = new Set(["katon","suiton","fuuton","doton","raiton"]);
  return STATIC_SKILL_CLASSES.map((c, i) => ({ value: c.value, label: c.label, description: c.desc, sort_order: (i + 1) * 10, active: true, is_element: ELEMENT_VALUES.has(c.value) }));
}

async function fetchAll(): Promise<Proficiency[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.from("proficiencies").select("value,label,description,sort_order,active,is_element").order("sort_order", { ascending: true });
    if (error || !data) return fallback();
    const rows = (data as any[]).map((r) => ({ ...r, is_element: !!r.is_element })) as Proficiency[];
    cache = rows;
    listeners.forEach((cb) => cb(rows));
    return rows;
  })();
  try { return await inflight; } finally { inflight = null; }
}

export async function refreshProficiencies() { cache = null; return fetchAll(); }

// Snapshot list of proficiency values flagged as elements — used by legacy
// sync helpers in `shared.ts`. Falls back to the hardcoded 5 naturezas until
// the catálogo termina de carregar.
export function getElementValuesSync(): string[] {
  if (cache) return cache.filter((r) => r.is_element).map((r) => r.value);
  return ["katon","suiton","fuuton","doton","raiton"];
}

export function useProficiencies(opts: { includeInactive?: boolean } = {}) {
  const [rows, setRows] = useState<Proficiency[]>(cache ?? fallback());
  useEffect(() => {
    let alive = true;
    const cb = (v: Proficiency[]) => { if (alive) setRows(v); };
    listeners.add(cb);
    if (!cache) fetchAll();
    else setRows(cache);
    const chName = `proficiencies_live_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const ch = supabase.channel(chName)
      .on("postgres_changes", { event: "*", schema: "public", table: "proficiencies" }, () => { refreshProficiencies(); })
      .subscribe();
    return () => { alive = false; listeners.delete(cb); supabase.removeChannel(ch); };
  }, []);
  return opts.includeInactive ? rows : rows.filter((r) => r.active);
}