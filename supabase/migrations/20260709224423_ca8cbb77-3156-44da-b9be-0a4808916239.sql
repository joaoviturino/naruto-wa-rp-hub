
-- Minigames system
DO $$ BEGIN CREATE TYPE public.minigame_kind AS ENUM ('cleanup'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.minigames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  kind public.minigame_kind NOT NULL DEFAULT 'cleanup',
  name text NOT NULL,
  description text,
  background_url text,
  tileset_url text,
  npc_portrait_url text,
  npc_name text,
  dialog_intro text,
  dialog_outro text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  rewards jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooldown_hours integer NOT NULL DEFAULT 24,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.minigames TO authenticated;
GRANT ALL ON public.minigames TO service_role;
ALTER TABLE public.minigames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minigames read all authed" ON public.minigames FOR SELECT TO authenticated USING (true);
CREATE POLICY "minigames admin write" ON public.minigames FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_minigames_touch BEFORE UPDATE ON public.minigames
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.location_minigames (
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  minigame_id uuid NOT NULL REFERENCES public.minigames(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, minigame_id)
);
GRANT SELECT ON public.location_minigames TO authenticated;
GRANT ALL ON public.location_minigames TO service_role;
ALTER TABLE public.location_minigames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_minigames read" ON public.location_minigames FOR SELECT TO authenticated USING (true);
CREATE POLICY "loc_minigames admin write" ON public.location_minigames FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.minigame_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  minigame_id uuid NOT NULL REFERENCES public.minigames(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  score integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT false,
  rewards_applied jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_minigame_runs_char_game ON public.minigame_runs(character_id, minigame_id, completed_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.minigame_runs TO authenticated;
GRANT ALL ON public.minigame_runs TO service_role;
ALTER TABLE public.minigame_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "minigame_runs read own" ON public.minigame_runs FOR SELECT TO authenticated
  USING (character_id IN (SELECT id FROM public.characters WHERE user_id = auth.uid()));
CREATE POLICY "minigame_runs admin read" ON public.minigame_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
