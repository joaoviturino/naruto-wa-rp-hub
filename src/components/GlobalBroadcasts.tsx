import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Broadcast = {
  id: string;
  message: string;
  variant: string;
  active: boolean;
  created_at: string;
  expires_at: string | null;
};

export function GlobalBroadcasts() {
  const seen = useRef<Set<string>>(new Set());
  const mounted = useRef(false);

  useEffect(() => {
    let alive = true;

    function show(b: Broadcast, opts: { silent?: boolean } = {}) {
      if (!b.active) return;
      if (b.expires_at && new Date(b.expires_at) < new Date()) return;
      if (seen.current.has(b.id)) return;
      seen.current.add(b.id);
      if (opts.silent) return;
      const fn = b.variant === "warning" ? toast.warning
              : b.variant === "success" ? toast.success
              : b.variant === "error" ? toast.error
              : toast.info;
      fn(b.message, { duration: 12000, description: "Aviso do Kage 影" });
    }

    async function load() {
      const { data } = await supabase
        .from("global_broadcasts")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!alive || !data) return;
      // On first mount, mark existing as seen (only show new ones from now)
      if (!mounted.current) {
        data.forEach((b) => seen.current.add((b as Broadcast).id));
        mounted.current = true;
        // Show the most recent still-active broadcast once as a welcome banner
        const latest = data[0] as Broadcast | undefined;
        if (latest && (!latest.expires_at || new Date(latest.expires_at) > new Date())) {
          const fn = latest.variant === "warning" ? toast.warning
                  : latest.variant === "success" ? toast.success
                  : latest.variant === "error" ? toast.error
                  : toast.info;
          fn(latest.message, { duration: 8000, description: "Aviso do Kage 影" });
        }
      }
    }

    load();
    const ch = supabase
      .channel("global_broadcasts_watch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_broadcasts" },
        (payload) => show(payload.new as Broadcast))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "global_broadcasts" },
        (payload) => {
          const b = payload.new as Broadcast;
          // If reactivated, allow re-showing
          if (b.active && !seen.current.has(b.id)) show(b);
        })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  return null;
}