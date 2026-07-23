import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, grantRole, revokeRole, adminResetPassword, deleteUserAccount, resetCharacter } from "@/lib/admin.functions";
import { toast } from "sonner";

export function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const list = useServerFn(listUsers);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const resetPass = useServerFn(adminResetPassword);
  const deleteAcc = useServerFn(deleteUserAccount);
  const resetChar = useServerFn(resetCharacter);

  async function load() { try { const data = await list({} as any); setRows(data as any); } catch (e: any) { toast.error(e.message); } }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => !q || r.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <h3 className="font-display text-xl text-gold">Usuários ({rows.length})</h3>
        <Input placeholder="Buscar email..." className="w-full sm:max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="scroll-panel rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
            <tr><th className="text-left p-2">Email</th><th className="text-left p-2">Roles</th><th className="text-left p-2">Personagens</th><th className="text-left p-2">Criado</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isAdmin = r.roles.includes("admin");
              const isMod = r.roles.includes("moderator");
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{r.email}</td>
                  <td className="p-2">
                    {r.roles.map((role: string) => (
                      <span key={role} className={`inline-block rounded-full px-2 py-0.5 text-xs mr-1 ${role === "admin" ? "bg-gold/20 text-gold" : role === "moderator" ? "bg-sky-500/20 text-sky-300" : "bg-secondary"}`}>{role}</span>
                    ))}
                  </td>
                  <td className="p-2 align-top">
                    {(r.characters ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {r.characters.map((c: any) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs">
                            <span className="truncate max-w-[140px]">{c.nickname}</span>
                            <span className="text-muted-foreground">[{c.rank ?? "?"}]</span>
                            <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px]" onClick={async () => {
                              if (!confirm(`ZERAR o personagem "${c.nickname}" de ${r.email}?\n\nApaga ficha, inventário, skills e progresso. O usuário volta ao fluxo de criação de personagem.`)) return;
                              const reason = prompt("Motivo (opcional, registrado no log):") ?? undefined;
                              try { await resetChar({ data: { character_id: c.id, reason } } as any); toast.success("Personagem zerado."); load(); }
                              catch (e: any) { toast.error(e.message); }
                            }}>Zerar</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-right">
                    <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" variant="secondary" onClick={async () => {
                      const pwd = prompt(`Nova senha para ${r.email} (mínimo 6 caracteres):`);
                      if (!pwd) return;
                      if (pwd.length < 6) { toast.error("Senha muito curta."); return; }
                      try { await resetPass({ data: { user_id: r.id, new_password: pwd } } as any); toast.success("Senha redefinida."); }
                      catch (e: any) { toast.error(e.message); }
                    }}>Redefinir senha</Button>
                    <Button size="sm" variant="destructive" onClick={async () => {
                      if (!confirm(`EXCLUIR permanentemente a conta ${r.email}?\n\nEsta ação apaga login, ficha, inventário e progresso. Age como banimento definitivo.`)) return;
                      const reason = prompt("Motivo (opcional, registrado no log):") ?? undefined;
                      try { await deleteAcc({ data: { user_id: r.id, reason } } as any); toast.success("Conta excluída."); load(); }
                      catch (e: any) { toast.error(e.message); }
                    }}>Excluir conta</Button>
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
                    {isMod ? (
                      <Button size="sm" variant="outline" onClick={async () => {
                        if (!confirm(`Remover cargo de Moderador de ${r.email}?`)) return;
                        try { await revoke({ data: { user_id: r.id, role: "moderator" } } as any); toast.success("Removido."); load(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>Remover moderador</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={async () => {
                        try { await grant({ data: { user_id: r.id, role: "moderator" } } as any); toast.success("Promovido a moderador."); load(); }
                        catch (e: any) { toast.error(e.message); }
                      }}>Tornar moderador</Button>
                    )}
                    </div>
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