
-- NPC groups
CREATE TABLE public.npc_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.npc_groups TO authenticated;
GRANT ALL ON public.npc_groups TO service_role;
ALTER TABLE public.npc_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npc_groups readable by auth" ON public.npc_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "npc_groups admin manage" ON public.npc_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.npc_group_members (
  group_id uuid NOT NULL REFERENCES public.npc_groups(id) ON DELETE CASCADE,
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 1,
  PRIMARY KEY (group_id, npc_id)
);
GRANT SELECT ON public.npc_group_members TO authenticated;
GRANT ALL ON public.npc_group_members TO service_role;
ALTER TABLE public.npc_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npc_group_members readable" ON public.npc_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "npc_group_members admin manage" ON public.npc_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Locations: possible spawn groups
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS spawn_group_ids uuid[] NOT NULL DEFAULT '{}';
