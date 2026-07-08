import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, GripVertical, Minus, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { respondPartyInvite, leaveParty } from "@/lib/party.functions";
import { toast } from "sonner";

type Member = { id: string; nickname: string; avatar_url: string | null; current_location_id?: string | null };
type Invite = { id: string; from_character?: { nickname: string; avatar_url: string | null } | null };

type Props = {
  myCharId: string;
  myLocationId: string | null;
  members: Member[];
  leaderId: string | null;
  invites: Invite[];
};

const STORAGE_KEY = "party-popup-pos";

export function PartyPopup({ myCharId, myLocationId, members, leaderId, invites }: Props) {
  const respond = useServerFn(respondPartyInvite);
  const leave = useServerFn(leaveParty);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 16, y: 16 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return { x: Math.max(16, window.innerWidth - 280), y: Math.max(16, window.innerHeight - 260) };
  });
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos]);

  // Mantém o popup dentro da viewport em resize/rotação
  useEffect(() => {
    function clamp() {
      setPos((p) => ({
        x: Math.min(Math.max(0, p.x), window.innerWidth - 80),
        y: Math.min(Math.max(0, p.y), window.innerHeight - 40),
      }));
    }
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const nx = Math.min(Math.max(0, e.clientX - dragRef.current.dx), window.innerWidth - 60);
    const ny = Math.min(Math.max(0, e.clientY - dragRef.current.dy), window.innerHeight - 40);
    setPos({ x: nx, y: ny });
  }
  function onPointerUp() { dragRef.current = null; }

  const inParty = members.length > 0;

  return (
    <div
      className="fixed w-64 scroll-panel rounded-lg border border-gold/50 shadow-xl bg-card/95 backdrop-blur select-none"
      style={{ left: pos.x, top: pos.y, zIndex: 999 }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5 border-b border-border cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <GripVertical size={12} className="text-muted-foreground" />
        <Users size={12} className="text-gold" />
        <div className="text-xs font-display text-gold flex-1">
          Time {inParty ? `(${members.length}/3)` : ""}
          {invites.length > 0 && <span className="ml-1 text-[10px] bg-blood text-white rounded-full px-1.5">{invites.length}</span>}
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? <Plus size={12} /> : <Minus size={12} />}
        </Button>
      </div>

      {!collapsed && (
        <div className="p-2 space-y-2">
          {invites.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Convites</div>
              {invites.map((iv) => (
                <div key={iv.id} className="flex items-center gap-1.5 text-xs bg-secondary/40 rounded p-1.5">
                  <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden shrink-0">
                    {iv.from_character?.avatar_url && <img src={iv.from_character.avatar_url} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <span className="flex-1 truncate">{iv.from_character?.nickname ?? "?"}</span>
                  <Button size="sm" variant="secondary" className="h-6 text-[11px] px-2"
                    onClick={async () => { try { await respond({ data: { invite_id: iv.id, accept: true } }); toast.success("Você entrou no time."); } catch (e: any) { toast.error(e.message); } }}>OK</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
                    onClick={async () => { await respond({ data: { invite_id: iv.id, accept: false } }); }}>X</Button>
                </div>
              ))}
            </div>
          )}

          {inParty ? (
            <>
              <div className="space-y-1">
                {members.map((m) => {
                  const here = !!myLocationId && m.current_location_id === myLocationId;
                  return (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden shrink-0">
                        {m.avatar_url && <img src={m.avatar_url} className="w-full h-full object-cover" alt="" />}
                      </div>
                      <span className="truncate flex-1">{m.nickname}</span>
                      {m.id === leaderId && <span className="text-[10px] text-gold" title="Líder">★</span>}
                      <span className={`w-1.5 h-1.5 rounded-full ${here ? "bg-green-500" : "bg-muted-foreground/50"}`} title={here ? "Presente" : "Ausente"} />
                      {m.id === myCharId && <span className="text-[10px] text-gold">você</span>}
                    </div>
                  );
                })}
              </div>
              {leaderId === myCharId && (
                <div className="text-[10px] text-muted-foreground leading-tight">
                  Você é o líder. NPCs só aparecem se todos os membros estiverem no mesmo local.
                </div>
              )}
              <Button variant="ghost" size="sm" className="w-full h-7 text-[11px]"
                onClick={async () => { try { await leave({}); toast.success("Você saiu do time."); } catch (e: any) { toast.error(e.message); } }}>
                Sair do time
              </Button>
            </>
          ) : (
            invites.length === 0 && (
              <div className="text-[11px] text-muted-foreground leading-snug">
                Você não está em nenhum time. Clique no avatar de outro jogador no chat para convidá-lo (precisa estar no mesmo local).
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}