
-- 1) Permissions column on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) has_job_permission RPC
CREATE OR REPLACE FUNCTION public.has_job_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.character_jobs cj
    JOIN public.characters c ON c.id = cj.character_id
    JOIN public.jobs j ON j.id = cj.job_id
    WHERE c.user_id = _user_id
      AND cj.status = 'active'
      AND j.active = true
      AND COALESCE((j.permissions ->> _perm)::boolean, false) = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_job_permission(uuid, text) TO authenticated, anon, service_role;

-- 3) Migrate: create/find a "Ferreiro" job with submit_items permission
DO $$
DECLARE
  v_job_id uuid;
  v_role_exists boolean;
BEGIN
  -- Check if blacksmith enum value exists (may not, if fresh install)
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'blacksmith'
  ) INTO v_role_exists;

  IF v_role_exists THEN
    -- Ensure a Ferreiro job exists with submit_items permission
    SELECT id INTO v_job_id FROM public.jobs
      WHERE permissions ? 'submit_items'
        AND COALESCE((permissions ->> 'submit_items')::boolean, false) = true
      LIMIT 1;

    IF v_job_id IS NULL THEN
      INSERT INTO public.jobs (name, description, salary_ryo, salary_xp, salary_interval_hours, fire_after_days, active, permissions)
      VALUES ('Ferreiro', 'Cria itens e envia para aprovação dos admins.', 0, 0, 24, 30, true,
              jsonb_build_object('submit_items', true))
      RETURNING id INTO v_job_id;
    ELSE
      UPDATE public.jobs SET permissions = permissions || jsonb_build_object('submit_items', true) WHERE id = v_job_id;
    END IF;

    -- Hire every user who has the blacksmith role, if they have a character
    INSERT INTO public.character_jobs (character_id, job_id, status)
    SELECT c.id, v_job_id, 'active'
    FROM public.user_roles ur
    JOIN public.characters c ON c.user_id = ur.user_id
    WHERE ur.role::text = 'blacksmith'
      AND NOT EXISTS (
        SELECT 1 FROM public.character_jobs cj
        WHERE cj.character_id = c.id AND cj.job_id = v_job_id
      );

    -- Reactivate any existing rows that were quit/fired for these users
    UPDATE public.character_jobs cj
    SET status = 'active', hired_at = now(), last_activity_at = now()
    FROM public.characters c, public.user_roles ur
    WHERE cj.character_id = c.id
      AND c.user_id = ur.user_id
      AND ur.role::text = 'blacksmith'
      AND cj.job_id = v_job_id
      AND cj.status <> 'active';

    -- Remove blacksmith role assignments (we cannot drop the enum value in the same tx safely, so we just clear the rows)
    DELETE FROM public.user_roles WHERE role::text = 'blacksmith';
  END IF;
END $$;
