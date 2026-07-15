ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS battle_bg_url text,
  ADD COLUMN IF NOT EXISTS music_url text;