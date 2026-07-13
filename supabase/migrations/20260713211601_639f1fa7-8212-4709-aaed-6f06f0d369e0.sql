ALTER TABLE public.clan_tree_nodes
  ADD COLUMN IF NOT EXISTS min_prereqs integer,
  ADD COLUMN IF NOT EXISTS xp_required integer;