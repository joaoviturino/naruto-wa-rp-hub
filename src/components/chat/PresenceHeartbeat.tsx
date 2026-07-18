import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { heartbeat, markRewardsSeen } from "@/lib/presence.functions";
import { toast } from "sonner";

const REWARD_ICON: Record<string, string> = { xp: "✨", ryo: "💰", skill: "📜", item: "🎁" };

/** Envia heartbeat a cada 30s e mostra prêmios globais recém-recebidos. */
export function PresenceHeartbeat({ status = "chat" }: { status?: "idle"|"combat"|"travel"|"chat" }) {
  const ping = useServerFn(heartbeat);
  const seen = useServerFn(markRewardsSeen);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res: any = await ping({ data: { status } });
        const claimed = (res?.claimed ?? []) as any[];
        if (!cancelled && claimed.length > 0) {
          for (const r of claimed) {
            const icon = REWARD_ICON[r.kind] ?? "🎉";
            const label =
              r.kind === "xp" ? `+${r.amount} XP` :
              r.kind === "ryo" ? `+${r.amount} Ryo` :
              r.kind === "skill" ? "Nova habilidade!" :
              "Novo item!";
            toast.success(`${icon} Prêmio global — ${label}`, {
              description: r.note ?? "Enviado pela administração.",
              duration: 8000,
            });
          }
          try { await seen({ data: { reward_ids: claimed.map((c) => c.id) } }); } catch {}
        }
      } catch { /* silencia — heartbeat não deve interromper o jogo */ }
    }
    tick();
    const t = setInterval(tick, 30_000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [ping, seen, status]);

  return null;
}
