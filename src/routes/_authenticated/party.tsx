import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { respondPartyInvite, leaveParty, disbandParty } from "@/lib/party.functions";
import { toast } from "sonner";
import { Users, ArrowLeft, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/party")({ component: PartyPage });

type Char = { id: string; nickname: string; avatar_url: string | null; current_location_id: string | null };
type Invite = { id: string; party_id: string; from_character: { id: string; nickname: string; avatar_url: string | null } | null };

function PartyPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [me, setMe] = useState<Char | null>(null);
  const [members, setMembers] = useState<Char[]>([]);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const respond = useServerFn(respondPartyInvite);
  const leave = useServerFn(leaveParty);
  const disband = useServerFn(disbandParty);

  async function load() {
    const { data: c } = await supabase.from("characters").select("id,nickname,avatar_url,current_location_id").eq("user_id", user.id).maybeSingle();
    if (!c) { setLoading(false); return; }
    setMe(c as Char);

    const { data: inv } = await supabase
      .from("party_invites")
      .select("id,party_id,from_character:characters!party_invites_from_character_id_fkey(id,nickname,avatar_url)")
      .eq("to_character_id", c.id).eq("status", "pending");
    setInvites((inv as any[]) ?? []);

    let partyId: string | null = null;
    let leader: string | null = null;
    const { data: mem } = await supabase.from("party_members").select("party_id").eq("character_id", c.id).maybeSingle();
    if (mem) partyId = (mem as any).party_id;
    if (!partyId) {
      const { data: led } = await supabase.from("parties").select("id,leader_id").eq("leader_id", c.id).maybeSingle();
      if (led) { partyId = (led as any).id; leader = (led as any).leader_id; }
    }
    if (!partyId) { setMembers([]); setLeaderId(null); setLoading(false); return; }
    if (!leader) {
      const { data: p } = await supabase.from("parties").select("leader_id").eq("id", partyId).maybeSingle();
      leader = (p as any)?.leader_id ?? null;
    }
    setLeaderId(leader);
    const { data: memRows } = await supabase.from("party_members")
      .select("character:characters(id,nickname,avatar_url,current_location_id)").eq("party_id", partyId);
    let list = ((memRows as any[]) ?? []).map((r) => r.character).filter(Boolean) as Char[];
    if (leader && !list.some((x) => x.id === leader)) {
      const { data: lc } = await supabase.from("characters").select("id,nickname,avatar_url,current_location_id").eq("id", leader).maybeSingle();
      if (lc) list = [lc as Char, ...list];
    }
    setMembers(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user.id]);
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel(`party-page-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_invites" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_members" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
     
  }, [me?.id]);

  if (loading) return <div className="p-10 text-muted-foreground text-center">Consultando o time…</div>;
  if (!me) return <div className="p-10 text-muted-foreground text-center">Crie um personagem primeiro.</div>;

  const isLeader = leaderId === me.id;
  const inParty = members.length > 0;

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-4 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild><Link to="/chat"><ArrowLeft size={14} className="mr-1" /> Voltar</Link></Button>
        <h1 className="font-display text-xl sm:text-2xl text-gold flex items-center gap-2 min-w-0"><Users size={18} className="shrink-0" /> <span className="truncate">Meu Time</span></h1>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => { router.invalidate(); load(); }}><RefreshCw size={14} /></Button>
      </div>

      {invites.length > 0 && (
        <div className="scroll-panel rounded-lg p-4 space-y-2">
          <h2 className="font-display text-lg">Convites pendentes</h2>
          {invites.map((iv) => (
            <div key={iv.id} className="flex items-center gap-2 border-b border-border last:border-0 py-2 flex-wrap">
              <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0">
                {iv.from_character?.avatar_url && <img src={iv.from_character.avatar_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="flex-1 text-sm min-w-0 truncate"><b>{iv.from_character?.nickname ?? "?"}</b> te convidou.</div>
              <Button size="sm" onClick={async () => { try { await respond({ data: { invite_id: iv.id, accept: true } }); toast.success("Você entrou no time."); load(); } catch (e: any) { toast.error(e.message); } }}>Aceitar</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await respond({ data: { invite_id: iv.id, accept: false } }); load(); }}>Recusar</Button>
            </div>
          ))}
        </div>
      )}

      <div className="scroll-panel rounded-lg p-4 space-y-3">
        {inParty ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Membros ({members.length}/3)</h2>
              {isLeader
                ? <span className="text-xs text-gold">Você é o líder</span>
                : <span className="text-xs text-muted-foreground">Líder: {members.find((m) => m.id === leaderId)?.nickname ?? "?"}</span>}
            </div>
            <div className="grid gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 border border-border rounded p-2">
                  <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden">
                    {m.avatar_url && <img src={m.avatar_url} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{m.nickname} {m.id === leaderId && <span className="text-gold">★</span>} {m.id === me.id && <span className="text-[10px] text-gold">(você)</span>}</div>
                    <div className="text-[11px] text-muted-foreground">{m.current_location_id === me.current_location_id ? "No mesmo local" : "Em outro local"}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {isLeader ? (
                <Button variant="destructive" size="sm" onClick={async () => {
                  if (!confirm("Dissolver o time? Todos os membros serão removidos.")) return;
                  try { await disband({}); toast.success("Time dissolvido."); load(); } catch (e: any) { toast.error(e.message); }
                }}>Dissolver time</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={async () => {
                  try { await leave({}); toast.success("Você saiu do time."); load(); } catch (e: any) { toast.error(e.message); }
                }}>Sair do time</Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Você não está em nenhum time. No chat, clique no avatar de outro jogador presente no mesmo local para convidá-lo.
          </div>
        )}
      </div>
    </div>
  );
}