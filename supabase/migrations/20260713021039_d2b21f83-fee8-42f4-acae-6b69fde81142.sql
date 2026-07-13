
CREATE TABLE IF NOT EXISTS public.clan_tree_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('skill','buff')),
  skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  buff_type TEXT CHECK (buff_type IN ('hp_bonus','energy_bonus','skill_power_bonus','skill_cost_reduction')),
  buff_value INT,
  buff_label TEXT,
  buff_icon_url TEXT,
  x INT NOT NULL DEFAULT 0,
  y INT NOT NULL DEFAULT 0,
  rank_required TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clan_tree_nodes TO authenticated, anon;
GRANT ALL ON public.clan_tree_nodes TO service_role;
ALTER TABLE public.clan_tree_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read clan tree nodes" ON public.clan_tree_nodes FOR SELECT USING (true);
CREATE POLICY "admins manage clan tree nodes" ON public.clan_tree_nodes FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.clan_tree_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clan_id UUID NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES public.clan_tree_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES public.clan_tree_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_node_id, to_node_id)
);
GRANT SELECT ON public.clan_tree_edges TO authenticated, anon;
GRANT ALL ON public.clan_tree_edges TO service_role;
ALTER TABLE public.clan_tree_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read clan tree edges" ON public.clan_tree_edges FOR SELECT USING (true);
CREATE POLICY "admins manage clan tree edges" ON public.clan_tree_edges FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.character_clan_progress (
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.clan_tree_nodes(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, node_id)
);
GRANT SELECT, INSERT, DELETE ON public.character_clan_progress TO authenticated;
GRANT ALL ON public.character_clan_progress TO service_role;
ALTER TABLE public.character_clan_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own progress" ON public.character_clan_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "insert own progress" ON public.character_clan_progress FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
);
CREATE POLICY "admins manage progress" ON public.character_clan_progress FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_clan_tree_nodes_clan ON public.clan_tree_nodes(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_tree_edges_clan ON public.clan_tree_edges(clan_id);
CREATE INDEX IF NOT EXISTS idx_char_clan_progress_char ON public.character_clan_progress(character_id);
