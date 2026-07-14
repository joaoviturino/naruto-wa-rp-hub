import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stats } from "@/lib/game";
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

export function ChatHud({ characterId }: { characterId: string }) {
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
      .channel(`hud:${characterId}`)
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

  return (
    <div
      className="fixed z-40 pointer-events-none select-none top-[calc(env(safe-area-inset-top)+56px)] left-1/2 -translate-x-1/2 sm:top-3 sm:right-3 sm:left-auto sm:translate-x-0"
      style={{ maxWidth: "min(420px, calc(100vw - 96px))" }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        {/* Collapsed pill */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex items-center gap-2 rounded-full border border-white/10 bg-black/55 backdrop-blur-xl pl-1 pr-3 py-1 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.7)] transition-all hover:border-gold/50"
        >
          <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden ring-1 ring-gold/40 bg-secondary">
            {c.eyes_frame_url ? (
              <img src={c.eyes_frame_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImagePlus className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
          <MiniBar cur={hpCur} max={hpMax} from="#10b981" to="#34d399" />
          <ChevronDown
            size={14}
            className={`text-white/60 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Expanded panel */}
        <div
          className={`origin-top-right transition-all duration-200 ${
            open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="w-[260px] sm:w-[300px] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-3 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full overflow-hidden ring-2 ring-gold/50 bg-secondary">
                  {c.eyes_frame_url ? (
                    <img src={c.eyes_frame_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImagePlus className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
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
              </div>
            </div>

            <div className="space-y-2">
              <Bar label="HP" cur={hpCur} max={hpMax} from="#10b981" to="#34d399" />
              <Bar label="EF" cur={efCur} max={s.ef} from="#ef4444" to="#f87171" />
              <Bar label="EM" cur={emCur} max={s.em} from="#0ea5e9" to="#38bdf8" />
              <Bar label="CK" cur={ckCur} max={s.chakra} from="#f59e0b" to="#fbbf24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, cur, max, from, to }: { label: string; cur: number; max: number; from: string; to: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] leading-none mb-1">
        <span className="font-semibold tracking-[0.15em] text-white/80">{label}</span>
        <span className="tabular-nums text-white/50">{cur.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}</span>
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

function MiniBar({ cur, max, from, to }: { cur: number; max: number; from: string; to: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return (
    <div className="flex flex-col items-start gap-0.5 min-w-[70px] sm:min-w-[90px]">
      <span className="text-[9px] tabular-nums text-white/70 leading-none">
        {cur.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}
      </span>
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }}
        />
      </div>
    </div>
  );
}