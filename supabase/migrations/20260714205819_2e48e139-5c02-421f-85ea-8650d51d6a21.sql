ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS defense int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_hit_percent int NOT NULL DEFAULT 50;

ALTER TABLE public.npcs
  ADD CONSTRAINT npcs_defense_range CHECK (defense BETWEEN 0 AND 90),
  ADD CONSTRAINT npcs_max_hit_percent_range CHECK (max_hit_percent BETWEEN 10 AND 100);