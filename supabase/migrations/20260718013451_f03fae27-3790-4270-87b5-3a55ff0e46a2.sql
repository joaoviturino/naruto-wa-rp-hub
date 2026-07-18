
ALTER TABLE public.server_config
  ADD COLUMN IF NOT EXISTS starter_kit jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.global_rewards
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.global_reward_claims
  ADD COLUMN IF NOT EXISTS seen boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.character_presence (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'idle',
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_presence TO authenticated;
GRANT ALL ON public.character_presence TO service_role;

ALTER TABLE public.character_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence read all authenticated" ON public.character_presence
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "presence insert own" ON public.character_presence
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence update own" ON public.character_presence
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence admin all" ON public.character_presence
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS character_presence_last_seen_idx ON public.character_presence(last_seen DESC);
CREATE INDEX IF NOT EXISTS character_presence_location_idx ON public.character_presence(current_location_id);

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.character_presence;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
