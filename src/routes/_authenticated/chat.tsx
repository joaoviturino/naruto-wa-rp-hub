import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { moveCharacter, sendLocationMessage, togglePinMessage } from "@/lib/chat.functions";
import { rollSpawn, getMyActiveCombat } from "@/lib/combat.functions";
import { MapPin, Send, ImagePlus, X, Compass, Skull, Users, Menu, Gamepad2, BookOpen, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { CombatDialog } from "@/components/chat/CombatDialog";
import { PlayerActionMenu } from "@/components/chat/PlayerActionMenu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { listMinigamesForMyLocation } from "@/lib/minigame.functions";
import { MinigameDialog } from "@/components/minigame/MinigameDialog";
import { NpcInteractPanel } from "@/components/chat/NpcInteractPanel";
import { DuelInvitesInline } from "@/components/chat/DuelInvitesInline";
import { ChatHud } from "@/components/chat/ChatHud";
import { MissionTracker } from "@/components/chat/MissionTracker";

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatPage });

const HISTORY_LIMIT = 80;

type Loc = { id: string; name: string; description: string | null; image_url: string | null;
  is_danger_zone?: boolean; spawn_chance?: number; spawn_tick_seconds?: number };
type Conn = { a_id: string; b_id: string };
type Character = { id: string; nickname: string; avatar_url: string | null; current_location_id: string | null };
type Scene = { id: string; image_url: string; label: string | null };
type Msg = {
  id: string; content: string; image_url: string | null; created_at: string;
  character_id: string; is_pinned?: boolean;
  character?: { nickname: string; avatar_url: string | null } | null;
};

function ChatPage() {
  const { user } = Route.useRouteContext();
  const [character, setCharacter] = useState<Character | null>(null);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [content, setContent] = useState("");
  const [scene, setScene] = useState<Scene | null>(null);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const move = useServerFn(moveCharacter);
  const sendMsg = useServerFn(sendLocationMessage);
  const roll = useServerFn(rollSpawn);
  const getCombat = useServerFn(getMyActiveCombat);
  const togglePin = useServerFn(togglePinMessage);
  const [combatId, setCombatId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ id: string; nickname: string; avatar_url: string | null } | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [partyMemberCount, setPartyMemberCount] = useState<number>(0);
  const [presentHere, setPresentHere] = useState<{ id: string; nickname: string; avatar_url: string | null }[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [availableMinigames, setAvailableMinigames] = useState<any[]>([]);
  const [activeMinigame, setActiveMinigame] = useState<any | null>(null);
  const listMg = useServerFn(listMinigamesForMyLocation);
  const [hasLibraryHere, setHasLibraryHere] = useState(false);
  const [pvpAtLocation, setPvpAtLocation] = useState<string | null>(null);

  async function loadCore() {
    const [{ data: c }, { data: l }, { data: cn }] = await Promise.all([
      supabase.from("characters").select("id,nickname,avatar_url,current_location_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("locations").select("id,name,description,image_url,is_danger_zone,spawn_chance,spawn_tick_seconds").order("name"),
      supabase.from("location_connections").select("a_id,b_id"),
    ]);
    setCharacter(c as Character | null);
    setLocs((l as Loc[]) ?? []);
    setConns((cn as Conn[]) ?? []);
    if (c) {
      const { data: s } = await supabase.from("scene_images").select("id,image_url,label").eq("character_id", c.id).order("created_at");
      setScenes((s as Scene[]) ?? []);
    }
  }
  useEffect(() => { loadCore(); }, [user.id]);

  async function refreshMinigames() {
    try { const r = await listMg({}); setAvailableMinigames(r.minigames ?? []); }
    catch { setAvailableMinigames([]); }
  }
  useEffect(() => { refreshMinigames(); }, [character?.current_location_id]);

  useEffect(() => {
    (async () => {
      if (!character?.current_location_id) { setHasLibraryHere(false); return; }
      const { data } = await supabase.from("location_libraries").select("section_id").eq("location_id", character.current_location_id).limit(1);
      setHasLibraryHere((data ?? []).length > 0);
    })();
  }, [character?.current_location_id]);

  // Convites de party e checagem inicial de combate
  async function loadInvites() {
    if (!character) return;
    const { data } = await supabase
      .from("party_invites")
      .select("id,party_id,from_character:characters!party_invites_from_character_id_fkey(id,nickname,avatar_url)")
      .eq("to_character_id", character.id).eq("status", "pending");
    setInvites((data as any[]) ?? []);
  }
  async function loadPartyMembers() {
    if (!character) return;
    let partyId: string | null = null;
    const { data: mem } = await supabase
      .from("party_members").select("party_id").eq("character_id", character.id).maybeSingle();
    if (mem) partyId = (mem as any).party_id;
    if (!partyId) {
      const { data: led } = await supabase
        .from("parties").select("id").eq("leader_id", character.id).maybeSingle();
      if (led) partyId = (led as any).id;
    }
    if (!partyId) { setPartyMemberCount(0); return; }
    const { count } = await supabase
      .from("party_members").select("*", { count: "exact", head: true }).eq("party_id", partyId);
    setPartyMemberCount(count ?? 0);
  }
  useEffect(() => {
    if (!character) return;
    async function checkCombat() {
      try {
        const r = await getCombat({});
        setCombatId((cur) => r.session ? (cur ?? r.session.id) : null);
      }
      catch { /* noop */ }
    }
    loadInvites(); loadPartyMembers(); checkCombat();
    const ch = supabase.channel(`invites-${character.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_invites" }, loadInvites)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_members" }, loadPartyMembers)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "characters" }, loadPartyMembers)
      .subscribe();
    // Fallback de polling (caso realtime falhe por rede/RLS)
    const poll = setInterval(() => { loadInvites(); loadPartyMembers(); checkCombat(); }, 3000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [character?.id]);

  // Polling de spawn na danger zone
  useEffect(() => {
    if (!character?.current_location_id) return;
    const cur = locs.find((l) => l.id === character.current_location_id);
    if (!cur?.is_danger_zone || !cur?.spawn_chance) return;
    let alive = true;
    async function tick() {
      if (!alive) return;
      try {
        const r = await roll({});
        if (r.session_id) setCombatId(r.session_id);
      } catch { /* noop */ }
    }
    tick();
    const tickMs = Math.max(15, cur.spawn_tick_seconds ?? 60) * 1000;
    const id = setInterval(tick, tickMs);
    return () => { alive = false; clearInterval(id); };
  }, [character?.current_location_id, locs.map((l) => `${l.id}:${l.spawn_chance}:${l.spawn_tick_seconds}:${l.is_danger_zone}`).join(",")]);

  const currentLoc = character?.current_location_id ? locs.find((l) => l.id === character.current_location_id) ?? null : null;
  const neighbors = currentLoc
    ? conns
        .filter((c) => c.a_id === currentLoc.id || c.b_id === currentLoc.id)
        .map((c) => locs.find((l) => l.id === (c.a_id === currentLoc.id ? c.b_id : c.a_id)))
        .filter(Boolean) as Loc[]
    : [];
  // Se ainda não tem local, mostra todos para escolher o inicial
  const availableToMove = character?.current_location_id ? neighbors : locs;

  async function loadMessages(locId: string) {
    const { data } = await supabase
      .from("location_messages")
      .select("id,content,image_url,created_at,character_id,is_pinned,character:characters(nickname,avatar_url)")
      .eq("location_id", locId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    setMessages(((data as Msg[]) ?? []).reverse());
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  useEffect(() => {
    if (!currentLoc) { setMessages([]); return; }
    loadMessages(currentLoc.id);
    const ch = supabase.channel(`loc-${currentLoc.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "location_messages", filter: `location_id=eq.${currentLoc.id}` },
        async (payload) => {
          const raw = payload.new as any;
          const { data: c } = await supabase.from("characters").select("nickname,avatar_url").eq("id", raw.character_id).maybeSingle();
          setMessages((prev) => (prev.some((m) => m.id === raw.id) ? prev : [...prev, { ...raw, character: c } as Msg]));
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "location_messages", filter: `location_id=eq.${currentLoc.id}` },
        (payload) => {
          const raw = payload.new as any;
          setMessages((prev) => prev.map((m) => m.id === raw.id ? { ...m, is_pinned: raw.is_pinned, content: raw.content, image_url: raw.image_url } : m));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentLoc?.id]);

  // Detecta duelo PvP ativo neste local (para travar chat e abrir espectador).
  useEffect(() => {
    if (!currentLoc || !character) { setPvpAtLocation(null); return; }
    async function refreshPvp() {
      const { data } = await supabase.from("combat_sessions")
        .select("id,state,status").eq("location_id", currentLoc!.id).eq("status", "active");
      const candidates = ((data as any[]) ?? []).filter((s) => s?.state?.mode === "pvp");
      let pvp = candidates[0] ?? null;
      if (pvp?.state?.duel_id) {
        const { data: duel } = await supabase.from("pvp_duels").select("status").eq("id", pvp.state.duel_id).maybeSingle();
        if (duel && duel.status !== "active") pvp = null;
      }
      const nextPvpId = pvp?.id ?? null;
      setPvpAtLocation((prev) => {
        if (!nextPvpId && prev) setCombatId((cur) => cur === prev ? null : cur);
        return nextPvpId;
      });
      // Auto-abre para o participante e para o espectador.
      if (nextPvpId) setCombatId(nextPvpId);
    }
    refreshPvp();
    const ch = supabase.channel(`pvp-loc-${currentLoc.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_sessions", filter: `location_id=eq.${currentLoc.id}` },
        () => refreshPvp())
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_duels" },
        () => refreshPvp())
      .subscribe();
    // Fallback: alguns celulares/webviews perdem realtime; isso garante que
    // o chat destrave assim que o duelo mudar para finished/fled.
    const poll = window.setInterval(refreshPvp, 1500);
    return () => { supabase.removeChannel(ch); window.clearInterval(poll); };
  }, [currentLoc?.id, character?.id]);

  // Presença em tempo real via Realtime Presence — instantâneo, sem depender de publication
  useEffect(() => {
    if (!currentLoc || !character) { setPresentHere([]); return; }
    const ch = supabase.channel(`presence-${currentLoc.id}`, {
      config: { presence: { key: character.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, any[]>;
      const list: { id: string; nickname: string; avatar_url: string | null }[] = [];
      const seen = new Set<string>();
      Object.values(state).flat().forEach((p: any) => {
        if (p?.id && !seen.has(p.id)) { seen.add(p.id); list.push({ id: p.id, nickname: p.nickname, avatar_url: p.avatar_url }); }
      });
      setPresentHere(list);
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ id: character.id, nickname: character.nickname, avatar_url: character.avatar_url });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [currentLoc?.id, character?.id]);

  async function doMove(locId: string) {
    try {
      await move({ data: { locationId: locId } });
      toast.success("Você chegou.");
      loadCore();
    } catch (e: any) { toast.error(e.message); }
  }

  async function doSend() {
    if (!currentLoc || sending) return;
    if (!content.trim() && !scene) return;
    setSending(true);
    try {
      await sendMsg({ data: { locationId: currentLoc.id, content, imageUrl: scene?.image_url ?? null } });
      setContent(""); setScene(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  }

  function closeCombatDialog() {
    const closingId = combatId;
    setCombatId(null);
    if (closingId && closingId === pvpAtLocation) setPvpAtLocation(null);
  }

  async function doTogglePin(id: string) {
    try {
      const r = await togglePin({ data: { messageId: id } });
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_pinned: r.pinned } : m));
      toast.success(r.pinned ? "Mensagem marcada." : "Marcação removida.");
    } catch (e: any) { toast.error(e.message); }
  }

  const pinned = messages.filter((m) => m.is_pinned);

  if (!character) return <div className="p-10 text-center text-muted-foreground">Você precisa criar um personagem primeiro.</div>;

  const sidebar = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
        <Button asChild variant="outline" size="sm" className="w-full justify-between h-auto py-2">
          <Link to="/party">
            <span className="flex items-center gap-1 min-w-0"><Users size={14} className="shrink-0" /> <span className="truncate">Meu time{partyMemberCount > 0 ? ` (${partyMemberCount})` : ""}</span></span>
            {invites.length > 0 && <span className="text-[10px] bg-blood text-white rounded-full px-1.5 shrink-0">{invites.length}</span>}
          </Link>
        </Button>
        <DuelInvitesInline />
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><MapPin size={12} /> Você está em</div>
        <div className="font-display text-xl text-gold flex items-center gap-2 min-w-0">
          <span className="truncate">{currentLoc?.name ?? "— nenhum local —"}</span>
          {currentLoc?.is_danger_zone && <span title="Zona de perigo — NPCs podem aparecer" className="shrink-0"><Skull size={16} className="text-blood" /></span>}
        </div>
        {currentLoc?.description && <p className="text-xs text-muted-foreground mt-1">{currentLoc.description}</p>}
      </div>

      {currentLoc && (
        <div className="border border-border rounded p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Users size={11} /> {presentHere.length} {presentHere.length === 1 ? "pessoa" : "pessoas"} no local
          </div>
          <div className="flex flex-wrap gap-1">
            {presentHere.slice(0, 5).map((p) => (
              <div key={p.id} title={p.nickname} className="w-6 h-6 rounded-full bg-secondary overflow-hidden ring-1 ring-border">
                {p.avatar_url && <img src={p.avatar_url} className="w-full h-full object-cover" alt={p.nickname} />}
              </div>
            ))}
            {presentHere.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-secondary ring-1 ring-border flex items-center justify-center text-[10px] text-muted-foreground">
                +{presentHere.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {currentLoc && availableMinigames.length > 0 && (
        <div className="border border-border rounded p-2 space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Gamepad2 size={11} /> Missões neste local
          </div>
          <div className="space-y-1">
            {availableMinigames.map((m: any) => {
              const ready = (m.cooldown_remaining_ms ?? 0) <= 0;
              const remH = Math.ceil((m.cooldown_remaining_ms ?? 0) / 3600000);
              const remM = Math.ceil((m.cooldown_remaining_ms ?? 0) / 60000);
              return (
                <Button key={m.id} size="sm" variant={ready ? "default" : "outline"} className="w-full justify-start"
                  disabled={!ready} onClick={() => setActiveMinigame(m)}>
                  <Gamepad2 size={12} className="mr-1" />
                  <span className="truncate flex-1 text-left">{m.name}</span>
                  {!ready && <span className="text-[10px] text-muted-foreground ml-1">{remH >= 1 ? `${remH}h` : `${remM}m`}</span>}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {currentLoc && <NpcInteractPanel locationId={currentLoc.id} />}

      {currentLoc && hasLibraryHere && (
        <Link to="/library" search={{ location: currentLoc.id }}>
          <Button size="sm" variant="outline" className="w-full justify-start">
            <BookOpen size={12} className="mr-1 text-gold" /> Biblioteca deste local
          </Button>
        </Link>
      )}

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2"><Compass size={12} /> {character.current_location_id ? "Locais próximos" : "Escolha onde iniciar"}</div>
        <div className="space-y-1">
          {availableToMove.length === 0 && <div className="text-xs text-muted-foreground">Sem locais acessíveis daqui.</div>}
          {availableToMove.map((l) => (
            <button key={l.id} onClick={() => { doMove(l.id); setNavOpen(false); }}
              className="w-full text-left p-2 rounded hover:bg-secondary text-sm flex items-center gap-2 min-w-0">
              {l.image_url && <img src={l.image_url} className="w-8 h-8 rounded object-cover shrink-0" alt="" />}
              <span className="flex-1 truncate">{l.name}</span>
              {l.is_danger_zone && <Skull size={12} className="text-blood shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl md:grid md:gap-4 md:grid-cols-[280px_1fr] md:p-4">
      {character && <ChatHud characterId={character.id} />}
      {character && <MissionTracker characterId={character.id} />}
      {/* HUD mobile (barra superior) */}
      {character && (
        <div className="md:hidden">
          <ChatHud characterId={character.id} variant="mobile-bar" />
        </div>
      )}
      {/* Barra mobile */}
      <div className="md:hidden sticky top-[44px] z-30 flex items-center gap-2 border-b border-border bg-card/95 backdrop-blur px-3 py-2">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8"><Menu size={16} /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
            <div className="pt-6">{sidebar}</div>
          </SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Local</div>
          <div className="font-display text-sm text-gold truncate flex items-center gap-1">
            <span className="truncate">{currentLoc?.name ?? "— nenhum —"}</span>
            {currentLoc?.is_danger_zone && <Skull size={12} className="text-blood shrink-0" />}
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-muted-foreground flex items-center gap-1"><Users size={11} /> {presentHere.length}</div>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link to="/party">
            <Users size={12} className="mr-1" /> Time{partyMemberCount > 0 ? ` ${partyMemberCount}` : ""}
            {invites.length > 0 && <span className="ml-1 text-[10px] bg-blood text-white rounded-full px-1.5">{invites.length}</span>}
          </Link>
        </Button>
      </div>

      {/* Mapa lateral desktop */}
      <aside className="hidden md:block scroll-panel rounded-lg p-4 md:h-[calc(100vh-8rem)] md:overflow-y-auto">
        {sidebar}
      </aside>

      {/* Chat */}
      <section className="scroll-panel md:rounded-lg flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100vh-8rem)]">
        {!currentLoc ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-10 text-center">
            Escolha um local ao lado para começar a interagir.
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="border-b border-border bg-card/50 p-2 max-h-32 overflow-y-auto space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-gold flex items-center gap-1"><Pin size={11} /> Marcadas ({pinned.length})</div>
                {pinned.map((m) => (
                  <div key={m.id} className="text-xs flex items-start gap-2 rounded p-1 hover:bg-secondary/50">
                    <span className="text-gold font-display shrink-0">{m.character?.nickname ?? "?"}:</span>
                    <span className="truncate flex-1">{m.content || (m.image_url ? "[imagem]" : "")}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
              {messages.length === 0 && <div className="text-center text-xs text-muted-foreground py-10">Silêncio. Seja o primeiro a agir.</div>}
              {messages.map((m) => {
                const mine = m.character_id === character.id;
                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    <button
                      className="w-8 h-8 rounded-full bg-secondary overflow-hidden shrink-0 hover:ring-2 hover:ring-gold transition"
                      title={mine ? "Você" : `Interagir com ${m.character?.nickname ?? ""}`}
                      disabled={mine}
                      onClick={() => { if (mine) return; setTarget({ id: m.character_id, nickname: m.character?.nickname ?? "?", avatar_url: m.character?.avatar_url ?? null }); setTargetOpen(true); }}>
                      {m.character?.avatar_url && <img src={m.character.avatar_url} className="w-full h-full object-cover" alt="" />}
                    </button>
                    <div className={`group max-w-[75%] rounded-lg p-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"} ${m.is_pinned ? "ring-2 ring-gold" : ""}`}>
                      <div className={`text-[10px] font-display ${mine ? "text-primary-foreground/70" : "text-gold"}`}>{m.character?.nickname ?? "?"}</div>
                      {m.image_url && <img src={m.image_url} className="mt-1 rounded max-h-64 object-cover" alt="" />}
                      {m.content && <div className="whitespace-pre-wrap text-sm mt-1">{m.content}</div>}
                      <div className={`text-[10px] mt-1 flex items-center gap-2 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        <span>{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {mine && (
                          <button onClick={() => doTogglePin(m.id)}
                            title={m.is_pinned ? "Desmarcar" : "Marcar mensagem"}
                            className="opacity-60 hover:opacity-100 transition">
                            {m.is_pinned ? <PinOff size={11} /> : <Pin size={11} />}
                          </button>
                        )}
                        {m.is_pinned && !mine && <Pin size={11} className="text-gold" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {scene && (
              <div className="border-t border-border p-2 flex items-center gap-2 bg-card/50">
                <img src={scene.image_url} className="w-14 h-14 object-cover rounded" alt="" />
                <div className="text-xs flex-1 truncate">{scene.label ?? "Cena anexada"}</div>
                <Button variant="ghost" size="icon" onClick={() => setScene(null)}><X size={14} /></Button>
              </div>
            )}

            <div className="border-t border-border p-3 flex gap-2 items-end">
              {pvpAtLocation && (
                <div className="absolute left-0 right-0 -translate-y-full text-center text-xs bg-blood/20 border-t border-blood text-blood py-1">
                  ⚔ Duelo em andamento — chat travado neste local.
                </div>
              )}
              <Dialog open={sceneOpen} onOpenChange={setSceneOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" title="Anexar cena" disabled={!!pvpAtLocation}><ImagePlus size={16} /></Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Escolha uma cena ({scenes.length}/10)</DialogTitle></DialogHeader>
                  {scenes.length === 0
                    ? <div className="text-sm text-muted-foreground p-4">Você ainda não enviou nenhuma cena. Vá em <b>Ficha → Configurações de cenas</b> para adicionar.</div>
                    : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
                        {scenes.map((s) => (
                          <button key={s.id} onClick={() => { setScene(s); setSceneOpen(false); }}
                            className="rounded overflow-hidden hover:ring-2 hover:ring-gold">
                            <img src={s.image_url} className="w-full h-28 object-cover" alt="" />
                            {s.label && <div className="text-[10px] truncate p-1">{s.label}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                </DialogContent>
              </Dialog>
              <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)}
                placeholder={pvpAtLocation ? "Chat travado durante o duelo." : "Descreva sua ação, fale…"}
                disabled={!!pvpAtLocation}
                className="resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }} />
              <Button onClick={doSend} disabled={sending || !!pvpAtLocation || (!content.trim() && !scene)}><Send size={16} /></Button>
            </div>
          </>
        )}
      </section>

      <PlayerActionMenu target={target} open={targetOpen} onOpenChange={setTargetOpen} />
      {combatId && character && (
        <CombatDialog sessionId={combatId} myCharId={character.id} onClose={closeCombatDialog} />
      )}
      {activeMinigame && (
        <MinigameDialog minigame={activeMinigame} open onOpenChange={(v) => { if (!v) setActiveMinigame(null); }}
          onCompleted={refreshMinigames} />
      )}
    </div>
  );
}