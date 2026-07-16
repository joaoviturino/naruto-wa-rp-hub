
ALTER TYPE public.npc_kind ADD VALUE IF NOT EXISTS 'dialogue';
ALTER TYPE public.npc_kind ADD VALUE IF NOT EXISTS 'buyer';
ALTER TABLE public.npcs ADD COLUMN IF NOT EXISTS buy_items jsonb NOT NULL DEFAULT '[]'::jsonb;
