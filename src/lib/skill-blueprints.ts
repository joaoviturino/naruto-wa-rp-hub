import { z } from "zod";
import { isAnimState, isSpriteEnvironment, type AnimState, type SpriteEnvironment } from "./sprite-animation";

export const combatVisualSchema = z.object({
  action: z.enum(["idle", "run", "punch", "kick", "hurt", "cast", "death", "guard"]).default("cast"),
  environment: z.enum(["neutral", "wind", "rain", "water"]).default("neutral"),
  chakra_color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#69c7ff"),
  duration_ms: z.number().int().min(300).max(3000).default(1200),
});
export type CombatVisual = z.infer<typeof combatVisualSchema>;
const ELEMENT_COLORS: Record<string, string> = { katon: "#ff8b47", suiton: "#58bfff", fuuton: "#88e6c0", doton: "#d4ae73", raiton: "#c0abff" };
export function resolveSkillVisual(skill: { meta?: unknown; energy_type?: string | null; is_defensive?: boolean | null; element?: string | null }): CombatVisual {
  const meta = skill.meta as { visual?: Partial<CombatVisual> } | null | undefined;
  const v = meta?.visual;
  return {
    action: isAnimState(v?.action) ? v.action : skill.is_defensive ? "guard" : skill.energy_type === "ef" ? "punch" : "cast",
    environment: isSpriteEnvironment(v?.environment) ? v.environment : "neutral",
    chakra_color: typeof v?.chakra_color === "string" && /^#[0-9a-f]{6}$/i.test(v.chakra_color) ? v.chakra_color : ELEMENT_COLORS[skill.element ?? ""] ?? "#69c7ff",
    duration_ms: Number.isFinite(v?.duration_ms) ? Math.max(300, Math.min(3000, Number(v!.duration_ms))) : 1200,
  };
}

// Portable single-skill blueprints. Relation IDs and unknown legacy meta are preserved;
// identity/timestamps are always removed before a copy or import is saved.
export const skillBlueprintSchema = z.object({
  name: z.string().trim().min(1).max(80), rank: z.enum(["E", "D", "C", "B", "A", "S"]).default("E"),
  energy_type: z.enum(["ef", "em", "chakra"]).default("chakra"),
  cost_percent: z.number().int().min(1).max(100).default(20),
  cooldown_turns: z.number().int().min(0).max(50).default(0),
  accuracy: z.number().int().min(1).max(100).default(100),
  bonus_speed: z.number().min(0).max(100).default(1),
  bonus_critical: z.number().min(0).max(100).default(1),
  bonus_energetic: z.number().min(0).max(100).default(1),
  meta: z.object({ visual: combatVisualSchema.optional() }).passthrough().nullable().optional(),
}).passthrough();
export function copySkillBlueprint(value: unknown, rename = true) {
  const parsed = skillBlueprintSchema.parse(value);
  const { id, created_at, updated_at, ...copy } = parsed;
  return { ...copy, name: rename ? `${copy.name.slice(0, 72)} (cópia)` : copy.name };
}
export function importSkillBlueprint(text: string) {
  if (text.length > 200_000) throw new Error("O modelo deve ter até 200 KB.");
  const parsed = JSON.parse(text);
  if (parsed?.format !== "shinobi-skill" || parsed?.version !== 1) throw new Error("Use um modelo Shinobi de habilidade, versão 1.");
  return copySkillBlueprint(parsed.skill, false);
}
export function exportSkillBlueprint(value: unknown) {
  return JSON.stringify({ format: "shinobi-skill", version: 1, skill: copySkillBlueprint(value, false) }, null, 2);
}
export function skillBalanceNotes(skill: Record<string, any>) {
  const notes: string[] = [];
  if (skill.cost_percent >= 40) notes.push("Custo alto: teste a duração do combate com pouca energia.");
  if (skill.bonus_energetic > 2 && !skill.cooldown_turns) notes.push("Dano energético alto sem recarga: considere ao menos 1 turno de cooldown.");
  if (skill.is_defensive && skill.defense_percent >= 90 && !skill.cooldown_turns) notes.push("Defesa quase total sem recarga pode prolongar demais o duelo.");
  if (skill.meta?.genjutsu?.paralyze_turns > 0 && (skill.cooldown_turns ?? 0) <= skill.meta.genjutsu.paralyze_turns)
    notes.push("A paralisia dura tanto quanto a recarga; verifique se o alvo consegue voltar a agir.");
  if (skill.meta?.heal && skill.classification !== "suplementar") notes.push("Cura precisa da classificação suplementar para usar o fluxo de aliados.");
  return notes;
}
function blueprint(name: string, rank: string, description: string, extra: Record<string, unknown>) {
  return { name, rank, description, classification: "ofensivo", skill_class: "ninjutsu", range: "medio",
    energy_type: "chakra", base_cost: 0, cost_percent: 15, bonus_speed: 1, bonus_critical: 1,
    bonus_energetic: 1, cooldown_turns: 1, accuracy: 95, ...extra };
}
const visual = (action: AnimState, environment: SpriteEnvironment, chakra_color: string) => ({ action, environment, chakra_color, duration_ms: 1100 });
export const SKILL_BLUEPRINTS = [
  { id: "taijutsu", label: "Taijutsu · investida", skill: blueprint("Passo da Folha", "D", "Uma aproximação curta seguida de um soco preciso. Técnica de pressão para abrir o combate.",
    { energy_type: "ef", skill_class: "taijutsu", range: "curto", is_dash: true, cost_percent: 12, bonus_speed: 1.2, meta: { visual: visual("punch", "wind", "#99e6b4") } }) },
  { id: "kick", label: "Taijutsu · chute", skill: blueprint("Arco da Folha", "C", "Um chute em arco que concentra a força física num único impacto.",
    { energy_type: "ef", skill_class: "taijutsu", range: "curto", cost_percent: 20, cooldown_turns: 2, bonus_energetic: 1.3, meta: { visual: visual("kick", "wind", "#99e6b4") } }) },
  { id: "katon", label: "Katon · ofensivo", skill: blueprint("Katon: Brasa Errante", "C", "O shinobi molda chakra em uma rajada de fogo concentrada. Pressiona o adversário a média distância.",
    { element: "katon", cost_percent: 22, bonus_energetic: 1.25, cooldown_turns: 2, animation_mode: "projectile", meta: { visual: visual("cast", "neutral", "#ff8b47") } }) },
  { id: "suiton", label: "Suiton · defesa", skill: blueprint("Suiton: Manto da Maré", "C", "Uma película de água amortece o próximo golpe recebido. Requer planejamento da energia defensiva.",
    { element: "suiton", classification: "defensivo", is_defensive: true, defense_percent: 40, cooldown_turns: 2, meta: { visual: visual("guard", "water", "#58bfff") } }) },
  { id: "fuuton", label: "Fuuton · velocidade", skill: blueprint("Fuuton: Corte da Brisa", "D", "Um fluxo estreito de vento é lançado em direção ao adversário.",
    { element: "fuuton", bonus_speed: 1.25, cost_percent: 18, meta: { visual: visual("cast", "wind", "#88e6c0") } }) },
  { id: "iryo", label: "Iryō · cura", skill: blueprint("Iryō: Pulso Restaurador", "C", "O chakra médico estabiliza um aliado e restaura sua vitalidade pelo sistema de cura do jogo.",
    { classification: "suplementar", skill_class: "ninjutsu_medico", cost_percent: 20, cooldown_turns: 2,
      meta: { heal: { target: "single" }, visual: visual("cast", "neutral", "#6de0a4") } }) },
];
