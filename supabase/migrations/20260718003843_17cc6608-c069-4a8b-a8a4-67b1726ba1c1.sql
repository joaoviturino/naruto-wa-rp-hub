ALTER TABLE public.server_config
  ADD COLUMN IF NOT EXISTS initial_spawn_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;