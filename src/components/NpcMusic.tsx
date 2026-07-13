import { useEffect, useRef } from "react";

/** Plays an NPC's background music while mounted (looped, low volume). */
export function NpcMusic({ src, volume = 0.35 }: { src?: string | null; volume?: number }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = ref.current;
    if (!a || !src) return;
    a.volume = volume;
    a.loop = true;
    a.play().catch(() => { /* autoplay may be blocked until user gesture */ });
    return () => { a.pause(); };
  }, [src, volume]);
  if (!src) return null;
  return <audio ref={ref} src={src} preload="auto" />;
}