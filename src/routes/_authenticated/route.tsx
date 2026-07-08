import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-black">
            <span className="text-blood">New Era</span> <span className="text-gold">Shinobi</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/character" className="px-3 py-1.5 rounded hover:bg-secondary [&.active]:text-gold" activeProps={{ className: "active" }}>Ficha</Link>
            <Link to="/chat" className="px-3 py-1.5 rounded hover:bg-secondary [&.active]:text-gold" activeProps={{ className: "active" }}>Chat</Link>
            {isAdmin && (
              <Link to="/admin" className="px-3 py-1.5 rounded hover:bg-secondary [&.active]:text-gold" activeProps={{ className: "active" }}>
                Admin
              </Link>
            )}
            <span className="mx-3 text-muted-foreground text-xs">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}