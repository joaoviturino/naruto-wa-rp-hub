import { AnimatedCharacter, ANIM_STATE_LABEL, type AnimState } from "@/components/AnimatedSprite";
import { BASE_SPRITE_URL } from "@/lib/sprite-base";
import { resolveSkillVisual, skillBalanceNotes } from "@/lib/skill-blueprints";
import { ENVIRONMENT_LABELS } from "@/components/CharacterPreview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SpriteEnvironment } from "@/lib/sprite-animation";
export function SkillVisualFields({ skill, onChange }: { skill: Record<string, any>; onChange: (meta: Record<string, unknown>) => void }) {
  const visual = resolveSkillVisual(skill);
  const patch = (v: Partial<typeof visual>) => onChange({ ...(skill.meta ?? {}), visual: { ...visual, ...v } });
  const notes = skillBalanceNotes(skill);
  return <section className="sm:col-span-2 rounded-xl border border-gold/30 p-4 space-y-4">
    <h4 className="font-display text-lg text-gold">Movimento e ambiente</h4>
    <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
      <AnimatedCharacter body={{ imageUrl: BASE_SPRITE_URL }} pieces={[]} state={visual.action}
        environment={visual.environment} chakraColor={visual.chakra_color} className="h-40 w-full rounded-lg bg-secondary" />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Ação do personagem</Label><Select value={visual.action} onValueChange={(v) => patch({ action: v as AnimState })}>
          <SelectTrigger aria-label="Ação do personagem"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ANIM_STATE_LABEL).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
        </Select></div>
        <div><Label>Reação da roupa</Label><Select value={visual.environment} onValueChange={(v) => patch({ environment: v as SpriteEnvironment })}>
          <SelectTrigger aria-label="Reação da roupa"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ENVIRONMENT_LABELS).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
        </Select></div>
        <div><Label htmlFor="skill-chakra-color">Cor do chakra</Label><Input id="skill-chakra-color" type="color" value={visual.chakra_color} onChange={(e) => patch({ chakra_color: e.target.value })} /></div>
        <div><Label htmlFor="skill-duration">Duração visual (ms)</Label><Input id="skill-duration" type="number" min={300} max={3000} step={100} value={visual.duration_ms} onChange={(e) => patch({ duration_ms: Number(e.target.value) })} /></div>
      </div>
    </div>
    <p className="text-sm text-muted-foreground">A ação acompanha os cosméticos equipados no combate. Use o teste para repetir a animação. Os efeitos visuais não alteram os atributos.</p>
    {notes.length > 0 && <ul className="space-y-1 text-sm text-amber-300 list-disc pl-5">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
  </section>;
}
