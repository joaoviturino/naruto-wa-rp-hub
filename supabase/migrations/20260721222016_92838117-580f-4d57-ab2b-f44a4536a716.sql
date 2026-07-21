
CREATE TABLE public.npc_poses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX npc_poses_npc_idx ON public.npc_poses(npc_id, sort_order);
GRANT SELECT ON public.npc_poses TO authenticated;
GRANT ALL ON public.npc_poses TO service_role;
ALTER TABLE public.npc_poses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npc_poses read auth" ON public.npc_poses FOR SELECT TO authenticated USING (true);
CREATE POLICY "npc_poses admin write" ON public.npc_poses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER npc_poses_touch BEFORE UPDATE ON public.npc_poses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.npc_skill_poses (
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  pose_id uuid NOT NULL REFERENCES public.npc_poses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (npc_id, skill_id)
);
GRANT SELECT ON public.npc_skill_poses TO authenticated;
GRANT ALL ON public.npc_skill_poses TO service_role;
ALTER TABLE public.npc_skill_poses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npc_skill_poses read auth" ON public.npc_skill_poses FOR SELECT TO authenticated USING (true);
CREATE POLICY "npc_skill_poses admin write" ON public.npc_skill_poses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
