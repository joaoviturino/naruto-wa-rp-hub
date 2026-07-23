import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { grantStarterKit, completeTutorial, getTutorialProgress, setTutorialFlag } from "@/lib/tutorial.functions";
import { consumeItem } from "@/lib/character.functions";
import { startTutorialCombat } from "@/lib/combat.functions";
import { Check, ChevronDown, ChevronUp, Gift, Shirt, MessageCircle, Swords, X, Zap } from "lucide-react";
import { toast } from "sonner";
import neutralImg from "@/assets/instructor-neutral.jpg";
import happyImg from "@/assets/instructor-happy.jpg";
import seriousImg from "@/assets/instructor-serious.jpg";

type Mood = "neutral" | "happy" | "serious";
const MOOD_IMG: Record<Mood, string> = { neutral: neutralImg, happy: happyImg, serious: seriousImg };

type StepId = "kit" | "equip" | "energy" | "combat" | "final";
type Step = {
  id: StepId;
  mood: Mood;
  title: string;
  text: string;
  hint?: string;
  icon: React.ReactNode;
};

const STEPS: Step[] = [
  {
    id: "kit",
    mood: "happy",
    title: "1. Kit inicial + 1000 XP",
    text: "Bem-vindo, jovem shinobi. Antes de tudo, aceite este kit: Colete de Treinamento, Kunais e Rações — e um bônus de 1000 XP pra você não morrer no primeiro golpe.",
    hint: "Clique em Receber Kit abaixo.",
    icon: <Gift size={16} />,
  },
  {
    id: "equip",
    mood: "neutral",
    title: "2. Equipe o Colete de Treinamento",
    text: "Vá na aba Inventário (Ficha), encontre o Colete de Treinamento na Bolsa Ninja e clique nele. No menu que abre, escolha Equipar.",
    hint: "Vou perceber sozinho quando o colete estiver equipado.",
    icon: <Shirt size={16} />,
  },
  {
    id: "energy",
    mood: "neutral",
    title: "3. Consuma uma Ração de Soldado",
    text: "Rações restauram suas energias (EF, EM, Chakra). Sem energia, você não usa jutsu. Clique em Consumir Ração para eu ver você fazer isso na prática.",
    hint: "Você pode consumir de novo pela aba Inventário quando quiser.",
    icon: <Zap size={16} />,
  },
  {
    id: "combat",
    mood: "serious",
    title: "4. Combate simulado: Javali Selvagem",
    text:
      "Chegou a hora. Vou soltar um Javali de Treino contra você. No campo de batalha:\n\n• Clique no inimigo para mirar (aura vermelha).\n• Escolha uma habilidade — cada uma gasta energia (EF/EM/Chakra) e tem cooldown.\n• Confirme o ataque. Quem tem mais Velocidade age primeiro.\n\nDerrote (ou fuja d)o javali para concluir. Se apanhar feio, use outra Ração.",
    hint: "Preciso que você chegue até o fim do combate.",
    icon: <Swords size={16} />,
  },
  {
    id: "final",
    mood: "happy",
    title: "Você está pronto",
    text: "Isso é o essencial. O resto você aprende com o mundo, com os NPCs e com outros ninjas. Boa sorte lá fora — a vila conta com você.",
    icon: <Check size={16} />,
  },
];

export function TutorialOverlay({ characterId, onDone }: { characterId: string; onDone: () => void }) {
  const router = useRouter();
  const grant = useServerFn(grantStarterKit);
  const consume = useServerFn(consumeItem);
  const startCombat = useServerFn(startTutorialCombat);
  const loadProgress = useServerFn(getTutorialProgress);
  const flag = useServerFn(setTutorialFlag);
  const finishFn = useServerFn(completeTutorial);

  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState<Record<StepId, boolean>>({
    kit: false, equip: false, energy: false, combat: false, final: false,
  });
  const [rationItemId, setRationItemId] = useState<string | null>(null);
  const [hasRation, setHasRation] = useState(false);
  const [activeCombatId, setActiveCombatId] = useState<string | null>(null);
  const combatStartedRef = useRef<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const finishedRef = useRef(false);

  const step = STEPS[stepIdx];

  const markDone = useCallback((id: StepId, persist = true) => {
    setDone((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      const nextIdx = STEPS.findIndex((s) => !next[s.id]);
      if (nextIdx >= 0) setStepIdx(nextIdx);
      return next;
    });
    if (persist) flag({ data: { character_id: characterId, flag: stepFlag(id) } } as any).catch(() => {});
  }, [characterId, flag]);

  // Sincroniza com o servidor: fonte da verdade do progresso.
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const p = await loadProgress({ data: { character_id: characterId } } as any) as any;
        if (cancelled) return;
        setRationItemId(p.ration_item_id);
        setHasRation(p.has_ration);
        setActiveCombatId(p.active_combat_id);
        const st = p.state ?? {};
        setDone((prev) => {
          const next = { ...prev };
          if (st.kit_granted) next.kit = true;
          if (p.has_vest_equipped) next.equip = true;
          if (st.energy_recovered) next.energy = true;
          if (st.combat_completed) next.combat = true;
          if (st.completed) next.final = true;
          return next;
        });
        // Detecta término do combate de treino
        if (combatStartedRef.current && !p.active_combat_id) {
          const finishedId = combatStartedRef.current;
          combatStartedRef.current = null;
          const { data: sess } = await supabase
            .from("combat_sessions").select("status").eq("id", finishedId).maybeSingle();
          if (sess && (sess as any).status !== "active") {
            await flag({ data: { character_id: characterId, flag: "combat_completed" } } as any).catch(() => {});
            markDone("combat", false);
          }
        }
      } catch {}
    }
    sync();
    const t = setInterval(sync, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [characterId, loadProgress, flag, markDone]);

  // Após primeiro sync, avança para a próxima pendente
  useEffect(() => {
    const nextIdx = STEPS.findIndex((s) => !done[s.id]);
    if (nextIdx >= 0) setStepIdx((cur) => (done[STEPS[cur].id] ? nextIdx : cur));
  }, [done]);

  async function handleGrant() {
    setBusy(true);
    try {
      const r: any = await grant({ data: { character_id: characterId } } as any);
      if (r?.already) toast.info("Kit já concedido — sem duplicatas.");
      else toast.success(`Kit + ${r?.xp_gained ?? 1000} XP recebidos!`);
      markDone("kit");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao conceder o kit.");
    } finally { setBusy(false); }
  }

  async function handleConsumeRation() {
    if (!rationItemId) { toast.error("Você não tem Ração — pegue o kit primeiro."); return; }
    setBusy(true);
    try {
      await consume({ data: { item_id: rationItemId, source: "ninja_bag" } } as any);
      toast.success("Ração consumida — energias restauradas!");
      await flag({ data: { character_id: characterId, flag: "energy_recovered" } } as any).catch(() => {});
      markDone("energy", false);
    } catch (e: any) {
      // Tenta secondary_slots
      try {
        await consume({ data: { item_id: rationItemId, source: "secondary_slots" } } as any);
        toast.success("Ração consumida — energias restauradas!");
        await flag({ data: { character_id: characterId, flag: "energy_recovered" } } as any).catch(() => {});
        markDone("energy", false);
      } catch (e2: any) {
        toast.error(e2?.message ?? e?.message ?? "Falha ao consumir.");
      }
    } finally { setBusy(false); }
  }

  async function handleStartCombat() {
    setBusy(true);
    try {
      const r: any = await startCombat({});
      combatStartedRef.current = r.session_id;
      toast.success("Um javali apareceu — boa sorte!");
      router.navigate({ to: "/chat" as any });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar o combate.");
    } finally { setBusy(false); }
  }

  async function handleFinish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setBusy(true);
    try {
      await finishFn({ data: { character_id: characterId } });
    } catch {
      await supabase.from("characters").update({ tutorial_completed: true }).eq("id", characterId);
    } finally {
      setBusy(false);
      onDone();
    }
  }

  const allDone = STEPS.every((s) => done[s.id]);

  return (
    <div className="fixed bottom-3 right-3 z-[100] w-[min(94vw,420px)] pointer-events-none">
      <div className="pointer-events-auto scroll-panel rounded-lg border border-gold/40 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gold/20 bg-black/40">
          <img src={MOOD_IMG[step.mood]} alt="" className="w-8 h-8 rounded-full object-cover border border-gold/40" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gold">Sensei Hikaru</div>
            <div className="text-xs text-muted-foreground truncate">
              {Object.values(done).filter(Boolean).length}/{STEPS.length} tarefas concluídas
            </div>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleFinish}
            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title="Pular tutorial"
          >
            <X size={14} />
          </button>
        </div>

        {!collapsed && (
          <div className="grid grid-cols-[100px_1fr] gap-0">
            <div className="relative bg-black/50">
              <img
                key={step.mood}
                src={MOOD_IMG[step.mood]}
                alt="Sensei"
                className="w-full h-full object-cover animate-in fade-in duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
            </div>

            <div className="p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-gold">
                {step.icon}
                <h3 className="font-display text-sm font-bold leading-tight">{step.title}</h3>
              </div>
              <p className="text-[12px] leading-relaxed text-foreground/90 whitespace-pre-line">
                {step.text}
              </p>
              {step.hint && (
                <p className="text-[10px] italic text-muted-foreground">{step.hint}</p>
              )}

              {/* Ações por passo */}
              <div className="flex flex-wrap gap-2 mt-1">
                {step.id === "kit" && !done.kit && (
                  <Button size="sm" onClick={handleGrant} disabled={busy} className="bg-gold text-black hover:bg-gold/90">
                    <Gift size={14} className="mr-1" /> Receber Kit + 1000 XP
                  </Button>
                )}
                {step.id === "equip" && !done.equip && (
                  <span className="text-[11px] text-muted-foreground italic">Aguardando colete equipado…</span>
                )}
                {step.id === "energy" && !done.energy && (
                  <Button size="sm" onClick={handleConsumeRation} disabled={busy || !hasRation}
                    className="bg-gold text-black hover:bg-gold/90">
                    <Zap size={14} className="mr-1" /> {hasRation ? "Consumir Ração" : "Sem ração na bolsa"}
                  </Button>
                )}
                {step.id === "combat" && !done.combat && (
                  <>
                    {activeCombatId ? (
                      <Button size="sm" onClick={() => router.navigate({ to: "/chat" as any })}
                        className="bg-gold text-black hover:bg-gold/90">
                        <Swords size={14} className="mr-1" /> Voltar ao Combate
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleStartCombat} disabled={busy}
                        className="bg-gold text-black hover:bg-gold/90">
                        <Swords size={14} className="mr-1" /> Enfrentar Javali
                      </Button>
                    )}
                  </>
                )}
                {step.id === "final" && !done.final && (
                  <Button size="sm" onClick={() => markDone("final")} variant="secondary">
                    <Check size={14} className="mr-1" /> Marcar como lido
                  </Button>
                )}
                {done[step.id] && !allDone && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> Concluído
                  </span>
                )}
                {allDone && (
                  <Button size="sm" onClick={handleFinish} disabled={busy} className="bg-gold text-black hover:bg-gold/90 ml-auto">
                    {busy ? "..." : "Finalizar tutorial"}
                  </Button>
                )}
              </div>

              {/* Trilha */}
              <div className="flex items-center gap-1 mt-2">
                {STEPS.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setStepIdx(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === stepIdx ? "w-6 bg-gold" : done[s.id] ? "w-3 bg-emerald-500/70" : "w-3 bg-muted"
                    }`}
                    title={s.title}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}