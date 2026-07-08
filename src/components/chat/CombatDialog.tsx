import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useServerFn } from "@tanstack/react-start";
import { playerAttack, fleeCombat } from "@/lib/combat.functions";
import { toast } from "sonner";
import { Sword, Flag } from "lucide-react";

type Skill = {
  id: string; name: string; energy_type: "ef" | "em" | "chakra"; base_cost: number;
  bonus_speed: number; bonus_critical: number; bonus_energetic: number;
};

export function CombatDialog({ sessionId, myCharId, onClose }: { sessionId: string; myCharId: string; onClose: () => void }) {
  const [session, setSession] = useState<any>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillId, setSkillId] = useState<string>("");
  const [energy, setEnergy] = useState<number>(10);
  const [attacking, setAttacking] = useState(false);
  const attack = useServerFn(playerAttack);
  const flee = useServerFn(fleeCombat);

  async function load() {
    const { data } = await supabase.from("combat_sessions").select("*").eq("id", sessionId).maybeSingle();
    setSession(data);
  }
  async function loadSkills() {
    const { data } = await supabase
      .from("character_skills")
      .select("skill:skills(id,name,energy_type,base_cost,bonus_speed,bonus_critical,bonus_energetic)")
      .eq("character_id", myCharId);
    const list = ((data as any[]) ?? []).map((r) => r.skill).filter(Boolean) as Skill[];
    setSkills(list);
    if (list.length && !skillId) { setSkillId(list[0].id); setEnergy(list[0].base_cost); }
  }

  useEffect(() => {
    load(); loadSkills();
    const ch = supabase.channel(`combat-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "combat_sessions", filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
     
  }, [sessionId]);

  if (!session) return null;
  const state = session.state as any;
  const me = state.players.find((p: any) => p.character_id === myCharId);
  const activePlayer = state.players[state.active];
  const myTurn = session.status === "active" && activePlayer?.character_id === myCharId && me?.alive;
  const currentSkill = skills.find((s) => s.id === skillId);

  async function doAttack() {
    if (!currentSkill) return;
    setAttacking(true);
    try {
      await attack({ data: { session_id: sessionId, skill_id: currentSkill.id, energy_used: energy } });
    } catch (e: any) { toast.error(e.message); }
    finally { setAttacking(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && session.status !== "active" && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sword size={16} /> Combate: {state.npc.name}
            {session.status !== "active" && <span className="ml-2 text-xs uppercase text-gold">{session.status}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* NPC */}
          <div className="text-center">
            <div className="w-full aspect-square max-w-[220px] mx-auto rounded-lg bg-secondary overflow-hidden border-2 border-blood/40">
              {state.npc.image_url && <img src={state.npc.image_url} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="mt-2 font-display text-lg">{state.npc.name}</div>
            <div className="text-xs text-blood">HP {state.npc.hp} / {state.npc.hp_max}</div>
            <Progress value={(state.npc.hp / state.npc.hp_max) * 100} className="mt-1" />
          </div>

          <div className="text-2xl font-display text-gold">VS</div>

          {/* Meus stats */}
          <div className="space-y-1">
            <div className="font-display text-lg">{me?.nickname}</div>
            <PoolBar label="EF"  v={me?.ef ?? 0}  m={me?.ef_max ?? 1} color="oklch(0.55 0.22 25)" />
            <PoolBar label="EM"  v={me?.em ?? 0}  m={me?.em_max ?? 1} color="oklch(0.6 0.15 220)" />
            <PoolBar label="CK"  v={me?.chakra ?? 0} m={me?.chakra_max ?? 1} color="oklch(0.78 0.15 80)" />
            {state.players.length > 1 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Time: {state.players.filter((p: any) => p.character_id !== myCharId).map((p: any) => `${p.nickname} (${p.alive ? "vivo" : "fora"})`).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* Log */}
        <div className="mt-3 border border-border rounded p-2 max-h-32 overflow-y-auto text-xs space-y-1 bg-input/40">
          {(session.log as any[]).slice(-8).map((l) => (
            <div key={l.seq} className={l.actor === "player" ? "text-emerald-300" : "text-red-300"}>
              #{l.seq} {l.msg}
            </div>
          ))}
          {(!session.log || session.log.length === 0) && <div className="text-muted-foreground">O combate começou. Escolha uma habilidade.</div>}
        </div>

        {session.status === "active" ? (
          myTurn ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-end">
              <div>
                <div className="text-xs text-gold mb-1">Sua vez — escolha uma habilidade</div>
                <select value={skillId}
                  onChange={(e) => { setSkillId(e.target.value); const s = skills.find((x) => x.id === e.target.value); if (s) setEnergy(s.base_cost); }}
                  className="w-full bg-input border border-border rounded px-2 py-2 text-sm">
                  {skills.length === 0 && <option value="">Você não conhece nenhuma habilidade.</option>}
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.energy_type.toUpperCase()} • ×{s.bonus_energetic} energ • ×{s.bonus_critical} crit • ×{s.bonus_speed} spd
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Energia ({currentSkill?.energy_type.toUpperCase() ?? "—"})</div>
                <Input type="number" min={currentSkill?.base_cost ?? 1} value={energy}
                  onChange={(e) => setEnergy(Math.max(1, Number(e.target.value)))} className="w-28" />
              </div>
              <Button onClick={doAttack} disabled={!currentSkill || attacking}>
                <Sword size={14} className="mr-1" /> {attacking ? "..." : "Atacar"}
              </Button>
              <Button variant="outline" onClick={() => flee({ data: { session_id: sessionId } })}>
                <Flag size={14} className="mr-1" /> Fugir
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between border border-border rounded p-3 bg-input/30">
              <div className="text-sm text-muted-foreground">
                Aguardando <span className="text-gold font-display">{activePlayer?.nickname ?? "…"}</span> agir…
              </div>
              <Button variant="outline" size="sm" onClick={() => flee({ data: { session_id: sessionId } })}>
                <Flag size={14} className="mr-1" /> Fugir
              </Button>
            </div>
          )
        ) : (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm">
              {session.status === "won" && <span className="text-emerald-400">Vitória! {state.npc.name} foi derrotado.</span>}
              {session.status === "lost" && <span className="text-blood">Derrota. Você saiu enfraquecido, mas sem penalidades.</span>}
              {session.status === "fled" && <span className="text-muted-foreground">Fuga registrada.</span>}
            </div>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PoolBar({ label, v, m, color }: { label: string; v: number; m: number; color: string }) {
  const pct = m > 0 ? (v / m) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px]"><span>{label}</span><span>{v}/{m}</span></div>
      <div className="h-2 rounded bg-input overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}