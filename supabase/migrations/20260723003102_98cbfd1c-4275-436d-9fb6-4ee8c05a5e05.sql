
-- Hierarquia de clãs
DO $$ BEGIN
  CREATE TYPE public.clan_role AS ENUM ('lider','vice','anciao','elite','membro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS clan_role public.clan_role NOT NULL DEFAULT 'membro';

CREATE INDEX IF NOT EXISTS idx_characters_clan_role ON public.characters(clan_id, clan_role);

-- Garantir apenas 1 líder por clã
CREATE UNIQUE INDEX IF NOT EXISTS uq_clan_leader
  ON public.characters(clan_id)
  WHERE clan_role = 'lider' AND clan_id IS NOT NULL;

-- Helper: caller é líder do clã?
CREATE OR REPLACE FUNCTION public.is_clan_leader(_user uuid, _clan uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.characters
    WHERE user_id=_user AND clan_id=_clan AND clan_role='lider'
  )
$$;
