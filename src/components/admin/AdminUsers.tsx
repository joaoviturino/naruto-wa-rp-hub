import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, grantRole, revokeRole } from "@/lib/admin.functions";
import { toast } from "sonner";

export function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const list = useServerFn(listUsers);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);

  async function load() { try { const data = await list({} as any); setRows(data as any); } catch (e: any) { toast.error(e.message); } }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => !q || r.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl text-gold">Usuários ({rows.length})</h3>
        <Input placeholder="Buscar email..." className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="scroll-panel rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
            <tr><th className="text-left p-2">Email</th><th className="text-left p-2">Roles</th><th className="text-left p-2">Criado</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isAdmin = r.roles.includes("admin");
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{r.email}</td>
                  <td className="p-2">
                    {r.roles.map((role: string) => (
                      <span key={role} className={`inline-block rounded-full px-2 py-0.5 text-xs mr-1 ${role === "admin" ? "bg-gold/20 text-gold" : "bg-secondary"}`}>{role}</span>
                    ))}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-right">
                    {isAdmin ? (
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (!confirm(`Remover admin de ${r.email}?`)) return;
                        try { await revoke({ data: { user_id: r.id, role: "admin" } } as any); toast.success("Removido."); load(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>Remover admin</Button>
                    ) : (
                      <Button size="sm" onClick={async () => {
                        try { await grant({ data: { user_id: r.id, role: "admin" } } as any); toast.success("Promovido a admin."); load(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>Tornar admin</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}