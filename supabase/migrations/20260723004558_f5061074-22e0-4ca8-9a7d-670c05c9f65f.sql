
CREATE OR REPLACE FUNCTION public.admin_reset_game_database()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Truncar em cascata a partir de characters cobre a maioria das dependências (FKs).
  TRUNCATE TABLE
    public.combat_participants,
    public.combat_sessions,
    public.pvp_turns,
    public.pvp_duels,
    public.trade_sessions,
    public.travel_sessions,
    public.party_invites,
    public.party_members,
    public.parties,
    public.location_messages,
    public.character_presence,
    public.chest_permissions,
    public.location_permissions,
    public.minigame_runs,
    public.battle_pass_claims,
    public.battle_pass_progress,
    public.global_reward_claims,
    public.item_submissions,
    public.character_book_reads,
    public.character_missions,
    public.character_mounts,
    public.character_poses,
    public.character_skill_poses,
    public.character_skills,
    public.character_knowledges,
    public.character_clan_progress,
    public.character_jobs,
    public.character_npc_rewards,
    public.scene_images,
    public.npc_private_messages,
    public.npc_ai_response_locks,
    public.inventory,
    public.characters,
    public.outbound_messages
  RESTART IDENTITY CASCADE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_game_database() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_game_database() TO authenticated;
