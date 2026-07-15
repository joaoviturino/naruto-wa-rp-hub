import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bumpMissionProgress } from "@/lib/missions.functions";

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
  user_id?: string | null;
  nickname: string;
  avatar_url: string | null;
  sprite_url?: string | null;
  hp: number; hp_max: number;
  ef: number; em: number; chakra: number;
  ef_max: number; em_max: number; chakra_max: number;
  alive: boolean;
  /** Cooldown restante por habilidade (turnos). */
  cooldowns?: Record<string, number>;
};
type NpcState = {
  id: string; name: string; image_url: string | null;
  battle_bg_url?: string | null;
  music_url?: string | null;
  hp: number; hp_max: number;
  energy: number; energy_max: number;
  alive?: boolean;
};
type CombatState = {
  /** Alvo atual (referência ao mesmo objeto em `npcs`). Mantido por compat. */
  npc: NpcState;
  /** Todos os inimigos do encontro. NPCs abatidos ficam com `alive=false`. */
  npcs: NpcState[];
  players: Player[];
  active: number; // index do jogador cuja vez é
  /** Índice do inimigo em `npcs` que o jogador atacará neste turno. */
  target?: number;
};

/** Normaliza sessões antigas (`state.npc` sem `state.npcs`) migrando para array. */
function normalizeState(state: any): CombatState {
  if (!state) return state;
  if (!Array.isArray(state.npcs) || state.npcs.length === 0) {
    if (state.npc) {
      state.npcs = [{ ...state.npc, alive: (state.npc.hp ?? 0) > 0 }];
    } else {
      state.npcs = [];
    }
  }
  // Sincroniza flag `alive` a partir do hp
  for (const n of state.npcs) if (n.alive === undefined) n.alive = (n.hp ?? 0) > 0;
  // target inicial
  if (typeof state.target !== "number") {
    state.target = state.npcs.findIndex((n: NpcState) => n.alive);
    if (state.target < 0) state.target = 0;
  }
  state.npc = state.npcs[state.target] ?? state.npcs[0];
  return state;
}

/** Seleciona próximo NPC vivo. Retorna -1 se todos mortos. */
function nextAliveNpcIdx(state: CombatState, from = 0): number {
  for (let i = 0; i < state.npcs.length; i++) {
    const idx = (from + i) % state.npcs.length;
    if (state.npcs[idx].alive) return idx;
  }
  return -1;
}
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
  animation_url?: string | null;
  animation_mode?: "projectile" | "front" | "overlay" | null;
  sound_url?: string | null;
  pose_url?: string | null;
  actor_char_id?: string | null;
  target_char_id?: string | null;
  target_npc_idx?: number | null;
  raw_damage?: number;
  defense?: number;
  hit_cap?: number;
  heal?: boolean;
  heal_mode?: "single" | "team";
  heal_target_ids?: string[];
};

function computeStats(xp: number) {
  const half = Math.floor(xp / 2);
  return { ef: half, em: xp - half, chakra: xp };
}

function damageTargetPlayer(p: Player, dmg: number): { pool: "hp"; taken: number } {
  // Dano de NPC vai direto na vida (HP máximo = XP do personagem).
  const taken = Math.min(dmg, Math.max(0, p.hp));
  p.hp = Math.max(0, p.hp - taken);
  if (p.hp <= 0) p.alive = false;
  return { pool: "hp", taken };
}

async function loadMyChar(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("characters").select("id,nickname,avatar_url,inventory_bg_url,xp,current_location_id,ef_current,em_current,chakra_current,hp_current").eq("user_id", context.userId).maybeSingle();
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
        .from("party_members").select("character:characters(id,nickname,avatar_url,inventory_bg_url,xp,current_location_id,ef_current,em_current,chakra_current,hp_current)").eq("party_id", partyIdEarly);
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

    // Escolhe inimigos: preferimos grupos configurados no local; se não houver, cai para
    // sorteio individual em `location_npcs`.
    let chosenNpcs: any[] = [];
    let groupBattleBg: string | null = null;
    let groupMusic: string | null = null;
    const { data: locFull } = await context.supabase
      .from("locations").select("spawn_group_ids").eq("id", loc.id).maybeSingle();
    const groupIds = ((locFull as any)?.spawn_group_ids ?? []) as string[];
    if (groupIds.length) {
      const groupId = groupIds[Math.floor(Math.random() * groupIds.length)];
      const { data: gRow } = await context.supabase
        .from("npc_groups").select("battle_bg_url,music_url").eq("id", groupId).maybeSingle();
      groupBattleBg = (gRow as any)?.battle_bg_url ?? null;
      groupMusic = (gRow as any)?.music_url ?? null;
      const { data: mems } = await context.supabase
        .from("npc_group_members")
        .select("npc:npcs(id,name,image_url,battle_bg_url,music_url,hp_max,energy_max,xp,kind)")
        .eq("group_id", groupId);
      chosenNpcs = ((mems as any[]) ?? [])
        .map((r) => r.npc)
        .filter((n: any) => n && (n.kind ?? "aggressive") === "aggressive");
    }
    if (!chosenNpcs.length) {
      const { data: pool } = await context.supabase
        .from("location_npcs").select("npc_id,weight,npc:npcs(id,name,image_url,battle_bg_url,music_url,hp_max,energy_max,xp,kind)").eq("location_id", loc.id);
      const rows = ((pool as any[]) ?? []).filter((r) => (r.npc?.kind ?? "aggressive") === "aggressive");
      if (!rows.length) return { session_id: null };
      const total = rows.reduce((s, r) => s + (r.weight ?? 1), 0);
      let r = Math.random() * total;
      let picked = rows[rows.length - 1];
      for (const row of rows) { r -= row.weight ?? 1; if (r <= 0) { picked = row; break; } }
      chosenNpcs = [picked.npc];
    }
    const npc = chosenNpcs[0];

    // Participantes
    const partyId: string | null = partyIdEarly;
    let members: any[] = partyIdEarly ? partyMembersEarly : [{
      id: me.id, nickname: me.nickname, avatar_url: me.avatar_url, inventory_bg_url: (me as any).inventory_bg_url, xp: me.xp,
      ef_current: me.ef_current, em_current: me.em_current, chakra_current: me.chakra_current, hp_current: (me as any).hp_current,
    }];

    const { getCharBuffs } = await import("./clan-tree.functions");
    const players: Player[] = [];
    for (const c of members as any[]) {
      const s = computeStats(c.xp ?? 0);
      const buffs = await getCharBuffs(supabaseAdmin, c.id);
      const enBonus = Math.max(0, Number(buffs.energy_bonus ?? 0));
      const efMax = s.ef + enBonus, emMax = s.em + enBonus, chakraMax = s.chakra + enBonus;
      const ef = c.ef_current == null ? efMax : Math.min(efMax, c.ef_current);
      const em = c.em_current == null ? emMax : Math.min(emMax, c.em_current);
      const ck = c.chakra_current == null ? chakraMax : Math.min(chakraMax, c.chakra_current);
      const hpMax = Math.max(1, Number(c.xp ?? 0) + Number(buffs.hp_bonus ?? 0));
      const hp = c.hp_current == null ? hpMax : Math.max(0, Math.min(hpMax, Number(c.hp_current)));
      players.push({
        character_id: c.id, nickname: c.nickname, avatar_url: c.avatar_url, sprite_url: c.inventory_bg_url ?? null,
        hp, hp_max: hpMax,
        ef, em, chakra: ck,
        ef_max: efMax, em_max: emMax, chakra_max: chakraMax,
        alive: hp > 0,
        cooldowns: {},
      });
    }
    const npcsState: NpcState[] = chosenNpcs.map((n) => ({
      id: n.id, name: n.name, image_url: n.image_url,
      battle_bg_url: groupBattleBg ?? n.battle_bg_url ?? null,
      music_url: groupMusic ?? (n as any).music_url ?? null,
      hp: n.hp_max, hp_max: n.hp_max,
      energy: n.energy_max, energy_max: n.energy_max,
      alive: true,
    }));
    const state: CombatState = {
      npc: npcsState[0],
      npcs: npcsState,
      players, active: 0, target: 0,
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
    target_index: z.number().int().min(0).max(10).optional(),
    heal_target_char_id: z.string().uuid().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sess } = await supabaseAdmin.from("combat_sessions").select("*").eq("id", data.session_id).maybeSingle();
    if (!sess || sess.status !== "active") throw new Error("Combate encerrado.");
    // PvP: dispatch para o motor específico
    if ((sess.state as any)?.mode === "pvp") {
      return await handlePvpAttack(supabaseAdmin, context.supabase, sess, me.id, data);
    }
    const state: CombatState = normalizeState(sess.state as any);
    const log: LogEntry[] = sess.log as any;

    // Escolhe alvo: usa target_index enviado, ou o `state.target`, ou o primeiro vivo.
    let targetIdx = typeof data.target_index === "number" ? data.target_index : (state.target ?? 0);
    if (!state.npcs[targetIdx] || !state.npcs[targetIdx].alive) {
      targetIdx = nextAliveNpcIdx(state, 0);
      if (targetIdx < 0) throw new Error("Todos os inimigos já caíram.");
    }
    state.target = targetIdx;
    state.npc = state.npcs[targetIdx];

    const activeIdx = state.active;
    const activePlayer = state.players[activeIdx];
    if (!activePlayer || activePlayer.character_id !== me.id) throw new Error("Não é sua vez.");
    if (!activePlayer.alive) throw new Error("Você está fora de combate.");

    // Cooldown check
    activePlayer.cooldowns = activePlayer.cooldowns ?? {};
    const cd = activePlayer.cooldowns[data.skill_id] ?? 0;
    if (cd > 0) throw new Error(`Habilidade em cooldown por mais ${cd} turno(s).`);

    // Habilidade precisa pertencer ao jogador
    const { data: owned } = await context.supabase
      .from("character_skills").select("skill_id").eq("character_id", me.id).eq("skill_id", data.skill_id).maybeSingle();
    if (!owned) throw new Error("Você não conhece essa habilidade.");
    const { data: skill } = await context.supabase.from("skills")
      .select("id,name,energy_type,base_cost,cost_percent,bonus_speed,bonus_critical,bonus_energetic,cooldown_turns,req_class,skill_class,classification,meta,animation_url,animation_mode,sound_url").eq("id", data.skill_id).maybeSingle();
    if (!skill) throw new Error("Habilidade inexistente.");
    const combatClass = String((skill as any).skill_class ?? skill.req_class ?? "").toLowerCase();
    const healCfg = (skill as any).meta?.heal as { target?: "single" | "team" } | undefined;
    const isHealSkill = !!healCfg?.target;

    // === Jutsu médico (Iryo suplementar): CURA em vez de dano ===
    if (isHealSkill) {
      const pool = (skill.energy_type as Pool);
      const poolMax = pool === "ef" ? activePlayer.ef_max : pool === "em" ? activePlayer.em_max : activePlayer.chakra_max;
      const costPct = Math.max(1, Math.min(100, Number((skill as any).cost_percent ?? 20)));
      const { getCharBuffs } = await import("./clan-tree.functions");
      const buffs = await getCharBuffs(context.supabase, me.id);
      const costReduction = Math.max(0, Math.min(90, Number(buffs.skill_cost_reduction ?? 0)));
      const powerBonus = Math.max(0, Number(buffs.skill_power_bonus ?? 0));
      const maxEnergyBase = Math.max(1, Math.floor((poolMax * costPct) / 100));
      const maxEnergy = Math.max(1, Math.floor(maxEnergyBase * (1 - costReduction / 100)));
      if (data.energy_used > maxEnergy) throw new Error(`Custo máximo desta habilidade: ${maxEnergy} (${costPct}% da pool ${pool.toUpperCase()}).`);
      if (activePlayer[pool] < data.energy_used) throw new Error(`Energia insuficiente (${pool.toUpperCase()}).`);
      activePlayer[pool] -= data.energy_used;

      // Bônus de maestria em Iryo
      let masteryMul = 1;
      if (skill.req_class || (skill as any).skill_class) {
        const cls = (skill as any).skill_class ?? skill.req_class;
        const { data: c } = await context.supabase
          .from("characters").select("proficiencies").eq("id", me.id).maybeSingle();
        const m = (c?.proficiencies as any)?.[cls]?.maestria as string | undefined;
        const idx = ["E","D","C","B","A","S"].indexOf(m ?? "");
        if (idx >= 0) masteryMul = 1 + idx * 0.1;
      }
      const powerMul = 1 + powerBonus / 100;
      const healAmount = Math.max(1, Math.round(data.energy_used * powerMul * masteryMul));

      // Cooldown
      if (Number(skill.cooldown_turns ?? 0) > 0) {
        activePlayer.cooldowns[data.skill_id] = Number(skill.cooldown_turns);
      }

      // Alvos
      let targets: Player[] = [];
      if (healCfg!.target === "team") {
        targets = state.players.filter((p) => p.alive);
      } else {
        const tid = data.heal_target_char_id ?? activePlayer.character_id;
        const t = state.players.find((p) => p.character_id === tid && p.alive);
        if (!t) throw new Error("Alvo inválido para cura.");
        targets = [t];
      }
      const healedIds: string[] = [];
      const names: string[] = [];
      for (const t of targets) {
        const before = t.hp;
        t.hp = Math.min(t.hp_max, t.hp + healAmount);
        if (t.hp > before) healedIds.push(t.character_id);
        names.push(t.nickname);
      }

      // Pose configurada
      let poseUrl: string | null = null;
      {
        const { data: csp } = await supabaseAdmin
          .from("character_skill_poses")
          .select("pose:character_poses(image_url)")
          .eq("character_id", activePlayer.character_id)
          .eq("skill_id", data.skill_id)
          .maybeSingle();
        poseUrl = ((csp as any)?.pose?.image_url as string | undefined) ?? null;
      }

      log.push({
        seq: log.length + 1, actor: "player", actor_name: activePlayer.nickname,
        target_name: healCfg!.target === "team" ? "Time" : names[0] ?? activePlayer.nickname,
        skill_name: skill.name, energy_type: pool, energy_used: data.energy_used,
        effective: healAmount, damage: healAmount, speed: 0, crit_mul: 1,
        heal: true, heal_mode: healCfg!.target, heal_target_ids: healedIds,
        pose_url: poseUrl,
        actor_char_id: activePlayer.character_id,
        animation_url: (skill as any).animation_url ?? null,
        animation_mode: ((skill as any).animation_mode ?? "overlay") as any,
        sound_url: (skill as any).sound_url ?? null,
        msg: `${activePlayer.nickname} usa ${skill.name} (cura ${pool.toUpperCase()} ${data.energy_used}) → ${healCfg!.target === "team" ? "time" : names[0]} +${healAmount} HP${masteryMul > 1 ? ` [Maestria ×${masteryMul.toFixed(1)}]` : ""}.`,
      });

      // NPC responde
      let status = sess.status as string;
      let ended_at: string | null = null;
      const npcTurn = await runNpcTurn(supabaseAdmin, sess.npc_id, state, log, 0);
      state.npc.energy = npcTurn.energyRemaining;
      if (state.players.every((p) => !p.alive)) { status = "lost"; ended_at = new Date().toISOString(); }
      else {
        const total = state.players.length;
        let next = (activeIdx + 1) % total;
        for (let i = 0; i < total; i++) {
          if (state.players[next].alive) break;
          next = (next + 1) % total;
        }
        state.active = next;
        const np = state.players[next];
        if (np.cooldowns) {
          for (const k of Object.keys(np.cooldowns)) {
            np.cooldowns[k] = Math.max(0, (np.cooldowns[k] ?? 0) - 1);
          }
        }
      }
      await persistPools(supabaseAdmin, state);
      await supabaseAdmin.from("combat_sessions").update({ state, log, status, ended_at, turn: "player" }).eq("id", sess.id);
      return { ok: true, status };
    }

    // Shurikenjutsu: consome N "ferramentas" (kunai/shuriken/etc.) da bolsa
    // e usa o bônus crítico da primeira ferramenta encontrada.
    let toolCritMul = 1;
    let toolConsumedLabel: string | null = null;
    let toolQtyConsumed = 0;
    if (combatClass === "shurikenjutsu") {
      const toolQtyNeeded = Math.max(1, Number((skill as any).meta?.tool_qty ?? 1));
      const { data: inv } = await supabaseAdmin.from("inventory")
        .select("ninja_bag,secondary_slots").eq("character_id", me.id).maybeSingle();
      const bag: any[] = Array.isArray(inv?.ninja_bag) ? inv!.ninja_bag.map((e: any) => ({ ...e })) : [];
      const sec: any[] = Array.isArray(inv?.secondary_slots) ? inv!.secondary_slots.map((e: any) => ({ ...e })) : [];
      const ids = Array.from(new Set([...bag, ...sec].map((e: any) => e?.item_id).filter(Boolean)));
      const { data: itemRows } = ids.length
        ? await supabaseAdmin.from("items").select("id,name,meta").in("id", ids)
        : { data: [] as any[] };
      const toolIds = new Set((itemRows ?? []).filter((r: any) => r?.meta?.is_tool).map((r: any) => r.id));
      const totalAvailable = (arr: any[]) =>
        arr.filter((e: any) => toolIds.has(e?.item_id)).reduce((s: number, e: any) => s + Number(e.qty ?? 1), 0);
      const available = totalAvailable(bag) + totalAvailable(sec);
      if (available < toolQtyNeeded) {
        throw new Error(`Ferramentas insuficientes — necessário ${toolQtyNeeded}, você tem ${available}.`);
      }
      let remaining = toolQtyNeeded;
      const consumeFrom = (arr: any[]) => {
        for (let i = 0; i < arr.length && remaining > 0; i++) {
          const e = arr[i];
          if (!toolIds.has(e?.item_id)) continue;
          const take = Math.min(Number(e.qty ?? 1), remaining);
          e.qty = Number(e.qty ?? 1) - take;
          remaining -= take;
          if (!toolConsumedLabel) {
            const row = (itemRows ?? []).find((r: any) => r.id === e.item_id);
            toolConsumedLabel = row?.name ?? "ferramenta";
            toolCritMul = 1 + Math.max(0, Number(row?.meta?.crit_bonus ?? 0)) / 100;
          }
        }
        // limpa pilhas zeradas
        for (let i = arr.length - 1; i >= 0; i--) if (Number(arr[i].qty ?? 0) <= 0) arr.splice(i, 1);
      };
      consumeFrom(bag);
      if (remaining > 0) consumeFrom(sec);
      toolQtyConsumed = toolQtyNeeded;
      await supabaseAdmin.from("inventory").update({ ninja_bag: bag, secondary_slots: sec }).eq("character_id", me.id);
    }

    // Kenjutsu: exige espada equipada com durabilidade > 0 e consome uma
    // porcentagem (skill.meta.durability_cost_pct, padrão 10%) da durabilidade
    // MÁXIMA da arma a cada golpe. Se ambos slots estiverem quebrados, bloqueia.
    const brokenWeapons: string[] = [];
    if (combatClass === "kenjutsu") {
      const { data: inv } = await supabaseAdmin.from("inventory")
        .select("primary_weapon_id,secondary_weapon_id,primary_weapon_durability,secondary_weapon_durability")
        .eq("character_id", me.id).maybeSingle();
      if (!inv || (!inv.primary_weapon_id && !inv.secondary_weapon_id)) {
        throw new Error("Você precisa de uma espada equipada para usar Kenjutsu.");
      }
      const slots = [
        { idCol: "primary_weapon_id", durCol: "primary_weapon_durability" },
        { idCol: "secondary_weapon_id", durCol: "secondary_weapon_durability" },
      ] as const;
      const weaponIds = slots.map((s) => (inv as any)[s.idCol]).filter(Boolean) as string[];
      const { data: itemRows } = weaponIds.length
        ? await supabaseAdmin.from("items").select("id,name,durability").in("id", weaponIds)
        : { data: [] as any[] };
      const rowOf = (id: string) => (itemRows ?? []).find((r: any) => r.id === id);
      // Precisa haver ao menos uma arma utilizável. Armas equipadas antes da
      // coluna de durabilidade podem estar com durabilidade atual nula; nesse
      // caso inicializamos pelo valor máximo do item e aplicamos o desgaste.
      const usable = slots.filter((s) => {
        const wid = (inv as any)[s.idCol];
        if (!wid) return false;
        const row = rowOf(wid);
        const cur = (inv as any)[s.durCol];
        if (cur === null || cur === undefined) return row?.durability == null || Number(row.durability) > 0;
        return Number(cur) > 0;
      });
      if (usable.length === 0) {
        throw new Error("Todas as suas espadas estão quebradas. Repare ou substitua antes de usar Kenjutsu.");
      }
      const pct = Math.max(1, Math.min(100, Number((skill as any).meta?.durability_cost_pct ?? 10)));
      const patch: any = {};
      for (const s of slots) {
        const wid = (inv as any)[s.idCol] as string | null;
        if (!wid) continue;
        const row = rowOf(wid);
        const itemMaxDur = row?.durability;
        if (itemMaxDur === null || itemMaxDur === undefined) continue; // arma sem durabilidade configurada = infinita
        const maxDur = Math.max(1, Number(itemMaxDur));
        const cur = (inv as any)[s.durCol];
        const currentDur = cur === null || cur === undefined ? maxDur : Number(cur);
        if (currentDur <= 0) {
          patch[s.idCol] = null;
          patch[s.durCol] = null;
          brokenWeapons.push(row?.name ?? "arma");
          continue;
        }
        const wear = Math.max(1, Math.ceil((maxDur * pct) / 100));
        const next = currentDur - wear;
        if (next <= 0) {
          patch[s.idCol] = null;
          patch[s.durCol] = null;
          brokenWeapons.push(row?.name ?? "arma");
        } else {
          patch[s.durCol] = next;
        }
      }
      if (Object.keys(patch).length) {
        await supabaseAdmin.from("inventory").update(patch).eq("character_id", me.id);
      }
    }

    const pool = (skill.energy_type as Pool);
    const poolMax = pool === "ef" ? activePlayer.ef_max : pool === "em" ? activePlayer.em_max : activePlayer.chakra_max;
    const costPct = Math.max(1, Math.min(100, Number((skill as any).cost_percent ?? 20)));
    // Buffs de clã: reduzem custo e amplificam dano
    const { getCharBuffs } = await import("./clan-tree.functions");
    const buffs = await getCharBuffs(context.supabase, me.id);
    const costReduction = Math.max(0, Math.min(90, Number(buffs.skill_cost_reduction ?? 0)));
    const powerBonus = Math.max(0, Number(buffs.skill_power_bonus ?? 0));
    const maxEnergyBase = Math.max(1, Math.floor((poolMax * costPct) / 100));
    const maxEnergy = Math.max(1, Math.floor(maxEnergyBase * (1 - costReduction / 100)));
    if (data.energy_used < 1) throw new Error("Energia mínima: 1.");
    if (data.energy_used > maxEnergy) throw new Error(`Custo máximo desta habilidade: ${maxEnergy} (${costPct}% da pool ${pool.toUpperCase()}).`);
    if (activePlayer[pool] < data.energy_used) throw new Error(`Energia insuficiente (${pool.toUpperCase()}).`);
    activePlayer[pool] -= data.energy_used;

    // Bônus de maestria: se a skill tem classe e o personagem tem maestria nela,
    // aumenta o dano proporcionalmente (E=0%, D=10%, C=20%, B=30%, A=40%, S=50%).
    let masteryMul = 1;
    if (skill.req_class) {
      const { data: c } = await context.supabase
        .from("characters").select("proficiencies").eq("id", me.id).maybeSingle();
      const m = (c?.proficiencies as any)?.[skill.req_class]?.maestria as string | undefined;
      const idx = ["E","D","C","B","A","S"].indexOf(m ?? "");
      if (idx >= 0) masteryMul = 1 + idx * 0.1;
    }
    const effective = data.energy_used * Number(skill.bonus_energetic);
    const speed = effective * Number(skill.bonus_speed);
    const powerMul = 1 + powerBonus / 100;
    const rawDamage = Math.round(effective * Number(skill.bonus_critical) * masteryMul * powerMul * toolCritMul);

    // Mitigação e cap por golpe vindos do NPC alvo
    const { data: npcCfg } = await supabaseAdmin
      .from("npcs").select("defense,max_hit_percent").eq("id", state.npc.id).maybeSingle();
    const defense = Math.max(0, Math.min(90, Number((npcCfg as any)?.defense ?? 0)));
    const maxHitPct = Math.max(10, Math.min(100, Number((npcCfg as any)?.max_hit_percent ?? 50)));
    const afterDef = Math.max(1, Math.round(rawDamage * (1 - defense / 100)));
    const hitCap = Math.max(1, Math.ceil((state.npc.hp_max ?? 0) * maxHitPct / 100));
    const damage = Math.min(afterDef, hitCap);

    // Aplica cooldown
    if (Number(skill.cooldown_turns ?? 0) > 0) {
      activePlayer.cooldowns[data.skill_id] = Number(skill.cooldown_turns);
    }

    // Pose configurada pelo jogador para esta habilidade (troca de sprite durante o golpe).
    let poseUrl: string | null = null;
    {
      const { data: csp } = await supabaseAdmin
        .from("character_skill_poses")
        .select("pose:character_poses(image_url)")
        .eq("character_id", activePlayer.character_id)
        .eq("skill_id", data.skill_id)
        .maybeSingle();
      poseUrl = ((csp as any)?.pose?.image_url as string | undefined) ?? null;
    }

    log.push({
      seq: log.length + 1, actor: "player", actor_name: activePlayer.nickname, target_name: state.npc.name,
      skill_name: skill.name, energy_type: pool, energy_used: data.energy_used,
      effective, damage, raw_damage: rawDamage, defense, hit_cap: hitCap, speed, crit_mul: Number(skill.bonus_critical),
      pose_url: poseUrl,
      actor_char_id: activePlayer.character_id,
      target_npc_idx: targetIdx,
      animation_url: (skill as any).animation_url ?? null,
      animation_mode: ((skill as any).animation_mode ?? "overlay") as any,
      sound_url: (skill as any).sound_url ?? null,
      msg: `${activePlayer.nickname} usa ${skill.name} (${pool.toUpperCase()} ${data.energy_used})${masteryMul > 1 ? ` [Maestria ×${masteryMul.toFixed(1)}]` : ""}${toolConsumedLabel ? ` [-${toolQtyConsumed} ${toolConsumedLabel}]` : ""} → ${damage} de dano${defense > 0 ? ` (def ${defense}%)` : ""}${damage < afterDef ? ` [cap ${maxHitPct}%]` : ""}.`,
      ...(toolConsumedLabel ? { tool_consumed: toolConsumedLabel, tool_qty: toolQtyConsumed, tool_crit_mul: toolCritMul } : {}),
    });
    if (brokenWeapons.length) {
      log.push({
        seq: log.length + 1, actor: "system", actor_name: "sistema", target_name: activePlayer.nickname,
        msg: `${brokenWeapons.join(" e ")} quebrou pelo uso! Arma desequipada.`,
      } as any);
    }
    state.npc.hp = Math.max(0, state.npc.hp - damage);
    if (state.npc.hp <= 0) state.npc.alive = false;
    // Reflete mudança no array (state.npc é referência, mas garantimos)
    state.npcs[targetIdx] = state.npc;

    let status = sess.status as string;
    let ended_at: string | null = null;

    const allDead = state.npcs.every((n) => !n.alive);
    if (allDead) {
      status = "won"; ended_at = new Date().toISOString();
    } else {
      // Auto-pick próximo alvo vivo caso o atual tenha morrido
      if (!state.npc.alive) {
        const nxt = nextAliveNpcIdx(state, targetIdx);
        if (nxt >= 0) { state.target = nxt; state.npc = state.npcs[nxt]; }
      }
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
        // Decrementa cooldowns do jogador que agora vai agir
        const np = state.players[next];
        if (np.cooldowns) {
          for (const k of Object.keys(np.cooldowns)) {
            np.cooldowns[k] = Math.max(0, (np.cooldowns[k] ?? 0) - 1);
          }
        }
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
      ef_current: p.ef, em_current: p.em, chakra_current: p.chakra, hp_current: p.hp,
    }).eq("id", p.character_id);
  }
}

async function applyRewards(supabaseAdmin: any, npcId: string | null, state: CombatState, log: LogEntry[]) {
  if (!npcId) return null;
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
  // Missões — registrar derrotas por NPC/tipo para cada jogador do time.
  try {
    const deadNpcs = (state.npcs ?? []).filter((n) => !n.alive);
    const npcIds = deadNpcs.map((n) => n.id).filter(Boolean);
    let kindMap = new Map<string, string | null>();
    if (npcIds.length) {
      const { data: kinds } = await supabaseAdmin.from("npcs").select("id,kind").in("id", npcIds);
      kindMap = new Map(((kinds as any[]) ?? []).map((r) => [r.id, r.kind ?? null]));
    }
    for (const p of receivers) {
      for (const n of deadNpcs) {
        await bumpMissionProgress(supabaseAdmin, p.character_id, {
          type: "kill_npc", npc_id: n.id, npc_kind: kindMap.get(n.id) ?? null, group_id: null,
        });
      }
    }
  } catch (e) { /* mission bump non-fatal */ }
  return { xp: xpGain, ryo: ryoGain, drops: rolled };
}

async function runSingleNpcAttack(supabaseAdmin: any, npcState: NpcState, state: CombatState, log: LogEntry[], incomingSpeed: number) {
  if (!npcState.alive) return;
  const { data: npcCfg } = await supabaseAdmin
    .from("npcs").select("avg_damage,crit_chance,crit_multiplier").eq("id", npcState.id).maybeSingle();
  const avgDamage = Number(npcCfg?.avg_damage ?? 0);
  const critChance = Math.max(0, Math.min(100, Number(npcCfg?.crit_chance ?? 10)));
  const critMul = Math.max(1, Number(npcCfg?.crit_multiplier ?? 1.5));
  const { data: skills } = await supabaseAdmin
    .from("npc_skills").select("skill:skills(id,name,energy_type,base_cost,bonus_speed,bonus_critical,bonus_energetic,animation_url,animation_mode,sound_url)").eq("npc_id", npcState.id);
  const pool = ((skills as any[]) ?? []).map((r: any) => r.skill).filter(Boolean);
  if (pool.length === 0) return;
  const affordable = pool.filter((s: any) => npcState.energy >= s.base_cost);
  if (affordable.length === 0) return;

  const skill = affordable[Math.floor(Math.random() * affordable.length)];
  const energy = Math.min(npcState.energy, Math.max(skill.base_cost, Math.floor(npcState.energy_max / 4)));
  const effective = energy * Number(skill.bonus_energetic);
  const speed = effective * Number(skill.bonus_speed);
  // Base do dano: dano_medio configurado (variação ±20%) ou fórmula por energia.
  let baseDamage: number;
  if (avgDamage > 0) {
    const variance = 0.8 + Math.random() * 0.4; // 0.8x..1.2x
    baseDamage = Math.max(1, Math.round(avgDamage * variance));
  } else {
    baseDamage = Math.round(effective * Number(skill.bonus_critical));
  }
  // Rolagem de crítico do NPC.
  const isCrit = Math.random() * 100 < critChance;
  const damage = isCrit ? Math.round(baseDamage * critMul) : baseDamage;

  // Regra "quem é mais rápido pega primeiro": se speed do jogador for maior E jogador matou o NPC, NPC não age.
  // Aqui já sabemos que NPC não morreu — mas se a fala for do jogador mais rápido, aplicamos multiplicador de dano reduzido (30% menos) como penalidade por reação.
  const speedPenalty = incomingSpeed > speed ? 0.7 : 1;
  const finalDamage = Math.round(damage * speedPenalty);

  // Escolhe um jogador vivo aleatório como alvo
  const alive = state.players.filter((p) => p.alive);
  if (!alive.length) return;
  const target = alive[Math.floor(Math.random() * alive.length)];
  const taken = damageTargetPlayer(target, finalDamage);

  log.push({
    seq: log.length + 1, actor: "npc", actor_name: npcState.name, target_name: target.nickname,
    skill_name: skill.name, energy_type: skill.energy_type as Pool, energy_used: energy,
    effective, damage: finalDamage, speed, crit_mul: isCrit ? critMul : Number(skill.bonus_critical),
    animation_url: (skill as any).animation_url ?? null,
    animation_mode: ((skill as any).animation_mode ?? "overlay") as any,
    target_char_id: target.character_id,
    actor_char_id: npcState.id,
    sound_url: (skill as any).sound_url ?? null,
    msg: `${npcState.name} usa ${skill.name}${isCrit ? " (CRÍTICO!)" : ""} → ${target.nickname} sofre ${taken.taken} de dano na vida${speedPenalty < 1 ? " (reação lenta)" : ""}.`,
  });
  npcState.energy = Math.max(0, npcState.energy - energy);
}

async function runNpcTurn(supabaseAdmin: any, _npcId: string | null, state: CombatState, log: LogEntry[], incomingSpeed: number) {
  for (const n of state.npcs) {
    if (!n.alive) continue;
    if (state.players.every((p) => !p.alive)) break;
    await runSingleNpcAttack(supabaseAdmin, n, state, log, incomingSpeed);
  }
  if (!state.npc.alive) {
    const nxt = nextAliveNpcIdx(state, state.target ?? 0);
    if (nxt >= 0) { state.target = nxt; state.npc = state.npcs[nxt]; }
  }
  return { energyRemaining: state.npc.energy };
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
    const { data: sess } = await supabaseAdmin.from("combat_sessions").select("*").eq("id", data.session_id).maybeSingle();
    if ((sess?.state as any)?.mode === "pvp") {
      return await pvpFlee(supabaseAdmin, sess, me.id);
    }
    if (sess?.state) await persistPools(supabaseAdmin, sess.state as any);
    await supabaseAdmin.from("combat_sessions").update({ status: "fled", ended_at: new Date().toISOString() }).eq("id", data.session_id);
    return { ok: true };
  });

/**
 * Usa um item consumível durante o combate. Aplica restore no jogador ativo,
 * consome 1 unidade da bolsa e passa para o próximo turno (NPC responde).
 */
export const consumeInCombat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    session_id: z.string().uuid(),
    item_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const me = await loadMyChar(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sess } = await supabaseAdmin.from("combat_sessions").select("*").eq("id", data.session_id).maybeSingle();
    if (!sess || sess.status !== "active") throw new Error("Combate encerrado.");
    if ((sess.state as any)?.mode === "pvp") {
      return await handlePvpConsume(supabaseAdmin, sess, me.id, data.item_id);
    }
    const state: CombatState = normalizeState(sess.state as any);
    const log: LogEntry[] = sess.log as any;
    const activeIdx = state.active;
    const activePlayer = state.players[activeIdx];
    if (!activePlayer || activePlayer.character_id !== me.id) throw new Error("Não é sua vez.");

    // Retira 1 da bolsa (ninja_bag OU secondary_bag)
    const { data: inv } = await supabaseAdmin.from("inventory").select("ninja_bag,secondary_slots").eq("character_id", me.id).maybeSingle();
    if (!inv) throw new Error("Sem inventário.");
    const removeOne = (arr: any[]) => {
      const b = Array.isArray(arr) ? arr.map((e: any) => ({ item_id: e.item_id, qty: Number(e.qty ?? 1) })) : [];
      const idx = b.findIndex((e) => e.item_id === data.item_id);
      if (idx < 0) return null;
      b[idx].qty -= 1;
      if (b[idx].qty <= 0) b.splice(idx, 1);
      return b;
    };
    let patch: any = null;
    const nb = removeOne(inv.ninja_bag as any);
    if (nb) patch = { ninja_bag: nb };
    else {
      const sb = removeOne(inv.secondary_slots as any);
      if (sb) patch = { secondary_slots: sb };
    }
    if (!patch) throw new Error("Você não tem este item.");

    const { data: item } = await supabaseAdmin.from("items").select("name,type,meta").eq("id", data.item_id).maybeSingle();
    if (!item) throw new Error("Item inexistente.");
    if (item.type !== "consumable") throw new Error("Só itens consumíveis podem ser usados em combate.");

    await supabaseAdmin.from("inventory").update(patch).eq("character_id", me.id);

    const restore = (item as any).meta?.restore as
      | { pool: "ef" | "em" | "chakra" | "hp" | "all"; mode: "flat" | "percent"; amount: number } | null | undefined;
    let restoredMsg = "";
    if (restore && restore.amount > 0) {
      const targets: Array<"ef"|"em"|"chakra"|"hp"> = restore.pool === "all"
        ? ["hp","ef","em","chakra"]
        : [restore.pool];
      const maxOf = { ef: activePlayer.ef_max, em: activePlayer.em_max, chakra: activePlayer.chakra_max, hp: activePlayer.hp_max } as const;
      const gains: string[] = [];
      for (const p of targets) {
        const gain = restore.mode === "percent"
          ? Math.round((maxOf[p] * restore.amount) / 100)
          : Math.round(restore.amount);
        const before = (activePlayer as any)[p] as number;
        (activePlayer as any)[p] = Math.min(maxOf[p], before + gain);
        gains.push(`${p.toUpperCase()} +${(activePlayer as any)[p] - before}`);
      }
      restoredMsg = ` (${gains.join(", ")})`;
      activePlayer.alive = activePlayer.hp > 0;
    }

    log.push({
      seq: log.length + 1, actor: "player", actor_name: activePlayer.nickname, target_name: activePlayer.nickname,
      skill_name: `Item: ${item.name}`, energy_type: "chakra", energy_used: 0,
      effective: 0, damage: 0, speed: 0, crit_mul: 0,
      msg: `${activePlayer.nickname} usa ${item.name}${restoredMsg}.`,
    });

    // NPC responde (comportamento igual ao ataque)
    const npcTurn = await runNpcTurn(supabaseAdmin, sess.npc_id, state, log, 0);
    state.npc.energy = npcTurn.energyRemaining;

    let status = sess.status as string;
    let ended_at: string | null = null;
    if (state.players.every((p) => !p.alive)) { status = "lost"; ended_at = new Date().toISOString(); }
    else {
      const total = state.players.length;
      let next = (activeIdx + 1) % total;
      for (let i = 0; i < total; i++) { if (state.players[next].alive) break; next = (next + 1) % total; }
      state.active = next;
      const np = state.players[next];
      if (np.cooldowns) for (const k of Object.keys(np.cooldowns)) np.cooldowns[k] = Math.max(0, (np.cooldowns[k] ?? 0) - 1);
    }

    await persistPools(supabaseAdmin, state);
    await supabaseAdmin.from("combat_sessions").update({ state, log, status, ended_at }).eq("id", sess.id);
    return { ok: true };
  });