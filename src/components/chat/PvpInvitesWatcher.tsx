import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@tanstack/react-router";
import { Sword, X, Check, Clock, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

export function PvpInvitesWatcher() {
  const [myId, setMyId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Row[]>([]);
  const [chars, setChars] = useState<Record<string, CharMini>>({});
  const [nowTick, setNowTick] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const prevIncoming = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const respond = useServerFn(respondDuel);
  const cancel = useServerFn(cancelDuel);

  async function refresh(cid: string) {
    const { data } = await supabase.from("pvp_duels")
      .select("id,challenger_id,opponent_id,status,current_turn_character_id,created_at")
      .in("status", ["pending", "active"])
      .or(`challenger_id.eq.${cid},opponent_id.eq.${cid}`)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Row[];
    // Filtra convites pendentes expirados (>2min) — o backend também expira ao responder/criar.
    const filtered = rows.filter((r) => {
      if (r.status !== "pending") return true;
      return Date.now() - new Date(r.created_at).getTime() < EXPIRE_MS;
    });
    setInvites(filtered);
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data: me } = await supabase.from("characters").select("id").eq("user_id", u.user.id).maybeSingle();
      if (!me?.id || cancelled) return;
      setMyId(me.id);
      await refresh(me.id);
      channel = supabase.channel(`pvp_watch_${me.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "pvp_duels" }, () => refresh(me.id));
      channel.subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Tick para atualizar o contador regressivo do convite.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Toca um "ping" quando chega um novo desafio direcionado a mim.
  useEffect(() => {
    if (!myId) return;
    const incoming = invites.filter((d) => d.status === "pending" && d.opponent_id === myId).map((d) => d.id);
    const incomingSet = new Set(incoming);
    const fresh = incoming.filter((id) => !prevIncoming.current.has(id));
    if (fresh.length) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = 660;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.6);
      } catch { /* ignore */ }
    }
    prevIncoming.current = incomingSet;
  }, [invites, myId]);

  const incoming = useMemo(
    () => invites.find((d) => d.status === "pending" && d.opponent_id === myId && !dismissed.has(d.id)) ?? null,
    [invites, myId, dismissed],
  );
  const outgoing = invites.filter((d) => d.status === "pending" && d.challenger_id === myId);
  const active = invites.filter((d) => d.status === "active");

  if (!myId) return null;

  const bar = (outgoing.length || active.length) ? (
    <div className="border-b border-gold/30 bg-gold/10">
      <div className="mx-auto max-w-6xl px-3 py-2 flex flex-wrap gap-2 text-xs">
        {outgoing.map((d) => {
          const other = chars[d.opponent_id]?.nickname ?? "…";
          const remain = Math.max(0, EXPIRE_MS - (Date.now() - new Date(d.created_at).getTime()));
          const secs = Math.ceil(remain / 1000);
          return (
            <div key={d.id} className="inline-flex items-center gap-2 rounded-full bg-background/60 border border-gold/40 px-3 py-1">
              <Loader2 size={12} className="animate-spin text-gold" />
              <span>Aguardando <b>{other}</b>...</span>
              <span className="text-muted-foreground flex items-center gap-1"><Clock size={10} />{secs}s</span>
              <button
                className="text-blood hover:underline"
                disabled={busy === d.id}
                onClick={async () => {
                  setBusy(d.id);
                  try { await cancel({ data: { duel_id: d.id } } as any); toast.success("Convite cancelado."); }
                  catch (e: any) { toast.error(e.message); }
                  finally { setBusy(null); }
                }}
              >Cancelar</button>
            </div>
          );
        })}
        {active.map((d) => {
          const iAmTurn = d.current_turn_character_id === myId;
          const otherId = d.challenger_id === myId ? d.opponent_id : d.challenger_id;
          const other = chars[otherId]?.nickname ?? "…";
          return (
            <Link key={d.id} to="/duel/$id" params={{ id: d.id }}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${iAmTurn ? "bg-gold text-background animate-pulse" : "bg-gold/20 text-gold"} hover:brightness-110`}>
              <Sword size={12} /> {iAmTurn ? `Seu turno contra ${other}` : `Duelo com ${other} — aguarde`}
            </Link>
          );
        })}
      </div>
    </div>
  ) : null;

  const remain = incoming ? Math.max(0, EXPIRE_MS - (Date.now() - new Date(incoming.created_at).getTime())) : 0;
  const secs = Math.ceil(remain / 1000);
  const challenger = incoming ? chars[incoming.challenger_id] : null;

  return (
    <>
      {bar}
      <Dialog
        open={!!incoming}
        onOpenChange={(v) => { if (!v && incoming) setDismissed((s) => new Set(s).add(incoming.id)); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sword className="text-blood" size={18} /> Desafio recebido
            </DialogTitle>
            <DialogDescription>
              Um shinobi te chama para um duelo. A oferta expira em <b>{secs}s</b>.
            </DialogDescription>
          </DialogHeader>
          {challenger && (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-secondary/40">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-background flex items-center justify-center">
                {challenger.avatar_url
                  ? <img src={challenger.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <Sword size={18} className="text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{challenger.nickname}</div>
                {challenger.rank && <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{challenger.rank.replace(/_/g, " ")}</div>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={async () => {
                if (!incoming) return;
                setBusy(incoming.id);
                try { await respond({ data: { duel_id: incoming.id, accept: false } } as any); toast("Convite recusado."); }
                catch (e: any) { toast.error(e.message); }
                finally { setBusy(null); }
              }}
            >
              <X size={14} className="mr-1" /> Recusar
            </Button>
            <Button
              disabled={!!busy}
              onClick={async () => {
                if (!incoming) return;
                setBusy(incoming.id);
                try {
                  await respond({ data: { duel_id: incoming.id, accept: true } } as any);
                  navigate({ to: "/duel/$id", params: { id: incoming.id } });
                } catch (e: any) { toast.error(e.message); }
                finally { setBusy(null); }
              }}
            >
              <Check size={14} className="mr-1" /> Aceitar
            </Button>
          </div>
          {/* nowTick usado para forçar rerender do contador */}
          <span className="hidden">{nowTick}</span>
        </DialogContent>
      </Dialog>
    </>
  );
}