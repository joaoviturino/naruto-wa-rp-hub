import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PvpInvitesWatcher } from "@/components/chat/PvpInvitesWatcher";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { GlobalBroadcasts } from "@/components/GlobalBroadcasts";
import { PresenceHeartbeat } from "@/components/chat/PresenceHeartbeat";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    return { user: data.user, isAdmin };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Até a próxima, shinobi.");
    navigate({ to: "/auth", replace: true });
  }
  return (
    <MaintenanceGate isAdmin={isAdmin}>
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <Link to="/" className="font-display text-base sm:text-xl font-black shrink-0">
            <span className="text-blood">New Era</span> <span className="text-gold">Shinobi</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-2 text-xs sm:text-sm min-w-0">
            <Link to="/character" className="px-2 sm:px-3 py-1.5 rounded hover:bg-secondary [&.active]:text-gold" activeProps={{ className: "active" }}>Ficha</Link>
            <Link to="/chat" className="px-2 sm:px-3 py-1.5 rounded hover:bg-secondary [&.active]:text-gold" activeProps={{ className: "active" }}>Chat</Link>
            {isAdmin && (
              <Link to="/admin" className="px-2 sm:px-3 py-1.5 rounded hover:bg-secondary [&.active]:text-gold" activeProps={{ className: "active" }}>
                Admin
              </Link>
            )}
            <span className="mx-2 lg:mx-3 text-muted-foreground text-xs hidden lg:inline truncate max-w-[180px]">{user.email}</span>
            <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 shrink-0" onClick={signOut}>Sair</Button>
          </nav>
        </div>
      </header>
      <PvpInvitesWatcher />
      <GlobalBroadcasts />
      <PresenceHeartbeat />
      <Outlet />
    </div>
    </MaintenanceGate>
  );
}