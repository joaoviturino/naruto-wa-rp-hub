import { useEffect, useState } from "react";

/**
 * Overlay de partículas verdes subindo — feedback visual dos jutsus médicos
 * de cura (classe iryo, classificação suplementar). Auto-remove após ~1.5s.
 */
export function HealParticles({
  count = 16,
  onDone,
}: {
  count?: number;
  onDone?: () => void;
}) {
  const [particles] = useState(() =>
    Array.from({ length: count }).map((_, i) => ({
      i,
      size: 5 + Math.random() * 7,
      tx: (Math.random() - 0.5) * 90,
      delay: Math.round(Math.random() * 350),
      dur: 900 + Math.round(Math.random() * 700),
      left: 20 + Math.random() * 60, // % dentro do sprite
    })),
  );
  useEffect(() => {
    if (!onDone) return;
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible animate-heal-glow rounded-md">
      {particles.map((p) => (
        <span
          key={p.i}
          className="absolute bottom-1 block rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.95)] animate-heal-rise"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            // @ts-ignore CSS custom property
            "--tx": `${p.tx}px`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.dur}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}