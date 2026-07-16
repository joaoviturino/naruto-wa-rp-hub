import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Info, CheckCircle2, XCircle, X } from "lucide-react";

type Broadcast = {
  id: string;
  message: string;
  variant: string;
  active: boolean;
  created_at: string;
  expires_at: string | null;
};

type Displayed = Broadcast & { shownAt: number };

const AUTO_DISMISS_MS = 15000;

export function GlobalBroadcasts() {
  const [items, setItems] = useState<Displayed[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const mounted = useRef(false);

  useEffect(() => {
    let alive = true;

    function isLive(b: Broadcast) {
      if (!b.active) return false;
      if (b.expires_at && new Date(b.expires_at) < new Date()) return false;
      return true;
    }

    function push(b: Broadcast) {
      if (!isLive(b)) return;
      if (seen.current.has(b.id)) return;
      seen.current.add(b.id);
      setItems((prev) => [...prev, { ...b, shownAt: Date.now() }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== b.id));
      }, AUTO_DISMISS_MS);
    }

    async function load() {
      const { data } = await supabase
        .from("global_broadcasts")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!alive || !data) return;
      if (!mounted.current) {
        mounted.current = true;
        const latest = (data[0] as Broadcast | undefined);
        (data as Broadcast[]).forEach((b) => seen.current.add(b.id));
        if (latest && isLive(latest)) {
          seen.current.delete(latest.id);
          push(latest);
        }
      }
    }

    load();
    const ch = supabase
      .channel("global_broadcasts_watch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_broadcasts" },
        (payload) => push(payload.new as Broadcast))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "global_broadcasts" },
        (payload) => {
          const b = payload.new as Broadcast;
          if (b.active && !seen.current.has(b.id)) push(b);
          if (!b.active) setItems((prev) => prev.filter((x) => x.id !== b.id));
        })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  function dismiss(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  if (!items.length) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 top-3 sm:top-5 pointer-events-none flex flex-col items-center gap-2 w-[min(92vw,720px)]"
      style={{ zIndex: 2147483647 }}
      aria-live="assertive"
      role="alert"
    >
      {items.map((b) => {
        const style = variantStyle(b.variant);
        return (
          <div
            key={b.id}
            className={`pointer-events-auto w-full rounded-lg border-2 shadow-2xl backdrop-blur-md px-4 py-3 flex items-center gap-3 ${style.wrap}`}
            style={{
              animation:
                "gb-pulse 1.1s ease-in-out infinite, gb-drop 260ms ease-out both",
            }}
          >
            <span className={`shrink-0 ${style.icon}`}>{style.Icon}</span>
            <div className="flex-1 min-w-0 font-display text-sm sm:text-base font-bold tracking-wide drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">
              {b.message}
            </div>
            <button
              onClick={() => dismiss(b.id)}
              className="shrink-0 opacity-70 hover:opacity-100 transition"
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes gb-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.0), 0 10px 30px rgba(0,0,0,0.55); filter: brightness(1); }
          50% { box-shadow: 0 0 0 6px rgba(255,255,255,0.10), 0 10px 40px rgba(0,0,0,0.7); filter: brightness(1.18); }
        }
        @keyframes gb-drop {
          from { transform: translateY(-24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function variantStyle(v: string) {
  switch (v) {
    case "warning":
      return {
        wrap: "bg-yellow-500/25 border-yellow-400 text-yellow-50",
        icon: "text-yellow-300",
        Icon: <AlertTriangle size={22} />,
      };
    case "success":
      return {
        wrap: "bg-emerald-600/25 border-emerald-400 text-emerald-50",
        icon: "text-emerald-300",
        Icon: <CheckCircle2 size={22} />,
      };
    case "error":
      return {
        wrap: "bg-red-600/30 border-red-500 text-red-50",
        icon: "text-red-300",
        Icon: <XCircle size={22} />,
      };
    default:
      return {
        wrap: "bg-sky-600/25 border-sky-400 text-sky-50",
        icon: "text-sky-300",
        Icon: <Info size={22} />,
      };
  }
}