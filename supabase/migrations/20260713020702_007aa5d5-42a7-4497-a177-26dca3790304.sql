
-- Enum tipo de buff
DO $$ BEGIN
  CREATE TYPE public.clan_buff_type AS ENUM ('hp_bonus','energy_bonus','skill_power_bonus','skill_cost_reduction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nós da árvore
CREATE TABLE IF NOT EXISTS public.clan_tree_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('skill','buff')),
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  buff_type public.clan_buff_type,
  buff_value integer,
  buff_label text,
  buff_icon_url text,
  x integer NOT NULL DEFAULT 0,
  y integer NOT NULL DEFAULT 0,
  rank_required text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clan_tree_nodes_clan_idx ON public.clan_tree_nodes(clan_id);
GRANT SELECT ON public.clan_tree_nodes TO authenticated;
GRANT ALL ON public.clan_tree_nodes TO service_role;
ALTER TABLE public.clan_tree_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tree nodes" ON public.clan_tree_nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write tree nodes" ON public.clan_tree_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Arestas da árvore
CREATE TABLE IF NOT EXISTS public.clan_tree_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES public.clan_tree_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES public.clan_tree_nodes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_node_id, to_node_id)
);
CREATE INDEX IF NOT EXISTS clan_tree_edges_clan_idx ON public.clan_tree_edges(clan_id);
GRANT SELECT ON public.clan_tree_edges TO authenticated;
GRANT ALL ON public.clan_tree_edges TO service_role;
ALTER TABLE public.clan_tree_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tree edges" ON public.clan_tree_edges FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write tree edges" ON public.clan_tree_edges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Progresso do personagem
CREATE TABLE IF NOT EXISTS public.character_clan_progress (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.clan_tree_nodes(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, node_id)
);
GRANT SELECT, INSERT, DELETE ON public.character_clan_progress TO authenticated;
GRANT ALL ON public.character_clan_progress TO service_role;
ALTER TABLE public.character_clan_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress read" ON public.character_clan_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
      OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own progress insert" ON public.character_clan_progress FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "admin progress delete" ON public.character_clan_progress FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Migrar clan_skills antigos como nós skill em linha
INSERT INTO public.clan_tree_nodes (clan_id, kind, skill_id, x, y)
SELECT cs.clan_id, 'skill', cs.skill_id, (cs.position * 160), 100
FROM public.clan_skills cs
WHERE NOT EXISTS (
  SELECT 1 FROM public.clan_tree_nodes n
  WHERE n.clan_id = cs.clan_id AND n.skill_id = cs.skill_id
);
