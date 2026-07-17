import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HealParticles } from "@/components/chat/HealParticles";
import { Play, RotateCcw, Volume2 } from "lucide-react";

type Fx = {
  id: string;
  url: string;
  mode: "projectile" | "front" | "overlay";
  isVideo: boolean;
};

/**
 * Ambiente de teste isolado para uma habilidade em edição.
 * Renderiza um palco fake (caster à esquerda, alvo à direita) e executa
 * animação + som conforme o modo configurado. Nada é persistido — é
 * apenas visualização.
 */
export function SkillTestDialog({
  open,
  onOpenChange,
  skill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  skill: any;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const casterRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [endPos, setEndPos] = useState<{ x: number; y: number } | null>(null);
  const [showHeal, setShowHeal] = useState(false);
  const [showDamage, setShowDamage] = useState<null | { amount: number; crit: boolean }>(null);
  const [log, setLog] = useState<string[]>([]);

  function center(el: HTMLElement | null) {
    const s = stageRef.current;
    if (!el || !s) return { x: 0, y: 0 };
    const sr = s.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top };
  }

  function isHealSkill() {
    const cls = skill?.skill_class || skill?.req_class;
    return (
      skill?.classification === "suplementar" &&
      (cls === "ninjutsu_medico" || skill?.meta?.heal || skill?.meta?.restore?.pool === "hp")
    );
  }

  function reset() {
    setFx(null);
    setPos(null);
    setEndPos(null);
    setShowHeal(false);
    setShowDamage(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function run() {
    reset();
    const url: string | null = skill?.animation_url ?? null;
    const mode: Fx["mode"] = skill?.animation_mode ?? "overlay";
    const isVideo = !!url && /\.(mp4|webm)$/i.test(url);
    const from = center(casterRef.current);
    const to = center(targetRef.current);

    const newLog: string[] = [];
    newLog.push(`▶ ${skill?.name || "Habilidade sem nome"}`);
    newLog.push(`• Modo de animação: ${mode}`);
    newLog.push(`• Energia: ${skill?.energy_type ?? "chakra"} — custo até ${skill?.cost_percent ?? 20}% da pool`);
    newLog.push(`• Precisão: ${skill?.accuracy ?? 100}% · Cooldown: ${skill?.cooldown_turns ?? 0} turnos`);
    newLog.push(
      `• Bônus — velocidade x${skill?.bonus_speed ?? 1} · crítico x${skill?.bonus_critical ?? 1} · energético x${skill?.bonus_energetic ?? 1}`,
    );
    if (skill?.is_defensive) newLog.push(`🛡 Defensiva: reduz ${skill?.defense_percent ?? 50}% de dano`);
    if (isHealSkill()) newLog.push(`💚 Iryō — cura de HP com partículas verdes`);
    if (skill?.sound_url) newLog.push(`🔊 Som: reproduzindo…`);
    if (!url) newLog.push(`⚠ Sem animação carregada — só som/efeitos serão simulados.`);
    setLog(newLog);

    // Som
    if (skill?.sound_url && audioRef.current) {
      try {
        audioRef.current.src = skill.sound_url;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch {}
    }

    // Animação
    if (url) {
      let start = to;
      let end = to;
      if (mode === "projectile") { start = from; end = to; }
      else if (mode === "front") {
        const dx = from.x - to.x, dy = from.y - to.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const off = 70;
        start = end = { x: to.x + (dx / len) * off, y: to.y + (dy / len) * off };
      }
      setFx({ id: String(Date.now()), url, mode, isVideo });
      setPos(start);
      setEndPos(end);
      if (mode === "projectile") {
        requestAnimationFrame(() => setPos(end));
      }
    }

    // Feedback: cura ou dano fake
    setTimeout(() => {
      if (isHealSkill()) {
        setShowHeal(true);
      } else {
        const crit = (skill?.bonus_critical ?? 1) > 1 && Math.random() < 0.35;
        const base = Math.round(20 + Math.random() * 30);
        const amount = crit ? Math.round(base * (skill?.bonus_critical ?? 1.5)) : base;
        setShowDamage({ amount, crit });
      }
    }, 700);

    // Limpa FX visual após duração
    setTimeout(() => setFx(null), 1800);
  }

  useEffect(() => { if (!open) reset(); /* eslint-disable-next-line */ }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Testar habilidade — ambiente de simulação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div
            ref={stageRef}
            className="relative w-full h-[320px] rounded-lg overflow-hidden border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          >
            {/* piso */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            {/* caster */}
            <div
              ref={casterRef}
              className="absolute bottom-6 left-10 w-24 h-40 rounded-md bg-emerald-500/20 border border-emerald-400/60 flex items-end justify-center text-[10px] text-emerald-200 pb-1"
            >
              Caster
            </div>
            {/* target */}
            <div
              ref={targetRef}
              className="absolute bottom-6 right-10 w-24 h-40 rounded-md bg-rose-500/20 border border-rose-400/60 flex items-end justify-center text-[10px] text-rose-200 pb-1"
            >
              Alvo
              {showHeal && <HealParticles onDone={() => setShowHeal(false)} />}
              {showDamage && (
                <div
                  className="absolute -top-6 left-1/2 -translate-x-1/2 font-display font-bold pointer-events-none animate-fade-in"
                  style={{
                    color: showDamage.crit ? "#fde047" : "#fca5a5",
                    textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                    fontSize: showDamage.crit ? 28 : 22,
                  }}
                  onAnimationEnd={() => setTimeout(() => setShowDamage(null), 600)}
                >
                  -{showDamage.amount}{showDamage.crit ? " CRIT!" : ""}
                </div>
              )}
            </div>
            {/* FX */}
            {fx && pos && (
              <div
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: 140,
                  height: 140,
                  transform: "translate(-50%, -50%)",
                  transition:
                    fx.mode === "projectile"
                      ? "left 700ms cubic-bezier(.4,.6,.4,1), top 700ms cubic-bezier(.4,.6,.4,1)"
                      : undefined,
                  pointerEvents: "none",
                  filter: "drop-shadow(0 0 12px rgba(255,220,120,0.6))",
                  zIndex: 20,
                }}
                className="animate-fade-in"
              >
                {fx.isVideo ? (
                  <video src={fx.url} autoPlay muted playsInline loop className="w-full h-full object-contain" />
                ) : (
                  <img src={fx.url} alt="" className="w-full h-full object-contain" />
                )}
              </div>
            )}
            {/* Badge modo */}
            <div className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded bg-black/50 text-gold uppercase tracking-wider">
              Ambiente de teste · sem persistência
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={run}><Play size={14} /> Executar</Button>
            <Button size="sm" variant="outline" onClick={reset}><RotateCcw size={14} /> Limpar</Button>
            {skill?.sound_url && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Volume2 size={12} /> som configurado
              </span>
            )}
          </div>

          <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-line">
            {log.length === 0 ? (
              <span className="text-muted-foreground">
                Clique em <b>Executar</b> para simular a habilidade. Nada é salvo — é apenas visualização
                da animação, som e efeitos visuais configurados.
              </span>
            ) : (
              log.join("\n")
            )}
          </div>

          <audio ref={audioRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}