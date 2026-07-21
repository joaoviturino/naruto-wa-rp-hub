ALTER TABLE public.skills ADD COLUMN required_item_id uuid REFERENCES public.items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_skills_required_item ON public.skills(required_item_id);