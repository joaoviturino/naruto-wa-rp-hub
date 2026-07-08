
-- ==================== NPCs ====================
CREATE TABLE public.npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  hp_max INT NOT NULL DEFAULT 100 CHECK (hp_max > 0),
  xp INT NOT NULL DEFAULT 100 CHECK (xp >= 0),
  energy_max INT NOT NULL DEFAULT 100 CHECK (energy_max > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.npcs TO authenticated;
GRANT ALL ON public.npcs TO service_role;

CREATE TABLE public.npc_skills (
  npc_id UUID NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  PRIMARY KEY (npc_id, skill_id)
);
GRANT SELECT ON public.npc_skills TO authenticated;
GRANT ALL ON public.npc_skills TO service_role;

-- ==================== Skills combat fields ====================
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS energy_type TEXT NOT NULL DEFAULT 'chakra' CHECK (energy_type IN ('ef','em','chakra')),
  ADD COLUMN IF NOT EXISTS base_cost INT NOT NULL DEFAULT 10 CHECK (base_cost >= 0),
  ADD COLUMN IF NOT EXISTS bonus_speed NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (bonus_speed >= 0),
  ADD COLUMN IF NOT EXISTS bonus_critical NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (bonus_critical >= 0),
  ADD COLUMN IF NOT EXISTS bonus_energetic NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (bonus_energetic >= 0);

-- ==================== Locations: danger zone ====================
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS is_danger_zone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spawn_chance INT NOT NULL DEFAULT 0 CHECK (spawn_chance >= 0 AND spawn_chance <= 100),
  ADD COLUMN IF NOT EXISTS spawn_tick_seconds INT NOT NULL DEFAULT 60 CHECK (spawn_tick_seconds >= 10);

CREATE TABLE public.location_npcs (
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  npc_id UUID NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  weight INT NOT NULL DEFAULT 1 CHECK (weight > 0),
  PRIMARY KEY (location_id, npc_id)
);
GRANT SELECT ON public.location_npcs TO authenticated;
GRANT ALL ON public.location_npcs TO service_role;

-- ==================== Parties ====================
CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parties TO authenticated;
GRANT ALL ON public.parties TO service_role;

CREATE TABLE public.party_members (
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE UNIQUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, character_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_members TO authenticated;
GRANT ALL ON public.party_members TO service_role;

CREATE TABLE public.party_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  from_character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  to_character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.party_invites (to_character_id) WHERE status='pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.party_invites TO authenticated;
GRANT ALL ON public.party_invites TO service_role;

-- ==================== Combat ====================
CREATE TABLE public.combat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  npc_id UUID NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','won','lost','fled')),
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  turn TEXT NOT NULL DEFAULT 'player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
GRANT SELECT ON public.combat_sessions TO authenticated;
GRANT ALL ON public.combat_sessions TO service_role;

CREATE TABLE public.combat_participants (
  session_id UUID NOT NULL REFERENCES public.combat_sessions(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, character_id)
);
GRANT SELECT ON public.combat_participants TO authenticated;
GRANT ALL ON public.combat_participants TO service_role;

-- ==================== Spawn tracking ====================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS location_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_spawn_roll_at TIMESTAMPTZ;

-- ==================== RLS + Policies (all tables now exist) ====================
ALTER TABLE public.npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npcs read all" ON public.npcs FOR SELECT TO authenticated USING (true);
CREATE POLICY "npcs admin write" ON public.npcs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER npcs_updated BEFORE UPDATE ON public.npcs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.npc_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npc_skills read" ON public.npc_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "npc_skills admin write" ON public.npc_skills FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.location_npcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_npcs read" ON public.location_npcs FOR SELECT TO authenticated USING (true);
CREATE POLICY "loc_npcs admin write" ON public.location_npcs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read own" ON public.parties FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.party_members pm JOIN public.characters c ON c.id=pm.character_id
                 WHERE pm.party_id = parties.id AND c.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.characters c WHERE c.id = parties.leader_id AND c.user_id = auth.uid()));
CREATE POLICY "parties leader manage" ON public.parties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = parties.leader_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = parties.leader_id AND c.user_id = auth.uid()));

ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm read same party" ON public.party_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.party_members pm2
    JOIN public.characters c ON c.id = pm2.character_id
    WHERE pm2.party_id = party_members.party_id AND c.user_id = auth.uid()
  ));
CREATE POLICY "pm self leave" ON public.party_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = party_members.character_id AND c.user_id = auth.uid()));

ALTER TABLE public.party_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites read involved" ON public.party_invites FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c
                 WHERE c.user_id = auth.uid()
                   AND (c.id = party_invites.from_character_id OR c.id = party_invites.to_character_id)));
CREATE POLICY "invites recipient update" ON public.party_invites FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.user_id=auth.uid() AND c.id = party_invites.to_character_id));

ALTER TABLE public.combat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combat read participants" ON public.combat_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.combat_participants cp
                 JOIN public.characters c ON c.id = cp.character_id
                 WHERE cp.session_id = combat_sessions.id AND c.user_id = auth.uid()));

ALTER TABLE public.combat_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp read own" ON public.combat_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = combat_participants.character_id AND c.user_id = auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_members;
