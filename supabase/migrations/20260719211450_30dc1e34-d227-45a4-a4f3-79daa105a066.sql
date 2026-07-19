
-- NPCs with AI persona
ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_mode text NOT NULL DEFAULT 'both' CHECK (ai_mode IN ('public','private','both')),
  ADD COLUMN IF NOT EXISTS ai_personality text,
  ADD COLUMN IF NOT EXISTS ai_background text,
  ADD COLUMN IF NOT EXISTS ai_goals text,
  ADD COLUMN IF NOT EXISTS ai_tone text,
  ADD COLUMN IF NOT EXISTS ai_knowledge text,
  ADD COLUMN IF NOT EXISTS ai_extra text;

-- Allow NPC-authored location messages
ALTER TABLE public.location_messages
  ADD COLUMN IF NOT EXISTS npc_id uuid REFERENCES public.npcs(id) ON DELETE CASCADE;
ALTER TABLE public.location_messages ALTER COLUMN character_id DROP NOT NULL;
ALTER TABLE public.location_messages
  ADD CONSTRAINT location_messages_author_chk
  CHECK (character_id IS NOT NULL OR npc_id IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_loc_msg_npc ON public.location_messages(npc_id) WHERE npc_id IS NOT NULL;

-- Dedupe lock: no two workers respond to the same trigger for the same NPC
CREATE TABLE public.npc_ai_response_locks (
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  trigger_message_id uuid NOT NULL REFERENCES public.location_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (npc_id, trigger_message_id)
);
GRANT ALL ON public.npc_ai_response_locks TO service_role;
ALTER TABLE public.npc_ai_response_locks ENABLE ROW LEVEL SECURITY;

-- Private 1-on-1 NPC chats
CREATE TABLE public.npc_private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_id uuid NOT NULL REFERENCES public.npcs(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_npc_priv_char_npc ON public.npc_private_messages(character_id, npc_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.npc_private_messages TO authenticated;
GRANT ALL ON public.npc_private_messages TO service_role;
ALTER TABLE public.npc_private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "npc priv read own" ON public.npc_private_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "npc priv insert own" ON public.npc_private_messages FOR INSERT TO authenticated
  WITH CHECK (role = 'user' AND EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "npc priv delete own" ON public.npc_private_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.npc_private_messages;
