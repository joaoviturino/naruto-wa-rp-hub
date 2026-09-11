import { useEffect, useSyncExternalStore } from "react";

const KEY = "shinobi:game-preferences:v1";
const EVENT = "shinobi:preferences";
export type GamePreferences = { effects: "full" | "reduced"; combatSpeed: 1 | 2; sound: boolean };
const DEFAULT: GamePreferences = { effects: "full", combatSpeed: 1, sound: true };
let rawCache: string | null = null;
let valueCache = DEFAULT;
function snapshot(): GamePreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === rawCache) return valueCache;
    const value = raw ? JSON.parse(raw) : {};
    rawCache = raw;
    valueCache = { effects: value.effects === "reduced" ? "reduced" : "full",
      combatSpeed: value.combatSpeed === 2 ? 2 : 1, sound: value.sound !== false };
  } catch { return valueCache; }
  return valueCache;
}
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => { window.removeEventListener("storage", fn); window.removeEventListener(EVENT, fn); };
}
export function setGamePreferences(patch: Partial<GamePreferences>) {
  const next = { ...snapshot(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Private browser: keep session preference. */ }
  valueCache = next;
  window.dispatchEvent(new Event(EVENT));
}
export function useGamePreferences() { return useSyncExternalStore(subscribe, snapshot, () => DEFAULT); }
function motionSubscribe(fn: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
export function useReducedGameMotion() {
  const preferences = useGamePreferences();
  const systemReduced = useSyncExternalStore(motionSubscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  return preferences.effects === "reduced" || systemReduced;
}
export function GamePreferencesSync() {
  const reduced = useReducedGameMotion();
  useEffect(() => {
    document.documentElement.dataset.gameMotion = reduced ? "reduced" : "full";
    return () => { delete document.documentElement.dataset.gameMotion; };
  }, [reduced]);
  return null;
}
