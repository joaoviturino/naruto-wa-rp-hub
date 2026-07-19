import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stats } from "@/lib/game";
import { levelProgress, DEFAULT_LEVEL_CONFIG } from "@/lib/level";
import { ImageUpload } from "@/components/ImageUpload";
import { updateCharacter } from "@/lib/character.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, ChevronDown } from "lucide-react";

type HudChar = {
  id: string;
  user_id: string;
  nickname: string;
  xp: number;
  hp_current: number | null;
  ef_current: number | null;
  em_current: number | null;
  chakra_current: number | null;
  eyes_frame_url: string | null;
};

export function ChatHud({ characterId, variant = "floating" }: { characterId: string; variant?: "floating" | "mobile-bar" }) {
  const [c, setC] = useState<HudChar | null>(null);
  const [open, setOpen] = useState(false);
  const update = useServerFn(updateCharacter);

  async function load() {
    const { data } = await supabase
      .from("characters")
      .select("id,user_id,nickname,xp,hp_current,ef_current,em_current,chakra_current,eyes_frame_url")
      .eq("id", characterId)
      .maybeSingle();
    setC(data as HudChar | null);
  }
  useEffect(() => { load(); }, [characterId]);

  useEffect(() => {
    const ch = supabase
      .channel(`hud:${characterId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "characters", filter: `id=eq.${characterId}` },
        (payload) => setC((prev) => (prev ? { ...prev, ...(payload.new as any) } : prev)),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [characterId]);

  if (!c) return null;

  const s = stats(c.xp);
  const hpMax = Math.max(1, c.xp);
  const hpCur = c.hp_current == null ? hpMax : Math.max(0, Math.min(hpMax, c.hp_current));
  const efCur = c.ef_current == null ? s.ef : Math.min(s.ef, c.ef_current);
  const emCur = c.em_current == null ? s.em : Math.min(s.em, c.em_current);
  const ckCur = c.chakra_current == null ? s.chakra : Math.min(s.chakra, c.chakra_current);
  const lvl = levelProgress(c.xp, DEFAULT_LEVEL_CONFIG);

  const avatarWithBadge = (size: "sm" | "md" | "lg") => {
    const dim = size === "sm" ? "h-8 w-8" : size === "md" ? "h-9 w-9" : "h-12 w-12";
    const badge = size === "lg" ? "text-[10px] px-1.5 py-0.5" : "text-[9px] px-1 py-[1px]";
    return (
      <div className={`relative ${dim} shrink-0`}>
        <div className={`${dim} rounded-full overflow-hidden ring-1 ring-gold/40 bg-secondary`}>
          {c.eyes_frame_url ? (
            <img src={c.eyes_frame_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImagePlus className="w-3 h-3 text-muted-foreground" />
            </div>
          )}
        </div>
        <div
          className={`absolute -bottom-0.5 -left-0.5 ${badge} rounded-full font-black tabular-nums text-black bg-gradient-to-b from-gold to-amber-500 ring-1 ring-black/60 shadow leading-none`}
        >
          {lvl.level}
        </div>
      </div>
    );
  };

  if (variant === "mobile-bar") {
    return (
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-1.5"
        >
          {avatarWithBadge("sm")}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <MiniBar cur={hpCur} max={hpMax} from="#10b981" to="#34d399" />
            <MiniBar cur={lvl.into} max={lvl.span} from="#f59e0b" to="#fbbf24" tiny />
          </div>
          <ChevronDown
            size={14}
            className={`text-white/60 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <div
          className={`overflow-hidden transition-all duration-200 ${open ? "max-h-64" : "max-h-0"}`}
        >
          <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Shinobi</div>
              <div className="font-display text-xs text-gold truncate flex-1">{c.nickname}</div>
              <ImageUpload
                label="Frame"
                bucket="avatars"
                userId={c.user_id}
                compact
                onUploaded={async (url) => {
                  try {
                    await update({ data: { eyes_frame_url: url } });
                    toast.success("Frame atualizado.");
                    load();
                  } catch (e: any) { toast.error(e.message); }
                }}
              />
            </div>
            <Bar label="HP" cur={hpCur} max={hpMax} from="#10b981" to="#34d399" />
            <Bar label="EF" cur={efCur} max={s.ef} from="#ef4444" to="#f87171" />
            <Bar label="EM" cur={emCur} max={s.em} from="#0ea5e9" to="#38bdf8" />
            <Bar label="CK" cur={ckCur} max={s.chakra} from="#f59e0b" to="#fbbf24" />
            <Bar label="EXP" cur={lvl.into} max={lvl.span} from="#eab308" to="#fde047" suffix={`  ${lvl.pct.toFixed(0)}%`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-40 pointer-events-none select-none hidden sm:block sm:top-3 sm:right-3"
      style={{ width: "min(380px, calc(100vw - 100px))" }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        {/* Collapsed pill */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex items-center gap-2 rounded-full border border-white/10 bg-black/55 backdrop-blur-xl pl-1 pr-3 py-1 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.7)] transition-all hover:border-gold/50"
        >
          {avatarWithBadge("md")}
          <MiniBar cur={hpCur} max={hpMax} from="#10b981" to="#34d399" />
          <ChevronDown
            size={14}
            className={`text-white/60 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Expanded panel */}
        <div
          className={`origin-top transition-all duration-200 ${
            open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="w-[260px] sm:w-[300px] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-3 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                {avatarWithBadge("lg")}
                <div className="absolute -bottom-1 -right-1 scale-[0.7] origin-bottom-right">
                  <ImageUpload
                    label="+"
                    bucket="avatars"
                    userId={c.user_id}
                    compact
                    onUploaded={async (url) => {
                      try {
                        await update({ data: { eyes_frame_url: url } });
                        toast.success("Frame atualizado.");
                        load();
                      } catch (e: any) { toast.error(e.message); }
                    }}
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Shinobi</div>
                <div className="font-display text-sm text-gold truncate">{c.nickname}</div>
                <div className="text-[10px] text-white/50 tabular-nums">Nv. {lvl.level} · {lvl.pct.toFixed(0)}%</div>
              </div>
            </div>

            <div className="space-y-2">
              <Bar label="HP" cur={hpCur} max={hpMax} from="#10b981" to="#34d399" />
              <Bar label="EF" cur={efCur} max={s.ef} from="#ef4444" to="#f87171" />
              <Bar label="EM" cur={emCur} max={s.em} from="#0ea5e9" to="#38bdf8" />
              <Bar label="CK" cur={ckCur} max={s.chakra} from="#f59e0b" to="#fbbf24" />
              <Bar label="EXP" cur={lvl.into} max={lvl.span} from="#eab308" to="#fde047" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, cur, max, from, to, suffix }: { label: string; cur: number; max: number; from: string; to: string; suffix?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] leading-none mb-1">
        <span className="font-semibold tracking-[0.15em] text-white/80">{label}</span>
        <span className="tabular-nums text-white/50">{cur.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}{suffix ?? ""}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 8px ${to}55` }}
        />
      </div>
    </div>
  );
}

function MiniBar({ cur, max, from, to, tiny }: { cur: number; max: number; from: string; to: string; tiny?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return (
    <div className="flex flex-col items-start gap-0.5 min-w-[70px] sm:min-w-[90px]">
      {!tiny && (
        <span className="text-[9px] tabular-nums text-white/70 leading-none">
          {cur.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}
        </span>
      )}
      <div className={`${tiny ? "h-1" : "h-1.5"} w-full rounded-full overflow-hidden bg-white/10`}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }}
        />
      </div>
    </div>
  );
}