
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS owner_character_id uuid NULL REFERENCES public.characters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_locations_owner ON public.locations(owner_character_id);
CREATE INDEX IF NOT EXISTS idx_locations_for_sale ON public.locations(is_for_sale) WHERE is_for_sale = true;

CREATE TABLE IF NOT EXISTS public.location_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  granted_by uuid NULL REFERENCES public.characters(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, character_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_permissions TO authenticated;
GRANT ALL ON public.location_permissions TO service_role;

ALTER TABLE public.location_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own permissions readable"
  ON public.location_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = location_permissions.character_id AND c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.characters c ON c.id = l.owner_character_id
      WHERE l.id = location_permissions.location_id AND c.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner manages permissions"
  ON public.location_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.characters c ON c.id = l.owner_character_id
      WHERE l.id = location_permissions.location_id AND c.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.characters c ON c.id = l.owner_character_id
      WHERE l.id = location_permissions.location_id AND c.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Helper para checar acesso a um local (usado nas server functions).
CREATE OR REPLACE FUNCTION public.can_access_location(_user_id uuid, _location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (SELECT 1 FROM public.locations l WHERE l.id = _location_id AND l.is_private = true)
    OR EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.characters c ON c.id = l.owner_character_id
      WHERE l.id = _location_id AND c.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.location_permissions lp
      JOIN public.characters c ON c.id = lp.character_id
      WHERE lp.location_id = _location_id AND c.user_id = _user_id
    )
    OR public.has_role(_user_id, 'admin');
$$;
