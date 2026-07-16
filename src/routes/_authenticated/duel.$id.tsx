import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { respondDuel, submitTurn, cancelDuel } from "@/lib/pvp.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sword, ShieldHalf, SkipForward, Flag, Loader2, Sparkles } from "lucide-react";
import { ComboSelect } from "@/components/ui/combo-select";

export const Route = createFileRoute("/_authenticated/duel/$id")({
  component: DuelRoom,
  errorComponent: ({ error }) => <div className="p-6 text-blood">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Duelo não encontrado.</div>,
});

type Side = { hp: number; hp_max: number; ef: number; em: number; chakra: number; ef_max: number; em_max: number; chakra_max: number; shield_pct: number; cooldowns: Record<string, number> };
type Duel = { id: string; challenger_id: string; opponent_id: string; status: string; current_turn_character_id: string | null; turn_number: number; state: any; winner_id: string | null };
type Turn = { id: string; turn_number: number; actor_character_id: string; action: string; skill_id: string | null; category: string | null; energy_invested_pct: number | null; narrative: string; damage: number; crit: boolean; effects: any; created_at: string };

function DuelRoom() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [chars, setChars] = useState<Record<string, { id: string; nickname: string; avatar_url: string | null }>>({});
  const [skills, setSkills] = useState<any[]>([]);
  const [action, setAction] = useState<"attack" | "defend" | "pass" | "forfeit">("attack");
  const [skillId, setSkillId] = useState<string>("");
  const [energyPct, setEnergyPct] = useState<number>(50);
  const [narrative, setNarrative] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const respond = useServerFn(respondDuel);
  const submit = useServerFn(submitTurn);
  const cancel = useServerFn(cancelDuel);
  const feedRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: me } = await supabase.from("characters").select("id").eq("user_id", u.user.id).maybeSingle();
    if (me?.id) setMeId(me.id);
    const { data: d } = await supabase.from("pvp_duels").select("*").eq("id", id).maybeSingle();
    if (!d) return;
    setDuel(d as any);
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("pvp_turns").select("*").eq("duel_id", id).order("created_at", { ascending: true }),
      supabase.from("characters").select("id,nickname,avatar_url").in("id", [d.challenger_id, d.opponent_id]),
    ]);
    setTurns((t ?? []) as any);
    const map: Record<string, any> = {}; (c ?? []).forEach((r) => (map[r.id] = r)); setChars(map);
    if (me?.id) {
      const { data: cs } = await supabase.from("character_skills").select("skill_id, skills(id,name,rank,cost_percent,cooldown_turns,skill_class,animation_url,sound_url)").eq("character_id", me.id);
      setSkills((cs ?? []).map((r: any) => r.skills).filter(Boolean));
    }
  }

  useEffect(() => { refresh(); }, [id]);
  useEffect(() => {
    const ch = supabase.channel(`duel_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pvp_duels", filter: `id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pvp_turns", filter: `duel_id=eq.${id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }); }, [turns.length]);

  const iAmChallenger = duel && meId === duel.challenger_id;
  const iAmOpponent = duel && meId === duel.opponent_id;
  const isMyTurn = duel?.status === "active" && duel.current_turn_character_id === meId;
  const mySide: Side | null = duel?.state ? (iAmChallenger ? duel.state.challenger : duel.state.opponent) ?? null : null;
  const enemySide: Side | null = duel?.state ? (iAmChallenger ? duel.state.opponent : duel.state.challenger) ?? null : null;
  const meChar = duel && meId ? chars[meId] : null;
  const enemyId = duel ? (iAmChallenger ? duel.opponent_id : duel.challenger_id) : null;
  const enemyChar = enemyId ? chars[enemyId] : null;

  const selectedSkill = useMemo(() => skills.find((s) => s.id === skillId), [skills, skillId]);

  async function onSubmit() {
    if (!duel) return;
    if (narrative.trim().length < 20) { toast.error("Narre pelo menos 20 caracteres."); return; }
    if (action === "attack" && !skillId) { toast.error("Escolha uma habilidade."); return; }
    setSubmitting(true);
    try {
      await submit({ data: { duel_id: duel.id, action, skill_id: action === "attack" ? skillId : null, energy_pct: action === "attack" ? energyPct : null, narrative } } as any);
      setNarrative(""); setSkillId("");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  if (!duel) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={16} /> Carregando duelo...</div>;

  // Convite pendente — visão do desafiado
  if (duel.status === "pending" && iAmOpponent) {
    return (
      <div className="mx-auto max-w-lg p-6 space-y-4 text-center">
        <h1 className="font-display text-3xl text-gold">Você foi desafiado!</h1>
        <p className="text-muted-foreground"><b>{chars[duel.challenger_id]?.nickname ?? "…"}</b> te desafiou para um duelo.</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={async () => { try { await respond({ data: { duel_id: duel.id, accept: true } } as any); toast.success("Que comece o combate."); refresh(); } catch (e: any) { toast.error(e.message); } }}>
            <Sword size={14} className="mr-2" /> Aceitar
          </Button>
          <Button variant="outline" onClick={async () => { try { await respond({ data: { duel_id: duel.id, accept: false } } as any); toast.info("Recusado."); navigate({ to: "/chat" }); } catch (e: any) { toast.error(e.message); } }}>
            Recusar
          </Button>
        </div>
      </div>
    );
  }
  if (duel.status === "pending" && iAmChallenger) {
    return (
      <div className="mx-auto max-w-lg p-6 space-y-4 text-center">
        <h1 className="font-display text-3xl text-gold">Aguardando resposta...</h1>
        <p className="text-muted-foreground">Esperando <b>{chars[duel.opponent_id]?.nickname ?? "…"}</b> aceitar o duelo.</p>
        <Button variant="outline" onClick={async () => { await cancel({ data: { duel_id: duel.id } } as any); navigate({ to: "/chat" }); }}>Cancelar convite</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-3 sm:p-6 space-y-4">
      {/* Cabeçalho com HP/energias */}
      <div className="grid grid-cols-2 gap-3">
        <FighterCard side="me" char={meChar} state={mySide} turn={isMyTurn} />
        <FighterCard side="enemy" char={enemyChar} state={enemySide} turn={!isMyTurn && duel.status === "active"} />
      </div>

      {duel.status === "finished" && (
        <div className="border border-gold/40 bg-gold/10 rounded-md p-4 text-center">
          <p className="font-display text-2xl text-gold">
            {duel.winner_id === meId ? "🏆 Vitória!" : "☠️ Derrota"}
          </p>
          <Link to="/chat" className="text-sm underline">Voltar ao chat</Link>
        </div>
      )}

      {/* Feed narrativo */}
      <div ref={feedRef} className="border border-border rounded-md p-3 space-y-3 max-h-[45vh] overflow-y-auto bg-card/40">
        {turns.length === 0 && <p className="text-xs text-muted-foreground text-center italic">O combate começou. Faça sua jogada.</p>}
        {turns.map((t) => {
          const author = chars[t.actor_character_id];
          const isMine = t.actor_character_id === meId;
          return (
            <div key={t.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
              <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden shrink-0">
                {author?.avatar_url && <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className={`max-w-[80%] rounded-md p-2 ${isMine ? "bg-primary/15" : "bg-secondary/40"}`}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  <b className="text-foreground">{author?.nickname ?? "?"}</b>
                  <span>· turno {t.turn_number}</span>
                  <span>· {labelAction(t.action)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-snug">{t.narrative}</p>
                {(t.damage > 0 || t.effects?.skill_name || t.effects?.recovered) && (
                  <div className="mt-2 border-t border-border/60 pt-1 text-xs flex flex-wrap gap-x-3 gap-y-1">
                    {t.effects?.skill_name && <span className="text-gold">✦ {t.effects.skill_name}</span>}
                    {t.category && <span className="text-muted-foreground">({t.category})</span>}
                    {t.damage > 0 && <span className="text-blood">−{t.damage} HP{t.crit ? " CRÍTICO!" : ""}</span>}
                    {t.effects?.recovered && <span className="text-emerald-400">+{Math.round((t.effects.recovered ?? 0) * 100)}% energias</span>}
                    {t.effects?.shield_pct && <span className="text-sky-400">Guarda {Math.round(t.effects.shield_pct * 100)}%</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel de ação */}
      {duel.status === "active" && (
        <div className="border border-border rounded-md p-3 space-y-3 bg-card/60">
          {!isMyTurn ? (
            <p className="text-sm text-muted-foreground text-center italic flex items-center gap-2 justify-center">
              <Loader2 className="animate-spin" size={14} /> Aguardando <b className="text-foreground">{enemyChar?.nickname}</b> jogar...
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <ActionButton icon={<Sword size={14} />} label="Atacar" active={action === "attack"} onClick={() => setAction("attack")} />
                <ActionButton icon={<ShieldHalf size={14} />} label="Defender" active={action === "defend"} onClick={() => setAction("defend")} />
                <ActionButton icon={<SkipForward size={14} />} label="Passar" active={action === "pass"} onClick={() => setAction("pass")} />
                <ActionButton icon={<Flag size={14} />} label="Desistir" active={action === "forfeit"} onClick={() => setAction("forfeit")} />
              </div>

              {action === "attack" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Habilidade</label>
                    <ComboSelect
                      value={skillId}
                      onChange={setSkillId}
                      placeholder="— escolher —"
                      triggerClassName="w-full h-9 text-sm"
                      options={skills.map((s) => {
                        const cd = mySide?.cooldowns?.[s.id] ?? 0;
                        return {
                          value: s.id,
                          label: `${s.name} (${s.rank})${cd > 0 ? ` — recarga ${cd}` : ""}`,
                          disabled: cd > 0,
                        };
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Energia investida ({energyPct}%)</label>
                    <input type="range" min={1} max={selectedSkill?.cost_percent ?? 100} value={energyPct} onChange={(e) => setEnergyPct(Number(e.target.value))} className="w-full accent-blood" />
                    <p className="text-[10px] text-muted-foreground">Teto da técnica: {selectedSkill?.cost_percent ?? "—"}%</p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Sparkles size={12} /> Narrativa — mín. 20 caracteres</label>
                <Textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={4} placeholder="Descreva o que seu personagem faz nesse turno..." />
                <p className="text-[10px] text-right text-muted-foreground">{narrative.trim().length}/2000</p>
              </div>
              <Button onClick={onSubmit} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="animate-spin" size={14} /> : "Confirmar turno"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FighterCard({ side, char, state, turn }: { side: "me" | "enemy"; char: any; state: Side | null; turn: boolean }) {
  if (!char || !state) return <div className="h-24 bg-secondary/30 rounded animate-pulse" />;
  const hpPct = Math.round((state.hp / state.hp_max) * 100);
  return (
    <div className={`border rounded-md p-3 ${turn ? "border-gold ring-1 ring-gold/50" : "border-border"} bg-card/60`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden">
          {char.avatar_url && <img src={char.avatar_url} className="w-full h-full object-cover" alt="" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm truncate">{char.nickname}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{side === "me" ? "você" : "adversário"}{turn ? " · agindo" : ""}</p>
        </div>
      </div>
      <Bar label="HP" cur={state.hp} max={state.hp_max} color="bg-blood" pct={hpPct} />
      <div className="grid grid-cols-3 gap-1 mt-1">
        <MiniBar label="EF" cur={state.ef} max={state.ef_max} color="bg-orange-500" />
        <MiniBar label="EM" cur={state.em} max={state.em_max} color="bg-violet-500" />
        <MiniBar label="CK" cur={state.chakra} max={state.chakra_max} color="bg-sky-500" />
      </div>
      {state.shield_pct > 0 && <p className="text-[10px] text-sky-400 mt-1">🛡 Guarda: {Math.round(state.shield_pct * 100)}%</p>}
    </div>
  );
}

function Bar({ label, cur, max, color, pct }: { label: string; cur: number; max: number; color: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground"><span>{label}</span><span>{cur}/{max}</span></div>
      <div className="h-2 bg-secondary rounded overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
function MiniBar({ label, cur, max, color }: { label: string; cur: number; max: number; color: string }) {
  const pct = Math.round((cur / Math.max(1, max)) * 100);
  return (
    <div>
      <div className="flex justify-between text-[9px] uppercase text-muted-foreground"><span>{label}</span><span>{cur}</span></div>
      <div className="h-1.5 bg-secondary rounded overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
function ActionButton({ icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded text-sm border flex items-center gap-2 ${active ? "border-gold text-gold bg-gold/10" : "border-border text-muted-foreground hover:text-foreground"}`}>
      {icon}{label}
    </button>
  );
}
function labelAction(a: string) {
  return { attack: "ataque", defend: "defesa", pass: "hesitou", item: "item", forfeit: "desistiu" }[a] ?? a;
}