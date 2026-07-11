
-- Extend enums (must be in own tx block; run one by one; supabase runs migrations in one transaction which supports ADD VALUE since PG12)
ALTER TYPE public.minigame_kind ADD VALUE IF NOT EXISTS 'sequence';
ALTER TYPE public.npc_kind ADD VALUE IF NOT EXISTS 'learning';

-- Book content blocks (ordered text/image)
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- NPC de aprendizagem
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS tutorial_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_min_read_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS linked_minigame_id uuid REFERENCES public.minigames(id) ON DELETE SET NULL;
