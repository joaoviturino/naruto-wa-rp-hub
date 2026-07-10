
CREATE TABLE public.library_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cover_url text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_sections TO authenticated;
GRANT ALL ON public.library_sections TO service_role;
ALTER TABLE public.library_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sections readable by authed" ON public.library_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections admin manage" ON public.library_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES public.library_sections(id) ON DELETE SET NULL,
  title text NOT NULL,
  author text,
  cover_url text,
  summary text,
  content text NOT NULL DEFAULT '',
  min_read_seconds int NOT NULL DEFAULT 30,
  rewards jsonb NOT NULL DEFAULT '{}'::jsonb,
  proficiency_grants jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books readable by authed" ON public.library_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "books admin manage" ON public.library_books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.character_book_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  rewards_applied jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (character_id, book_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_book_reads TO authenticated;
GRANT ALL ON public.character_book_reads TO service_role;
ALTER TABLE public.character_book_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads" ON public.character_book_reads FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "admin manage reads" ON public.character_book_reads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_library_sections_updated BEFORE UPDATE ON public.library_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_library_books_updated BEFORE UPDATE ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
