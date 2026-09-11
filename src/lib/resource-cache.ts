/** Shared read cache: deduplicates mounts and retains last good data on failure. */
export function createResourceCache<T>(fetcher: (id: string) => Promise<T>, ttl = 60_000, limit = 150) {
  const entries = new Map<string, { value: T; at: number }>();
  const pending = new Map<string, Promise<void>>();
  const listeners = new Map<string, Set<() => void>>();
  function prune() {
    for (const id of entries.keys()) {
      if (entries.size <= limit) break;
      if (!listeners.has(id) && !pending.has(id)) entries.delete(id);
    }
  }
  async function load(id: string, force = false): Promise<void> {
    const running = pending.get(id);
    if (running) {
      await running;
      if (force) return load(id, true);
      return;
    }
    const entry = entries.get(id);
    if (!force && entry && Date.now() - entry.at < ttl) return;
    const request = Promise.resolve().then(() => fetcher(id)).then((value) => {
      entries.delete(id);
      entries.set(id, { value, at: Date.now() });
      listeners.get(id)?.forEach((fn) => fn());
    }).finally(() => { pending.delete(id); prune(); });
    pending.set(id, request);
    return request;
  }
  return {
    get: (id: string) => entries.get(id)?.value,
    load,
    subscribe(id: string, callback: () => void) {
      if (!listeners.has(id)) listeners.set(id, new Set());
      const set = listeners.get(id)!;
      set.add(callback);
      return () => { set.delete(callback); if (!set.size) listeners.delete(id); prune(); };
    },
  };
}
