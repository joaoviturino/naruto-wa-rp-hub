import { useState } from "react";
import { AnimatedCharacter, ANIM_STATE_LABEL, type BodyConfig, type AnimState } from "@/components/AnimatedSprite";
import type { EquippedPiece } from "@/hooks/useCharacterCosmetics";
import type { SpriteEnvironment } from "@/lib/sprite-animation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw, FlipHorizontal, Pause, Play } from "lucide-react";

export const ENVIRONMENT_LABELS: Record<SpriteEnvironment, string> = {
  neutral: "Ambiente calmo", wind: "Vento", rain: "Chuva", water: "Sobre a água",
};
export function CharacterPreview({ body, pieces, characterId, initialState = "idle" }:
  { body: BodyConfig; pieces?: EquippedPiece[]; characterId?: string; initialState?: AnimState }) {
  const [state, setState] = useState<AnimState>(initialState);
  const [environment, setEnvironment] = useState<SpriteEnvironment>("neutral");
  const [flip, setFlip] = useState(false);
  const [restart, setRestart] = useState(0);
  const [playing, setPlaying] = useState(true);
  return <div className="space-y-3">
    <div className="character-preview-stage" data-environment={environment}>
      <span className="absolute top-3 left-3 z-20 text-xs uppercase tracking-widest text-gold">Prévia · {ANIM_STATE_LABEL[state]}</span>
      <AnimatedCharacter characterId={characterId} body={body} pieces={pieces} state={state}
        environment={environment} flipX={flip} restartKey={restart} motion={playing} className="h-full w-full" />
    </div>
    <div className="flex gap-2">
      <Button variant="outline" size="icon" aria-label={playing ? "Pausar prévia" : "Reproduzir prévia"}
        onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} /> : <Play size={16} />}</Button>
      <Button variant="outline" size="icon" aria-label="Repetir ação" onClick={() => { setRestart((v) => v + 1); setPlaying(true); }}><RotateCcw size={16} /></Button>
      <Button variant="outline" size="icon" aria-label="Virar personagem" aria-pressed={flip} onClick={() => setFlip(!flip)}><FlipHorizontal size={16} /></Button>
      <Select value={environment} onValueChange={(v) => setEnvironment(v as SpriteEnvironment)}>
        <SelectTrigger className="flex-1 min-w-0" aria-label="Ambiente da prévia"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(ENVIRONMENT_LABELS).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {(Object.entries(ANIM_STATE_LABEL) as [AnimState, string][]).map(([id, label]) => <Button key={id}
        variant={state === id ? "default" : "outline"} className="min-h-11 text-sm" aria-pressed={state === id}
        onClick={() => { setState(id); setRestart((v) => v + 1); setPlaying(true); }}>{label}</Button>)}
    </div>
    <p className="text-xs text-muted-foreground">Spritesheets usam os quadros cadastrados. Imagens estáticas recebem movimentos de apoio; os desenhos das poses podem ser configurados pela administração.</p>
  </div>;
}
