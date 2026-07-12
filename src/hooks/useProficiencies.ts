import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_CLASSES as STATIC_SKILL_CLASSES } from "@/components/admin/shared";

export type Proficiency = { value: string; label: string; description: string | null; sort_order: number; active: boolean };

let cache: Proficiency[] | null = null;
const listeners = new Set<(v: Proficiency[]) => void>();
let inflight: Promise<Proficiency[]> | null = null;

function fallback(): Proficiency[] {
  return STATIC_SKILL_CLASSES.map((c, i) => ({ value: c.value, label: c.label, description: c.desc, sort_order: (i + 1) * 10, active: true }));
}

async function fetchAll(): Promise<Proficiency[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.from("proficiencies").select("value,label,description,sort_order,active").order("sort_order", { ascending: true });
    if (error || !data) return fallback();
    const rows = data as Proficiency[];
    cache = rows;
    listeners.forEach((cb) => cb(rows));
    return rows;
  })();
  try { return await inflight; } finally { inflight = null; }
}

export async function refreshProficiencies() { cache = null; return fetchAll(); }

export function useProficiencies(opts: { includeInactive?: boolean } = {}) {
  const [rows, setRows] = useState<Proficiency[]>(cache ?? fallback());
  useEffect(() => {
    let alive = true;
    const cb = (v: Proficiency[]) => { if (alive) setRows(v); };
    listeners.add(cb);
    if (!cache) fetchAll();
    else setRows(cache);
    const ch = supabase.channel("proficiencies_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "proficiencies" }, () => { refreshProficiencies(); })
      .subscribe();
    return () => { alive = false; listeners.delete(cb); supabase.removeChannel(ch); };
  }, []);
  return opts.includeInactive ? rows : rows.filter((r) => r.active);
}