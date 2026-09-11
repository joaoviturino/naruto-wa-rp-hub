-- Cosmetic ambience only; existing locations retain their current appearance.
-- Uses the existing locations RLS policies. No privileges or combat stats change.
ALTER TABLE public.locations
  ADD COLUMN visual_environment text NOT NULL DEFAULT 'neutral'
  CONSTRAINT locations_visual_environment_check
  CHECK (visual_environment IN ('neutral', 'wind', 'rain', 'water'));

COMMENT ON COLUMN public.locations.visual_environment IS
  'Cosmetic clothing response used by new PvE/PvP combat sessions.';
