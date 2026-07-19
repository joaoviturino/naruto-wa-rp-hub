
CREATE INDEX IF NOT EXISTS idx_combat_participants_character ON public.combat_participants(character_id);
CREATE INDEX IF NOT EXISTS idx_combat_sessions_location_status ON public.combat_sessions(location_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_combat_sessions_status ON public.combat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_character_presence_last_seen ON public.character_presence(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_character_presence_location ON public.character_presence(current_location_id);
CREATE INDEX IF NOT EXISTS idx_location_messages_location_created ON public.location_messages(location_id, created_at DESC);
