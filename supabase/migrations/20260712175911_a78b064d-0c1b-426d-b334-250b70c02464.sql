ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS required_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS required_rank text,
  ADD COLUMN IF NOT EXISTS required_profs jsonb NOT NULL DEFAULT '[]'::jsonb;