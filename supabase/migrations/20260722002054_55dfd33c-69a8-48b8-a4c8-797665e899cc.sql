CREATE OR REPLACE FUNCTION public.has_admin_or_mod(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'moderator'::public.app_role)
  )
$$;