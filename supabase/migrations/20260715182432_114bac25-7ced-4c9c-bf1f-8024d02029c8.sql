
-- 1) combat_sessions: modo (pve/pvp) + npc_id opcional (não há NPC em pvp) + duração
ALTER TABLE public.combat_sessions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'pve';
ALTER TABLE public.combat_sessions ALTER COLUMN npc_id DROP NOT NULL;

-- 2) pvp_duels ganha referência ao combate criado
ALTER TABLE public.pvp_duels ADD COLUMN IF NOT EXISTS combat_session_id uuid REFERENCES public.combat_sessions(id) ON DELETE SET NULL;

-- 3) RLS: espectadores no mesmo local podem VER sessões PvP para acompanhar a luta.
DROP POLICY IF EXISTS "combat read participants" ON public.combat_sessions;
CREATE POLICY "combat read participants or spectators"
  ON public.combat_sessions FOR SELECT
  USING (
    -- participante direto (via combat_participants)
    EXISTS (
      SELECT 1 FROM public.combat_participants cp
      JOIN public.characters c ON c.id = cp.character_id
      WHERE cp.session_id = combat_sessions.id AND c.user_id = auth.uid()
    )
    -- OU pvp + estou no mesmo local
    OR (
      combat_sessions.mode = 'pvp'
      AND public.user_at_location(combat_sessions.location_id)
    )
    -- admins
    OR public.has_role(auth.uid(), 'admin')
  );
