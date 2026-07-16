-- Mounts catalog
CREATE TABLE public.mounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  description text,
  rank text,
  speed_multiplier numeric NOT NULL DEFAULT 0.5 CHECK (speed_multiplier > 0 AND speed_multiplier <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mounts TO authenticated;
GRANT ALL ON public.mounts TO service_role;
ALTER TABLE public.mounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mounts read all authenticated" ON public.mounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "mounts admin manage" ON public.mounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER mounts_touch BEFORE UPDATE ON public.mounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Character mounts ownership
CREATE TABLE public.character_mounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  mount_id uuid NOT NULL REFERENCES public.mounts(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, mount_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_mounts TO authenticated;
GRANT ALL ON public.character_mounts TO service_role;
ALTER TABLE public.character_mounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "character_mounts owner read" ON public.character_mounts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "character_mounts admin manage" ON public.character_mounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Travel sessions
CREATE TABLE public.travel_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  from_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  to_location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  mount_id uuid REFERENCES public.mounts(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  arrives_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'traveling' CHECK (status IN ('traveling','arrived','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX travel_sessions_char_status_idx ON public.travel_sessions(character_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_sessions TO authenticated;
GRANT ALL ON public.travel_sessions TO service_role;
ALTER TABLE public.travel_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "travel_sessions owner rw" ON public.travel_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'));