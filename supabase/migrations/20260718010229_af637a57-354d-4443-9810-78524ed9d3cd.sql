CREATE TABLE public.global_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('xp','ryo','skill','item')),
  amount INTEGER,
  skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.global_rewards TO authenticated;
GRANT ALL ON public.global_rewards TO service_role;
ALTER TABLE public.global_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage global rewards" ON public.global_rewards FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "authenticated view global rewards" ON public.global_rewards FOR SELECT TO authenticated USING (true);

CREATE TABLE public.global_reward_claims (
  reward_id UUID NOT NULL REFERENCES public.global_rewards(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reward_id, character_id)
);
GRANT SELECT ON public.global_reward_claims TO authenticated;
GRANT ALL ON public.global_reward_claims TO service_role;
ALTER TABLE public.global_reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage claims" ON public.global_reward_claims FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "players view own claims" ON public.global_reward_claims FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));