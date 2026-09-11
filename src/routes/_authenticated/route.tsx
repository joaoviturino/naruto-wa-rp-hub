import { GameSettings } from "@/components/GameSettings";
import { GamePreferencesSync } from "@/hooks/useGamePreferences";
import { UserRound, MessagesSquare, Award, Hammer, Shield, Users, LogOut } from "lucide-react";
import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PvpInvitesWatcher } from "@/components/chat/PvpInvitesWatcher";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { GlobalBroadcasts } from "@/components/GlobalBroadcasts";
import { PresenceHeartbeat } from "@/components/chat/PresenceHeartbeat";
import { OnlinePlayersButton } from "@/components/OnlinePlayersButton";
import { TutorialWatcher } from "@/components/TutorialWatcher";
import { NotificationsToggle } from "@/components/NotificationsToggle";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const isModerator = (roles ?? []).some((r) => r.role === "moderator");
    // "Ferreiro" agora é um emprego com permissão submit_items — checado via RPC.
    const { data: canForge } = await supabase.rpc("has_job_permission", {
      _user_id: data.user.id, _perm: "submit_items",
    });
    const isBlacksmith = !!canForge;
    return { user: data.user, isAdmin, isBlacksmith, isModerator };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, isAdmin, isBlacksmith, isModerator } = Route.useRouteContext();
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Até a próxima, shinobi.");
    navigate({ to: "/auth", replace: true });
  }
  return (
    <MaintenanceGate isAdmin={isAdmin}>
    <div className="game-shell">
      <GamePreferencesSync />
      <a href="#game-content" className="game-skip">Ir para o jogo</a>
      <header className="border-b border-gold/20 bg-card/95">
        <div className="mx-auto max-w-7xl px-3 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/chat" className="font-display text-lg font-black shrink-0 mr-auto">
            <span className="text-red-400">New Era</span> <span className="text-gold">Shinobi</span>
          </Link>
          <div className="flex items-center gap-2 order-2 lg:order-3">
            {isAdmin && <OnlinePlayersButton isAdmin={isAdmin} />}
            <NotificationsToggle />
            <GameSettings />
            <Button variant="ghost" size="icon" className="min-h-11" aria-label="Sair do jogo" onClick={signOut}><LogOut size={16} /></Button>
          </div>
          <nav aria-label="Menu do jogo" className="game-nav order-3 w-full lg:w-auto lg:order-2">
            <Link to="/chat" activeProps={{ className: "active" }}><MessagesSquare size={16} /> Mundo</Link>
            <Link to="/character" activeProps={{ className: "active" }}><UserRound size={16} /> Personagem</Link>
            <Link to="/party" activeProps={{ className: "active" }}><Users size={16} /> Time</Link>
            <Link to="/battle-pass" activeProps={{ className: "active" }}><Award size={16} /> Passe</Link>
            {(isBlacksmith || isAdmin) && <Link to="/blacksmith" activeProps={{ className: "active" }}><Hammer size={16} /> Forja</Link>}
            {(isAdmin || isModerator) && <Link to="/admin" activeProps={{ className: "active" }}><Shield size={16} />{isAdmin ? "Admin" : "Mod"}</Link>}
          </nav>
        </div>
      </header>
      <PvpInvitesWatcher />
      <GlobalBroadcasts />
      <PresenceHeartbeat />
      <TutorialWatcher userId={user.id} />
      <main id="game-content" className="min-w-0"><Outlet /></main>
    </div>
    </MaintenanceGate>
  );
}