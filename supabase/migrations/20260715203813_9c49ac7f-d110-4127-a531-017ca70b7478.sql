ALTER PUBLICATION supabase_realtime ADD TABLE public.character_missions;
ALTER TABLE public.character_missions REPLICA IDENTITY FULL;