CREATE TABLE public.location_libraries (
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.library_sections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, section_id)
);
GRANT SELECT ON public.location_libraries TO authenticated;
GRANT ALL ON public.location_libraries TO service_role;
ALTER TABLE public.location_libraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read location_libraries" ON public.location_libraries FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage location_libraries" ON public.location_libraries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));