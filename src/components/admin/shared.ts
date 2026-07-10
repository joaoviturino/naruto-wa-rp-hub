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

// Legado — mantido apenas para código antigo. O novo sistema usa SKILL_CLASSES
// com Nível + Maestria em letras (E→S).
export const PROFICIENCIES = [
  "kenjutsu","shurikenjutsu","taijutsu","ninjutsu","genjutsu","fuinjutsu","iryo",
] as const;

export function rankIndex(r: string | null | undefined): number {
  if (!r) return -1;
  return SKILL_RANKS.indexOf(r as any);
}

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

// Classes de habilidade — lista fechada, com descrições curtas para o admin.
// Fontes: Narutopedia (naruto.fandom.com) — resumos adaptados.
export const SKILL_CLASSES = [
  { value: "genjutsu", label: "Genjutsu", desc: "Ilusões que atacam o sistema nervoso e a percepção." },
  { value: "selos_de_mao", label: "Selos de Mão", desc: "Domínio dos selos manuais que moldam e liberam o chakra." },
  { value: "ninjutsu", label: "Ninjutsu", desc: "Técnicas de chakra puras (elementais, invocações, etc.)." },
  { value: "taijutsu", label: "Taijutsu", desc: "Combate corpo a corpo baseado em força física." },
  { value: "shinjutsu", label: "Shinjutsu", desc: "Técnicas divinas ligadas ao chakra do Shinju/Ootsutsuki." },
  { value: "armadilha", label: "Armadilha", desc: "Preparação de armadilhas e explosivos." },
  { value: "boujutsu", label: "Boujutsu", desc: "Combate com bastões." },
  { value: "bukijutsu", label: "Bukijutsu", desc: "Uso genérico de armas ninja." },
  { value: "bunshinjutsu", label: "Bunshinjutsu", desc: "Criação de clones." },
  { value: "doujutsu", label: "Doujutsu", desc: "Técnicas oculares (Sharingan, Byakugan, etc.)." },
  { value: "fluxo_de_chakra", label: "Fluxo de Chakra", desc: "Canaliza chakra elemental em armas." },
  { value: "formacao", label: "Formação", desc: "Táticas coordenadas entre múltiplos ninjas." },
  { value: "estilo_de_luta", label: "Estilo de Luta", desc: "Estilos marciais específicos (Gōken, Jūken...)." },
  { value: "fuuinjutsu", label: "Fuuinjutsu", desc: "Selamento de objetos, chakra ou seres." },
  { value: "gijutsu", label: "Gijutsu", desc: "Técnicas científicas / tecnologia ninja." },
  { value: "hiden", label: "Hiden", desc: "Técnicas secretas de clã ou vila, passadas por herança." },
  { value: "juinjutsu", label: "Juinjutsu", desc: "Selos amaldiçoados que dominam o portador." },
  { value: "jujutsu", label: "Jujutsu", desc: "Combate com projeção e alavancagem." },
  { value: "jutsu_basico", label: "Jutsu Básico", desc: "Técnicas fundamentais ensinadas na Academia." },
  { value: "kaijutsu", label: "Kaijutsu", desc: "Contra-medidas: dispersa ou anula outras técnicas." },
  { value: "kekkaijutsu", label: "Kekkaijutsu", desc: "Barreiras de chakra." },
  { value: "kekkei_genkai", label: "Kekkei Genkai", desc: "Habilidades hereditárias (linhagem sanguínea)." },
  { value: "kekkei_moura", label: "Kekkei Mōra", desc: "Kekkei ancestral únicas dos Ōtsutsuki." },
  { value: "kekkei_touta", label: "Kekkei Tōta", desc: "Combinação avançada de três naturezas elementares." },
  { value: "kenjutsu", label: "Kenjutsu", desc: "Combate com espadas." },
  { value: "kinjutsu", label: "Kinjutsu", desc: "Técnicas proibidas por seu custo ou tabu." },
  { value: "kinkojutsu", label: "Kinkojutsu", desc: "Técnicas de aprisionamento e imobilização." },
  { value: "konbijutsu", label: "Konbijutsu", desc: "Técnicas combinadas entre dois ou mais ninjas." },
  { value: "kugutsujutsu", label: "Kugutsujutsu", desc: "Manipulação de marionetes ninja." },
  { value: "kyuuinjutsu", label: "Kyuuinjutsu", desc: "Absorção de chakra ou de outras técnicas." },
  { value: "ninjutsu_espaco_tempo", label: "Ninjutsu Espaço-Tempo", desc: "Manipula distância e dimensões (teletransporte, Kamui)." },
  { value: "ninjutsu_medico", label: "Ninjutsu Médico", desc: "Cura e cirurgia via chakra." },
  { value: "nintaijutsu", label: "Nintaijutsu", desc: "Fusão de ninjutsu com taijutsu (Rasengan, Chidori)." },
  { value: "saiseijutsu", label: "Saiseijutsu", desc: "Regeneração acelerada." },
  { value: "senjutsu", label: "Senjutsu", desc: "Uso da energia natural (Modo Sábio)." },
  { value: "shurikenjutsu", label: "Shurikenjutsu", desc: "Uso de shuriken, kunai e projéteis." },
  { value: "tansakujutsu", label: "Tansakujutsu", desc: "Rastreamento e detecção (sensores)." },
  { value: "tenseijutsu", label: "Tenseijutsu", desc: "Ressurreição de mortos (Edo Tensei, Rinne Tensei)." },
  { value: "tonjutsu", label: "Tonjutsu", desc: "Técnicas de evasão e fuga furtiva." },
  { value: "yuugoujutsu", label: "Yuugoujutsu", desc: "Fusão entre criaturas ou entre ninja e criatura." },
] as const;