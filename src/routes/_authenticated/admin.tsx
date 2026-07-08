import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminPanel } from "@/components/AdminPanel";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/character" });
  },
  component: () => <AdminPanel />,
});