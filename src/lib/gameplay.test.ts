import { describe, expect, it, vi, afterEach } from "vitest";
import { atlasPosition, resolveSpriteState, mapLayerFrame, resolveCombatEnvironment } from "./sprite-animation";
import { createResourceCache } from "./resource-cache";
import { normalizeCleanupConfig, cleanupReducer, cleanupTileStyle, cleanupConfigSchema, createCleanupState } from "./cleanup-game";
import { freshCombatEntries, delayPlayback, resolveCombatKeys } from "./combat-playback";
import { SKILL_BLUEPRINTS, copySkillBlueprint, exportSkillBlueprint, importSkillBlueprint, resolveSkillVisual, combatVisualSchema } from "./skill-blueprints";
import { mergeChatWindow } from "./chat-window";
import { startVisiblePolling } from "./visible-polling";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("layered sprites", () => {
  it("keeps a static outfit intact even when the body has six columns", () => {
    expect(resolveSpriteState(null, "punch", 1, 1).frames).toBe(1);
    expect(atlasPosition(1, 1, 5, 2)).toEqual({ backgroundSize: "100% 100%", backgroundPosition: "50% 50%" });
  });
  it("maps different layer lengths to one progress, preserving the last nonloop frame", () => {
    const body = { row: 2, frames: 6, loop: false };
    const clothes = { row: 1, frames: 3, loop: false };
    expect(mapLayerFrame(3, body, clothes)).toBe(1);
    expect(mapLayerFrame(5, body, clothes)).toBe(2);
    expect(atlasPosition(3, 2, 2, 1).backgroundPosition).toBe("100% 100%");
  });
  it("falls back to idle for invalid rows and clamps malformed atlas data", () => {
    const state = resolveSpriteState({ punch: { row: 9, frames: 8 }, idle: { row: 0, frames: 3 } }, "punch", 3, 2);
    expect(state.row).toBe(0); expect(state.frames).toBe(3);
    expect(atlasPosition(NaN, 0, Infinity, -1).backgroundSize).toBe("100% 100%");
  });
  it("preserves old 60 FPS metadata and lets an elemental action temporarily override the scene", () => {
    expect(resolveSpriteState({ idle: { row: 0, frames: 6, fps: 60 } }, "idle", 6).fps).toBe(60);
    expect(resolveCombatEnvironment("rain", "wind")).toBe("wind");
    expect(resolveCombatEnvironment("rain", "neutral")).toBe("rain");
    expect(resolveCombatEnvironment("rain")).toBe("rain");
    expect(resolveCombatEnvironment(undefined, "invalid")).toBe("neutral");
  });
});
describe("appearance cache", () => {
  it("deduplicates concurrent subscribers and reuses fresh data", async () => {
    const fetcher = vi.fn(async (id: string) => ({ id }));
    const cache = createResourceCache(fetcher);
    await Promise.all([cache.load("a"), cache.load("a"), cache.load("a")]);
    await cache.load("a"); expect(fetcher).toHaveBeenCalledTimes(1);
    await cache.load("a", true); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("retains good data after failure and does not leak another character's snapshot", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(["clothing"]).mockRejectedValueOnce(new Error("offline"));
    const cache = createResourceCache(fetcher);
    await cache.load("a"); await expect(cache.load("a", true)).rejects.toThrow("offline");
    expect(cache.get("a")).toEqual(["clothing"]); expect(cache.get("b")).toBeUndefined();
  });
  it("evicts inactive snapshots while retaining active subscriptions", async () => {
    const cache = createResourceCache(async (id: string) => id, 60_000, 2);
    const unsubscribe = cache.subscribe("a", () => {});
    await cache.load("a"); await cache.load("b"); await cache.load("c");
    expect(cache.get("a")).toBe("a"); expect(cache.get("b")).toBeUndefined(); unsubscribe();
  });
});
describe("cleanup minigame", () => {
  it("counts a spot only once even under repeated touch events", () => {
    let state = createCleanupState(normalizeCleanupConfig({ spots: 3 }), () => .5);
    state = cleanupReducer(state, { type: "clean", id: 0 });
    state = cleanupReducer(state, { type: "clean", id: 0 });
    expect(state.score).toBe(1);
    for (const id of [1, 2]) state = cleanupReducer(state, { type: "clean", id });
    expect(state.finished).toBe(true); expect(state.score).toBe(3);
  });
  it("uses both atlas axes and keeps target positions stable after asset load", () => {
    const state = createCleanupState(normalizeCleanupConfig({ spots: 12 }), () => .5);
    expect(state.spots.every((s) => s.x > 0 && s.x < 100 && s.y > 0 && s.y < 100)).toBe(true);
    expect(cleanupTileStyle(.99, 4, 3).backgroundPosition).toBe("100% 100%");
    expect(cleanupTileStyle(0, 4, 3).backgroundPosition).toBe("0% 0%");
  });
  it("rejects impossible new configurations, normalizes legacy records, and ignores expired clicks", () => {
    expect(cleanupConfigSchema.safeParse({ spots: 3, target_score: 8 }).success).toBe(false);
    const cfg = normalizeCleanupConfig({ spots: 3, target_score: 8 }); expect(cfg.target_score).toBe(3);
    const state = cleanupReducer(createCleanupState(cfg), { type: "tick", remaining: 0 });
    expect(cleanupReducer(state, { type: "clean", id: 0 }).score).toBe(0);
  });
});
describe("combat playback", () => {
  const logs = [1, 2, 3].map((seq) => ({ seq, actor: "player" as const, skill_name: "Soco" }));
  it("skips historical actions and plays each new sequence once in order", () => {
    expect(freshCombatEntries(logs, null)).toEqual({ latest: 3, entries: [] });
    expect(freshCombatEntries([logs[2], logs[1], logs[2]], 1).entries.map((e) => e.seq)).toEqual([2, 3]);
    expect(freshCombatEntries(logs, 3).entries).toEqual([]);
  });
  it("cancels a pending animation when the dialog closes", async () => {
    vi.useFakeTimers(); const controller = new AbortController();
    const result = delayPlayback(3000, controller.signal); controller.abort();
    expect(await result).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds the replay queue after reconnecting", () => {
    const log = Array.from({ length: 100 }, (_, i) => ({ seq: i + 1, actor: "npc" as const }));
    expect(freshCombatEntries(log, 0).entries).toHaveLength(24);
  });
  it("targets the correct duplicate NPC and maps enemy healing to its own side", () => {
    const players = [{ character_id: "ally", nickname: "Shinobi" }];
    const npcs = [{ id: "one", name: "Clone" }, { id: "two", character_id: "enemy", name: "Clone" }];
    expect(resolveCombatKeys({ seq: 1, actor: "player", actor_char_id: "ally", target_name: "Clone", target_npc_idx: 1 }, players, npcs))
      .toEqual({ actorKey: "player:ally", targetKey: "npc:1" });
    expect(resolveCombatKeys({ seq: 2, actor: "npc", actor_char_id: "enemy", actor_name: "Clone", heal: true, heal_target_ids: ["enemy"] }, players, npcs))
      .toEqual({ actorKey: "npc:1", targetKey: "npc:1" });
    expect(resolveCombatKeys({ seq: 3, actor: "player", target_char_id: "missing" }, players, npcs).targetKey).toBeNull();
  });
});

describe("visible polling", () => {
  it("does not overlap requests, sleeps while hidden and cleans up when stopped", async () => {
    vi.useFakeTimers();
    const tab = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal("document", tab);
    let finish!: () => void;
    const task = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockResolvedValue(undefined);
    const stop = startVisiblePolling(task, 100);
    await vi.advanceTimersByTimeAsync(400);
    expect(task).toHaveBeenCalledTimes(1);
    tab.hidden = true; finish();
    await vi.advanceTimersByTimeAsync(200);
    expect(task).toHaveBeenCalledTimes(1);
    tab.hidden = false; tab.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(2);
    stop(); tab.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(500);
    expect(task).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
});
describe("jutsu workshop", () => {
  it.each(SKILL_BLUEPRINTS)("round-trips $label without overwriting an existing skill", ({ skill }) => {
    const json = exportSkillBlueprint({ ...skill, id: "existing-id", created_at: "old" });
    const restored = importSkillBlueprint(json);
    expect(restored.name).toBe(skill.name); expect(restored).not.toHaveProperty("id"); expect(restored).not.toHaveProperty("created_at");
    expect(combatVisualSchema.safeParse(restored.meta?.visual).success).toBe(true);
  });
  it("rejects unversioned imports and uses safe defaults for old visual metadata", () => {
    expect(() => importSkillBlueprint('{"id":"x"}')).toThrow();
    expect(resolveSkillVisual({ energy_type: "ef", meta: { visual: { action: "invalid", chakra_color: "url(x)" } } }).action).toBe("punch");
    expect(resolveSkillVisual({ is_defensive: true }).action).toBe("guard");
    expect(copySkillBlueprint({ name: "Soco", rank: "E", id: "x" }).name).toBe("Soco (cópia)");
  });
});
describe("bounded chat history", () => {
  it("merges realtime with history without duplicates or unbounded growth", () => {
    const old = Array.from({ length: 100 }, (_, i) => ({ id: String(i), created_at: String(i).padStart(3, "0"), content: "old" }));
    const result = mergeChatWindow(old, [{ ...old[99], content: "edited" }]);
    expect(result).toHaveLength(80); expect(result[79].content).toBe("edited"); expect(result[0].id).toBe("20");
  });
});
