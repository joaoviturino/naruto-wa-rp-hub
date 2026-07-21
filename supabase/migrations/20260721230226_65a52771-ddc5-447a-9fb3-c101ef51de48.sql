
CREATE TABLE public.battle_pass_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  banner_url text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  xp_per_tier int NOT NULL DEFAULT 1000,
  tiers_count int NOT NULL DEFAULT 50,
  premium_cost int NOT NULL DEFAULT 5000,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.battle_pass_seasons TO authenticated;
GRANT ALL ON public.battle_pass_seasons TO service_role;
ALTER TABLE public.battle_pass_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_seasons_read" ON public.battle_pass_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "bp_seasons_admin" ON public.battle_pass_seasons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_bp_seasons_touch BEFORE UPDATE ON public.battle_pass_seasons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.battle_pass_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.battle_pass_seasons(id) ON DELETE CASCADE,
  tier int NOT NULL,
  track text NOT NULL CHECK (track IN ('free','premium')),
  reward_type text NOT NULL CHECK (reward_type IN ('item','ryo','xp','title')),
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1,
  title text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, tier, track)
);
GRANT SELECT ON public.battle_pass_rewards TO authenticated;
GRANT ALL ON public.battle_pass_rewards TO service_role;
ALTER TABLE public.battle_pass_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_rewards_read" ON public.battle_pass_rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "bp_rewards_admin" ON public.battle_pass_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ix_bp_rewards_season ON public.battle_pass_rewards(season_id, tier);

CREATE TABLE public.battle_pass_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.battle_pass_seasons(id) ON DELETE CASCADE,
  xp int NOT NULL DEFAULT 0,
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, season_id)
);
GRANT SELECT ON public.battle_pass_progress TO authenticated;
GRANT ALL ON public.battle_pass_progress TO service_role;
ALTER TABLE public.battle_pass_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_progress_own_read" ON public.battle_pass_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_bp_progress_touch BEFORE UPDATE ON public.battle_pass_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.battle_pass_claims (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.battle_pass_seasons(id) ON DELETE CASCADE,
  tier int NOT NULL,
  track text NOT NULL CHECK (track IN ('free','premium')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, season_id, tier, track)
);
GRANT SELECT ON public.battle_pass_claims TO authenticated;
GRANT ALL ON public.battle_pass_claims TO service_role;
ALTER TABLE public.battle_pass_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_claims_own_read" ON public.battle_pass_claims FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
         OR public.has_role(auth.uid(), 'admin'));
