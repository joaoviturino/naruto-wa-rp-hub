import { useEffect, useRef, useState, type RefObject } from "react";
import { useGamePreferences, useReducedGameMotion } from "@/hooks/useGamePreferences";
import { freshCombatEntries, delayPlayback, resolveCombatKeys, type CombatPlaybackEntry, type CombatFighter } from "@/lib/combat-playback";
import { resolveSkillVisual, type CombatVisual } from "@/lib/skill-blueprints";

export type CombatAction = { actorKey: string; targetKey: string; seq: number; visual: CombatVisual; poseUrl?: string };
export type CombatFx = { id: string; url: string; mode: "projectile" | "front" | "overlay";
  from: { x: number; y: number }; to: { x: number; y: number }; isVideo: boolean; mirror?: boolean };
type Options = { sessionId: string; loaded: boolean; log: CombatPlaybackEntry[]; players: CombatFighter[]; npcs: CombatFighter[];
  stageRef: RefObject<HTMLDivElement | null>; playerRefs: RefObject<Record<string, HTMLDivElement | null>>;
  npcRefs: RefObject<Record<number, HTMLDivElement | null>>; onImpact: (entry: CombatPlaybackEntry) => void };
export function useCombatPlayback(options: Options) {
  const preferences = useGamePreferences();
  const reduced = useReducedGameMotion();
  const latest = useRef({ ...options, preferences, reduced });
  latest.current = { ...options, preferences, reduced };
  const [action, setAction] = useState<CombatAction | null>(null);
  const [fx, setFx] = useState<CombatFx | null>(null);
  const last = useRef<number | null>(null);
  const queue = useRef<CombatPlaybackEntry[]>([]);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const restoreDash = useRef<(() => void) | null>(null);
  useEffect(() => {
    controller.current = new AbortController();
    last.current = null; queue.current = []; running.current = false;
    setAction(null); setFx(null);
    const signal = controller.current;
    const hide = () => {
      if (!document.hidden) return;
      audio.current?.pause(); queue.current = [];
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      signal.abort(); queue.current = []; audio.current?.pause(); restoreDash.current?.();
      document.removeEventListener("visibilitychange", hide);
    };
  }, [options.sessionId]);
  useEffect(() => {
    if (!preferences.sound) audio.current?.pause();
  }, [preferences.sound]);
  useEffect(() => {
    if (!options.loaded) return;
    const fresh = freshCombatEntries(options.log, last.current);
    last.current = fresh.latest;
    if (document.hidden) return;
    queue.current.push(...fresh.entries.filter((e) => e.skill_name && e.skill_name !== "recompensa"));
    if (queue.current.length > 24) queue.current = queue.current.slice(-24);
    if (running.current || !queue.current.length) return;
    const signal = controller.current!.signal;
    running.current = true;
    const run = async () => {
      try {
        while (queue.current.length && !signal.aborted) {
          const e = queue.current.shift()!;
          const { players, npcs, playerRefs, npcRefs, stageRef, preferences: prefs, reduced: low } = latest.current;
          const { actorKey, targetKey } = resolveCombatKeys(e, players, npcs);
          const element = (key: string | null) => key?.startsWith("player:")
            ? playerRefs.current[key.slice(7)] : key?.startsWith("npc:") ? npcRefs.current[Number(key.slice(4))] : null;
          const fromEl = element(actorKey), toEl = element(targetKey);
          const visual = resolveSkillVisual({ meta: { visual: e.visual }, energy_type: e.energy_type, is_defensive: e.is_defense });
          const duration = (low ? 300 : visual.duration_ms) / prefs.combatSpeed;
          if (signal.aborted) break;
          setAction({ actorKey: actorKey ?? "", targetKey: targetKey ?? "", seq: e.seq, visual, poseUrl: e.pose_url });
          if (prefs.sound && e.sound_url) {
            audio.current?.pause();
            const sound = new Audio(e.sound_url); audio.current = sound; sound.volume = 0.6;
            void sound.play().catch(() => {});
          }
          if (!low && e.animation_url && stageRef.current && toEl) {
            const stage = stageRef.current.getBoundingClientRect();
            const center = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - stage.left, y: r.top + r.height / 2 - stage.top }; };
            setFx({ id: String(e.seq), url: e.animation_url, mode: e.animation_mode ?? "overlay",
              from: center(fromEl ?? toEl), to: center(toEl), isVideo: /\.(mp4|webm)(?:[?#]|$)/i.test(e.animation_url), mirror: e.actor === "player" });
          }
          // Imperative translation moves the whole layered character, including its clothes.
          if (!low && e.is_dash && fromEl && toEl && fromEl !== toEl) {
            const from = fromEl.getBoundingClientRect(), to = toEl.getBoundingClientRect();
            const before = { transform: fromEl.style.transform, transition: fromEl.style.transition };
            restoreDash.current = () => { fromEl.style.transform = before.transform; fromEl.style.transition = before.transition; };
            const gap = (from.left < to.left ? -1 : 1) * (to.width / 2 + 24);
            fromEl.style.transition = `transform ${200 / prefs.combatSpeed}ms ease-out`;
            fromEl.style.transform = `translate(${to.left + to.width / 2 + gap - from.left - from.width / 2}px, ${to.top - from.top}px)`;
          }
          if (!await delayPlayback(duration * 0.35, signal)) break;
          latest.current.onImpact(e);
          if (!await delayPlayback(duration * 0.65, signal)) break;
          restoreDash.current?.(); restoreDash.current = null;
          audio.current?.pause();
          setAction(null); setFx(null);
          if (queue.current.length && !await delayPlayback(120 / prefs.combatSpeed, signal)) break;
        }
      } catch (error) {
        console.warn("Não foi possível reproduzir um efeito de combate.", error);
      } finally {
        if (!signal.aborted) {
          restoreDash.current?.(); restoreDash.current = null; audio.current?.pause();
          running.current = false; setAction(null); setFx(null);
        }
      }
    };
    void run();
  }, [options.log, options.loaded, options.sessionId]);
  return { action, fx };
}
