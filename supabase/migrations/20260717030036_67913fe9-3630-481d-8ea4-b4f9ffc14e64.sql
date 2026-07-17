ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS is_defensive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS defense_percent integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS accuracy integer NOT NULL DEFAULT 100;

ALTER TABLE public.skills
  ADD CONSTRAINT skills_defense_percent_range CHECK (defense_percent BETWEEN 0 AND 100),
  ADD CONSTRAINT skills_accuracy_range CHECK (accuracy BETWEEN 1 AND 100);
