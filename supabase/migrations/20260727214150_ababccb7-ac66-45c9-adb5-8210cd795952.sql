
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS body_sheet_url text,
  ADD COLUMN IF NOT EXISTS body_sheet_cols int,
  ADD COLUMN IF NOT EXISTS body_sheet_rows int,
  ADD COLUMN IF NOT EXISTS body_sheet_states jsonb;

ALTER TABLE public.cosmetic_pieces
  ADD COLUMN IF NOT EXISTS sheet_url text,
  ADD COLUMN IF NOT EXISTS sheet_cols int,
  ADD COLUMN IF NOT EXISTS sheet_rows int,
  ADD COLUMN IF NOT EXISTS sheet_states jsonb;
