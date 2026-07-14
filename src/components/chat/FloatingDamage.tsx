import { useEffect, useState } from "react";

export type DamageBurst = {
  id: string;
  amount: number;
  crit?: boolean;
  heal?: boolean;
  label?: string;
};

/**
 * Overlay que renderiza números de dano flutuantes sobre um sprite.
 * Passe `bursts` — a lista é gerenciada pelo pai (ele adiciona e o próprio
 * componente remove após a animação encerrar).
 */
export function FloatingDamageLayer({
  bursts,
  onExpire,
}: {
  bursts: DamageBurst[];
  onExpire: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {bursts.map((b) => (
        <DamageNumber key={b.id} burst={b} onExpire={() => onExpire(b.id)} />
      ))}
    </div>
  );
}

function DamageNumber({ burst, onExpire }: { burst: DamageBurst; onExpire: () => void }) {
  const [offset] = useState(() => Math.round((Math.random() - 0.5) * 40));
  useEffect(() => {
    const t = setTimeout(onExpire, 1650);
    return () => clearTimeout(t);
  }, [onExpire]);
  const color = burst.heal
    ? "text-emerald-300"
    : burst.crit
      ? "text-gold"
      : "text-red-300";
  const size = burst.crit ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl";
  return (
    <div
      className={`absolute left-1/2 top-[45%] animate-damage-float font-display font-black ${size} ${color} drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]`}
      style={{ transform: `translate(calc(-50% + ${offset}px), 0)` }}
    >
      {burst.heal ? "+" : "-"}
      {burst.amount}
      {burst.crit && <span className="ml-1 text-sm align-super">CRIT!</span>}
    </div>
  );
}