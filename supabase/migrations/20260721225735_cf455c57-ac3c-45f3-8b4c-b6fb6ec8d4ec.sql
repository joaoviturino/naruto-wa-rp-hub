CREATE TABLE IF NOT EXISTS public.item_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  name text NOT NULL,
  type text NOT NULL,
  rank text NOT NULL,
  description text,
  image_url text,
  durability integer,
  slot_size integer DEFAULT 1,
  stackable boolean DEFAULT false,
  stack_limit integer,
  req_rank text,
  req_class text,
  req_nivel text,
  req_maestria text,
  req_mission_id uuid,
  req_skill_id uuid,
  meta jsonb DEFAULT '{}'::jsonb,
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  approved_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_submissions_status ON public.item_submissions(status);
CREATE INDEX IF NOT EXISTS idx_item_submissions_submitted_by ON public.item_submissions(submitted_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_submissions TO authenticated;
GRANT ALL ON public.item_submissions TO service_role;

ALTER TABLE public.item_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their submissions"
  ON public.item_submissions FOR SELECT TO authenticated
  USING (auth.uid() = submitted_by);

CREATE POLICY "Admins can view all submissions"
  ON public.item_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Blacksmiths can create submissions"
  ON public.item_submissions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = submitted_by
    AND (public.has_role(auth.uid(), 'blacksmith') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Owners can update pending submissions"
  ON public.item_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by AND status = 'pending')
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

CREATE POLICY "Admins can update any submission"
  ON public.item_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners or admins delete submissions"
  ON public.item_submissions FOR DELETE TO authenticated
  USING ((auth.uid() = submitted_by AND status = 'pending') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_item_submissions_touch
  BEFORE UPDATE ON public.item_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
