
ALTER TABLE public.mounts ADD COLUMN IF NOT EXISTS travel_gif_url text;

ALTER TABLE public.character_mounts
  ADD COLUMN IF NOT EXISTS pose_id uuid REFERENCES public.character_poses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pose_offset_x real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pose_offset_y real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pose_scale real NOT NULL DEFAULT 1;
