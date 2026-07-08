// Domain helpers shared by client and server.
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Village =
  | "konoha" | "suna" | "kiri" | "kumo" | "iwa"
  | "ame" | "kusa" | "taki" | "oto" | "yuki" | "hoshi" | "nomad";
export type Element = "katon" | "suiton" | "fuuton" | "doton" | "raiton";

export const VILLAGES: { id: Village; name: string; kanji: string; blurb: string }[] = [
  { id: "konoha", name: "Konohagakure", kanji: "木ノ葉", blurb: "Vila oculta da Folha." },
  { id: "suna", name: "Sunagakure", kanji: "砂", blurb: "Vila oculta da Areia." },
  { id: "kiri", name: "Kirigakure", kanji: "霧", blurb: "Vila oculta da Névoa." },
  { id: "kumo", name: "Kumogakure", kanji: "雲", blurb: "Vila oculta da Nuvem." },
  { id: "iwa", name: "Iwagakure", kanji: "岩", blurb: "Vila oculta da Pedra." },
  { id: "ame", name: "Amegakure", kanji: "雨", blurb: "Vila oculta da Chuva." },
  { id: "kusa", name: "Kusagakure", kanji: "草", blurb: "Vila oculta da Grama." },
  { id: "taki", name: "Takigakure", kanji: "滝", blurb: "Vila oculta da Cachoeira." },
  { id: "oto", name: "Otogakure", kanji: "音", blurb: "Vila oculta do Som." },
  { id: "yuki", name: "Yukigakure", kanji: "雪", blurb: "Vila oculta da Neve." },
  { id: "hoshi", name: "Hoshigakure", kanji: "星", blurb: "Vila oculta da Estrela." },
  { id: "nomad", name: "Nômade", kanji: "無宿", blurb: "Sem afiliação a nenhuma vila." },
];

export const ELEMENTS: { id: Element; name: string; color: string; kanji: string }[] = [
  { id: "katon", name: "Katon (Fogo)", color: "oklch(0.6 0.24 25)", kanji: "火" },
  { id: "suiton", name: "Suiton (Água)", color: "oklch(0.6 0.18 220)", kanji: "水" },
  { id: "fuuton", name: "Fuuton (Vento)", color: "oklch(0.75 0.15 140)", kanji: "風" },
  { id: "doton", name: "Doton (Terra)", color: "oklch(0.55 0.15 60)", kanji: "土" },
  { id: "raiton", name: "Raiton (Raio)", color: "oklch(0.78 0.18 90)", kanji: "雷" },
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "text-muted-foreground",
  uncommon: "text-emerald-400",
  rare: "text-sky-400",
  epic: "text-fuchsia-400",
  legendary: "text-gold",
};

export const NINJA_BAG_CAPACITY = 20;
export const SECONDARY_SLOTS = 10;

export function stats(xp: number) {
  const half = Math.floor(xp / 2);
  return { xp, ef: half, em: xp - half, chakra: xp };
}