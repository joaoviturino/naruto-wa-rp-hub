import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stats } from "@/lib/game";
import { ImageUpload } from "@/components/ImageUpload";
import { updateCharacter } from "@/lib/character.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";

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
    <div className="fixed top-2 right-2 z-40 pointer-events-none select-none">
      <div className="pointer-events-auto flex items-stretch gap-2 rounded-lg border border-gold/40 bg-background/85 backdrop-blur-sm p-2 shadow-lg shadow-black/40 w-[240px] sm:w-[280px]">
        {/* Eyes frame */}
        <div className="relative shrink-0">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded border border-gold/60 overflow-hidden bg-secondary flex items-center justify-center">
            {c.eyes_frame_url ? (
              <img src={c.eyes_frame_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 scale-75 origin-bottom-right">
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

        {/* Bars */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <Bar label="HP" cur={hpCur} max={hpMax} color="bg-emerald-500" />
          <Bar label="EF" cur={efCur} max={s.ef} color="bg-red-500" />
          <Bar label="EM" cur={emCur} max={s.em} color="bg-sky-500" />
          <Bar label="CK" cur={ckCur} max={s.chakra} color="bg-amber-400" />
        </div>
      </div>
    </div>
  );
}

function Bar({ label, cur, max, color }: { label: string; cur: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[9px] leading-none mb-0.5">
        <span className="font-bold text-gold tracking-wider">{label}</span>
        <span className="tabular-nums text-muted-foreground">{cur}/{max}</span>
      </div>
      <div className="h-1.5 rounded overflow-hidden bg-input">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}