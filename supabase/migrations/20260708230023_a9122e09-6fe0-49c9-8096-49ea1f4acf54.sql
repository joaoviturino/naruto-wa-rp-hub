
-- 1) Allow authenticated users to read basic character info of others (nickname/avatar/banner needed for chats/party UI).
CREATE POLICY "characters authenticated read" ON public.characters
  FOR SELECT TO authenticated USING (true);

-- 2) Persistent energy pools + Ryo currency.
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS ryo bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ef_current integer,
  ADD COLUMN IF NOT EXISTS em_current integer,
  ADD COLUMN IF NOT EXISTS chakra_current integer;

-- 3) NPC rewards + drop table.
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS reward_xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_ryo integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drop_table jsonb NOT NULL DEFAULT '[]'::jsonb;
