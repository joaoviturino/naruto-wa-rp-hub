import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { playerAttack, fleeCombat, consumeInCombat } from "@/lib/combat.functions";
import { toast } from "sonner";
import { Sword, Flag, Zap, FlaskConical, Users } from "lucide-react";

type Skill = {
  id: string; name: string; energy_type: "ef" | "em" | "chakra"; base_cost: number;
  bonus_speed: number; bonus_critical: number; bonus_energetic: number;
  cooldown_turns?: number; description?: string | null;
};
type BagEntry = { item_id: string; qty: number };
type Item = { id: string; name: string; image_url: string | null; type: string };

export function CombatDialog({ sessionId, myCharId, onClose }: { sessionId: string; myCharId: string; onClose: () => void }) {
  const [session, setSession] = useState<any>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [energy, setEnergy] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [bag, setBag] = useState<BagEntry[]>([]);
  const [itemMap, setItemMap] = useState<Record<string, Item>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const attack = useServerFn(playerAttack);
  const flee = useServerFn(fleeCombat);
  const consume = useServerFn(consumeInCombat);

  async function load() {
    const { data } = await supabase.from("combat_sessions").select("*").eq("id", sessionId).maybeSingle();
    setSession(data);
  }
  async function loadSkills() {
    const { data } = await supabase
      .from("character_skills")
      .select("skill:skills(id,name,energy_type,base_cost,bonus_speed,bonus_critical,bonus_energetic,cooldown_turns,description)")
      .eq("character_id", myCharId);
    const list = ((data as any[]) ?? []).map((r) => r.skill).filter(Boolean) as Skill[];
    setSkills(list);
    if (list.length && !selectedSkill) { setSelectedSkill(list[0].id); setEnergy(list[0].base_cost); }
  }
  async function loadBag() {
    const { data: inv } = await supabase.from("inventory").select("ninja_bag,secondary_slots").eq("character_id", myCharId).maybeSingle();
    const b: BagEntry[] = [];
    for (const src of [inv?.ninja_bag, inv?.secondary_slots]) {
      if (Array.isArray(src)) for (const e of src as any[]) b.push({ item_id: e.item_id, qty: Number(e.qty ?? 1) });
    }
    setBag(b);
    if (b.length) {
      const ids = Array.from(new Set(b.map((x) => x.item_id)));
      const { data: its } = await supabase.from("items").select("id,name,image_url,type").in("id", ids);
      const map: Record<string, Item> = {};
      for (const it of (its as Item[]) ?? []) map[it.id] = it;
      setItemMap(map);
    }
  }

  useEffect(() => {
    load(); loadSkills(); loadBag();
    const ch = supabase.channel(`combat-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "combat_sessions", filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
     
  }, [sessionId]);

  useEffect(() => {
    // Carrega avatares dos participantes
    if (!session) return;
    const ids = (session.state?.players ?? []).map((p: any) => p.character_id);
    if (!ids.length) return;
    supabase.from("characters").select("id,avatar_url").in("id", ids).then(({ data }) => {
      const map: Record<string, string | null> = {};
      for (const c of (data as any[]) ?? []) map[c.id] = c.avatar_url;
      setAvatars(map);
    });
  }, [session?.id]);

  const state = (session?.state ?? {}) as any;
  const players: any[] = Array.isArray(state.players) ? state.players : [];
  const npc = state.npc ?? { name: "?", image_url: null, hp: 0, hp_max: 1, energy: 0, energy_max: 1 };
  const log: any[] = Array.isArray(session?.log) ? session.log : [];
  const me = players.find((p: any) => p.character_id === myCharId);
  const activePlayer = players[state.active ?? 0];
  const aliveMe = !!me?.alive;
  const solo = players.length <= 1;
  const onlyAlivePlayer = players.filter((p: any) => p.alive).length === 1 && aliveMe;
  const myTurn = session?.status === "active" && aliveMe && (solo || onlyAlivePlayer || activePlayer?.character_id === myCharId);
  const currentSkill = skills.find((s) => s.id === selectedSkill);
  const myCooldowns: Record<string, number> = (me?.cooldowns as any) ?? {};
  const currentCd = currentSkill ? (myCooldowns[currentSkill.id] ?? 0) : 0;
  const consumables = useMemo(() => bag.filter((e) => itemMap[e.item_id]?.type === "consumable"), [bag, itemMap]);
  if (!session) return null;

  async function doAttack() {
    if (!currentSkill) return;
    setBusy(true);
    try {
      await attack({ data: { session_id: sessionId, skill_id: currentSkill.id, energy_used: energy } });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  async function doItem(itemId: string) {
    setBusy(true);
    try {
      await consume({ data: { session_id: sessionId, item_id: itemId } });
      await loadBag();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  const poolColor: Record<string, string> = { ef: "oklch(0.55 0.22 25)", em: "oklch(0.6 0.15 220)", chakra: "oklch(0.78 0.15 80)" };

  return (
    <Dialog open onOpenChange={(v) => !v && session.status !== "active" && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-blood/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 px-4 pt-4">
            <Sword size={16} /> Combate: {npc.name}
            {session.status !== "active" && <span className="ml-2 text-xs uppercase text-gold">{session.status}</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Turn order strip */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-input/40 overflow-x-auto">
          <span className="text-[10px] uppercase text-muted-foreground mr-2 shrink-0">Turno</span>
          {[npc, ...players].map((entity: any, i: number) => {
            const isNpc = i === 0;
            const active = !isNpc && players[state.active ?? 0]?.character_id === entity.character_id;
            const img = isNpc ? entity.image_url : avatars[entity.character_id];
            return (
              <div key={i} className={`w-10 h-10 rounded-md overflow-hidden shrink-0 border-2 ${active ? "border-gold ring-2 ring-gold/40" : isNpc ? "border-blood/60" : "border-border"} bg-secondary`}>
                {img && <img src={img} className="w-full h-full object-cover" alt="" />}
              </div>
            );
          })}
        </div>

        {/* Battle stage */}
        <div className="relative bg-gradient-to-b from-background to-secondary/40 px-4 py-6">
          <div className="flex justify-center">
            <div className="text-center">
              <div className="w-full aspect-square max-w-[240px] mx-auto rounded-lg bg-secondary overflow-hidden border-2 border-blood/40 shadow-lg shadow-blood/20">
                {npc.image_url && <img src={npc.image_url} className="w-full h-full object-cover" alt="" />}
              </div>
              <div className="mt-2 font-display text-xl">{npc.name}</div>
              <div className="mx-auto max-w-[240px]">
                <div className="flex justify-between text-[10px] mt-1"><span className="text-blood">HP</span><span>{npc.hp}/{npc.hp_max}</span></div>
                <Progress value={npc.hp_max ? (npc.hp / npc.hp_max) * 100 : 0} />
                <div className="flex justify-between text-[10px] mt-1"><span className="text-gold">Energia</span><span>{npc.energy}/{npc.energy_max}</span></div>
                <Progress value={npc.energy_max ? (npc.energy / npc.energy_max) * 100 : 0} />
              </div>
            </div>
          </div>
        </div>

        {/* Party bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-3 py-2 border-y border-border bg-background/60">
          {players.map((p: any) => {
            const isMe = p.character_id === myCharId;
            const active = players[state.active ?? 0]?.character_id === p.character_id;
            return (
              <div key={p.character_id} className={`rounded-md border p-2 ${active ? "border-gold" : "border-border"} ${!p.alive ? "opacity-40" : ""} ${isMe ? "bg-gold/10" : "bg-input/30"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded overflow-hidden bg-secondary shrink-0">
                    {avatars[p.character_id] && <img src={avatars[p.character_id]!} className="w-full h-full object-cover" alt="" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-display truncate">{p.nickname} {isMe && "(você)"}</div>
                    <div className="grid grid-cols-3 gap-0.5">
                      {(["ef","em","chakra"] as const).map((k) => {
                        const v = p[k]; const m = p[`${k}_max` as const];
                        return (
                          <div key={k} title={`${k.toUpperCase()} ${v}/${m}`} className="h-1 rounded overflow-hidden bg-input">
                            <div className="h-full" style={{ width: `${m > 0 ? (v/m)*100 : 0}%`, background: poolColor[k] }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Log */}
        <div className="mx-3 mt-2 border border-border rounded p-2 max-h-28 overflow-y-auto text-xs space-y-1 bg-input/40">
          {log.slice(-8).map((l: any) => (
            <div key={l.seq} className={l.actor === "player" ? "text-emerald-300" : "text-red-300"}>
              #{l.seq} {l.msg}
            </div>
          ))}
          {log.length === 0 && <div className="text-muted-foreground">O combate começou. Escolha uma habilidade.</div>}
        </div>

        <div className="p-3">
        {session.status === "active" ? (
          myTurn ? (
            <Tabs defaultValue="skills">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="skills"><Zap size={12} className="mr-1"/>Habilidades</TabsTrigger>
                <TabsTrigger value="items"><FlaskConical size={12} className="mr-1"/>Itens ({consumables.length})</TabsTrigger>
                <TabsTrigger value="flee"><Flag size={12} className="mr-1"/>Fugir</TabsTrigger>
              </TabsList>
              <TabsContent value="skills" className="mt-2">
                {skills.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Você não conhece nenhuma habilidade.</p>}
                <div className="grid gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
                  {skills.map((s) => {
                    const cd = myCooldowns[s.id] ?? 0;
                    const chosen = s.id === selectedSkill;
                    return (
                      <button key={s.id} disabled={cd > 0}
                        onClick={() => { setSelectedSkill(s.id); setEnergy(s.base_cost); }}
                        className={`text-left rounded-md border p-2 transition ${chosen ? "border-gold bg-gold/10" : "border-border hover:border-gold/60"} ${cd > 0 ? "opacity-40 cursor-not-allowed" : ""}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm">{s.name}</span>
                          <Badge variant="outline" className="text-[9px]">{s.energy_type.toUpperCase()}</Badge>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          ×{s.bonus_energetic} energ • ×{s.bonus_critical} crit • ×{s.bonus_speed} spd
                          {cd > 0 ? ` • ⏳ ${cd}` : (s.cooldown_turns ? ` • CD ${s.cooldown_turns}` : "")}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-end gap-2 mt-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">Energia ({currentSkill?.energy_type.toUpperCase() ?? "—"})</div>
                    <Input type="number" min={currentSkill?.base_cost ?? 1} value={energy}
                      onChange={(e) => setEnergy(Math.max(1, Number(e.target.value)))} />
                  </div>
                  <Button onClick={doAttack} disabled={!currentSkill || busy || currentCd > 0} className="shrink-0">
                    <Sword size={14} className="mr-1" /> {busy ? "..." : "Atacar"}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="items" className="mt-2">
                {consumables.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">Sem consumíveis na bolsa.</p>}
                <div className="grid gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
                  {consumables.map((e) => {
                    const it = itemMap[e.item_id];
                    return (
                      <button key={e.item_id} disabled={busy}
                        onClick={() => doItem(e.item_id)}
                        className="text-left rounded-md border border-border p-2 hover:border-gold/60 transition flex items-center gap-2">
                        <div className="w-10 h-10 rounded bg-secondary overflow-hidden shrink-0">
                          {it?.image_url && <img src={it.image_url} className="w-full h-full object-cover" alt="" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-display truncate">{it?.name ?? "?"}</div>
                          <div className="text-[10px] text-muted-foreground">×{e.qty}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="flee" className="mt-2">
                <div className="text-sm text-muted-foreground mb-2">Fugir encerra o combate para você e o time sem recompensas.</div>
                <Button variant="outline" onClick={() => flee({ data: { session_id: sessionId } })}>
                  <Flag size={14} className="mr-1" /> Confirmar fuga
                </Button>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-between border border-border rounded p-3 bg-input/30">
              <div className="text-sm text-muted-foreground">
                <Users size={12} className="inline mr-1"/> Aguardando <span className="text-gold font-display">{activePlayer?.nickname ?? "…"}</span> agir…
              </div>
              <Button variant="outline" size="sm" onClick={() => flee({ data: { session_id: sessionId } })}>
                <Flag size={14} className="mr-1" /> Fugir
              </Button>
            </div>
          )
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {session.status === "won" && <span className="text-emerald-400">Vitória! {npc.name} foi derrotado.</span>}
              {session.status === "lost" && <span className="text-blood">Derrota. Você saiu enfraquecido, mas sem penalidades.</span>}
              {session.status === "fled" && <span className="text-muted-foreground">Fuga registrada.</span>}
            </div>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}