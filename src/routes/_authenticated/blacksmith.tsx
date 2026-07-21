import { createFileRoute, redirect } from "@tanstack/react-router";
import { BlacksmithPanel } from "@/components/BlacksmithPanel";

export const Route = createFileRoute("/_authenticated/blacksmith")({
  beforeLoad: ({ context }: any) => {
    if (!context.isBlacksmith && !context.isAdmin) {
      throw redirect({ to: "/character" });
    }
  },
  component: () => <BlacksmithPanel />,
  head: () => ({
    meta: [
      { title: "Forja do Ferreiro · New Era Shinobi" },
      { name: "description", content: "Crie e envie itens forjados para aprovação dos administradores." },
      { property: "og:title", content: "Forja do Ferreiro" },
      { property: "og:description", content: "Envie itens criados por você para revisão da administração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});