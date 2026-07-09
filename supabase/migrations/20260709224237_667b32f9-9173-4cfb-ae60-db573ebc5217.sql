
CREATE TYPE public.minigame_kind AS ENUM ('cleanup');

CREATE TABLE public.minigames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  kind public.minigame_kind NOT NULL DEFAULT 'cleanup',
  name text NOT NULL,
  description text,
  background_url text,
  tileset_url text,
  npc_portrait_url text,
  npc_name text,
  dialog_intro text DEFAULT '',
  dialog_outro text DEFAULT '',
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
CREATE POLICY "read active minigames" ON public.minigames FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage minigames" ON public.minigames FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_minigames_updated BEFORE UPDATE ON public.minigames FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.location_minigames (
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  minigame_id uuid NOT NULL REFERENCES public.minigames(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, minigame_id)
);
GRANT SELECT ON public.location_minigames TO authenticated;
GRANT ALL ON public.location_minigames TO service_role;
ALTER TABLE public.location_minigames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read location_minigames" ON public.location_minigames FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage location_minigames" ON public.location_minigames FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.minigame_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  minigame_id uuid NOT NULL REFERENCES public.minigames(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  rewards_applied jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX minigame_runs_char_mg_idx ON public.minigame_runs (character_id, minigame_id, completed_at DESC);
GRANT SELECT, INSERT ON public.minigame_runs TO authenticated;
GRANT ALL ON public.minigame_runs TO service_role;
ALTER TABLE public.minigame_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own runs" ON public.minigame_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own runs" ON public.minigame_runs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
