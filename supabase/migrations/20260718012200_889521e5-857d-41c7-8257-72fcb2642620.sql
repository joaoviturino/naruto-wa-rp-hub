
-- Trade tax config
ALTER TABLE public.server_config
  ADD COLUMN IF NOT EXISTS trade_tax_percent integer NOT NULL DEFAULT 0
  CHECK (trade_tax_percent BETWEEN 0 AND 50);

-- Trade sessions (1-a-1 no mesmo local)
CREATE TABLE IF NOT EXISTS public.trade_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  partner_id   uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES public.locations(id)  ON DELETE CASCADE,
  initiator_offer jsonb NOT NULL DEFAULT '{"items":[],"ryo":0}'::jsonb,
  partner_offer   jsonb NOT NULL DEFAULT '{"items":[],"ryo":0}'::jsonb,
  initiator_confirmed boolean NOT NULL DEFAULT false,
  partner_confirmed   boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','completed','cancelled','declined','failed')),
  tax_percent integer NOT NULL DEFAULT 0,
  fail_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (initiator_id <> partner_id)
);

CREATE INDEX IF NOT EXISTS trade_sessions_participants_idx
  ON public.trade_sessions (initiator_id, partner_id) WHERE status IN ('pending','active');
CREATE INDEX IF NOT EXISTS trade_sessions_partner_pending_idx
  ON public.trade_sessions (partner_id) WHERE status IN ('pending','active');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_sessions TO authenticated;
GRANT ALL ON public.trade_sessions TO service_role;

ALTER TABLE public.trade_sessions ENABLE ROW LEVEL SECURITY;

-- Helper: user is a trade participant?
CREATE OR REPLACE FUNCTION public.is_trade_participant(_trade uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_sessions t
    JOIN public.characters c ON c.id IN (t.initiator_id, t.partner_id)
    WHERE t.id = _trade AND c.user_id = _user
  );
$$;

CREATE POLICY "trade participants read" ON public.trade_sessions
  FOR SELECT TO authenticated
  USING (public.is_trade_participant(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "trade participants update" ON public.trade_sessions
  FOR UPDATE TO authenticated
  USING (public.is_trade_participant(id, auth.uid()))
  WITH CHECK (public.is_trade_participant(id, auth.uid()));

CREATE POLICY "trade admin all" ON public.trade_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trade_sessions_touch
  BEFORE UPDATE ON public.trade_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_sessions;
