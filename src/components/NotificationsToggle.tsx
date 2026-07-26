import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  currentPushStatus,
  enablePushNotifications,
  disablePushNotifications,
  refreshPushOnBoot,
  type PushStatus,
} from "@/lib/push-register";

export function NotificationsToggle() {
  const [status, setStatus] = useState<PushStatus>("default");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setStatus(currentPushStatus());
    (async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setSubscribed(!!sub);
        if (sub) refreshPushOnBoot();
      } catch {}
    })();
  }, []);

  if (status === "unsupported") return null;

  async function enable() {
    setBusy(true);
    const r = await enablePushNotifications();
    setBusy(false);
    if (r.ok) {
      setStatus("granted"); setSubscribed(true);
      toast.success("Notificações ativadas!", {
        description: /iPhone|iPad|iPod/.test(navigator.userAgent)
          ? "No iOS, instale o app na tela de início para receber push com o app fechado."
          : "Você receberá alertas mesmo com o app fechado.",
      });
    } else {
      toast.error(r.reason);
    }
  }

  async function disable() {
    setBusy(true);
    await disablePushNotifications();
    setSubscribed(false);
    setBusy(false);
    toast("Notificações desativadas.");
  }

  const active = status === "granted" && subscribed;
  const label = active ? "Notificações ativas" : status === "denied" ? "Notificações bloqueadas" : "Ativar notificações";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy || status === "blocked-preview"}
      onClick={active ? disable : enable}
      className={`relative grid h-8 w-8 place-items-center rounded-full border transition-colors shrink-0
        ${active ? "border-gold/50 bg-gold/10 text-gold" : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"}
        disabled:opacity-40`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" />
        : active ? <Bell size={14} />
        : status === "denied" ? <BellOff size={14} />
        : <Bell size={14} />}
      {active && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background" />}
    </button>
  );
}