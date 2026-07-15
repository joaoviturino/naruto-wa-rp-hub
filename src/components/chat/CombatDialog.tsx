import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { playerAttack, fleeCombat, consumeInCombat } from "@/lib/combat.functions";
import { NpcMusic } from "@/components/NpcMusic";
import { toast } from "sonner";
import { Sword, Flag, Zap, FlaskConical, Users, Target } from "lucide-react";
import { FloatingDamageLayer, type DamageBurst } from "@/components/chat/FloatingDamage";
import { HealParticles } from "@/components/chat/HealParticles";
import { remapPvpForViewer } from "@/components/chat/pvpRemap";

type Skill = {
  id: string; name: string; energy_type: "ef" | "em" | "chakra"; base_cost: number;
  bonus_speed: number; bonus_critical: number; bonus_energetic: number;
  cooldown_turns?: number; description?: string | null; cost_percent?: number;
  meta?: any;
};
type BagEntry = { item_id: string; qty: number };
type Item = { id: string; name: string; image_url: string | null; type: string };

export function CombatDialog({ sessionId, myCharId, onClose }: { sessionId: string; myCharId: string; onClose: () => void }) {
  const [session, setSession] = useState<any>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [energy, setEnergy] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [fleeing, setFleeing] = useState(false);
  const [bag, setBag] = useState<BagEntry[]>([]);
  const [itemMap, setItemMap] = useState<Record<string, Item>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [sprites, setSprites] = useState<Record<string, string | null>>({});
  // Pose ativa por jogador (character_id → url) durante um ataque.
  const [poses, setPoses] = useState<Record<string, string | null>>({});
  const lastLogSeq = useRef<number>(0);
  const animQueue = useRef<any[]>([]);
  const animRunning = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Refs para calcular posições no palco (projetéis, overlays, etc.)
  const stageRef = useRef<HTMLDivElement | null>(null);
  const npcRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const playerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // GIF/vídeo ativo no palco (por entrada de log)
  const [fx, setFx] = useState<null | {
    id: string;
    url: string;
    mode: "projectile" | "front" | "overlay";
    from: { x: number; y: number };
    to: { x: number; y: number };
    isVideo: boolean;
    mirror?: boolean;
  }>(null);
  const attack = useServerFn(playerAttack);
  const flee = useServerFn(fleeCombat);
  const consume = useServerFn(consumeInCombat);

  async function doFlee(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (fleeing) return;
    setFleeing(true);
    try {
      await flee({ data: { session_id: sessionId } });
      toast.success("Você fugiu do combate.");
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? "Não foi possível fugir.";
      toast.error(msg);
      if (/encerrado|não encontrado|nao encontrado/i.test(String(msg))) onClose();
    } finally {
      setFleeing(false);
    }
  }

  async function load() {
    const { data } = await supabase.from("combat_sessions").select("*").eq("id", sessionId).maybeSingle();
    if (!data) { onClose(); return; }
    setSession(remapPvpForViewer(data as any, myCharId));
  }
  async function loadSkills() {
    const { data } = await supabase
      .from("character_skills")
      .select("skill:skills(id,name,energy_type,base_cost,cost_percent,bonus_speed,bonus_critical,bonus_energetic,cooldown_turns,description,meta)")
      .eq("character_id", myCharId);
    const list = ((data as any[]) ?? []).map((r) => r.skill).filter(Boolean) as Skill[];
    setSkills(list);
    if (list.length && !selectedSkill) { setSelectedSkill(list[0].id); setEnergy(Math.max(1, Number(list[0].base_cost) || 1)); }
  }
  async function loadBag() {
    const { data: inv } = await supabase.from("inventory").select("ninja_bag,secondary_slots").eq("character_id", myCharId).maybeSingle();
    const b: BagEntry[] = [];
    for (const src of [inv?.ninja_bag, inv?.secondary_slots]) {
      if (Array.isArray(src)) for (const e of src as any[]) b.push({ item_id: e.item_id, qty: Number(e.qty ?? 1) });
    }
    setBag(b);
    if (b.length) {
      const ids = Array.from(new Set(b.map((x) => x.item_id)));
      const { data: its } = await supabase.from("items").select("id,name,image_url,type").in("id", ids);
      const map: Record<string, Item> = {};
      for (const it of (its as Item[]) ?? []) map[it.id] = it;
      setItemMap(map);
    }
  }

  useEffect(() => {
    load(); loadSkills(); loadBag();
    const ch = supabase.channel(`combat-${sessionId}-${myCharId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "combat_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") { onClose(); return; }
          const next = remapPvpForViewer(payload.new as any, myCharId);
          setSession(next);
          if (next?.state?._pvp && next?.status !== "active") onClose();
        })
      .subscribe((status) => { if (status === "SUBSCRIBED") void load(); });
    return () => { supabase.removeChannel(ch); };
     
  }, [sessionId, myCharId]);

  const participantIdsKey = useMemo(() => [
    ...(session?.state?.players ?? []).map((p: any) => p.character_id),
    ...(session?.state?._pvp ? (session?.state?.npcs ?? []).map((p: any) => p.character_id) : []),
  ].filter(Boolean).sort().join("|"), [session?.state?.players, session?.state?.npcs, session?.state?._pvp]);

  useEffect(() => {
    // Carrega avatares/sprites dos participantes dos dois lados (no PvP os inimigos ficam em `npcs`).
    if (!session) return;
    const ids = Array.from(new Set([
      ...(session.state?.players ?? []).map((p: any) => p.character_id),
      ...(session.state?._pvp ? (session.state?.npcs ?? []).map((p: any) => p.character_id) : []),
    ].filter(Boolean)));
    if (!ids.length) return;
    supabase.from("characters").select("id,avatar_url,inventory_bg_url").in("id", ids).then(({ data }) => {
      const av: Record<string, string | null> = {};
      const sp: Record<string, string | null> = {};
      for (const c of (data as any[]) ?? []) { av[c.id] = c.avatar_url; sp[c.id] = c.inventory_bg_url; }
      setAvatars(av); setSprites(sp);
    });
  }, [participantIdsKey]);

  const state = (session?.state ?? {}) as any;
  const players: any[] = Array.isArray(state.players) ? state.players : [];
  const npcs: any[] = Array.isArray(state.npcs) && state.npcs.length
    ? state.npcs
    : (state.npc ? [state.npc] : []);
  const npc = npcs[state.target ?? 0] ?? npcs[0] ?? { name: "?", image_url: null, hp: 0, hp_max: 1, energy: 0, energy_max: 1 };

  // Alvo selecionado localmente (default: primeiro NPC vivo).
  const [targetIdx, setTargetIdx] = useState<number>(0);
  useEffect(() => {
    // Se o alvo atual estiver morto/inexistente, aponta para o primeiro vivo.
    const cur = npcs[targetIdx];
    if (!cur || cur.alive === false) {
      const nxt = npcs.findIndex((n: any) => n?.alive !== false);
      if (nxt >= 0 && nxt !== targetIdx) setTargetIdx(nxt);
    }
  }, [npcs.map((n: any) => `${n?.id}:${n?.alive !== false}`).join("|")]);

  // Números de dano flutuantes por combatente. Chave por índice (npc:i | player:cid).
  const [bursts, setBursts] = useState<Record<string, DamageBurst[]>>({});
  const pushBurst = (slotKey: string, burst: DamageBurst) => {
    setBursts((prev) => ({ ...prev, [slotKey]: [...(prev[slotKey] ?? []), burst] }));
  };
  const expireBurst = (slotKey: string, id: string) => {
    setBursts((prev) => ({ ...prev, [slotKey]: (prev[slotKey] ?? []).filter((b) => b.id !== id) }));
  };
  // Overlays de cura ativas por personagem (map charId → key para forçar remount).
  const [healOverlays, setHealOverlays] = useState<Record<string, number>>({});
  const triggerHeal = (cid: string) => {
    setHealOverlays((prev) => ({ ...prev, [cid]: (prev[cid] ?? 0) + 1 }));
    setTimeout(() => {
      setHealOverlays((prev) => {
        const { [cid]: _drop, ...rest } = prev;
        return rest;
      });
    }, 1500);
  };
  const log: any[] = Array.isArray(session?.log) ? session.log : [];
  const me = players.find((p: any) => p.character_id === myCharId);
  const activePlayer = players[state.active ?? 0];
  const aliveMe = !!me?.alive;
  const solo = players.length <= 1;
  const onlyAlivePlayer = players.filter((p: any) => p.alive).length === 1 && aliveMe;
  const spectator = !!state._spectator;
  const myTurn = !spectator && session?.status === "active" && aliveMe &&
    (state._pvp
      ? (state.turn === "player" && activePlayer?.character_id === myCharId)
      : (solo || onlyAlivePlayer || activePlayer?.character_id === myCharId));
  const currentSkill = skills.find((s) => s.id === selectedSkill);
  const healTarget: "single" | "team" | null = currentSkill?.meta?.heal?.target ?? null;
  const isHealSkill = !!healTarget;
  const [healTargetId, setHealTargetId] = useState<string>("");
  useEffect(() => {
    if (isHealSkill && healTarget === "single") {
      const alive = players.filter((p: any) => p.alive);
      if (!alive.some((p: any) => p.character_id === healTargetId)) {
        setHealTargetId(myCharId);
      }
    }
  }, [selectedSkill, players.length]);
  const myCooldowns: Record<string, number> = (me?.cooldowns as any) ?? {};
  const currentCd = currentSkill ? (myCooldowns[currentSkill.id] ?? 0) : 0;
  const currentPool: "ef" | "em" | "chakra" | null = currentSkill?.energy_type ?? null;
  const currentPoolMax = currentPool && me ? (me[`${currentPool}_max` as const] as number) : 0;
  const currentPoolNow = currentPool && me ? (me[currentPool as "ef" | "em" | "chakra"] as number) : 0;
  const currentPct = Math.max(1, Math.min(100, Number(currentSkill?.cost_percent ?? 20)));
  const currentMaxEnergy = currentPool ? Math.max(1, Math.floor((currentPoolMax * currentPct) / 100)) : 1;
  const [skillTab, setSkillTab] = useState<"ef" | "em" | "chakra">("chakra");
  useEffect(() => {
    if (currentSkill) setSkillTab(currentSkill.energy_type);
  }, [selectedSkill]);
  useEffect(() => {
    if (energy > currentMaxEnergy) setEnergy(currentMaxEnergy);
  }, [currentMaxEnergy]);
  const skillsByTab = useMemo(() => skills.filter((s) => s.energy_type === skillTab), [skills, skillTab]);
  const consumables = useMemo(() => bag.filter((e) => itemMap[e.item_id]?.type === "consumable"), [bag, itemMap]);

  // Enfileira TODAS as novas entradas do log (jogador + resposta do NPC vêm juntas do backend)
  // e roda uma de cada vez: espera pré-carregar mídia, mostra animação, toca som e SÓ ENTÃO
  // avança para a próxima. Isso evita que o ataque do NPC "sobrescreva" o do jogador.
  useEffect(() => {
    if (!log.length) return;
    const fresh = log.filter((l: any) => l.seq > lastLogSeq.current);
    if (!fresh.length) return;
    lastLogSeq.current = fresh[fresh.length - 1].seq;
    for (const entry of fresh) {
      if (entry.pose_url || entry.sound_url || entry.animation_url) animQueue.current.push(entry);
      // Números de dano flutuantes
      if (Number(entry.damage) > 0) {
        const id = `${entry.seq}-${Math.random().toString(36).slice(2, 7)}`;
        const crit = Number(entry.crit_mul ?? 1) > 1 && entry.damage > 0;
        if (entry.heal) {
          // Cura: burst verde e partículas em cada alvo curado.
          const ids: string[] = Array.isArray(entry.heal_target_ids) && entry.heal_target_ids.length
            ? entry.heal_target_ids
            : (entry.heal_mode === "team"
              ? players.filter((p: any) => p.alive).map((p: any) => p.character_id)
              : [entry.actor_char_id].filter(Boolean));
          for (const cid of ids) {
            pushBurst(`player:${cid}`, { id: `${id}-${cid}`, amount: Number(entry.damage), heal: true });
            triggerHeal(cid);
          }
        } else if (entry.actor === "player") {
          // dano no NPC alvo — usa o nome como fallback para achar o slot
          const idx = npcs.findIndex((n: any) => n.name === entry.target_name);
          const key = `npc:${idx >= 0 ? idx : 0}`;
          pushBurst(key, { id, amount: Number(entry.damage), crit });
        } else if (entry.actor === "npc") {
          // dano no jogador target_name
          const p = players.find((x: any) => x.nickname === entry.target_name);
          if (p) pushBurst(`player:${p.character_id}`, { id, amount: Number(entry.damage), crit });
        }
      }
    }
    void runQueue();

    async function runQueue() {
      if (animRunning.current) return;
      animRunning.current = true;
      let lastActor: string | null = null;
      while (animQueue.current.length) {
        const entry = animQueue.current.shift();
        // Pausa dramática: o NPC "respira" 3s após tomar o golpe antes de revidar.
        if (lastActor === "player" && entry?.actor === "npc") {
          await new Promise((r) => setTimeout(r, 3000));
        }
        await playOne(entry);
        if (entry?.actor) lastActor = entry.actor;
      }
      animRunning.current = false;
    }

    async function playOne(entry: any) {
      const poseUrl: string | undefined = entry.pose_url;
      const actorCharId: string | undefined = entry.actor_char_id;
      const soundUrl: string | undefined = entry.sound_url;
      const animUrl: string | undefined = entry.animation_url;
      const animMode: "projectile" | "front" | "overlay" = entry.animation_mode ?? "overlay";
      const MAX_WAIT = 5000;
      const POSE_MS = 1400;

      const waitImg = poseUrl ? new Promise<boolean>((res) => {
        const img = new Image();
        let done = false;
        const finish = (ok: boolean) => { if (done) return; done = true; res(ok); };
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        img.src = poseUrl;
        setTimeout(() => finish(false), MAX_WAIT);
      }) : Promise.resolve(false);

      let audio: HTMLAudioElement | null = null;
      const waitAudio = soundUrl ? new Promise<boolean>((res) => {
        try {
          const a = new Audio(soundUrl);
          a.crossOrigin = "anonymous";
          a.preload = "auto";
          a.volume = 0.7;
          audio = a;
          let done = false;
          const finish = (ok: boolean) => { if (done) return; done = true; res(ok); };
          a.addEventListener("canplaythrough", () => finish(true), { once: true });
          a.addEventListener("loadeddata", () => finish(true), { once: true });
          a.addEventListener("error", () => finish(false), { once: true });
          a.load();
          setTimeout(() => finish(false), MAX_WAIT);
        } catch { res(false); }
      }) : Promise.resolve(false);

      const [imgOk] = await Promise.all([waitImg, waitAudio]);

      // Tocar som
      let audioDuration = 0;
      const a2 = audio as HTMLAudioElement | null;
      if (a2) {
        if (audioRef.current) { try { audioRef.current.pause(); } catch { /* noop */ } }
        audioRef.current = a2;
        try { await a2.play(); } catch { /* noop */ }
        audioDuration = Number.isFinite(a2.duration) ? a2.duration * 1000 : 0;
      }

      // Troca de pose para o jogador que agiu
      if (poseUrl && imgOk && actorCharId) {
        setPoses((p) => ({ ...p, [actorCharId]: poseUrl }));
      }

      // Renderiza a animação (gif/vídeo) no palco, se houver
      if (animUrl && stageRef.current) {
        const stageRect = stageRef.current.getBoundingClientRect();
        // origem = quem agiu
        let fromEl: HTMLElement | null = null;
        if (entry.actor === "player" && entry.actor_char_id) fromEl = playerRefs.current[entry.actor_char_id] ?? null;
        else if (entry.actor === "npc") {
          // achamos por nome como fallback
          const idx = npcs.findIndex((n: any) => n.name === entry.actor_name);
          if (idx >= 0) fromEl = npcRefs.current[idx] ?? null;
        }
        // alvo
        let toEl: HTMLElement | null = null;
        if (entry.actor === "player") {
          const idx = typeof entry.target_npc_idx === "number"
            ? entry.target_npc_idx
            : npcs.findIndex((n: any) => n.name === entry.target_name);
          if (idx >= 0) toEl = npcRefs.current[idx] ?? null;
        } else if (entry.actor === "npc") {
          const cid = entry.target_char_id
            ?? players.find((p: any) => p.nickname === entry.target_name)?.character_id;
          if (cid) toEl = playerRefs.current[cid] ?? null;
        }
        const rectCenter = (el: HTMLElement | null) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2 - stageRect.left, y: r.top + r.height / 2 - stageRect.top };
        };
        const to = rectCenter(toEl);
        const from = rectCenter(fromEl) ?? to;
        if (to) {
          setFx({
            id: `${entry.seq}-fx`,
            url: animUrl,
            mode: animMode,
            from: from!,
            to,
            isVideo: /\.(mp4|webm)$/i.test(animUrl),
            mirror: entry.actor === "player",
          });
        }
      }

      // Aguarda o maior entre duração do áudio e a pose (mínimo 1.2s, máximo 6s)
      const wait = Math.max(1200, Math.min(6000, Math.max(audioDuration || 0, poseUrl && imgOk ? POSE_MS : 0)));
      await new Promise((r) => setTimeout(r, wait));
      if (poseUrl && imgOk && actorCharId) {
        setPoses((p) => { const { [actorCharId]: _drop, ...rest } = p; return rest; });
      }
      setFx(null);
    }
  }, [log.length]);

  if (!session) return null;

  async function doAttack() {
    if (!currentSkill) return;
    if (energy > currentMaxEnergy) { toast.error(`Custo máximo: ${currentMaxEnergy} (${currentPct}% de ${currentPool?.toUpperCase()}).`); return; }
    if (energy > currentPoolNow) { toast.error(`Energia insuficiente. Você tem ${currentPoolNow} ${currentPool?.toUpperCase()}.`); return; }
    if (isHealSkill && healTarget === "single" && !healTargetId) { toast.error("Escolha um aliado para curar."); return; }
    setBusy(true);
    try {
      await attack({ data: {
        session_id: sessionId, skill_id: currentSkill.id, energy_used: energy,
        target_index: targetIdx,
        ...(isHealSkill && healTarget === "single" ? { heal_target_char_id: healTargetId } : {}),
      } });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  async function doItem(itemId: string) {
    setBusy(true);
    try {
      await consume({ data: { session_id: sessionId, item_id: itemId } });
      await loadBag();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  const poolColor: Record<string, string> = { ef: "oklch(0.55 0.22 25)", em: "oklch(0.6 0.15 220)", chakra: "oklch(0.78 0.15 80)" };
  const lastEntry = log[log.length - 1];
  const npcActive = session.status === "active" && lastEntry?.actor === "npc" && Object.keys(poses).length === 0;
  // Preferimos cenário/música do LOCAL; caímos para os do NPC/grupo por retrocompatibilidade.
  const bgUrl = ((state as any).location_bg_url as string | null) ?? (npc.battle_bg_url as string | null);
  const battleMusic = ((state as any).location_music_url as string | null) ?? ((npc as any).music_url as string | null);

  return (
    <Dialog open onOpenChange={(v) => !v && session.status !== "active" && onClose()}>
      <DialogContent className="max-w-4xl w-[calc(100vw-1rem)] p-0 overflow-hidden border-blood/30 max-h-[95vh] overflow-y-auto no-scrollbar">
        <NpcMusic src={battleMusic} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 px-3 pt-3 text-sm sm:text-base">
            <Sword size={16} /> Combate: {npc.name}
            {session.status !== "active" && <span className="ml-2 text-xs uppercase text-gold">{session.status}</span>}
            {state._pvp && !spectator && session.status === "active" && (
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto mr-8 h-7 px-2 text-[11px]"
                disabled={fleeing}
                onClick={doFlee}
              >
                <Flag size={12} className="mr-1" /> {fleeing ? "Fugindo..." : "Fugir do duelo"}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Turn order strip */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-input/40 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase text-muted-foreground mr-2 shrink-0">Turno</span>
          {[...npcs.map((n: any, i: number) => ({ kind: "npc" as const, e: n, i })),
            ...players.map((p: any) => ({ kind: "player" as const, e: p, i: -1 }))].map((row, i) => {
            const activeP = row.kind === "player" && players[state.active ?? 0]?.character_id === row.e.character_id;
            const activeN = row.kind === "npc" && npcActive && row.i === (state.target ?? 0);
            const img = row.kind === "npc" ? row.e.image_url : avatars[row.e.character_id];
            const dead = row.kind === "npc" ? row.e.alive === false : !row.e.alive;
            return (
              <div key={i} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md overflow-hidden shrink-0 border-2 ${activeP ? "border-emerald-400 ring-2 ring-emerald-400/40" : activeN ? "border-red-500 ring-2 ring-red-500/40" : row.kind === "npc" ? "border-blood/60" : "border-border"} bg-secondary ${dead ? "opacity-30 grayscale" : ""}`}>
                {img && <img src={img} className="w-full h-full object-cover" alt="" />}
              </div>
            );
          })}
        </div>

        {/* Battle stage */}
        <div ref={stageRef} className="relative overflow-hidden border-y border-border" style={{
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}>
          {!bgUrl && <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/60" />}
          <div className="absolute inset-0 bg-black/25" />
          <div className="relative h-[240px] sm:h-[320px] flex items-end justify-between px-3 sm:px-6 pb-3 gap-2 overflow-hidden">
            {/* Selected target badge */}
            {myTurn && npcs[targetIdx] && (npcs[targetIdx].alive !== false) && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/75 backdrop-blur-sm border border-red-500/60 rounded-full px-3 py-1 shadow-lg animate-fade-in">
                <Target size={12} className="text-red-400" />
                <span className="font-display text-[11px] sm:text-xs text-white truncate max-w-[140px]">{npcs[targetIdx].name}</span>
                <span className="text-[10px] sm:text-[11px] text-white/80 tabular-nums">{npcs[targetIdx].hp}/{npcs[targetIdx].hp_max}</span>
                <div className="w-16 sm:w-20"><Progress value={npcs[targetIdx].hp_max ? (npcs[targetIdx].hp / npcs[targetIdx].hp_max) * 100 : 0} className="h-1" /></div>
              </div>
            )}
            {/* NPCs (left half) — formação em 2 fileiras quando > 2 */}
            {(() => {
              const n = npcs.length;
              const frontCount = n <= 2 ? n : Math.ceil(n / 2);
              const front = npcs.slice(0, frontCount).map((v: any, i: number) => ({ v, i }));
              const back = npcs.slice(frontCount).map((v: any, i: number) => ({ v, i: i + frontCount }));
              const sizeCls = n > 2 ? "max-h-[95px] sm:max-h-[130px]" : "max-h-[150px] sm:max-h-[200px]";
              const renderNpc = ({ v: nn, i }: { v: any; i: number }) => {
                const dead = nn.alive === false || nn.hp <= 0;
                const isTarget = i === targetIdx && !dead;
                const isActing = npcActive && i === (state.target ?? 0);
                const canPick = !dead && myTurn;
                // Em PvP, o "npc" na verdade é um jogador do lado adversário. Usa
                // sprite_url do inventário e permite a troca de pose pelo character_id.
                const enemyCid = nn.character_id as string | undefined;
                const enemySprite = state._pvp
                  ? ((enemyCid ? poses[enemyCid] : null) || nn.sprite_url || (enemyCid ? sprites[enemyCid] : null) || nn.inventory_bg_url || nn.image_url || (enemyCid ? avatars[enemyCid] : null))
                  : ((enemyCid ? poses[enemyCid] : null) || nn.image_url || nn.sprite_url);
                const enemyName = nn.name ?? nn.nickname ?? "?";
                return (
                  <button
                    key={nn.id ?? i}
                    type="button"
                    disabled={!canPick}
                    onClick={() => canPick && setTargetIdx(i)}
                    className={`relative flex flex-col items-center gap-1 group min-w-0 ${canPick ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div ref={(el) => { npcRefs.current[i] = el; }} className={`relative transition-all ${isActing ? "drop-shadow-[0_0_18px_rgba(239,68,68,0.9)] scale-105" : ""} ${isTarget && !isActing ? "drop-shadow-[0_0_14px_rgba(239,68,68,0.75)] scale-[1.03]" : ""} ${dead ? "opacity-30 grayscale" : "group-hover:scale-105"}`}>
                      {enemySprite ? (
                        <img src={enemySprite} alt={enemyName} className={`${sizeCls} w-auto object-contain`} style={{ filter: isActing ? "drop-shadow(0 0 10px rgb(239 68 68))" : undefined }} />
                      ) : <div className={`${sizeCls} w-20 bg-secondary rounded`} />}
                      <FloatingDamageLayer bursts={bursts[`npc:${i}`] ?? []} onExpire={(id) => expireBurst(`npc:${i}`, id)} />
                    </div>
                    <div className={`rounded px-1.5 py-0.5 max-w-[130px] w-full transition-colors ${isTarget ? "bg-red-600/80 ring-1 ring-red-300" : "bg-black/70"}`}>
                      <div className="font-display text-[10px] sm:text-xs text-white truncate">{enemyName}</div>
                      <div className="flex justify-between text-[9px] text-white/80"><span>HP</span><span>{nn.hp}/{nn.hp_max}</span></div>
                      <Progress value={nn.hp_max ? (nn.hp / nn.hp_max) * 100 : 0} className="h-1" />
                    </div>
                  </button>
                );
              };
              return (
                <div className="flex flex-col items-center justify-end flex-1 min-w-0 gap-1">
                  {back.length > 0 && (
                    <div className="flex items-end justify-center gap-2 sm:gap-3 w-full">
                      {back.map(renderNpc)}
                    </div>
                  )}
                  <div className="flex items-end justify-center gap-2 sm:gap-3 w-full">
                    {front.map(renderNpc)}
                  </div>
                </div>
              );
            })()}

            {/* Allies (right half) */}
            {(() => {
              const n = players.length;
              const frontCount = n <= 2 ? n : Math.ceil(n / 2);
              const front = players.slice(0, frontCount);
              const back = players.slice(frontCount);
              const sizeCls = n > 2 ? "max-h-[95px] sm:max-h-[130px]" : "max-h-[150px] sm:max-h-[200px]";
              const renderPlayer = (p: any) => {
                const isActive = session.status === "active" && !npcActive && p.character_id === activePlayer?.character_id && p.alive;
                const sprite = poses[p.character_id] || p.sprite_url || sprites[p.character_id];
                const isHealPick = isHealSkill && healTarget === "single" && myTurn && p.alive;
                const chosenHeal = isHealPick && healTargetId === p.character_id;
                return (
                  <button
                    key={p.character_id}
                    type="button"
                    disabled={!isHealPick}
                    onClick={() => isHealPick && setHealTargetId(p.character_id)}
                    className={`flex flex-col items-center gap-1 min-w-0 ${isHealPick ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div ref={(el) => { playerRefs.current[p.character_id] = el; }} className={`relative transition-all ${isActive ? "drop-shadow-[0_0_18px_rgba(52,211,153,0.9)] scale-105" : ""} ${chosenHeal ? "drop-shadow-[0_0_18px_rgba(52,211,153,0.9)] scale-[1.04] ring-2 ring-emerald-400/70 rounded-md" : ""} ${!p.alive ? "opacity-30 grayscale" : ""}`}>
                      {sprite ? (
                        <img src={sprite} alt={p.nickname} className={`${sizeCls} w-auto object-contain`} style={{ transform: "scaleX(-1)", filter: isActive ? "drop-shadow(0 0 10px rgb(52 211 153))" : undefined }} />
                      ) : (
                        <div className={`${sizeCls} w-20 bg-secondary rounded`} />
                      )}
                      <FloatingDamageLayer bursts={bursts[`player:${p.character_id}`] ?? []} onExpire={(id) => expireBurst(`player:${p.character_id}`, id)} />
                      {healOverlays[p.character_id] && (
                        <HealParticles key={healOverlays[p.character_id]} />
                      )}
                    </div>
                  </button>
                );
              };
              return (
                <div className="flex flex-col items-center justify-end flex-1 min-w-0 gap-1">
                  {back.length > 0 && (
                    <div className="flex items-end justify-center gap-2 sm:gap-3 w-full">
                      {back.map(renderPlayer)}
                    </div>
                  )}
                  <div className="flex items-end justify-center gap-2 sm:gap-3 w-full">
                    {front.map(renderPlayer)}
                  </div>
                </div>
              );
            })()}

          </div>
          {/* Camada de animação de habilidade (GIF/vídeo) */}
          {fx && <SkillFxLayer fx={fx} />}
        </div>

        {/* Party bar */}
        <div
          className="grid gap-2 px-2 py-2 border-b border-border bg-background/60"
          style={{ gridTemplateColumns: `repeat(${Math.min(players.length, 6)}, minmax(0, 1fr))` }}
        >
          {players.map((p: any) => {
            const isMe = p.character_id === myCharId;
            const active = players[state.active ?? 0]?.character_id === p.character_id;
            return (
              <div key={p.character_id} className={`min-w-0 rounded-md border p-2 ${active ? "border-gold" : "border-border"} ${!p.alive ? "opacity-40" : ""} ${isMe ? "bg-gold/10" : "bg-input/30"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded overflow-hidden bg-secondary shrink-0">
                    {avatars[p.character_id] && <img src={avatars[p.character_id]!} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-display truncate">{p.nickname} {isMe && "(você)"}</div>
                    <div className="flex items-center gap-1 mb-0.5" title={`HP ${p.hp}/${p.hp_max}`}>
                      <span className="text-[9px] text-muted-foreground w-5">HP</span>
                      <div className="h-1.5 flex-1 rounded overflow-hidden bg-input">
                        <div className="h-full bg-emerald-500" style={{ width: `${p.hp_max > 0 ? (p.hp / p.hp_max) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground tabular-nums">{p.hp}/{p.hp_max}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-0.5">
                      {(["ef","em","chakra"] as const).map((k) => {
                        const v = p[k]; const m = p[`${k}_max` as const];
                        return (
                          <div key={k} title={`${k.toUpperCase()} ${v}/${m}`} className="h-1 rounded overflow-hidden bg-input">
                            <div className="h-full" style={{ width: `${m > 0 ? (v/m)*100 : 0}%`, background: poolColor[k] }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Log */}
        <div className="mx-2 mt-2 border border-border rounded p-2 max-h-24 sm:max-h-28 overflow-y-auto no-scrollbar text-xs space-y-1 bg-input/40">
          {log.slice(-8).map((l: any) => (
            <div key={l.seq} className={l.actor === "player" ? "text-emerald-300" : "text-red-300"}>
              #{l.seq} {l.msg}
            </div>
          ))}
          {log.length === 0 && <div className="text-muted-foreground">O combate começou. Escolha uma habilidade.</div>}
        </div>

        <div className="p-2 sm:p-3">
        {session.status === "active" ? (
          myTurn ? (
            <Tabs defaultValue="skills">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="skills"><Zap size={12} className="mr-1"/>Habilidades</TabsTrigger>
                <TabsTrigger value="items"><FlaskConical size={12} className="mr-1"/>Itens ({consumables.length})</TabsTrigger>
                <TabsTrigger value="flee"><Flag size={12} className="mr-1"/>Fugir</TabsTrigger>
              </TabsList>
              <TabsContent value="skills" className="mt-2">
                {skills.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Você não conhece nenhuma habilidade.</p>}
                <div className="mb-2">
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-input/40 p-1 text-[10px] sm:text-xs">
                    {([
                      { k: "ef", label: "Física" },
                      { k: "em", label: "Mental" },
                      { k: "chakra", label: "Ninjutsu" },
                    ] as const).map((t) => {
                      const count = skills.filter((s) => s.energy_type === t.k).length;
                      const active = skillTab === t.k;
                      return (
                        <button key={t.k} onClick={() => setSkillTab(t.k)}
                          className={`rounded px-2 py-1.5 transition ${active ? "bg-gold/20 text-gold border border-gold/60" : "border border-transparent hover:bg-secondary/50"}`}>
                          {t.label} <span className="opacity-60">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto no-scrollbar pr-1">
                  {skillsByTab.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center col-span-full">Nenhuma habilidade nesta categoria.</p>}
                  {skillsByTab.map((s) => {
                    const cd = myCooldowns[s.id] ?? 0;
                    const chosen = s.id === selectedSkill;
                    const poolMaxS = me ? (me[`${s.energy_type}_max` as const] as number) : 0;
                    const maxES = Math.max(1, Math.floor((poolMaxS * Math.max(1, Math.min(100, Number(s.cost_percent ?? 20)))) / 100));
                    return (
                      <button key={s.id} disabled={cd > 0}
                        onClick={() => { setSelectedSkill(s.id); setEnergy(Math.max(1, Math.min(maxES, Number(s.base_cost) || 1))); }}
                        className={`text-left rounded-md border p-2 transition ${chosen ? "border-gold bg-gold/10" : "border-border hover:border-gold/60"} ${cd > 0 ? "opacity-40 cursor-not-allowed" : ""}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm">{s.name}</span>
                          <Badge variant="outline" className="text-[9px]">{s.energy_type.toUpperCase()}</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          ×{s.bonus_energetic} energ • ×{s.bonus_critical} crit • ×{s.bonus_speed} spd
                          {cd > 0 ? ` • ⏳ ${cd}` : (s.cooldown_turns ? ` • CD ${s.cooldown_turns}` : "")}
                          <span className="ml-1">• máx {maxES} ({s.cost_percent ?? 20}%)</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-end gap-2 mt-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">
                      Energia ({currentSkill?.energy_type.toUpperCase() ?? "—"}) — máx {currentMaxEnergy} ({currentPct}%)
                      {isHealSkill && (
                        <span className="ml-2 text-emerald-300">
                          • cura ≈ energia gasta{healTarget === "team" ? " (time inteiro)" : " (alvo único — clique num aliado)"}
                        </span>
                      )}
                    </div>
                    <Input type="number" min={1} max={currentMaxEnergy} value={energy}
                      onChange={(e) => setEnergy(Math.max(1, Math.min(currentMaxEnergy, Number(e.target.value))))} />
                  </div>
                  <Button onClick={doAttack} disabled={!currentSkill || busy || currentCd > 0} className="shrink-0">
                    <Sword size={14} className="mr-1" /> {busy ? "..." : isHealSkill ? "Curar" : "Atacar"}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="items" className="mt-2">
                {consumables.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Sem consumíveis na bolsa.</p>}
                <div className="grid gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto no-scrollbar pr-1">
                  {consumables.map((e) => {
                    const it = itemMap[e.item_id];
                    return (
                      <button key={e.item_id} disabled={busy}
                        onClick={() => doItem(e.item_id)}
                        className="text-left rounded-md border border-border p-2 hover:border-gold/60 transition flex items-center gap-2">
                        <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0">
                          {it?.image_url && <img src={it.image_url} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-display truncate">{it?.name ?? "?"}</div>
                          <div className="text-[10px] text-muted-foreground">×{e.qty}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="flee" className="mt-2">
                <div className="text-sm text-muted-foreground mb-2">Fugir encerra o combate para você e o time sem recompensas.</div>
                <Button variant="outline" onClick={doFlee} disabled={fleeing}>
                  <Flag size={14} className="mr-1" /> {fleeing ? "Fugindo..." : "Confirmar fuga"}
                </Button>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-between border border-border rounded p-3 bg-input/30">
              <div className="text-sm text-muted-foreground">
                <Users size={12} className="inline mr-1"/>
                {spectator
                  ? <>Você está assistindo ao duelo. Vez de <span className="text-gold font-display">{state._acting_nickname ?? activePlayer?.nickname ?? "…"}</span>.</>
                  : <>Aguardando <span className="text-gold font-display">{state._acting_nickname ?? "adversário"}</span> agir…</>
                }
              </div>
              {spectator ? (
                <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={doFlee} disabled={fleeing}>
                  <Flag size={14} className="mr-1" /> {fleeing ? "Fugindo..." : "Fugir"}
                </Button>
              )}
            </div>
          )
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {session.status === "won" && <span className="text-emerald-400">Vitória! {npc.name} foi derrotado.</span>}
              {session.status === "lost" && <span className="text-blood">Derrota. Você saiu enfraquecido, mas sem penalidades.</span>}
              {session.status === "fled" && <span className="text-muted-foreground">Fuga registrada.</span>}
            </div>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SkillFxLayer({ fx }: {
  fx: {
    id: string;
    url: string;
    mode: "projectile" | "front" | "overlay";
    from: { x: number; y: number };
    to: { x: number; y: number };
    isVideo: boolean;
    mirror?: boolean;
  };
}) {
  // Tamanho do sprite da animação
  const SIZE = 140;
  // Posição alvo por modo:
  //  - overlay: centro do alvo
  //  - front: um pouco à frente do alvo (na direção do atacante)
  //  - projectile: sai do atacante e vai até o alvo
  let startX = fx.to.x, startY = fx.to.y, endX = fx.to.x, endY = fx.to.y;
  if (fx.mode === "overlay") {
    startX = endX = fx.to.x; startY = endY = fx.to.y;
  } else if (fx.mode === "front") {
    const dx = fx.from.x - fx.to.x;
    const dy = fx.from.y - fx.to.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const off = 70;
    startX = endX = fx.to.x + (dx / len) * off;
    startY = endY = fx.to.y + (dy / len) * off;
  } else {
    // projectile
    startX = fx.from.x; startY = fx.from.y;
    endX = fx.to.x; endY = fx.to.y;
  }
  const style: React.CSSProperties = {
    position: "absolute",
    left: startX,
    top: startY,
    width: SIZE,
    height: SIZE,
    transform: `translate(-50%, -50%)`,
    transition: fx.mode === "projectile" ? "left 700ms cubic-bezier(.4,.6,.4,1), top 700ms cubic-bezier(.4,.6,.4,1)" : undefined,
    pointerEvents: "none",
    zIndex: 25,
    filter: "drop-shadow(0 0 12px rgba(255,220,120,0.6))",
  };
  const [pos, setPos] = useState({ x: startX, y: startY });
  useEffect(() => {
    if (fx.mode === "projectile") {
      // Kick após 1 frame para animar
      const r = requestAnimationFrame(() => setPos({ x: endX, y: endY }));
      return () => cancelAnimationFrame(r);
    }
    setPos({ x: startX, y: startY });
     
  }, [fx.id]);
  return (
    <div style={{ ...style, left: pos.x, top: pos.y }} className="animate-fade-in">
      {fx.isVideo ? (
        <video src={fx.url} autoPlay muted playsInline loop className="w-full h-full object-contain" style={fx.mirror ? { transform: "scaleX(-1)" } : undefined} />
      ) : (
        <img src={fx.url} alt="" className="w-full h-full object-contain" style={fx.mirror ? { transform: "scaleX(-1)" } : undefined} />
      )}
    </div>
  );
}