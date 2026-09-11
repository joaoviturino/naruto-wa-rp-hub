/** Fallback polling sleeps in background tabs and never overlaps slow requests. */
export function startVisiblePolling(task: () => Promise<unknown>, interval: number) {
  let stopped = false, busy = false;
  const tick = async () => {
    if (stopped || busy || document.hidden) return;
    busy = true;
    try { await task(); } catch { /* The next poll/realtime event can recover. */ }
    finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, interval);
  const onVisibility = () => { if (!document.hidden) void tick(); };
  document.addEventListener("visibilitychange", onVisibility);
  return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
}
