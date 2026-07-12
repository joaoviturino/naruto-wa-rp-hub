
CREATE TABLE public.level_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  base_xp integer NOT NULL DEFAULT 100 CHECK (base_xp > 0),
  growth_factor numeric NOT NULL DEFAULT 1.6 CHECK (growth_factor > 0),
  max_level integer NOT NULL DEFAULT 100 CHECK (max_level > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.level_config TO authenticated;
GRANT ALL ON public.level_config TO service_role;

ALTER TABLE public.level_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "level_config readable by authenticated"
  ON public.level_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "level_config admin insert"
  ON public.level_config FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "level_config admin update"
  ON public.level_config FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER level_config_touch
  BEFORE UPDATE ON public.level_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.level_config (id, base_xp, growth_factor, max_level)
VALUES (true, 100, 1.6, 100)
ON CONFLICT (id) DO NOTHING;
