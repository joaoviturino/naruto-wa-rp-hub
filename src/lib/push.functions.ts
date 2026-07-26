import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Chave VAPID pública (necessária no cliente para criar PushSubscription). */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

/** Registra/atualiza a inscrição do dispositivo atual. */
export const subscribeToPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    endpoint: z.string().url(),
    p256dh: z.string().min(10),
    auth: z.string().min(4),
    user_agent: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert({
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.user_agent ?? null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a inscrição do dispositivo atual. */
export const unsubscribeFromPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ endpoint: z.string().url() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions")
      .delete().eq("endpoint", data.endpoint).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Envia uma notificação de teste para o próprio usuário (útil para depurar). */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUsers } = await import("@/lib/push.server");
    const n = await sendPushToUsers([context.userId], {
      title: "🎉 Notificações ativas",
      body: "Você vai receber alertas mesmo com o app fechado.",
      url: "/chat",
      tag: "push-test",
    });
    return { ok: true, sent: n };
  });