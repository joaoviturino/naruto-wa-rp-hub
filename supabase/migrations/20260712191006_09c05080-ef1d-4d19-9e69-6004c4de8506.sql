
DO $$ BEGIN
  CREATE TYPE public.pvp_status AS ENUM ('pending','active','finished','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pvp_action AS ENUM ('attack','defend','item','pass','forfeit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pvp_category AS ENUM ('fisico','mental','ninjutsu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pvp_duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  status public.pvp_status NOT NULL DEFAULT 'pending',
  current_turn_character_id uuid REFERENCES public.characters(id),
  turn_number int NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_id uuid REFERENCES public.characters(id),
  forfeit_by uuid REFERENCES public.characters(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pvp_distinct CHECK (challenger_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS pvp_duels_challenger_idx ON public.pvp_duels(challenger_id);
CREATE INDEX IF NOT EXISTS pvp_duels_opponent_idx ON public.pvp_duels(opponent_id);
CREATE INDEX IF NOT EXISTS pvp_duels_status_idx ON public.pvp_duels(status);

GRANT SELECT, INSERT, UPDATE ON public.pvp_duels TO authenticated;
GRANT ALL ON public.pvp_duels TO service_role;

ALTER TABLE public.pvp_duels ENABLE ROW LEVEL SECURITY;

-- Helper: is auth.uid() one of the participants?
CREATE OR REPLACE FUNCTION public.is_duel_participant(_duel uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pvp_duels d
    JOIN public.characters c ON c.id IN (d.challenger_id, d.opponent_id)
    WHERE d.id = _duel AND c.user_id = _user
  );
$$;

CREATE POLICY pvp_duels_select_participants ON public.pvp_duels FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.characters c WHERE c.id IN (challenger_id, opponent_id) AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY pvp_duels_insert_own ON public.pvp_duels FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.characters c WHERE c.id = challenger_id AND c.user_id = auth.uid())
);

CREATE POLICY pvp_duels_update_participants ON public.pvp_duels FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.characters c WHERE c.id IN (challenger_id, opponent_id) AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER pvp_duels_touch BEFORE UPDATE ON public.pvp_duels
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Turns
CREATE TABLE IF NOT EXISTS public.pvp_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.pvp_duels(id) ON DELETE CASCADE,
  turn_number int NOT NULL,
  actor_character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  target_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  action public.pvp_action NOT NULL,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  category public.pvp_category,
  energy_invested_pct int,
  narrative text NOT NULL,
  damage int NOT NULL DEFAULT 0,
  crit boolean NOT NULL DEFAULT false,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pvp_turns_duel_idx ON public.pvp_turns(duel_id, turn_number);

GRANT SELECT, INSERT ON public.pvp_turns TO authenticated;
GRANT ALL ON public.pvp_turns TO service_role;

ALTER TABLE public.pvp_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY pvp_turns_select ON public.pvp_turns FOR SELECT TO authenticated
USING (
  public.is_duel_participant(duel_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY pvp_turns_insert ON public.pvp_turns FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.characters c WHERE c.id = actor_character_id AND c.user_id = auth.uid())
);
