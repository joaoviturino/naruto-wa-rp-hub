/* Helper server-only para enviar Web Push (VAPID) via web-push.
 * NÃO importar de código que roda no cliente — usar dentro de handlers.
 */

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
};

let vapidConfigured = false;

async function getWebPush() {
  const mod = await import("web-push");
  const webpush: any = (mod as any).default ?? mod;
  if (!vapidConfigured) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!pub || !priv) throw new Error("VAPID keys ausentes.");
    webpush.setVapidDetails(subject, pub, priv);
    vapidConfigured = true;
  }
  return webpush;
}

/** Envia notificação para todas as inscrições dos userIds informados. Retorna quantos endpoints receberam. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,user_id")
    .in("user_id", ids);
  if (error) {
    console.error("[push] fetch subs failed", error);
    return 0;
  }
  if (!subs || subs.length === 0) return 0;

  let webpush: any;
  try { webpush = await getWebPush(); }
  catch (e) { console.error("[push] vapid config failed", e); return 0; }

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/",
    tag: payload.tag,
    icon: payload.icon ?? "/icons/icon-192.png",
  });

  let ok = 0;
  const expired: string[] = [];
  await Promise.all((subs as any[]).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        json,
        { TTL: 60 * 60 * 24 },
      );
      ok++;
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      if (status === 404 || status === 410) expired.push(s.endpoint);
      else console.error("[push] send failed", status, e?.message);
    }
  }));

  if (expired.length > 0) {
    try { await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired); } catch {}
  }
  return ok;
}

/** Resolve nicknames para user_ids (para menções no chat). */
export async function resolveUserIdsByNicknames(nicknames: string[]): Promise<string[]> {
  const clean = Array.from(new Set(nicknames.map((n) => n.trim()).filter(Boolean)));
  if (clean.length === 0) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("characters").select("user_id,nickname").in("nickname", clean);
  return (data ?? []).map((r: any) => r.user_id).filter(Boolean);
}

/** Retorna user_ids de todos os admins do sistema. */
export async function getAdminUserIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  return Array.from(new Set(((data ?? []) as any[]).map((r) => r.user_id).filter(Boolean)));
}