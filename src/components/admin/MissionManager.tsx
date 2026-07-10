import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { upsertMission, deleteMission } from "@/lib/admin.functions";
import { toast } from "sonner";
import { NINJA_RANKS } from "./shared";
import { Trash2, Pencil, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function MissionManager() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  async function load() { const { data } = await supabase.from("missions").select("*").order("rank"); setRows(data ?? []); }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Diárias</TabsTrigger>
          <TabsTrigger value="common">Comuns</TabsTrigger>
          <TabsTrigger value="special">Especiais</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-gold">Missões diárias ({rows.length})</h3>
            <Button size="sm" onClick={() => { setEditing({}); setOpen(true); }}><Plus size={14} /> Nova missão</Button>
          </div>
          <div className="scroll-panel rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider">
                <tr><th className="text-left p-2">Nome</th><th className="text-left p-2">Patente</th><th className="text-left p-2">XP</th><th className="text-left p-2">Descrição</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2 font-semibold">{r.name}</td>
                    <td className="p-2">{r.rank}</td>
                    <td className="p-2">{r.reward_xp}</td>
                    <td className="p-2 text-xs text-muted-foreground max-w-md truncate">{r.description}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil size={14} /></Button>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm(`Remover ${r.name}?`)) return;
                        try { await deleteMission({ data: { id: r.id } } as any); toast.success("Removida."); load(); }
                        catch (e: any) { toast.error(e.message); }
                      }}><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="common" className="mt-3">
          <div className="scroll-panel rounded-lg p-8 text-center text-muted-foreground">
            <p className="font-display text-lg text-gold">Missões Comuns</p>
            <p className="text-sm mt-2">Em breve.</p>
          </div>
        </TabsContent>
        <TabsContent value="special" className="mt-3">
          <div className="scroll-panel rounded-lg p-8 text-center text-muted-foreground">
            <p className="font-display text-lg text-gold">Missões Especiais</p>
            <p className="text-sm mt-2">Em breve.</p>
          </div>
        </TabsContent>
      </Tabs>
      <MissionDialog open={open} onOpenChange={setOpen} initial={editing} onSaved={() => { setOpen(false); load(); }} />
    </div>
  );
}

function MissionDialog({ open, onOpenChange, initial, onSaved }: any) {
  const save = useServerFn(upsertMission);
  const [f, setF] = useState<any>(initial ?? {});
  useEffect(() => { setF(initial ?? {}); }, [initial]);
  function up(k: string, v: any) { setF((p: any) => ({ ...p, [k]: v })); }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{f.id ? "Editar missão" : "Criar missão"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={f.name ?? ""} onChange={(e) => up("name", e.target.value)} /></div>
          <div><Label>Patente</Label>
            <Select value={f.rank ?? "genin"} onValueChange={(v: any) => up("rank", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{NINJA_RANKS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>XP de recompensa</Label><Input type="number" min={0} value={f.reward_xp ?? 0} onChange={(e) => up("reward_xp", Number(e.target.value))} /></div>
          <div><Label>Descrição</Label><Textarea rows={4} value={f.description ?? ""} onChange={(e) => up("description", e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={async () => {
            try { await save({ data: { ...f, description: f.description || null } } as any); toast.success("Salva."); onSaved(); }
            catch (e: any) { toast.error(e.message); }
          }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}