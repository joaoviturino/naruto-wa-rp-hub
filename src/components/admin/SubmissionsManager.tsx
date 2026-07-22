import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, X, Trash2, Eye } from "lucide-react";
import { listAllSubmissions, approveSubmission, rejectSubmission, deleteSubmission } from "@/lib/blacksmith.functions";
import { labelize } from "./shared";

type Status = "pending" | "approved" | "rejected" | "all";

export function SubmissionsManager({ canReject = true }: { canReject?: boolean } = {}) {
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [viewing, setViewing] = useState<any | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [notes, setNotes] = useState("");

  const list = useServerFn(listAllSubmissions);
  const approve = useServerFn(approveSubmission);
  const reject = useServerFn(rejectSubmission);
  const remove = useServerFn(deleteSubmission);

  async function load() {
    try { const data = await list({ data: { status } } as any); setRows(data as any); }
    catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, [status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl text-gold">Submissões de itens ({rows.length})</h3>
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
          {(["pending","approved","rejected","all"] as Status[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs rounded-md capitalize ${status === s ? "bg-gold/20 text-gold font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              {s === "pending" ? "Pendentes" : s === "approved" ? "Aprovadas" : s === "rejected" ? "Rejeitadas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-panel rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left p-2">Img</th>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Rank</th>
              <th className="text-left p-2">Autor</th>
              <th className="text-left p-2">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nada aqui.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2">{r.image_url ? <img src={r.image_url} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-secondary" />}</td>
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2">{labelize(r.type)}</td>
                <td className="p-2">{r.rank}</td>
                <td className="p-2 text-xs font-mono">{r.submitter_email ?? r.submitted_by.slice(0, 8)}</td>
                <td className="p-2"><StatusBadge status={r.status} /></td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => setViewing(r)} title="Ver detalhes"><Eye size={14} /></Button>
                  {r.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" className="text-emerald-400" title="Aprovar"
                        onClick={async () => {
                          if (!confirm(`Aprovar "${r.name}" e adicionar ao catálogo?`)) return;
                          try { await approve({ data: { id: r.id } } as any); toast.success("Aprovado."); load(); }
                          catch (e: any) { toast.error(e.message); }
                        }}><Check size={14} /></Button>
                      {canReject && (
                        <Button size="icon" variant="ghost" className="text-red-400" title="Rejeitar"
                          onClick={() => { setRejectFor(r); setNotes(""); }}><X size={14} /></Button>
                      )}
                    </>
                  )}
                  {canReject && (
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm(`Remover submissão "${r.name}"?`)) return;
                      try { await remove({ data: { id: r.id } } as any); toast.success("Removido."); load(); }
                      catch (e: any) { toast.error(e.message); }
                    }}><Trash2 size={14} /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalhes */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.name}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              {viewing.image_url && <img src={viewing.image_url} alt="" className="w-32 h-32 rounded object-cover mx-auto" />}
              <Detail k="Tipo" v={labelize(viewing.type)} />
              <Detail k="Rank" v={viewing.rank} />
              <Detail k="Descrição" v={viewing.description ?? "—"} />
              <Detail k="Durabilidade" v={viewing.durability ?? "∞"} />
              <Detail k="Patente req." v={viewing.req_rank ? labelize(viewing.req_rank) : "—"} />
              <Detail k="Classe req." v={viewing.req_class ? labelize(viewing.req_class) : "—"} />
              <Detail k="Nível req." v={viewing.req_nivel ?? "—"} />
              <Detail k="Maestria req." v={viewing.req_maestria ?? "—"} />
              {Array.isArray(viewing.meta?.recipe) && viewing.meta.recipe.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mt-2">Receita</div>
                  <ul className="list-disc pl-5">
                    {viewing.meta.recipe.map((r: any, i: number) => (
                      <li key={i} className="text-xs">{r.qty}× material <code className="font-mono">{r.item_id.slice(0, 8)}</code></li>
                    ))}
                  </ul>
                </div>
              )}
              {viewing.review_notes && (
                <div className="mt-3 rounded-md border border-border bg-secondary/30 p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Notas do admin</div>
                  <p className="text-sm mt-1">{viewing.review_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejeitar */}
      <Dialog open={!!rejectFor} onOpenChange={(v) => !v && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar "{rejectFor?.name}"</DialogTitle></DialogHeader>
          <Textarea rows={4} placeholder="Explique o motivo da rejeição..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!notes.trim()) { toast.error("Informe o motivo."); return; }
              try {
                await reject({ data: { id: rejectFor.id, notes: notes.trim() } } as any);
                toast.success("Submissão rejeitada."); setRejectFor(null); load();
              } catch (e: any) { toast.error(e.message); }
            }}>Rejeitar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/50 pb-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="text-sm text-right">{String(v)}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    rejected: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  const label: Record<string, string> = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${map[status] ?? ""}`}>{label[status] ?? status}</span>;
}