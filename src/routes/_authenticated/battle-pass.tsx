import { createFileRoute } from "@tanstack/react-router";
import { BattlePassPage } from "@/components/BattlePassPage";

export const Route = createFileRoute("/_authenticated/battle-pass")({
  component: BattlePassPage,
  head: () => ({
    meta: [
      { title: "Passe de Batalha · New Era Shinobi" },
      { name: "description", content: "Suba tiers, resgate recompensas e desbloqueie a trilha Premium da temporada." },
      { property: "og:title", content: "Passe de Batalha" },
      { property: "og:description", content: "Progrida na temporada e ganhe itens, ryō e XP exclusivos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});