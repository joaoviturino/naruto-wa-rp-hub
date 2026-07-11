
-- Extend minigames with one-time flag, requirements, reward skills
ALTER TABLE public.minigames
  ADD COLUMN IF NOT EXISTS one_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_rank text,
  ADD COLUMN IF NOT EXISTS required_profs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_skills jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Ordered learning steps per NPC (multiple minigames per learning NPC)
CREATE TABLE IF NOT EXISTS public.npc_learning_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  minigame_id uuid NOT NULL REFERENCES public.minigames(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  required_rank text,
  required_profs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (npc_id, minigame_id)
);
CREATE INDEX IF NOT EXISTS idx_npc_learning_steps_npc ON public.npc_learning_steps(npc_id, position);

GRANT SELECT ON public.npc_learning_steps TO authenticated;
GRANT ALL ON public.npc_learning_steps TO service_role;

ALTER TABLE public.npc_learning_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "npc_learning_steps read all authenticated"
  ON public.npc_learning_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "npc_learning_steps admin write"
  ON public.npc_learning_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
