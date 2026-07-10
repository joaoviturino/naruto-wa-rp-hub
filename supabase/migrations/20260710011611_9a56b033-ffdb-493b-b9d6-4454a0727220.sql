ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS stackable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stack_limit integer;