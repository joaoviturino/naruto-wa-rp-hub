import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClanTree, unlockClanNode } from "@/lib/clan-tree.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Lock, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clan-tree")({
  component: ClanTreePage,
});

const NODE_W = 96, NODE_H = 96;

function ClanTreePage() {
  const router = useRouter();
  const load = useServerFn(getClanTree);
  const unlock = useServerFn(unlockClanNode);
  const [state, setState] = useState<any>(null);

  const reload = useCallback(async () => {
    // precisa saber o clan do char primeiro; getClanTree exige clan_id.
    // Buscamos o clan_id via primeira chamada com o clan do char — usamos supabase direto:
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) return;
    const { data: ch } = await supabase.from("characters").select("clan_id").eq("user_id", me.user.id).maybeSingle();
    if (!ch?.clan_id) { setState({ empty: true }); return; }
    const res: any = await load({ data: { clan_id: ch.clan_id } });
    setState(res);
  }, [load]);

  useEffect(() => { reload(); }, [reload]);

  if (!state) return <div className="p-6 text-center text-muted-foreground">Carregando…</div>;
  if (state.empty) return <div className="p-6 text-center text-muted-foreground">Você não pertence a um clã.</div>;

  const nodes = state.nodes as any[];
  const edges = state.edges as any[];
  const progress = new Set<string>(state.progress ?? []);

  const maxX = Math.max(700, ...nodes.map((n) => n.x + NODE_W + 40));
  const maxY = Math.max(500, ...nodes.map((n) => n.y + NODE_H + 40));

  function canUnlock(nodeId: string) {
    const incoming = edges.filter((e) => e.to_node_id === nodeId).map((e) => e.from_node_id);
    if (!incoming.length) return true;
    return incoming.every((id) => progress.has(id));
  }

  async function onUnlock(n: any) {
    try {
      await unlock({ data: { node_id: n.id } });
      toast.success("Desbloqueado!");
      reload();
      router.invalidate();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-3">
      <h1 className="font-display text-2xl text-gold flex items-center gap-2"><Sparkles size={20} />Árvore do Clã</h1>
      <p className="text-xs text-muted-foreground">Clique num nó destravável para desbloqueá-lo. Buffs são aplicados no combate.</p>
      <div className="relative w-full overflow-auto rounded-lg border border-border bg-black/40" style={{ height: 600 }}>
        <div className="relative" style={{ width: maxX, height: maxY }}>
          <svg className="absolute inset-0 pointer-events-none" width={maxX} height={maxY}>
            {edges.map((e) => {
              const a = nodes.find((n) => n.id === e.from_node_id);
              const b = nodes.find((n) => n.id === e.to_node_id);
              if (!a || !b) return null;
              const done = progress.has(a.id) && progress.has(b.id);
              return (
                <line key={e.id} x1={a.x + NODE_W / 2} y1={a.y + NODE_H / 2} x2={b.x + NODE_W / 2} y2={b.y + NODE_H / 2}
                  stroke={done ? "oklch(0.75 0.2 140)" : "oklch(0.6 0.1 80)"} strokeWidth={3} strokeOpacity={0.7} />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const owned = progress.has(n.id);
            const avail = !owned && canUnlock(n.id);
            const border = owned ? "border-emerald-500" : avail ? "border-gold animate-pulse" : "border-slate-600 opacity-60";
            return (
              <button key={n.id}
                onClick={() => avail && onUnlock(n)}
                disabled={!avail}
                title={n.kind === "skill" ? n.skill?.name : n.buff_label}
                className={`absolute rounded-full border-4 shadow-lg overflow-hidden flex items-center justify-center bg-card ${border} ${avail ? "cursor-pointer hover:scale-105 transition-transform" : "cursor-default"}`}
                style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}>
                {n.kind === "skill" ? (
                  n.skill?.image_url
                    ? <img src={n.skill.image_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs px-1 text-center">{n.skill?.name ?? "?"}</span>
                ) : (
                  <div className="text-center">
                    <Sparkles size={20} className="mx-auto text-emerald-400" />
                    <div className="text-[10px] font-bold">{n.buff_label}</div>
                  </div>
                )}
                {owned && <Check size={16} className="absolute top-1 right-1 text-emerald-400 bg-background rounded-full" />}
                {!owned && !avail && <Lock size={16} className="absolute top-1 right-1 text-muted-foreground bg-background rounded-full" />}
              </button>
            );
          })}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Este clã ainda não possui árvore configurada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
