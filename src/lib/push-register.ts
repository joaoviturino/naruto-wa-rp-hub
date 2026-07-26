/* Registrador do service worker + inscrição Web Push.
 * Só age no navegador em produção (evita quebrar previews da Lovable).
 */
import { supabase } from "@/integrations/supabase/client";
import { getPushPublicKey, subscribeToPush, unsubscribeFromPush } from "@/lib/push.functions";

const SW_URL = "/sw.js";

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.top !== window.self) return true;
  } catch { return true; }
  const host = window.location.hostname;
  const search = window.location.search;
  if (search.includes("sw=off")) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  return false;
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function unregisterAppSW(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => {
    const url = r.active?.scriptURL || "";
    if (url.endsWith(SW_URL)) return r.unregister();
    return Promise.resolve(false);
  }));
}

export type PushStatus = "unsupported" | "denied" | "granted" | "default" | "blocked-preview";

export function currentPushStatus(): PushStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (isPreviewOrDev()) return "blocked-preview";
  return Notification.permission as PushStatus;
}

export async function enablePushNotifications(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "SSR" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "Este navegador não suporta notificações push." };
  }
  if (isPreviewOrDev()) {
    return { ok: false, reason: "As notificações só funcionam no app publicado. Abra o site em uma nova aba." };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permissão de notificações negada." };

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, reason: "Faça login primeiro." };

  const { publicKey } = await getPushPublicKey();
  if (!publicKey) return { ok: false, reason: "Servidor sem chave VAPID configurada." };

  const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const p256dh = arrayBufferToBase64(sub.getKey("p256dh"));
  const auth = arrayBufferToBase64(sub.getKey("auth"));
  await subscribeToPush({
    data: {
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 500),
    },
  } as any);

  return { ok: true };
}

export async function disablePushNotifications(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try { await unsubscribeFromPush({ data: { endpoint: sub.endpoint } } as any); } catch {}
    try { await sub.unsubscribe(); } catch {}
  }
}

/** Reinscreve silenciosamente se já havia permissão + inscrição (mantém dados atualizados). */
export async function refreshPushOnBoot(): Promise<void> {
  try {
    if (currentPushStatus() !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const p256dh = arrayBufferToBase64(sub.getKey("p256dh"));
    const auth = arrayBufferToBase64(sub.getKey("auth"));
    await subscribeToPush({
      data: { endpoint: sub.endpoint, p256dh, auth, user_agent: navigator.userAgent.slice(0, 500) },
    } as any);
  } catch {}
}