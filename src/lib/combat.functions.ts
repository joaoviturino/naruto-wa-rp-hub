import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Modelo de combate simplificado:
// - Cada participante tem 3 pools: ef, em, chakra (derivados de xp/2 e xp).
// - NPC tem hp (recebe dano) e energy (gasta ao atacar).
// - Jogador gasta da pool escolhida pelo skill (energy_type) e recebe dano
//   subtraído da pool de maior valor (para não morrer de bobeira).
// - Efetividade: effective = energy_used * bonus_energetic.
//   damage = effective * bonus_critical. speed = effective * bonus_speed.
// - Fluxo turno a turno: player age; se o NPC continuar vivo, NPC responde.

type Pool = "ef" | "em" | "chakra";

type Player = {
  character_id: string;
  nickname: string;
  avatar_url: string | null;
  ef: number; em: number; chakra: number;
  ef_max: number; em_max: number; chakra_max: number;
  alive: boolean;
};
type NpcState = {
  id: string; name: string; image_url: string | null;
  hp: number; hp_max: number;
  energy: number; energy_max: number;
};
type CombatState = {
  npc: NpcState;
  players: Player[];
  active: number; // index do jogador cuja vez é
};
type LogEntry = {
  seq: number;
  actor: "player" | "npc";
  actor_name: string;
  target_name: string;
  skill_name: string;
  energy_type: Pool;
  energy_used: number;
  effective: number;
  damage: number;
  speed: number;
  crit_mul: number;
  msg: string;
};

function computeStats(xp: number) {
  const half = Math.floor(xp / 2);
  return { ef: half, em: xp - half, chakra: xp };
}

function damageTargetPlayer(p: Player, dmg: number): { pool: Pool; taken: number } {
  // Retira do maior pool primeiro.
  const pools: { key: Pool; v: number }[] = (
    [
      { key: "ef" as const, v: p.ef },
      { key: "em" as const, v: p.em },
      { key: "chakra" as const, v: p.chakra },
    ]
  ).sort((a, b) => b.v - a.v);
  const target = pools[0];
  const taken = Math.min(dmg, target.v);
  p[target.key] = target.v - taken;
  if (p.ef <= 0 && p.em <= 0 && p.chakra <= 0) p.alive = false;
  return { pool: target.key, taken };
}

async function loadMyChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters").select("id,nickname,avatar_url,xp,current_location_id,ef_current,em_current,chakra_current").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem personagem.");
  return data;
}

/**
 * Roda a checagem de spawn para o personagem atual (chamada periódica pelo cliente enquanto está em danger zone).
 * Retorna { session_id } se um novo combate foi criado, ou { session_id: null }.
 */
export const rollSpawn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await loadMyChar(context);
    if (!me.current_location_id) return { session_id: null as string | null };

    // Já tem combate ativo?
    const { data: existing } = await context.supabase
      .from("combat_participants")
      .select("session_id, session:combat_sessions!inner(status)")
      .eq("character_id", me.id);
    const active = (existing as any[])?.find((e) => e.session?.status === "active");
    if (active) return { session_id: active.session_id as string };

    const { data: loc } = await context.supabase
      .from("locations").select("id,is_danger_zone,spawn_chance,spawn_tick_seconds").eq("id", me.current_location_id).maybeSingle();
    if (!loc?.is_danger_zone) return { session_id: null };
    if (!loc.spawn_chance) return { session_id: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Se estou em uma party: só o líder rola o spawn e todos os membros precisam estar no mesmo local.
    const { data: myPartyRow } = await supabaseAdmin
      .from("party_members").select("party_id").eq("character_id", me.id).maybeSingle();
    let partyIdEarly: string | null = null;
    let partyMembersEarly: any[] = [];
    if (myPartyRow) {
      partyIdEarly = myPartyRow.party_id;
      const { data: party } = await supabaseAdmin.from("parties").select("leader_id").eq("id", partyIdEarly).maybeSingle();
      if (!party || party.leader_id !== me.id) return { session_id: null }; // só líder dispara
      const { data: mems } = await supabaseAdmin
        .from("party_members").select("character:characters(id,nickname,avatar_url,xp,current_location_id,ef_current,em_current,chakra_current)").eq("party_id", partyIdEarly);
      partyMembersEarly = ((mems as any[]) ?? []).map((m: any) => m.character).filter(Boolean);
      // Todos os membros precisam estar no local
      const allHere = partyMembersEarly.every((c: any) => c.current_location_id === loc.id);
      if (!allHere) return { session_id: null };
    }

    // Roll gated por dwell time: precisa ter passado spawn_tick_seconds desde a última rolagem
    const { data: charRow } = await context.supabase
      .from("characters").select("last_spawn_roll_at,location_entered_at").eq("id", me.id).maybeSingle();
    const now = Date.now();
    const last = charRow?.last_spawn_roll_at ? new Date(charRow.last_spawn_roll_at).getTime() : (charRow?.location_entered_at ? new Date(charRow.location_entered_at).getTime() : 0);
    if (now - last < loc.spawn_tick_seconds * 1000) return { session_id: null };

    await supabaseAdmin.from("characters").update({ last_spawn_roll_at: new Date().toISOString() }).eq("id", me.id);

    if (Math.random() * 100 >= loc.spawn_chance) return { session_id: null };

    // Escolhe um NPC do local
    const { data: pool } = await context.supabase
      .from("location_npcs").select("npc_id,weight,npc:npcs(id,name,image_url,hp_max,energy_max,xp)").eq("location_id", loc.id);
    const rows = (pool as any[]) ?? [];
    if (!rows.length) return { session_id: null };
    const total = rows.reduce((s, r) => s + (r.weight ?? 1), 0);
    let r = Math.random() * total;
    let picked = rows[rows.length - 1];
    for (const row of rows) { r -= row.weight ?? 1; if (r <= 0) { picked = row; break; } }
    const npc = picked.npc;

    // Participantes
    const partyId: string | null = partyIdEarly;
    let members: any[] = partyIdEarly ? partyMembersEarly : [{
      id: me.id, nickname: me.nickname, avatar_url: me.avatar_url, xp: me.xp,
      ef_current: me.ef_current, em_current: me.em_current, chakra_current: me.chakra_current,
    }];

    const players: Player[] = members.map((c: any) => {
      const s = computeStats(c.xp ?? 0);
      const ef = c.ef_current == null ? s.ef : Math.min(s.ef, c.ef_current);
      const em = c.em_current == null ? s.em : Math.min(s.em, c.em_current);
      const ck = c.chakra_current == null ? s.chakra : Math.min(s.chakra, c.chakra_current);
      return {
        character_id: c.id, nickname: c.nickname, avatar_url: c.avatar_url,
        ef, em, chakra: ck,
        ef_max: s.ef, em_max: s.em, chakra_max: s.chakra,
        alive: (ef + em + ck) > 0,
      };
    });
    const state: CombatState = {
      npc: { id: npc.id, name: npc.name, image_url: npc.image_url, hp: npc.hp_max, hp_max: npc.hp_max, energy: npc.energy_max, energy_max: npc.energy_max },
      players, active: 0,
    };

    const { data: session, error: sErr } = await supabaseAdmin.from("combat_sessions").insert({
      location_id: loc.id, party_id: partyId, npc_id: npc.id, status: "active", state, log: [], turn: "player",
    }).select("id").single();
    if (sErr) throw new Error(sErr.message);
    const rows2 = players.map((p) => ({ session_id: session.id, character_id: p.character_id }));
    await supabaseAdmin.from("combat_participants").insert(rows2);
    return { session_id: session.id as string };
  });

/** Retorna o combate ativo em que o personagem atual participa (se houver). */
export const getMyActiveCombat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await loadMyChar(context);
    const { data } = await context.supabase
      .from("combat_participants")
      .select("session:combat_sessions!inner(id,status,state,log,turn,npc_id)")
      .eq("character_id", me.id);
    const found = ((data as any[]) ?? []).find((r) => r.session?.status === "active");
    return { session: found?.session ?? null, character_id: me.id as string };
  });

export const playerAttack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    session_id: z.string().uuid(),
    skill_id: z.string().uuid(),
    energy_used: z.number().int().min(1).max(100000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sess } = await supabaseAdmin.from("combat_sessions").select("*").eq("id", data.session_id).maybeSingle();
    if (!sess || sess.status !== "active") throw new Error("Combate encerrado.");
    const state: CombatState = sess.state as any;
    const log: LogEntry[] = sess.log as any;

    const activeIdx = state.active;
    const activePlayer = state.players[activeIdx];
    if (!activePlayer || activePlayer.character_id !== me.id) throw new Error("Não é sua vez.");
    if (!activePlayer.alive) throw new Error("Você está fora de combate.");

    // Habilidade precisa pertencer ao jogador
    const { data: owned } = await context.supabase
      .from("character_skills").select("skill_id").eq("character_id", me.id).eq("skill_id", data.skill_id).maybeSingle();
    if (!owned) throw new Error("Você não conhece essa habilidade.");
    const { data: skill } = await context.supabase.from("skills")
      .select("id,name,energy_type,base_cost,bonus_speed,bonus_critical,bonus_energetic").eq("id", data.skill_id).maybeSingle();
    if (!skill) throw new Error("Habilidade inexistente.");
    if (data.energy_used < skill.base_cost) throw new Error(`Custo mínimo: ${skill.base_cost}.`);

    const pool = (skill.energy_type as Pool);
    if (activePlayer[pool] < data.energy_used) throw new Error(`Energia insuficiente (${pool.toUpperCase()}).`);
    activePlayer[pool] -= data.energy_used;

    const effective = data.energy_used * Number(skill.bonus_energetic);
    const speed = effective * Number(skill.bonus_speed);
    const damage = Math.round(effective * Number(skill.bonus_critical));

    log.push({
      seq: log.length + 1, actor: "player", actor_name: activePlayer.nickname, target_name: state.npc.name,
      skill_name: skill.name, energy_type: pool, energy_used: data.energy_used,
      effective, damage, speed, crit_mul: Number(skill.bonus_critical),
      msg: `${activePlayer.nickname} usa ${skill.name} (${pool.toUpperCase()} ${data.energy_used}) → ${damage} de dano.`,
    });
    state.npc.hp = Math.max(0, state.npc.hp - damage);

    let status = sess.status as string;
    let ended_at: string | null = null;

    if (state.npc.hp <= 0) {
      status = "won"; ended_at = new Date().toISOString();
    } else {
      // Turno do NPC
      const npcTurn = await runNpcTurn(supabaseAdmin, sess.npc_id, state, log, speed);
      state.npc.energy = npcTurn.energyRemaining;
      if (state.players.every((p) => !p.alive)) { status = "lost"; ended_at = new Date().toISOString(); }
      else {
        // Passa a vez para próximo jogador vivo
        const total = state.players.length;
        let next = (activeIdx + 1) % total;
        for (let i = 0; i < total; i++) {
          if (state.players[next].alive) break;
          next = (next + 1) % total;
        }
        state.active = next;
      }
    }

    // Persistir pools atuais em characters
    await persistPools(supabaseAdmin, state);

    // Recompensas ao vencer
    let rewards: any = null;
    if (status === "won") {
      rewards = await applyRewards(supabaseAdmin, sess.npc_id, state, log);
    }

    await supabaseAdmin.from("combat_sessions").update({ state, log, status, ended_at, turn: "player" }).eq("id", sess.id);
    return { ok: true, status };
  });

async function persistPools(supabaseAdmin: any, state: CombatState) {
  for (const p of state.players) {
    await supabaseAdmin.from("characters").update({
      ef_current: p.ef, em_current: p.em, chakra_current: p.chakra,
    }).eq("id", p.character_id);
  }
}

async function applyRewards(supabaseAdmin: any, npcId: string, state: CombatState, log: LogEntry[]) {
  const { data: npc } = await supabaseAdmin.from("npcs").select("reward_xp,reward_ryo,drop_table").eq("id", npcId).maybeSingle();
  if (!npc) return null;
  const xpGain = Number(npc.reward_xp ?? 0);
  const ryoGain = Number(npc.reward_ryo ?? 0);
  const drops = Array.isArray(npc.drop_table) ? npc.drop_table : [];
  const rolled: { item_id: string; qty: number }[] = [];
  for (const d of drops) {
    if (!d?.item_id) continue;
    const chance = Number(d.chance ?? 0);
    if (Math.random() * 100 < chance) rolled.push({ item_id: d.item_id, qty: Number(d.qty ?? 1) });
  }
  // Entrega pra cada jogador vivo (ou todos participantes se ninguém sobreviveu — mas won implica ao menos 1 vivo).
  const receivers = state.players.filter((p) => p.alive);
  for (const p of receivers) {
    if (xpGain > 0 || ryoGain > 0) {
      const { data: c } = await supabaseAdmin.from("characters").select("xp,ryo").eq("id", p.character_id).maybeSingle();
      await supabaseAdmin.from("characters").update({
        xp: Number(c?.xp ?? 0) + xpGain,
        ryo: Number(c?.ryo ?? 0) + ryoGain,
      }).eq("id", p.character_id);
    }
    if (rolled.length) {
      const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag").eq("character_id", p.character_id).maybeSingle();
      const bag = (Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag : []).map((e: any) => ({ item_id: e.item_id, qty: Number(e.qty ?? 1) }));
      for (const r of rolled) {
        const idx = bag.findIndex((e: any) => e.item_id === r.item_id);
        if (idx >= 0) bag[idx].qty += r.qty; else bag.push({ item_id: r.item_id, qty: r.qty });
      }
      await supabaseAdmin.from("inventory").update({ ninja_bag: bag }).eq("character_id", p.character_id);
    }
  }
  const dropNames = rolled.length ? ` + ${rolled.length} item(ns)` : "";
  log.push({
    seq: log.length + 1, actor: "npc", actor_name: state.npc.name, target_name: "time",
    skill_name: "recompensa", energy_type: "chakra", energy_used: 0, effective: 0, damage: 0, speed: 0, crit_mul: 0,
    msg: `Recompensa: +${xpGain} XP, +${ryoGain} Ryo${dropNames} (por jogador).`,
  });
  return { xp: xpGain, ryo: ryoGain, drops: rolled };
}

async function runNpcTurn(supabaseAdmin: any, npcId: string, state: CombatState, log: LogEntry[], incomingSpeed: number) {
  const { data: skills } = await supabaseAdmin
    .from("npc_skills").select("skill:skills(id,name,energy_type,base_cost,bonus_speed,bonus_critical,bonus_energetic)").eq("npc_id", npcId);
  const pool = ((skills as any[]) ?? []).map((r: any) => r.skill).filter(Boolean);
  if (pool.length === 0) return { energyRemaining: state.npc.energy };

  // NPC escolhe skill com maior speed×critical de energia disponível
  const affordable = pool.filter((s: any) => state.npc.energy >= s.base_cost);
  if (affordable.length === 0) return { energyRemaining: state.npc.energy };

  const skill = affordable[Math.floor(Math.random() * affordable.length)];
  const energy = Math.min(state.npc.energy, Math.max(skill.base_cost, Math.floor(state.npc.energy_max / 4)));
  const effective = energy * Number(skill.bonus_energetic);
  const speed = effective * Number(skill.bonus_speed);
  const damage = Math.round(effective * Number(skill.bonus_critical));

  // Regra "quem é mais rápido pega primeiro": se speed do jogador for maior E jogador matou o NPC, NPC não age.
  // Aqui já sabemos que NPC não morreu — mas se a fala for do jogador mais rápido, aplicamos multiplicador de dano reduzido (30% menos) como penalidade por reação.
  const speedPenalty = incomingSpeed > speed ? 0.7 : 1;
  const finalDamage = Math.round(damage * speedPenalty);

  // Escolhe um jogador vivo aleatório como alvo
  const alive = state.players.filter((p) => p.alive);
  if (!alive.length) return { energyRemaining: state.npc.energy };
  const target = alive[Math.floor(Math.random() * alive.length)];
  const taken = damageTargetPlayer(target, finalDamage);

  log.push({
    seq: log.length + 1, actor: "npc", actor_name: state.npc.name, target_name: target.nickname,
    skill_name: skill.name, energy_type: skill.energy_type as Pool, energy_used: energy,
    effective, damage: finalDamage, speed, crit_mul: Number(skill.bonus_critical),
    msg: `${state.npc.name} usa ${skill.name} → ${target.nickname} perde ${taken.taken} de ${taken.pool.toUpperCase()}${speedPenalty < 1 ? " (reação lenta)" : ""}.`,
  });
  return { energyRemaining: state.npc.energy - energy };
}

export const fleeCombat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cp } = await supabaseAdmin
      .from("combat_participants").select("session_id").eq("session_id", data.session_id).eq("character_id", me.id).maybeSingle();
    if (!cp) throw new Error("Você não está neste combate.");
    const { data: sess } = await supabaseAdmin.from("combat_sessions").select("state").eq("id", data.session_id).maybeSingle();
    if (sess?.state) await persistPools(supabaseAdmin, sess.state as any);
    await supabaseAdmin.from("combat_sessions").update({ status: "fled", ended_at: new Date().toISOString() }).eq("id", data.session_id);
    return { ok: true };
  });