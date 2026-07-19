
CREATE TABLE IF NOT EXISTS public.bot_auth_state (
  session_id text NOT NULL DEFAULT 'default',
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, key)
);

GRANT ALL ON public.bot_auth_state TO service_role;
ALTER TABLE public.bot_auth_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.bot_auth_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);
