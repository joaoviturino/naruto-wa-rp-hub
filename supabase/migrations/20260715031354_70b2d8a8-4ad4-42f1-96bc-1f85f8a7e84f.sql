
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'daily' CHECK (category IN ('daily','common','special')),
  ADD COLUMN IF NOT EXISTS objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rewards jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cooldown_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS repeatable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reward_ryo integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.character_missions
  ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','claimed')),
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Índice para acelerar lookup de missão ativa do personagem
CREATE INDEX IF NOT EXISTS character_missions_char_status_idx
  ON public.character_missions(character_id, status);
