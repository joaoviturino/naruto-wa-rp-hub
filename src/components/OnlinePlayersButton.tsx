import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, RotateCw, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listOnlinePlayers, adminTeleportPlayer } from "@/lib/presence.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  character_id: string;
  status: string;
  last_seen: string;
  character: { id: string; nickname: string; avatar_url: string | null; rank: string | null } | null;
  location: { id: string; name: string } | null;
};

export function OnlinePlayersButton({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState<number>(0);
  const [players, setPlayers] = useState<Row[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const list = useServerFn(listOnlinePlayers);
  const tp = useServerFn(adminTeleportPlayer);

  async function load() {
    setLoading(true);
    try {
      const res: any = await list({} as any);
      setTotal(res?.total ?? 0);
      setPlayers((res?.players ?? []) as Row[]);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    if (isAdmin && locations.length === 0) {
      supabase.from("locations").select("id,name").order("name").then(({ data }) =>
        setLocations(((data ?? []) as any[]).map((l) => ({ id: l.id, name: l.name }))));
    }
  }, [open]);

  async function teleport(characterId: string) {
    const q = prompt("Teletransportar para qual local? (digite parte do nome)");
    if (!q) return;
    const loc = locations.find((l) => l.name.toLowerCase().includes(q.toLowerCase()));
    if (!loc) { toast.error("Local não encontrado."); return; }
    setBusy(characterId);
    try {
      await tp({ data: { character_id: characterId, location_id: loc.id } } as any);
      toast.success(`Teletransportado para ${loc.name}.`);
      await load();
    } catch (e: any) { toast.error(e?.message ?? "Falha."); }
    finally { setBusy(""); }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded hover:bg-secondary text-xs sm:text-sm"
        title="Jogadores online"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <Users size={14} className="hidden sm:inline" />
        <span className="tabular-nums font-semibold">{total}</span>
        <span className="hidden md:inline text-muted-foreground">online</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="flex items-center gap-2"><Users size={16} /> Jogadores online ({total})</span>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                <RotateCw size={12} className={loading ? "animate-spin" : ""} />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {players.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6">Ninguém online no momento.</div>
            )}
            {players.map((p) => (
              <div key={p.character_id} className="rounded-lg border border-border p-2 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary/40 shrink-0 overflow-hidden">
                  {p.character?.avatar_url && <img src={p.character.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{p.character?.nickname ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {(p.character?.rank ?? "").toUpperCase()} · {p.location?.name ?? "sem local"} · <span className={
                      p.status === "combat" ? "text-red-400" : p.status === "travel" ? "text-sky-400" : "text-emerald-400"
                    }>{p.status}</span>
                  </div>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" disabled={busy === p.character_id}
                    onClick={() => teleport(p.character_id)}>
                    <Send size={12} className="mr-1" />TP
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}