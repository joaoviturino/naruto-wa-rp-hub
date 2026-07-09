
-- Helper: is a given user in a given party? (SECURITY DEFINER avoids RLS recursion on party_members)
CREATE OR REPLACE FUNCTION public.user_in_party(_party uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.party_members pm
    JOIN public.characters c ON c.id = pm.character_id
    WHERE pm.party_id = _party AND c.user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.parties p
    JOIN public.characters c ON c.id = p.leader_id
    WHERE p.id = _party AND c.user_id = _user
  );
$$;

-- Rewrite party_members SELECT policy to use the helper (no self-recursion)
DROP POLICY IF EXISTS "pm read same party" ON public.party_members;
CREATE POLICY "pm read same party" ON public.party_members
  FOR SELECT TO authenticated
  USING (public.user_in_party(party_id, auth.uid()));

-- Rewrite parties SELECT policy the same way
DROP POLICY IF EXISTS "parties read own" ON public.parties;
CREATE POLICY "parties read own" ON public.parties
  FOR SELECT TO authenticated
  USING (public.user_in_party(id, auth.uid()));
