// Remapa uma combat_session de PvP (side_a/side_b) para o shape esperado
// pelo CombatDialog (players/npcs/active/turn/target) segundo o ponto de
// vista do viewer. Espectadores caem em side_a=npcs, side_b=players.
export type RawSession = { id: string; state: any; log: any[]; status: string };

function asUiFighter(p: any) {
  const sprite = p?.sprite_url ?? p?.inventory_bg_url ?? p?.image_url ?? p?.avatar_url ?? null;
  return {
    ...p,
    id: p?.id ?? p?.character_id,
    name: p?.name ?? p?.nickname ?? "?",
    inventory_bg_url: p?.inventory_bg_url ?? p?.sprite_url ?? p?.image_url ?? null,
    image_url: p?.image_url ?? sprite,
    sprite_url: sprite,
  };
}

export function remapPvpForViewer(raw: RawSession | null, myCharId: string): any {
  if (!raw) return raw;
  const st = raw.state ?? {};
  if (st.mode !== "pvp") return raw;
  const inA = Array.isArray(st.side_a_ids) && st.side_a_ids.includes(myCharId);
  const inB = Array.isArray(st.side_b_ids) && st.side_b_ids.includes(myCharId);
  const spectator = !inA && !inB;
  const mySide: "a" | "b" = inA ? "a" : (inB ? "b" : "a");
  const otherSide: "a" | "b" = mySide === "a" ? "b" : "a";
  const players = ((mySide === "a" ? st.side_a : st.side_b) ?? []).map(asUiFighter);
  const npcs = ((otherSide === "a" ? st.side_a : st.side_b) ?? []).map(asUiFighter);
  const myTurn = st.active_side === mySide;
  const active = myTurn ? Math.max(0, Number(st.active_idx ?? 0)) : 0;
  const target = 0;
  const turn = myTurn ? "player" : "npc";
  // Nickname de quem realmente está agindo (para textos "Aguardando X agir").
  const actingList = st.active_side === "a" ? st.side_a : st.side_b;
  const actingIdx = Math.max(0, Number(st.active_idx ?? 0));
  const activeActorNickname = actingList?.[actingIdx]?.nickname ?? null;

  const remappedLog = (Array.isArray(raw.log) ? raw.log : []).map((e: any) => {
    if (!e) return e;
    const actorMine = e.pvp_actor_side === mySide;
    const targetMine = e.pvp_target_side === mySide;
    return {
      ...e,
      actor: actorMine ? "player" : "npc",
      // Alvo no lado inimigo (do ponto de vista do viewer) → indexado como "npc idx".
      target_npc_idx: targetMine ? -1 : Number(e.pvp_target_idx ?? -1),
      // Mantém identificadores; heal_target_ids continuam sendo character_ids.
    };
  });

  return {
    ...raw,
    state: {
      ...st,
      players,
      npcs,
      npc: npcs[0] ?? null,
      active,
      target,
      turn,
      _pvp: true,
      _pvp_my_side: mySide,
      _spectator: spectator,
      _acting_nickname: activeActorNickname,
    },
    log: remappedLog,
  };
}
