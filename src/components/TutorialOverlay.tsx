import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, X } from "lucide-react";
import neutralImg from "@/assets/instructor-neutral.jpg";
import happyImg from "@/assets/instructor-happy.jpg";
import seriousImg from "@/assets/instructor-serious.jpg";

type Mood = "neutral" | "happy" | "serious";
type Step = { mood: Mood; title: string; text: string };

const MOOD_IMG: Record<Mood, string> = {
  neutral: neutralImg,
  happy: happyImg,
  serious: seriousImg,
};

const STEPS: Step[] = [
  {
    mood: "happy",
    title: "Sensei Hikaru",
    text: "Bem-vindo à vila, jovem shinobi. Eu sou o Sensei Hikaru e vou te ensinar o básico da vida ninja. Preste atenção — o mundo lá fora não perdoa.",
  },
  {
    mood: "neutral",
    title: "A sua ficha",
    text: "Na aba Ficha você encontra sua vida (HP), Energia Física (EF), Energia Mental (EM) e Chakra. Cada golpe e jutsu consome uma dessas energias. Descanse ou use itens para recuperá-las.",
  },
  {
    mood: "neutral",
    title: "Bolsa Ninja e Inventário",
    text: "Tudo que você carrega fica na aba Inventário. Roupas, armas e ferramentas ficam na Bolsa Ninja. Clique em um item para ver as opções disponíveis.",
  },
  {
    mood: "happy",
    title: "Equipar e Desequipar",
    text: "Ao clicar num item equipável (kunai, colete, calça...) aparece a opção Equipar. Uma vez equipado, ele te dá bônus. Clique de novo e escolha Desequipar para trocar. Consumíveis somem ao usar.",
  },
  {
    mood: "serious",
    title: "Como bater nos bichos",
    text: "Quando um NPC agressivo aparecer no local, use o botão Combate no chat. No campo de batalha: 1) escolha a habilidade, 2) clique no inimigo pra mirar, 3) confirme. Cada jutsu gasta energia e tem cooldown.",
  },
  {
    mood: "serious",
    title: "Velocidade, Crítico e Foco",
    text: "Personagem mais rápido ataca primeiro. Críticos multiplicam o dano. Ninjutsu Médico cura aliados no lugar de causar dano — a energia gasta vira HP recuperado. Escolha bem quem age em cada turno.",
  },
  {
    mood: "neutral",
    title: "Aprender a ler os pergaminhos",
    text: "Alguns NPCs oferecem tutoriais e livros. Interaja com eles pelo chat e clique em Aprender — você precisa ficar lendo pelo tempo mínimo pra realmente aprender. Sem pressa: sabedoria vem com paciência.",
  },
  {
    mood: "neutral",
    title: "Missões e Ryō",
    text: "Missões diárias dão XP, Ryō (o dinheiro) e itens. Aceite pelo painel de missões ou com NPCs de recompensa. Gaste seus Ryō em NPCs de loja e no Ferreiro.",
  },
  {
    mood: "happy",
    title: "Party e Chat",
    text: "Convide outros jogadores do mesmo local para formar uma Party e enfrentarem NPCs juntos. No chat use ❕️ para ações e - para falas. Boa sorte, shinobi — a vila conta com você!",
  },
];

export function TutorialOverlay({ characterId, onDone }: { characterId: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  async function finish() {
    setSaving(true);
    try {
      await supabase.from("characters").update({ tutorial_completed: true }).eq("id", characterId);
    } finally {
      setSaving(false);
      onDone();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl scroll-panel rounded-lg overflow-hidden border border-gold/40 shadow-2xl">
        <button
          onClick={finish}
          className="absolute top-2 right-2 z-10 p-1.5 rounded bg-black/40 hover:bg-black/70 text-muted-foreground hover:text-foreground"
          title="Pular tutorial"
        >
          <X size={16} />
        </button>

        <div className="grid md:grid-cols-[240px_1fr]">
          <div className="relative bg-black/60 aspect-square md:aspect-auto">
            <img
              key={step.mood}
              src={MOOD_IMG[step.mood]}
              alt="Sensei"
              className="w-full h-full object-cover animate-in fade-in duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-3 right-3 text-[10px] uppercase tracking-widest text-gold">
              Sensei Hikaru
            </div>
          </div>

          <div className="p-6 flex flex-col min-h-[320px]">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold mb-2">
              Tutorial · {i + 1} / {STEPS.length}
            </div>
            <h2 className="text-2xl font-display font-black mb-4">{step.title}</h2>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line flex-1">
              {step.text}
            </p>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex gap-1">
                {STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === i ? "w-6 bg-gold" : idx < i ? "w-1.5 bg-gold/60" : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {i > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setI(i - 1)} disabled={saving}>
                    Voltar
                  </Button>
                )}
                {!isLast ? (
                  <Button size="sm" onClick={() => setI(i + 1)}>
                    Continuar <ChevronRight size={14} className="ml-1" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={finish} disabled={saving} className="bg-gold text-black hover:bg-gold/90">
                    {saving ? "..." : "Começar minha jornada"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}