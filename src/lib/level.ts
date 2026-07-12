export type LevelConfig = {
  base_xp: number;
  growth_factor: number;
  max_level: number;
};

export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  base_xp: 100,
  growth_factor: 1.6,
  max_level: 100,
};

/** Total XP acumulado necessário para *alcançar* o nível n (nível 1 = 0 XP). */
export function totalXpForLevel(n: number, cfg: LevelConfig): number {
  if (n <= 1) return 0;
  return Math.floor(cfg.base_xp * Math.pow(n - 1, cfg.growth_factor));
}

/** Nível atual a partir do XP acumulado, respeitando o teto global. */
export function levelFromXp(xp: number, cfg: LevelConfig): number {
  if (xp <= 0) return 1;
  let lvl = 1;
  while (lvl < cfg.max_level && totalXpForLevel(lvl + 1, cfg) <= xp) lvl++;
  return lvl;
}

export function levelProgress(xp: number, cfg: LevelConfig) {
  const level = levelFromXp(xp, cfg);
  const curFloor = totalXpForLevel(level, cfg);
  const nextFloor = level >= cfg.max_level ? curFloor : totalXpForLevel(level + 1, cfg);
  const into = Math.max(0, xp - curFloor);
  const span = Math.max(1, nextFloor - curFloor);
  const pct = level >= cfg.max_level ? 100 : Math.min(100, (into / span) * 100);
  return { level, curFloor, nextFloor, into, span, pct, maxed: level >= cfg.max_level };
}