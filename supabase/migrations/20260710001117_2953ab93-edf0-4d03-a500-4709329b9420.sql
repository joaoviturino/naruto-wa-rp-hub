ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS battle_bg_url TEXT;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS animation_url TEXT;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS sound_url TEXT;