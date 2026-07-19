import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  // ---- Auto-recovery ---------------------------------------------------
  // Some errors are transient (network flap, realtime re-mount, chunk load
  // failure after a deploy). Try to recover automatically 2x with backoff
  // before showing the manual "This page didn't load" fallback.
  const attemptRef = useRef(0);
  const [status, setStatus] = useState<"recovering" | "failed">("recovering");
  const [countdown, setCountdown] = useState(0);

  const message = String(error?.message ?? "");
  const category: "network" | "auth" | "chunk" | "realtime" | "unknown" =
    /network|failed to fetch|load failed|timeout|abort/i.test(message)
      ? "network"
      : /unauthor|401|403|jwt|token/i.test(message)
      ? "auth"
      : /chunkloaderror|dynamically imported module|loading chunk/i.test(message)
      ? "chunk"
      : /realtime|channel|postgres_changes|subscribe/i.test(message)
      ? "realtime"
      : "unknown";

  useEffect(() => {
    // Chunk errors after a deploy are only fixed by a hard reload.
    if (category === "chunk") {
      const t = setTimeout(() => window.location.reload(), 1200);
      return () => clearTimeout(t);
    }
    if (attemptRef.current >= 2) {
      setStatus("failed");
      return;
    }
    attemptRef.current += 1;
    const delayMs = attemptRef.current === 1 ? 800 : 2500;
    setCountdown(Math.ceil(delayMs / 1000));
    const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    const t = setTimeout(() => {
      clearInterval(tick);
      router.invalidate();
      reset();
    }, delayMs);
    return () => { clearTimeout(t); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const headline =
    status === "recovering"
      ? "Recarregando…"
      : category === "network"
      ? "Sem conexão estável"
      : category === "auth"
      ? "Sua sessão expirou"
      : category === "realtime"
      ? "Falha no canal em tempo real"
      : "Não foi possível carregar";

  const advice =
    status === "recovering"
      ? `Tentando recuperar automaticamente… (${countdown}s)`
      : category === "network"
      ? "Verifique sua internet e toque em Tentar de novo."
      : category === "auth"
      ? "Faça login novamente para continuar."
      : category === "realtime"
      ? "Feche e reabra a página. Se persistir, alterne o Wi-Fi/4G."
      : "Toque em Tentar de novo, ou volte para a home.";

  const primaryAction = category === "auth"
    ? { label: "Fazer login", onClick: () => { window.location.href = "/auth"; } }
    : { label: "Tentar de novo", onClick: () => { attemptRef.current = 0; setStatus("recovering"); router.invalidate(); reset(); } };
  // ----------------------------------------------------------------------

  const diagnostics = (() => {
    const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
    const win = typeof window !== "undefined" ? window : ({} as Window);
    return {
      when: new Date().toISOString(),
      url: typeof win.location !== "undefined" ? win.location.href : "(ssr)",
      route: typeof win.location !== "undefined" ? win.location.pathname + win.location.search : "(ssr)",
      userAgent: nav.userAgent ?? "(unknown)",
      platform: (nav as any).platform ?? "(unknown)",
      language: nav.language ?? "(unknown)",
      viewport:
        typeof win.innerWidth === "number"
          ? `${win.innerWidth}x${win.innerHeight} @dpr${win.devicePixelRatio ?? 1}`
          : "(ssr)",
      online: typeof nav.onLine === "boolean" ? String(nav.onLine) : "(unknown)",
      message: String(error?.message ?? error),
      stack: error?.stack ?? "(no stack)",
    };
  })();

  const report = [
    `When:       ${diagnostics.when}`,
    `URL:        ${diagnostics.url}`,
    `Route:      ${diagnostics.route}`,
    `Viewport:   ${diagnostics.viewport}`,
    `Online:     ${diagnostics.online}`,
    `Platform:   ${diagnostics.platform}`,
    `Language:   ${diagnostics.language}`,
    `UserAgent:  ${diagnostics.userAgent}`,
    ``,
    `Message:    ${diagnostics.message}`,
    ``,
    `Stack:`,
    diagnostics.stack,
  ].join("\n");

  const copyReport = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        const ta = document.createElement("textarea");
        ta.value = report;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      // eslint-disable-next-line no-alert
      alert("Diagnóstico copiado. Cole no chat com o suporte.");
    } catch {
      // eslint-disable-next-line no-alert
      alert("Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {status === "recovering" && (
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {headline}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {advice}
        </p>
        <details className="mt-4 text-left rounded-md border border-border bg-card/60 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">Detalhes técnicos</summary>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={copyReport}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
            >
              Copiar diagnóstico
            </button>
          </div>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground">Quando</span><span className="break-all">{diagnostics.when}</span>
            <span className="text-foreground">URL</span><span className="break-all">{diagnostics.url}</span>
            <span className="text-foreground">Rota</span><span className="break-all">{diagnostics.route}</span>
            <span className="text-foreground">Viewport</span><span>{diagnostics.viewport}</span>
            <span className="text-foreground">Online</span><span>{diagnostics.online}</span>
            <span className="text-foreground">Plataforma</span><span className="break-all">{diagnostics.platform}</span>
            <span className="text-foreground">Idioma</span><span>{diagnostics.language}</span>
            <span className="text-foreground">UserAgent</span><span className="break-all">{diagnostics.userAgent}</span>
          </div>
          <div className="mt-3 font-mono text-[11px] text-blood break-words whitespace-pre-wrap">
            {diagnostics.message}
          </div>
          <pre className="mt-2 max-h-48 overflow-auto text-[10px] text-muted-foreground whitespace-pre-wrap">
            {diagnostics.stack}
          </pre>
        </details>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {status === "failed" && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {primaryAction.label}
            </button>
          )}
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar à home
          </a>
          {status === "failed" && (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Recarregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "New Era Shinobi — Revolution" },
      { name: "description", content: "RPG shinobi baseado em Naruto: crie seu personagem na web e jogue no WhatsApp." },
      { property: "og:title", content: "New Era Shinobi — Revolution" },
      { property: "og:description", content: "RPG shinobi baseado em Naruto: crie seu personagem na web e jogue no WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "New Era Shinobi — Revolution" },
      { name: "twitter:description", content: "RPG shinobi baseado em Naruto: crie seu personagem na web e jogue no WhatsApp." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6932a559-16c2-489b-87f7-af0308de4cd3/id-preview-b2e40a32--fc4388b0-a3a0-4026-8467-92b3eac2a359.lovable.app-1783473057379.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6932a559-16c2-489b-87f7-af0308de4cd3/id-preview-b2e40a32--fc4388b0-a3a0-4026-8467-92b3eac2a359.lovable.app-1783473057379.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" />
    </QueryClientProvider>
  );
}
