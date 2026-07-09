
DO $$ BEGIN
  CREATE TYPE public.npc_kind AS ENUM ('aggressive','shop','reward');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS kind public.npc_kind NOT NULL DEFAULT 'aggressive',
  ADD COLUMN IF NOT EXISTS dialog_intro text,
  ADD COLUMN IF NOT EXISTS dialog_outro text,
  ADD COLUMN IF NOT EXISTS shop_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_cooldown_hours integer NOT NULL DEFAULT 24;

CREATE TABLE IF NOT EXISTS public.character_npc_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cnr_char_npc ON public.character_npc_rewards(character_id, npc_id, claimed_at DESC);

GRANT SELECT, INSERT ON public.character_npc_rewards TO authenticated;
GRANT ALL ON public.character_npc_rewards TO service_role;

ALTER TABLE public.character_npc_rewards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own reward log read" ON public.character_npc_rewards FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
