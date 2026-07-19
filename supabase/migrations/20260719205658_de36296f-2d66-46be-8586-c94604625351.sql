ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS archetype text,
  ADD COLUMN IF NOT EXISTS qualities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flaws text[] NOT NULL DEFAULT '{}';