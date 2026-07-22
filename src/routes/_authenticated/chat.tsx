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
import { TradeWatcher } from "@/components/chat/TradeDialog";
import { ActionHotkey } from "@/components/chat/ActionHotkey";
import { Minimap } from "@/components/chat/Minimap";

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatPage });

const HISTORY_LIMIT = 80;

/** Formata linhas de RP: "❕️ ..." = ação (itálico, mutado), "- ..." = fala (destaque). */
function RpFormatted({ text, mine, isNpc }: { text: string; mine: boolean; isNpc: boolean }) {
  const lines = text.split(/\r?\n/);
  const speechColor = mine ? "text-white" : "text-foreground";
  const actionColor = mine ? "text-white/70" : "text-muted-foreground";
  // Se o texto tem múltiplos marcadores "❕️" ou "- " colados na mesma linha, quebra também por eles.
  const parts: { kind: "action" | "speech" | "plain"; content: string }[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { parts.push({ kind: "plain", content: "" }); continue; }
    // Divide por marcadores no meio da linha
    const chunks = line.split(/(?=❕️?\s)|(?=(?:^|\s)-\s)/g).map((s) => s.trim()).filter(Boolean);
    for (const c of chunks) {
      if (/^❕️?\s*/.test(c)) parts.push({ kind: "action", content: c.replace(/^❕️?\s*/, "") });
      else if (/^-\s+/.test(c)) parts.push({ kind: "speech", content: c.replace(/^-\s+/, "") });
      else parts.push({ kind: "plain", content: c });
    }
  }
  return (
    <div className="text-sm leading-relaxed break-words space-y-1">
      {parts.map((p, i) => {
        if (p.kind === "action") return (
          <div key={i} className={`italic ${actionColor} flex gap-1.5`}>
            <span className="opacity-60 shrink-0">❕️</span><span>{p.content}</span>
          </div>
        );
        if (p.kind === "speech") return (
          <div key={i} className={`${speechColor} flex gap-1.5`}>
            <span className="shrink-0 opacity-60">—</span>
            <span>{p.content}</span>
          </div>
        );
        return <div key={i} className={speechColor}>{p.content}</div>;
      })}
    </div>
  );
}

type Loc = { id: string; name: string; description: string | null; image_url: string | null;
  is_danger_zone?: boolean; spawn_chance?: number; spawn_tick_seconds?: number;
  map_x?: number; map_y?: number; parent_id?: string | null };
type Conn = { a_id: string; b_id: string };
type Character = { id: string; nickname: string; avatar_url: string | null; current_location_id: string | null };
type Scene = { id: string; image_url: string; label: string | null };
type Msg = {
  id: string; content: string; image_url: string | null; created_at: string;
  character_id: string | null; npc_id?: string | null; is_pinned?: boolean;
  character?: { nickname: string; avatar_url: string | null } | null;
  npc?: { name: string; image_url: string | null } | null;
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
      supabase.from("locations").select("id,name,description,image_url,is_danger_zone,spawn_chance,spawn_tick_seconds,map_x,map_y,parent_id").order("name"),
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
    const ch = supabase.channel(`invites-${character.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_invites" }, loadInvites)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_members" }, loadPartyMembers)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "characters" }, loadPartyMembers)
      .subscribe();
    // Fallback de polling (caso realtime falhe por rede/RLS) — realtime é o caminho principal.
    const poll = setInterval(() => { loadInvites(); loadPartyMembers(); checkCombat(); }, 10000);
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
      .select("id,content,image_url,created_at,character_id,npc_id,is_pinned,character:characters(nickname,avatar_url),npc:npcs!location_messages_npc_id_fkey(name,image_url)")
      .eq("location_id", locId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    setMessages(((data as Msg[]) ?? []).reverse());
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  useEffect(() => {
    if (!currentLoc) { setMessages([]); return; }
    loadMessages(currentLoc.id);
    const ch = supabase.channel(`loc-${currentLoc.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "location_messages", filter: `location_id=eq.${currentLoc.id}` },
        async (payload) => {
          const raw = payload.new as any;
          let character: any = null; let npc: any = null;
          if (raw.npc_id) {
            const { data: n } = await supabase.from("npcs").select("name,image_url").eq("id", raw.npc_id).maybeSingle();
            npc = n;
          } else if (raw.character_id) {
            const { data: c } = await supabase.from("characters").select("nickname,avatar_url").eq("id", raw.character_id).maybeSingle();
            character = c;
          }
          setMessages((prev) => (prev.some((m) => m.id === raw.id) ? prev : [...prev, { ...raw, character, npc } as Msg]));
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
    const ch = supabase.channel(`pvp-loc-${currentLoc.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_sessions", filter: `location_id=eq.${currentLoc.id}` },
        () => refreshPvp())
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_duels" },
        () => refreshPvp())
      .subscribe();
    // Fallback: alguns celulares/webviews perdem realtime; isso garante que
    // o chat destrave assim que o duelo mudar para finished/fled.
    const poll = window.setInterval(refreshPvp, 6000);
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

  const SectionLabel = ({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) => (
    <div className="flex items-center gap-2 mb-2">
      <div className="text-[10px] font-display uppercase tracking-[0.2em] text-gold/80 flex items-center gap-1.5">
        {Icon && <Icon size={11} />} {children}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-blood/40 to-transparent" />
    </div>
  );

  const sidebar = (
    <div className="space-y-5">
      {/* Localização atual */}
      <div className="relative rounded-xl border border-blood/30 bg-gradient-to-b from-blood/10 to-transparent p-4 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse shadow-[0_0_8px_var(--gold)]" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-gold/80 font-bold">Localização Atual</span>
        </div>
        <div className="font-display text-lg text-gold flex items-center gap-2 min-w-0 leading-tight">
          <span className="truncate">{currentLoc?.name ?? "— sem local —"}</span>
          {currentLoc?.is_danger_zone && <Skull size={14} className="text-blood shrink-0" />}
        </div>
        {currentLoc?.description && <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{currentLoc.description}</p>}
      </div>

      {/* Minimapa */}
      {currentLoc && (
        <div>
          <SectionLabel icon={Compass}>Minimapa</SectionLabel>
          <div className="rounded-xl border border-border/60 bg-black/40 overflow-hidden">
            <Minimap
              locations={locs as any}
              connections={conns}
              currentLocationId={currentLoc.id}
              onSelect={(id) => { if (neighbors.some((n) => n.id === id)) doMove(id); }}
            />
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="sm" className="justify-between h-9 border-blood/40 bg-blood/10 hover:bg-blood/20 text-blood hover:text-blood">
          <Link to="/party">
            <span className="flex items-center gap-1.5 min-w-0"><Users size={13} className="shrink-0" /> <span className="truncate text-[11px] font-bold uppercase tracking-wide">Time{partyMemberCount > 0 ? ` ${partyMemberCount}` : ""}</span></span>
            {invites.length > 0 && <span className="text-[10px] bg-blood text-white rounded-full px-1.5 shrink-0">{invites.length}</span>}
          </Link>
        </Button>
        <div className="[&>*]:h-9 [&>*]:w-full">
          <DuelInvitesInline />
        </div>
      </div>

      {/* Pessoas presentes */}
      {currentLoc && (
        <div>
          <SectionLabel icon={Users}>{presentHere.length} {presentHere.length === 1 ? "shinobi" : "shinobis"} no local</SectionLabel>
          <div className="rounded-xl border border-border/60 bg-card/40 p-2.5">
            {presentHere.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic px-1">Ninguém por aqui além de você.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {presentHere.slice(0, 8).map((p) => (
                  <div key={p.id} title={p.nickname} className="w-7 h-7 rounded-full bg-secondary overflow-hidden ring-1 ring-border hover:ring-gold transition">
                    {p.avatar_url && <img src={p.avatar_url} className="w-full h-full object-cover" alt={p.nickname} />}
                  </div>
                ))}
                {presentHere.length > 8 && (
                  <div className="w-7 h-7 rounded-full bg-secondary ring-1 ring-border flex items-center justify-center text-[10px] text-muted-foreground">
                    +{presentHere.length - 8}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Missões */}
      {currentLoc && availableMinigames.length > 0 && (
        <div>
          <SectionLabel icon={Gamepad2}>Missões neste local</SectionLabel>
          <div className="space-y-1.5">
            {availableMinigames.map((m: any) => {
              const ready = (m.cooldown_remaining_ms ?? 0) <= 0;
              const remH = Math.ceil((m.cooldown_remaining_ms ?? 0) / 3600000);
              const remM = Math.ceil((m.cooldown_remaining_ms ?? 0) / 60000);
              return (
                <button key={m.id} disabled={!ready} onClick={() => setActiveMinigame(m)}
                  className={`group w-full flex items-center gap-2 p-2.5 rounded-lg border transition text-left ${ready ? "border-gold/30 bg-gold/5 hover:bg-gold/10 hover:border-gold/60" : "border-border/40 bg-card/30 opacity-60 cursor-not-allowed"}`}>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ready ? "bg-gold/20 text-gold" : "bg-secondary text-muted-foreground"}`}><Gamepad2 size={13} /></div>
                  <span className="flex-1 truncate text-xs font-medium">{m.name}</span>
                  <span className={`text-[10px] shrink-0 ${ready ? "text-gold" : "text-muted-foreground"}`}>{ready ? "PRONTO" : (remH >= 1 ? `${remH}h` : `${remM}m`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* NPCs */}
      {currentLoc && <NpcInteractPanel locationId={currentLoc.id} />}

      {currentLoc && hasLibraryHere && (
        <Link to="/library" search={{ location: currentLoc.id }}
          className="flex items-center gap-2 p-2.5 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/10 transition">
          <BookOpen size={14} className="text-gold shrink-0" />
          <span className="text-xs font-medium flex-1">Biblioteca deste local</span>
        </Link>
      )}

      {/* Movimento */}
      <div>
        <SectionLabel icon={Compass}>{character.current_location_id ? "Locais próximos" : "Escolha onde iniciar"}</SectionLabel>
        <div className="space-y-1">
          {availableToMove.length === 0 && <div className="text-xs text-muted-foreground italic px-1">Sem locais acessíveis daqui.</div>}
          {availableToMove.map((l) => (
            <button key={l.id} onClick={() => { doMove(l.id); setNavOpen(false); }}
              className="w-full text-left p-2 rounded-lg border border-transparent hover:border-blood/40 hover:bg-blood/5 transition text-sm flex items-center gap-2.5 min-w-0 group">
              {l.image_url
                ? <img src={l.image_url} className="w-8 h-8 rounded-md object-cover shrink-0 ring-1 ring-border" alt="" />
                : <div className="w-8 h-8 rounded-md bg-secondary shrink-0 flex items-center justify-center text-muted-foreground group-hover:text-gold transition"><MapPin size={13} /></div>}
              <span className="flex-1 truncate text-xs">{l.name}</span>
              {l.is_danger_zone && <Skull size={12} className="text-blood shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl md:grid md:gap-4 md:grid-cols-[300px_1fr] md:p-4 pb-[env(safe-area-inset-bottom)]">
      {character && <ChatHud characterId={character.id} />}
      {character && <MissionTracker characterId={character.id} />}
      {character && <TradeWatcher myCharacterId={character.id} />}
      {/* HUD mobile (barra superior) */}
      {character && (
        <div className="md:hidden">
          <ChatHud characterId={character.id} variant="mobile-bar" />
        </div>
      )}
      {/* Barra mobile */}
      <div className="md:hidden sticky top-[54px] z-30 flex items-center gap-2 border-b border-blood/20 bg-card/95 backdrop-blur px-2 py-2">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 border-blood/30"><Menu size={16} /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto p-4">
            <div className="pt-4">{sidebar}</div>
          </SheetContent>
        </Sheet>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.2em] text-gold/70 font-bold">Localização</div>
          <div className="font-display text-sm text-gold truncate flex items-center gap-1 leading-tight">
            <span className="truncate">{currentLoc?.name ?? "— nenhum —"}</span>
            {currentLoc?.is_danger_zone && <Skull size={12} className="text-blood shrink-0" />}
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-muted-foreground flex items-center gap-1 px-1.5 py-1 rounded-full bg-secondary/60"><Users size={11} /> {presentHere.length}</div>
        <Button asChild variant="outline" size="sm" className="h-9 px-2 shrink-0 border-blood/30">
          <Link to="/party">
            <Users size={12} className="mr-1" />
            <span className="hidden xs:inline">Time</span>
            {partyMemberCount > 0 ? <span className="ml-0.5">{partyMemberCount}</span> : null}
            {invites.length > 0 && <span className="ml-1 text-[10px] bg-blood text-white rounded-full px-1.5">{invites.length}</span>}
          </Link>
        </Button>
      </div>

      {/* Mapa lateral desktop */}
      <aside className="hidden md:block scroll-panel rounded-xl p-4 md:h-[calc(100vh-8rem)] md:overflow-y-auto no-scrollbar">
        {sidebar}
      </aside>

      {/* Chat */}
      <section className="scroll-panel md:rounded-xl flex flex-col h-[calc(100dvh-9rem)] md:h-[calc(100vh-8rem)] relative overflow-hidden">
        {!currentLoc ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 text-center gap-3">
            <Compass size={40} className="text-gold/40" />
            <div className="font-display text-lg text-gold">O caminho aguarda</div>
            <div className="text-xs max-w-xs">Escolha um local ao lado para começar sua jornada e interagir com outros shinobis.</div>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="border-b border-gold/20 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent p-2.5 max-h-32 overflow-y-auto space-y-1 no-scrollbar">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold flex items-center gap-1.5"><Pin size={11} /> Marcadas · {pinned.length}</div>
                {pinned.map((m) => (
                  <div key={m.id} className="text-xs flex items-start gap-2 rounded p-1 hover:bg-secondary/50">
                    <span className={`font-display shrink-0 ${m.npc_id ? "text-emerald-300" : "text-gold"}`}>{m.npc_id ? (m.npc?.name ?? "NPC") : (m.character?.nickname ?? "?")}:</span>
                    <span className="truncate flex-1">{m.content || (m.image_url ? "[imagem]" : "")}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-1">
              {messages.length === 0 && (
                <div className="text-center py-14 space-y-2">
                  <div className="text-3xl opacity-30">忍</div>
                  <div className="text-xs text-muted-foreground italic">Silêncio absoluto. Seja o primeiro a agir.</div>
                </div>
              )}
              {messages.map((m, idx) => {
                const mine = !!m.character_id && m.character_id === character.id;
                const isNpc = !!m.npc_id;
                const isSystem = !!m.content && (m.content.startsWith("❕️") || m.content.startsWith("❕"));
                const displayName = isNpc ? (m.npc?.name ?? "NPC") : (m.character?.nickname ?? "?");
                const avatarUrl = isNpc ? m.npc?.image_url : m.character?.avatar_url;
                const prev = messages[idx - 1];
                const prevSame = prev && !isSystem && prev.character_id === m.character_id && prev.npc_id === m.npc_id
                  && !(prev.content?.startsWith("❕"));
                const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                // Mensagens de sistema — divisor discreto
                if (isSystem) {
                  return (
                    <div key={m.id} className="flex items-center gap-2 py-2 px-2 my-1">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                      <div className="text-[11px] text-gold/70 italic font-display flex items-center gap-1.5 px-2">
                        <span className="text-gold">•</span>
                        <span>{m.content.replace(/^❕️?\s*/, "")}</span>
                        <span className="text-muted-foreground text-[9px]">· {time}</span>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/20 to-transparent" />
                    </div>
                  );
                }

                return (
                  <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""} ${prevSame ? "mt-0.5" : "mt-3"}`}>
                    {prevSame ? (
                      <div className="w-9 shrink-0" />
                    ) : (
                      <button
                        className={`w-9 h-9 rounded-full bg-secondary overflow-hidden shrink-0 transition ring-2 ${isNpc ? "ring-emerald-500/60" : mine ? "ring-blood/50" : "ring-transparent hover:ring-gold"}`}
                        title={mine ? "Você" : (isNpc ? `NPC: ${displayName}` : `Interagir com ${displayName}`)}
                        disabled={mine || isNpc}
                        onClick={() => {
                          if (mine || isNpc || !m.character_id) return;
                          setTarget({ id: m.character_id, nickname: m.character?.nickname ?? "?", avatar_url: m.character?.avatar_url ?? null });
                          setTargetOpen(true);
                        }}>
                        {avatarUrl
                          ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-display">{displayName[0]?.toUpperCase()}</div>}
                      </button>
                    )}
                    <div className={`group max-w-[78%] min-w-0 ${mine ? "items-end text-right" : "items-start"} flex flex-col`}>
                      {!prevSame && (
                        <div className={`flex items-center gap-1.5 mb-0.5 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                          <span className={`text-[11px] font-display font-bold ${isNpc ? "text-emerald-300" : mine ? "text-blood" : "text-gold"}`}>{displayName}</span>
                          {isNpc && <span className="text-[9px] px-1 py-px rounded bg-emerald-500/20 text-emerald-300 uppercase tracking-wider">NPC</span>}
                          <span className="text-[9px] text-muted-foreground">{time}</span>
                        </div>
                      )}
                      <div className={`relative rounded-2xl px-3 py-2 shadow-sm ${
                        mine
                          ? "bg-gradient-to-br from-blood to-blood/70 text-white rounded-tr-sm"
                          : isNpc
                            ? "bg-emerald-950/50 border border-emerald-500/30 rounded-tl-sm"
                            : "bg-secondary/80 border border-border/50 rounded-tl-sm"
                        } ${m.is_pinned ? "ring-2 ring-gold/70" : ""}`}>
                        {m.image_url && <img src={m.image_url} className="mb-1 rounded-lg max-h-64 object-cover" alt="" />}
                        {m.content && <RpFormatted text={m.content} mine={mine} isNpc={isNpc} />}
                        {(mine || m.is_pinned) && (
                          <div className={`absolute -bottom-1 ${mine ? "left-2" : "right-2"} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition`}>
                            {mine && (
                              <button onClick={() => doTogglePin(m.id)}
                                title={m.is_pinned ? "Desmarcar" : "Marcar"}
                                className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center hover:bg-gold/20 hover:border-gold text-muted-foreground hover:text-gold transition">
                                {m.is_pinned ? <PinOff size={10} /> : <Pin size={10} />}
                              </button>
                            )}
                          </div>
                        )}
                        {m.is_pinned && (
                          <div className={`absolute -top-1.5 ${mine ? "-left-1.5" : "-right-1.5"} w-4 h-4 rounded-full bg-gold flex items-center justify-center shadow-md`}>
                            <Pin size={9} className="text-black" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {scene && (
              <div className="border-t border-gold/20 p-2 flex items-center gap-2 bg-gold/5">
                <img src={scene.image_url} className="w-14 h-14 object-cover rounded-lg ring-1 ring-gold/40" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-gold font-bold">Cena anexada</div>
                  <div className="text-xs truncate">{scene.label ?? "Sem título"}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setScene(null)}><X size={14} /></Button>
              </div>
            )}

            {pvpAtLocation && (
              <div className="border-t border-blood bg-gradient-to-r from-blood/30 via-blood/10 to-blood/30 text-center text-xs text-blood py-1.5 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <span className="animate-pulse">⚔</span> Duelo em andamento · chat travado <span className="animate-pulse">⚔</span>
              </div>
            )}
            <div className="border-t border-blood/20 bg-card/60 backdrop-blur p-2.5 md:p-3">
              <div className="flex gap-2 items-end">
                {character && (
                  <ActionHotkey
                    currentLocationId={character.current_location_id}
                    onArrived={loadCore}
                    disabled={!!combatId || !!pvpAtLocation}
                  />
                )}
                <Dialog open={sceneOpen} onOpenChange={setSceneOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" title="Anexar cena" disabled={!!pvpAtLocation}
                      className="shrink-0 h-10 w-10 border-border/60 hover:border-gold/60 hover:text-gold"><ImagePlus size={16} /></Button>
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
                <div className="flex-1 relative">
                  <Textarea rows={1} value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder={pvpAtLocation ? "Chat travado durante o duelo." : "Descreva sua ação (❕️) ou fale (-)…"}
                    disabled={!!pvpAtLocation}
                    className="resize-none min-h-10 max-h-32 rounded-xl border-border/60 bg-input/60 focus:border-gold/60 pr-2 py-2.5"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }} />
                </div>
                <Button onClick={doSend} disabled={sending || !!pvpAtLocation || (!content.trim() && !scene)}
                  className="shrink-0 h-10 w-10 p-0 rounded-xl bg-gradient-to-br from-blood to-blood/70 hover:from-blood/90 hover:to-blood/60 shadow-lg shadow-blood/30">
                  <Send size={16} />
                </Button>
              </div>
              <div className="hidden md:flex items-center gap-3 mt-1.5 px-1 text-[10px] text-muted-foreground">
                <span><kbd className="px-1 py-0.5 rounded bg-secondary/60 text-[9px]">Enter</kbd> enviar</span>
                <span><kbd className="px-1 py-0.5 rounded bg-secondary/60 text-[9px]">Shift+Enter</kbd> nova linha</span>
                <span className="ml-auto">❕️ ação · - fala</span>
              </div>
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