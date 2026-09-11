import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AnimatedCharacter } from "@/components/AnimatedSprite";
import { BASE_SPRITE_URL } from "@/lib/sprite-base";
import { resolveSkillVisual } from "@/lib/skill-blueprints";
import { useGamePreferences, useReducedGameMotion } from "@/hooks/useGamePreferences";
import { Play, RotateCcw } from "lucide-react";

/** Visual rehearsal using the same renderer and metadata as real combat. */
export function SkillTestDialog({ open, onOpenChange, skill }:
  { open: boolean; onOpenChange: (v: boolean) => void; skill: any }) {
  const [playing, setPlaying] = useState(false);
  const [impact, setImpact] = useState(false);
  const [replay, setReplay] = useState(0);
  const [fxAtTarget, setFxAtTarget] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const frame = useRef(0);
  const preferences = useGamePreferences();
  const reduced = useReducedGameMotion();
  const visual = resolveSkillVisual(skill);
  const healing = !!skill?.meta?.heal || skill?.meta?.restore?.pool === "hp";
  const defensive = !!skill?.is_defensive;
  const mode = skill?.animation_mode ?? "overlay";
  function clear() {
    timers.current.forEach(clearTimeout); timers.current = [];
    cancelAnimationFrame(frame.current); audio.current?.pause(); audio.current = null;
  }
  function reset() { clear(); setPlaying(false); setImpact(false); setFxAtTarget(false); }
  function run() {
    reset(); setReplay((v) => v + 1); setPlaying(true);
    const duration = (reduced ? 300 : visual.duration_ms) / preferences.combatSpeed;
    if (preferences.sound && skill?.sound_url) {
      const a = new Audio(skill.sound_url); audio.current = a; a.volume = .6; void a.play().catch(() => {});
    }
    frame.current = requestAnimationFrame(() => { frame.current = requestAnimationFrame(() => setFxAtTarget(true)); });
    timers.current.push(setTimeout(() => setImpact(true), duration * .35));
    timers.current.push(setTimeout(() => { setPlaying(false); audio.current?.pause(); }, duration));
    timers.current.push(setTimeout(() => setImpact(false), duration + 500));
  }
  useEffect(() => {
    if (!open) reset();
    return clear;
  }, [open]);
  useEffect(() => { if (!preferences.sound) audio.current?.pause(); }, [preferences.sound]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl max-h-[92dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{skill?.name || "Teste de habilidade"}</DialogTitle></DialogHeader>
      <div className="character-preview-stage" data-environment={visual.environment}>
        <div className="absolute inset-y-6 left-[5%] w-[40%]" style={{
          transform: playing && skill?.is_dash && !reduced ? "translateX(45%)" : undefined,
          transition: `transform ${200 / preferences.combatSpeed}ms ease-out` }}>
          <AnimatedCharacter body={{ imageUrl: BASE_SPRITE_URL }} pieces={[]}
            state={playing ? visual.action : "idle"} environment={visual.environment}
            chakraColor={visual.chakra_color} restartKey={replay} className="w-full h-full" />
          <span className="absolute bottom-0 inset-x-0 text-center text-sm">Usuário</span>
        </div>
        <div className="absolute inset-y-6 right-[5%] w-[40%]">
          <AnimatedCharacter body={{ imageUrl: BASE_SPRITE_URL }} pieces={[]} flipX
            state={impact && !healing && !defensive ? "hurt" : "idle"} restartKey={replay} className="w-full h-full" />
          <span className="absolute bottom-0 inset-x-0 text-center text-sm">{healing ? "Aliado" : "Alvo"}</span>
          {impact && <span className="absolute top-8 inset-x-0 text-center text-gold text-sm font-semibold">
            {healing ? "Cura" : defensive ? "Defesa preparada" : "Impacto"}</span>}
        </div>
        {playing && skill?.animation_url && !reduced && <div className="absolute top-[35%] w-28 h-28 pointer-events-none" style={{
          left: defensive ? "25%" : mode === "projectile" && !fxAtTarget ? "25%" : mode === "front" ? "60%" : "75%",
          transform: "translateX(-50%)", transition: mode === "projectile" ? `left ${visual.duration_ms * .35 / preferences.combatSpeed}ms ease-out` : undefined }}>
          {/\.(mp4|webm)(?:[?#]|$)/i.test(skill.animation_url)
            ? <video src={skill.animation_url} autoPlay playsInline muted className="w-full h-full object-contain" />
            : <img src={skill.animation_url} alt="Efeito da técnica" className="w-full h-full object-contain" />}
        </div>}
      </div>
      <div className="flex gap-2"><Button onClick={run}><Play size={16} />{playing ? "Reiniciar" : "Executar"}</Button>
        <Button variant="outline" onClick={reset}><RotateCcw size={16} /> Limpar</Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="rounded-lg bg-secondary p-3">Custo máximo<br /><b>{skill?.cost_percent ?? 20}% {(skill?.energy_type ?? "chakra").toUpperCase()}</b></div>
        <div className="rounded-lg bg-secondary p-3">Precisão<br /><b>{skill?.accuracy ?? 100}%</b></div>
        <div className="rounded-lg bg-secondary p-3">Recarga<br /><b>{skill?.cooldown_turns ?? 0} turnos</b></div>
        <div className="rounded-lg bg-secondary p-3">Energia efetiva<br /><b>×{skill?.bonus_energetic ?? 1}</b></div>
      </div>
      <p className="text-sm text-muted-foreground">Prévia de movimento, som e efeito. O dano e a cura reais dependem dos atributos, da energia usada e das regras do combate.</p>
    </DialogContent>
  </Dialog>;
}
