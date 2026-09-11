import type { CombatVisual } from "./skill-blueprints";
export type CombatPlaybackEntry = {
  seq: number; actor: "player" | "npc"; actor_name?: string; actor_char_id?: string;
  target_name?: string; target_char_id?: string; target_npc_idx?: number;
  skill_name?: string; energy_type?: string; damage?: number; crit_mul?: number;
  heal?: boolean; heal_mode?: "single" | "team"; heal_target_ids?: string[]; missed?: boolean;
  is_defense?: boolean; is_dash?: boolean; pose_url?: string; sound_url?: string;
  animation_url?: string; animation_mode?: "projectile" | "front" | "overlay"; visual?: CombatVisual;
};
export type CombatFighter = { character_id?: string; id?: string; nickname?: string; name?: string };
export function resolveCombatKeys(e: CombatPlaybackEntry, players: CombatFighter[], npcs: CombatFighter[]) {
  const playerKey = (id?: string, name?: string) => {
    const p = players.find((p) => id ? p.character_id === id : !!name && p.nickname === name);
    return p?.character_id ? `player:${p.character_id}` : null;
  };
  const npcKey = (id?: string, name?: string) => {
    const idx = npcs.findIndex((n) => id ? n.character_id === id || n.id === id : !!name && (n.name === name || n.nickname === name));
    return idx >= 0 ? `npc:${idx}` : null;
  };
  const actorKey = e.actor === "player" ? playerKey(e.actor_char_id, e.actor_name) : npcKey(e.actor_char_id, e.actor_name);
  const healId = e.heal_target_ids?.[0] ?? e.target_char_id ?? e.actor_char_id;
  const targetKey = e.is_defense ? actorKey : e.heal
    ? playerKey(healId) ?? npcKey(healId) ?? actorKey
    : e.actor === "player"
      ? typeof e.target_npc_idx === "number" && npcs[e.target_npc_idx] ? `npc:${e.target_npc_idx}` : npcKey(e.target_char_id, e.target_name)
      : playerKey(e.target_char_id, e.target_name);
  return { actorKey, targetKey };
}
export function freshCombatEntries(log: CombatPlaybackEntry[], lastSeq: number | null) {
  const valid = log.filter((e) => Number.isFinite(e?.seq));
  const latest = valid.reduce((n, e) => Math.max(n, e.seq), lastSeq ?? 0);
  // The initial snapshot is history, not a list of actions to replay.
  const entries = lastSeq === null ? [] : valid.filter((e) => e.seq > lastSeq);
  return { latest, entries: [...new Map(entries.map((e) => [e.seq, e])).values()].sort((a, b) => a.seq - b.seq).slice(-24) };
}
export function delayPlayback(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const done = (ok: boolean) => { clearTimeout(timer); signal.removeEventListener("abort", abort); resolve(ok); };
    const timer = setTimeout(() => done(true), ms);
    const abort = () => done(false);
    signal.addEventListener("abort", abort, { once: true });
  });
}
