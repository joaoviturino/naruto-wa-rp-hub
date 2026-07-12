import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@tanstack/react-router";
import { Sword, Check, X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { respondDuel, cancelDuel } from "@/lib/pvp.functions";
import { toast } from "sonner";

type Row = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: "pending" | "active" | string;
  current_turn_character_id: string | null;
  created_at: string;
};
type CharMini = { id: string; nickname: string; avatar_url: string | null; rank?: string | null };

const EXPIRE_MS = 120_000;

export function DuelInvitesInline() {
  const [myId, setMyId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [chars, setChars] = useState<Record<string, CharMini>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const respond = useServerFn(respondDuel);
  const cancel = useServerFn(cancelDuel);
  const navigate = useNavigate();
  const chRef = useRef<any>(null);

  async function refresh(cid: string) {
    const { data } = await supabase.from("pvp_duels")
      .select("id,challenger_id,opponent_id,status,current_turn_character_id,created_at")
      .in("status", ["pending", "active"])
      .or(`challenger_id.eq.${cid},opponent_id.eq.${cid}`)
      .order("created_at", { ascending: false });
    const raw = (data ?? []) as Row[];
    const filtered = raw.filter((r) => r.status !== "pending" || Date.now() - new Date(r.created_at).getTime() < EXPIRE_MS);
    setRows(filtered);
    const ids = new Set<string>();
    filtered.forEach((r) => { ids.add(r.challenger_id); ids.add(r.opponent_id); });
    if (ids.size) {
      const { data: cs } = await supabase.from("characters").select("id,nickname,avatar_url,rank").in("id", Array.from(ids));
      const m: Record<string, CharMini> = {};
      (cs ?? []).forEach((c: any) => (m[c.id] = c));
      setChars(m);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data: me } = await supabase.from("characters").select("id").eq("user_id", u.user.id).maybeSingle();
      if (!me?.id || cancelled) return;
      setMyId(me.id);
      await refresh(me.id);
      const channel = supabase.channel(`pvp_inline_${me.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pvp_duels" }, () => refresh(me.id));
      channel.subscribe();
      chRef.current = channel;
    })();
    return () => { cancelled = true; if (chRef.current) supabase.removeChannel(chRef.current); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const incoming = useMemo(() => rows.filter((r) => r.status === "pending" && r.opponent_id === myId), [rows, myId]);
  const outgoing = useMemo(() => rows.filter((r) => r.status === "pending" && r.challenger_id === myId), [rows, myId]);
  const active = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);

  const total = incoming.length + outgoing.length + active.length;

  async function doRespond(id: string, accept: boolean) {
    setBusy(id);
    try {
      await respond({ data: { duel_id: id, accept } } as any);
      if (accept) navigate({ to: "/duel/$id", params: { id } });
      else toast("Convite recusado.");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function doCancel(id: string) {
    setBusy(id);
    try { await cancel({ data: { duel_id: id } } as any); toast.success("Convite cancelado."); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="border border-border rounded p-2 space-y-2 h-full flex flex-col">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        <Sword size={11} className="text-blood" /> Duelos {total > 0 && <span className="ml-auto text-gold">{total}</span>}
      </div>

      {total === 0 && (
        <div className="text-[11px] text-muted-foreground py-1">Nenhum convite ou duelo ativo.</div>
      )}

      {incoming.map((d) => {
        const c = chars[d.challenger_id];
        const remain = Math.max(0, EXPIRE_MS - (Date.now() - new Date(d.created_at).getTime()));
        const secs = Math.ceil(remain / 1000);
        return (
          <div key={d.id} className="rounded border border-blood/40 bg-blood/10 p-2 space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-background shrink-0">
                {c?.avatar_url && <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold truncate">{c?.nickname ?? "Desafiante"}</div>
                <div className="text-[9px] text-muted-foreground flex items-center gap-1"><Clock size={9} />{secs}s</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" disabled={busy === d.id}
                onClick={() => doRespond(d.id, false)}>
                <X size={12} className="mr-1" />Recusar
              </Button>
              <Button size="sm" className="h-7 text-[11px] px-2" disabled={busy === d.id}
                onClick={() => doRespond(d.id, true)}>
                <Check size={12} className="mr-1" />Aceitar
              </Button>
            </div>
          </div>
        );
      })}

      {outgoing.map((d) => {
        const c = chars[d.opponent_id];
        const remain = Math.max(0, EXPIRE_MS - (Date.now() - new Date(d.created_at).getTime()));
        const secs = Math.ceil(remain / 1000);
        return (
          <div key={d.id} className="rounded border border-gold/40 bg-gold/5 p-2 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-gold shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] truncate">Aguardando <b>{c?.nickname ?? "…"}</b></div>
              <div className="text-[9px] text-muted-foreground">{secs}s restantes</div>
            </div>
            <button className="text-[10px] text-blood hover:underline shrink-0"
              disabled={busy === d.id} onClick={() => doCancel(d.id)}>Cancelar</button>
          </div>
        );
      })}

      {active.map((d) => {
        const iAmTurn = d.current_turn_character_id === myId;
        const otherId = d.challenger_id === myId ? d.opponent_id : d.challenger_id;
        const c = chars[otherId];
        return (
          <Link key={d.id} to="/duel/$id" params={{ id: d.id }}
            className={`rounded border p-2 flex items-center gap-2 hover:brightness-110 ${
              iAmTurn ? "border-gold bg-gold text-background animate-pulse" : "border-gold/40 bg-gold/10 text-gold"
            }`}>
            <Sword size={12} className="shrink-0" />
            <div className="text-[11px] truncate flex-1">
              {iAmTurn ? "Seu turno" : "Aguardando"} · {c?.nickname ?? "…"}
            </div>
          </Link>
        );
      })}
    </div>
  );
}