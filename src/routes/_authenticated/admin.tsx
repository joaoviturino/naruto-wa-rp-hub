import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminPanel } from "@/components/AdminPanel";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }: any) => {
    if (!context.isAdmin && !context.isModerator) throw redirect({ to: "/character" });
  },
  component: AdminRoute,
});

function AdminRoute() {
  const ctx = Route.useRouteContext() as any;
  return <AdminPanel isAdmin={!!ctx.isAdmin} isModerator={!!ctx.isModerator} />;
}