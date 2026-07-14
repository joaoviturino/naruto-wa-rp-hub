
-- Server config (maintenance mode) singleton
CREATE TABLE public.server_config (
  id text PRIMARY KEY DEFAULT 'main',
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_title text NOT NULL DEFAULT 'RP em atualização',
  maintenance_message text NOT NULL DEFAULT 'Estamos preparando novidades. Volte em breve, shinobi.',
  maintenance_image_url text,
  maintenance_eta timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT server_config_singleton CHECK (id = 'main')
);

GRANT SELECT ON public.server_config TO anon, authenticated;
GRANT ALL ON public.server_config TO service_role;

ALTER TABLE public.server_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "server_config readable by everyone"
  ON public.server_config FOR SELECT
  USING (true);

CREATE POLICY "server_config admin write"
  ON public.server_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.server_config (id) VALUES ('main') ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.server_config;

-- Global broadcasts from admins
CREATE TABLE public.global_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  variant text NOT NULL DEFAULT 'info',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

GRANT SELECT ON public.global_broadcasts TO authenticated;
GRANT ALL ON public.global_broadcasts TO service_role;

ALTER TABLE public.global_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcasts readable to authenticated"
  ON public.global_broadcasts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "broadcasts admin write"
  ON public.global_broadcasts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX global_broadcasts_active_idx ON public.global_broadcasts (active, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.global_broadcasts;
