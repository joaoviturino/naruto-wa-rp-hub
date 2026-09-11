import { Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { setGamePreferences, useGamePreferences } from "@/hooks/useGamePreferences";
import { useId } from "react";
export function GameSettings({ compact = false }: { compact?: boolean }) {
  const preferences = useGamePreferences();
  const id = useId();
  return <Popover><PopoverTrigger asChild><Button variant="outline" size={compact ? "icon" : "sm"}
    className="min-h-11 shrink-0" aria-label="Opções do jogo"><Settings2 size={16} />{!compact && <span className="hidden sm:inline">Opções</span>}</Button></PopoverTrigger>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-5">
      <h3 className="font-semibold text-base">Opções do jogo</h3>
      <div className="flex gap-4 items-center justify-between"><div><Label htmlFor={`${id}-effects`}>Movimento reduzido</Label>
        <p className="text-sm text-muted-foreground mt-1">Menos animações e efeitos no combate.</p></div>
        <Switch id={`${id}-effects`} checked={preferences.effects === "reduced"} onCheckedChange={(v) => setGamePreferences({ effects: v ? "reduced" : "full" })} /></div>
      <div className="flex gap-4 items-center justify-between"><Label htmlFor={`${id}-sound`}>Som do combate</Label>
        <Switch id={`${id}-sound`} checked={preferences.sound} onCheckedChange={(v) => setGamePreferences({ sound: v })} /></div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium mb-2">Animações do combate</legend>
        <RadioGroup value={String(preferences.combatSpeed)} onValueChange={(v) => setGamePreferences({ combatSpeed: v === "2" ? 2 : 1 })} className="grid grid-cols-2 gap-2">
          {[1, 2].map((speed) => <Label key={speed} className="min-h-11 rounded border border-border p-3 flex gap-2 items-center" htmlFor={`${id}-${speed}`}>
            <RadioGroupItem id={`${id}-${speed}`} value={String(speed)} />{speed === 1 ? "Normal" : "Rápida · 2×"}</Label>)}
        </RadioGroup>
      </fieldset>
      <p className="text-xs text-muted-foreground">Preferências deste navegador. A velocidade não altera os turnos nem os atributos.</p>
    </PopoverContent>
  </Popover>;
}
