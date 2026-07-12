import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Sword } from "lucide-react";

type Row = { id: string; challenger_id: string; opponent_id: string; status: string; current_turn_character_id: string | null };

export function PvpInvitesWatcher() {
  const [myId, setMyId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  async function refresh(cid: string) {
    const { data } = await supabase.from("pvp_duels").select("id,challenger_id,opponent_id,status,current_turn_character_id")
      .in("status", ["pending", "active"])
      .or(`challenger_id.eq.${cid},opponent_id.eq.${cid}`);
    const rows = (data ?? []) as Row[];
    setInvites(rows);
    const ids = new Set<string>();
    rows.forEach((r) => { ids.add(r.challenger_id); ids.add(r.opponent_id); });
    if (ids.size) {
      const { data: cs } = await supabase.from("characters").select("id,nickname").in("id", Array.from(ids));
      const m: Record<string, string> = {}; (cs ?? []).forEach((c: any) => (m[c.id] = c.nickname));
      setNames(m);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: me } = await supabase.from("characters").select("id").eq("user_id", u.user.id).maybeSingle();
      if (!me?.id) return;
      setMyId(me.id);
      refresh(me.id);
      const ch = supabase.channel(`pvp_watch_${me.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pvp_duels" }, () => refresh(me.id))
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
  }, []);

  if (!myId || invites.length === 0) return null;

  return (
    <div className="border-b border-gold/30 bg-gold/10">
      <div className="mx-auto max-w-6xl px-4 py-2 flex flex-wrap gap-2 text-xs">
        {invites.map((d) => {
          const iAmOpp = d.opponent_id === myId;
          const iAmChall = d.challenger_id === myId;
          const otherId = iAmOpp ? d.challenger_id : d.opponent_id;
          const other = names[otherId] ?? "…";
          let label = "";
          if (d.status === "pending" && iAmOpp) label = `⚔️ ${other} te desafiou`;
          else if (d.status === "pending" && iAmChall) label = `Aguardando ${other}...`;
          else if (d.status === "active" && d.current_turn_character_id === myId) label = `⚔️ Seu turno contra ${other}`;
          else if (d.status === "active") label = `Duelando com ${other} — vez de ${other}`;
          return (
            <Link key={d.id} to="/duel/$id" params={{ id: d.id }} className="inline-flex items-center gap-1 rounded-full bg-gold/20 hover:bg-gold/30 px-3 py-1 text-gold">
              <Sword size={12} /> {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}