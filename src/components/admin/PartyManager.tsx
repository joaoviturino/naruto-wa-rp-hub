import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { listParties, listPartyInvites, deleteParty, deletePartyInvite, resetAllParties } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Trash2, Users, Mail, RefreshCw, AlertTriangle } from "lucide-react";

export function PartyManager() {
  const loadParties = useServerFn(listParties);
  const loadInvites = useServerFn(listPartyInvites);
  const delParty = useServerFn(deleteParty);
  const delInvite = useServerFn(deletePartyInvite);
  const resetAll = useServerFn(resetAllParties);

  const [parties, setParties] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([loadParties(), loadInvites()]);
      setParties(p as any[]); setInvites(i as any[]);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [loadParties, loadInvites]);

  useEffect(() => { load(); }, [load]);

  async function doReset(scope: "invites" | "parties" | "all") {
    const msg = scope === "invites" ? "TODOS os convites" : scope === "parties" ? "TODAS as parties" : "TODAS as parties e convites";
    if (!confirm(`Tem certeza? Isto vai apagar ${msg}. Ação irreversível.`)) return;
    try { await resetAll({ data: { scope } }); toast.success("Reset concluído."); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  const pending = invites.filter((i) => i.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl text-gold flex items-center gap-2"><Users size={18} /> Parties & Convites</h3>
          <p className="text-xs text-muted-foreground mt-1">{parties.length} parties · {pending.length} convites pendentes · {invites.length} total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar</Button>
          <Button size="sm" variant="outline" onClick={() => doReset("invites")}><Trash2 size={14} /> Limpar convites</Button>
          <Button size="sm" variant="outline" onClick={() => doReset("parties")}><Trash2 size={14} /> Dissolver parties</Button>
          <Button size="sm" variant="destructive" onClick={() => doReset("all")}><AlertTriangle size={14} /> Reset total</Button>
        </div>
      </div>

      <section>
        <h4 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Parties ativas ({parties.length})</h4>
        <div className="scroll-panel rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">Líder</th>
                <th className="text-left p-2">Membros</th>
                <th className="text-left p-2">Criada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="p-2 font-semibold flex items-center gap-2">
                    {p.leader?.avatar_url ? <img src={p.leader.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full bg-secondary" />}
                    {p.leader?.nickname ?? "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {p.members.map((m: any) => (
                        <span key={m.character?.id} className="text-xs bg-secondary/60 rounded px-2 py-0.5">{m.character?.nickname ?? "?"}</span>
                      ))}
                      {p.members.length === 0 && <span className="text-xs text-muted-foreground">(vazia)</span>}
                    </div>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm(`Dissolver a party de ${p.leader?.nickname ?? "?"}?`)) return;
                      try { await delParty({ data: { party_id: p.id } }); toast.success("Party dissolvida."); load(); }
                      catch (e: any) { toast.error(e.message); }
                    }}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              ))}
              {parties.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma party ativa.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h4 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Mail size={14} /> Convites ({invites.length})</h4>
        <div className="scroll-panel rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-2">De</th>
                <th className="text-left p-2">Para</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Enviado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((iv) => (
                <tr key={iv.id} className="border-t border-border">
                  <td className="p-2">{iv.from?.nickname ?? "—"}</td>
                  <td className="p-2">{iv.to?.nickname ?? "—"}</td>
                  <td className="p-2">
                    <span className={`text-xs rounded px-2 py-0.5 ${iv.status === "pending" ? "bg-gold/20 text-gold" : iv.status === "accepted" ? "bg-green-500/20 text-green-400" : "bg-secondary/60 text-muted-foreground"}`}>
                      {iv.status}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(iv.created_at).toLocaleString()}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try { await delInvite({ data: { invite_id: iv.id } }); toast.success("Convite removido."); load(); }
                      catch (e: any) { toast.error(e.message); }
                    }}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              ))}
              {invites.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum convite.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}