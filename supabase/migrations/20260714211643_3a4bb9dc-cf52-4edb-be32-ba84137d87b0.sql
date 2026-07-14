
CREATE TABLE public.character_poses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_character_poses_char ON public.character_poses(character_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_poses TO authenticated;
GRANT ALL ON public.character_poses TO service_role;
ALTER TABLE public.character_poses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poses_owner_read" ON public.character_poses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "poses_admin_all" ON public.character_poses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_touch_poses BEFORE UPDATE ON public.character_poses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.character_skill_poses (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  pose_id uuid NOT NULL REFERENCES public.character_poses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, skill_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_skill_poses TO authenticated;
GRANT ALL ON public.character_skill_poses TO service_role;
ALTER TABLE public.character_skill_poses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csp_owner_all" ON public.character_skill_poses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "csp_admin_all" ON public.character_skill_poses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
