-- Fix: completed_at deve ser nulo até que o minigame realmente termine.
ALTER TABLE public.minigame_runs ALTER COLUMN completed_at DROP DEFAULT;
ALTER TABLE public.minigame_runs ALTER COLUMN completed_at DROP NOT NULL;

-- Corrige runs antigos que nunca receberam recompensa: aplica XP/Ryo/EF/EM/Chakra
-- para runs com success=true e rewards_applied vazio.
DO $$
DECLARE r record; rw jsonb; applied jsonb;
BEGIN
  FOR r IN
    SELECT mr.id, mr.character_id, m.rewards, m.reward_skills, m.id AS minigame_id
      FROM public.minigame_runs mr
      JOIN public.minigames m ON m.id = mr.minigame_id
     WHERE mr.success = true
       AND (mr.rewards_applied IS NULL OR mr.rewards_applied = '{}'::jsonb)
  LOOP
    rw := COALESCE(r.rewards, '{}'::jsonb);
    applied := '{}'::jsonb;

    IF (rw->>'xp')::int IS NOT NULL AND (rw->>'xp')::int > 0 THEN
      UPDATE public.characters SET xp = COALESCE(xp,0) + (rw->>'xp')::int WHERE id = r.character_id;
      applied := applied || jsonb_build_object('xp', (rw->>'xp')::int);
    END IF;
    IF (rw->>'ryo')::int IS NOT NULL AND (rw->>'ryo')::int > 0 THEN
      UPDATE public.characters SET ryo = COALESCE(ryo,0) + (rw->>'ryo')::int WHERE id = r.character_id;
      applied := applied || jsonb_build_object('ryo', (rw->>'ryo')::int);
    END IF;
    IF (rw->>'ef')::int IS NOT NULL AND (rw->>'ef')::int > 0 THEN
      UPDATE public.characters SET ef_current = COALESCE(ef_current,0) + (rw->>'ef')::int WHERE id = r.character_id;
      applied := applied || jsonb_build_object('ef', (rw->>'ef')::int);
    END IF;
    IF (rw->>'em')::int IS NOT NULL AND (rw->>'em')::int > 0 THEN
      UPDATE public.characters SET em_current = COALESCE(em_current,0) + (rw->>'em')::int WHERE id = r.character_id;
      applied := applied || jsonb_build_object('em', (rw->>'em')::int);
    END IF;
    IF (rw->>'chakra')::int IS NOT NULL AND (rw->>'chakra')::int > 0 THEN
      UPDATE public.characters SET chakra_current = COALESCE(chakra_current,0) + (rw->>'chakra')::int WHERE id = r.character_id;
      applied := applied || jsonb_build_object('chakra', (rw->>'chakra')::int);
    END IF;

    -- Concede skills de recompensa (aprendizagem)
    IF r.reward_skills IS NOT NULL AND jsonb_typeof(r.reward_skills) = 'array' THEN
      INSERT INTO public.character_skills(character_id, skill_id)
      SELECT r.character_id, (elem->>'skill_id')::uuid
        FROM jsonb_array_elements(r.reward_skills) elem
       WHERE elem ? 'skill_id'
      ON CONFLICT (character_id, skill_id) DO NOTHING;
    END IF;

    UPDATE public.minigame_runs SET rewards_applied = applied WHERE id = r.id;
  END LOOP;
END $$;