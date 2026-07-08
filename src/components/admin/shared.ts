export const NINJA_RANKS = [
  { value: "estudante", label: "Estudante" },
  { value: "genin", label: "Genin" },
  { value: "chunin", label: "Chūnin" },
  { value: "tokubetsu_jonin", label: "Tokubetsu Jōnin" },
  { value: "jonin", label: "Jōnin" },
  { value: "anbu", label: "ANBU" },
  { value: "sannin", label: "Sannin" },
  { value: "kage", label: "Kage" },
] as const;

export const SKILL_RANKS = ["E","D","C","B","A","S"] as const;

export const PROFICIENCIES = [
  "kenjutsu","shurikenjutsu","taijutsu","ninjutsu","genjutsu","fuinjutsu","iryo",
] as const;

export const VILLAGES = [
  "konoha","suna","kiri","kumo","iwa","ame","kusa","taki","oto","yuki","hoshi","nomad",
] as const;

export const ELEMENTS = ["katon","suiton","fuuton","doton","raiton"] as const;

export const ITEM_TYPES = [
  "consumable","tool","armor_helmet","armor_vest","armor_pants","armor_boots","weapon_primary","weapon_secondary",
] as const;

export const CLASSIFICATIONS = ["ofensivo","defensivo","suplementar"] as const;
export const RANGES = ["curto","medio","longo"] as const;

export function labelize(s: string | null | undefined) {
  if (!s) return "—";
  return s.replace(/_/g, " ");
}