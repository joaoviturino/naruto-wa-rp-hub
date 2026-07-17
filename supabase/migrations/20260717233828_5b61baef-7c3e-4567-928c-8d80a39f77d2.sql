ALTER TYPE public.npc_kind ADD VALUE IF NOT EXISTS 'employer';

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  salary_ryo integer NOT NULL DEFAULT 0,
  salary_xp integer NOT NULL DEFAULT 0,
  salary_interval_hours integer NOT NULL DEFAULT 24,
  fire_after_days integer NOT NULL DEFAULT 7,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  hired_at timestamptz NOT NULL DEFAULT now(),
  last_paid_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, job_id)
);
CREATE INDEX IF NOT EXISTS character_jobs_char_idx ON public.character_jobs(character_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_jobs TO authenticated;
GRANT ALL ON public.character_jobs TO service_role;
ALTER TABLE public.character_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS offered_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;

ALTER TABLE public.minigames
  ADD COLUMN IF NOT EXISTS required_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_required boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.npc_chests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id uuid NOT NULL UNIQUE REFERENCES public.npcs(id) ON DELETE CASCADE,
  capacity integer NOT NULL DEFAULT 100,
  contents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.npc_chests TO authenticated;
GRANT ALL ON public.npc_chests TO service_role;
ALTER TABLE public.npc_chests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chest_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chest_id uuid NOT NULL REFERENCES public.npc_chests(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chest_id, character_id)
);
CREATE INDEX IF NOT EXISTS chest_perm_char_idx ON public.chest_permissions(character_id);
CREATE UNIQUE INDEX IF NOT EXISTS chest_perm_one_owner ON public.chest_permissions(chest_id) WHERE is_owner;
GRANT SELECT ON public.chest_permissions TO authenticated;
GRANT ALL ON public.chest_permissions TO service_role;
ALTER TABLE public.chest_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs read auth" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "jobs admin write" ON public.jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "cj owner read" ON public.character_jobs FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cj admin write" ON public.character_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "chest read allowed" ON public.npc_chests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.chest_permissions cp
      JOIN public.characters c ON c.id = cp.character_id
      WHERE cp.chest_id = npc_chests.id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "chest admin write" ON public.npc_chests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "chestperm self read" ON public.chest_permissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
  );
CREATE POLICY "chestperm admin write" ON public.chest_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER character_jobs_updated_at BEFORE UPDATE ON public.character_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER npc_chests_updated_at BEFORE UPDATE ON public.npc_chests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();