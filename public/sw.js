/* Service worker mínimo dedicado a Web Push (VAPID).
 * Sem cache de app-shell — evita ficar servindo HTML velho em produção.
 * Guarda de desativação: registrar `?sw=off` no cliente unregistra este SW.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Nova notificação", body: "", url: "/", tag: undefined, icon: "/icons/icon-192.png" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    try { payload.body = event.data ? event.data.text() : ""; } catch {}
  }
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag,
    renotify: !!payload.tag,
    data: { url: payload.url || "/" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(payload.title || "Shinobi", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin) {
            await client.focus();
            if (clientUrl.pathname !== target.pathname) {
              await client.navigate(target.href);
            }
            return;
          }
        } catch {}
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});