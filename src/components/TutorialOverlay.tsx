import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { grantStarterKit, completeTutorial } from "@/lib/tutorial.functions";
import { Check, ChevronDown, ChevronUp, Gift, Shirt, MessageCircle, Swords, X } from "lucide-react";
import { toast } from "sonner";
import neutralImg from "@/assets/instructor-neutral.jpg";
import happyImg from "@/assets/instructor-happy.jpg";
import seriousImg from "@/assets/instructor-serious.jpg";

type Mood = "neutral" | "happy" | "serious";
const MOOD_IMG: Record<Mood, string> = { neutral: neutralImg, happy: happyImg, serious: seriousImg };

type StepId = "kit" | "equip" | "chat" | "combat" | "final";
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
    title: "1. Receba seu kit inicial",
    text: "Bem-vindo, jovem shinobi. Antes de qualquer coisa, aceite este kit: um Colete de Treinamento, algumas Kunais e Rações. Sem equipamento, você não sobrevive.",
    hint: "Clique em Receber Kit abaixo.",
    icon: <Gift size={16} />,
  },
  {
    id: "equip",
    mood: "neutral",
    title: "2. Equipe o Colete de Treinamento",
    text: "Vá na aba Inventário, encontre o Colete de Treinamento na Bolsa Ninja e clique nele. No menu que abre, escolha Equipar. Se quiser trocar, clique no slot equipado e use Desequipar.",
    hint: "Vou perceber sozinho quando o colete estiver equipado.",
    icon: <Shirt size={16} />,
  },
  {
    id: "chat",
    mood: "neutral",
    title: "3. Vá para o Chat da sua Vila",
    text: "É no chat que a vida acontece: você conversa, aceita missões e enfrenta NPCs que aparecem no local. Clique no botão abaixo para ir agora.",
    hint: "Use ❕ para ações e - para falas.",
    icon: <MessageCircle size={16} />,
  },
  {
    id: "combat",
    mood: "serious",
    title: "4. Aprenda a bater nos bichos",
    text:
      "Quando um NPC agressivo aparecer, o botão Combate aparece no chat. No campo de batalha:\n\n• Clique no inimigo para mirar (aura vermelha).\n• Escolha uma habilidade — cada uma gasta energia (EF/EM/Chakra) e tem cooldown.\n• Confirme o ataque. Quem tem mais Velocidade age primeiro.\n• Jutsus médicos curam aliados no lugar de causar dano.\n\nUse suas Rações para recuperar HP se apanhar feio.",
    hint: "Marque como concluído quando entender.",
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
  const finishFn = useServerFn(completeTutorial);

  const [stepIdx, setStepIdx] = useState(0);
  const storageKey = `nes.tutorial.${characterId}`;
  const [done, setDone] = useState<Record<StepId, boolean>>(() => {
    if (typeof window === "undefined") return { kit: false, equip: false, chat: false, combat: false, final: false };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { kit: false, equip: false, chat: false, combat: false, final: false, ...JSON.parse(raw) };
    } catch {}
    return { kit: false, equip: false, chat: false, combat: false, final: false };
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(done)); } catch {}
  }, [done, storageKey]);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const finishedRef = useRef(false);

  const step = STEPS[stepIdx];

  const markDone = useCallback((id: StepId) => {
    setDone((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      // Avança automaticamente para a próxima tarefa pendente
      const nextIdx = STEPS.findIndex((s) => !next[s.id]);
      if (nextIdx >= 0) setStepIdx(nextIdx);
      return next;
    });
  }, []);

  // Poll do inventário para detectar equipe do colete
  useEffect(() => {
    if (done.equip) return;
    let cancelled = false;
    async function check() {
      const { data: inv } = await supabase
        .from("inventory").select("vest_id").eq("character_id", characterId).maybeSingle();
      if (!cancelled && inv?.vest_id) markDone("equip");
    }
    check();
    const t = setInterval(check, 2000);
    return () => { cancelled = true; clearInterval(t); };
  }, [characterId, done.equip, markDone]);

  async function handleGrant() {
    setBusy(true);
    try {
      await grant({ data: { character_id: characterId } });
      toast.success("Kit inicial recebido!");
      markDone("kit");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao conceder o kit.");
    } finally { setBusy(false); }
  }

  function handleGoChat() {
    markDone("chat");
    router.navigate({ to: "/chat" as any });
  }

  async function handleFinish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setBusy(true);
    try {
      await finishFn({ data: { character_id: characterId } });
    } catch {
      // fallback direto
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
                    <Gift size={14} className="mr-1" /> Receber Kit
                  </Button>
                )}
                {step.id === "equip" && !done.equip && (
                  <span className="text-[11px] text-muted-foreground italic">Aguardando colete equipado…</span>
                )}
                {step.id === "chat" && !done.chat && (
                  <Button size="sm" onClick={handleGoChat} className="bg-gold text-black hover:bg-gold/90">
                    <MessageCircle size={14} className="mr-1" /> Ir para o Chat
                  </Button>
                )}
                {step.id === "combat" && !done.combat && (
                  <Button size="sm" variant="secondary" onClick={() => markDone("combat")}>
                    <Check size={14} className="mr-1" /> Entendi
                  </Button>
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