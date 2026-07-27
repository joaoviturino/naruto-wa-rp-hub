
-- Enum para slots de cosméticos
DO $$ BEGIN
  CREATE TYPE public.cosmetic_slot AS ENUM ('hair','face','clothing','accessory');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Catálogo de peças (curadoria admin)
CREATE TABLE public.cosmetic_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot public.cosmetic_slot NOT NULL,
  name text NOT NULL,
  image_url text NOT NULL,
  z_index integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cosmetic_pieces TO authenticated;
GRANT ALL ON public.cosmetic_pieces TO service_role;
ALTER TABLE public.cosmetic_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth pode ver peças ativas" ON public.cosmetic_pieces
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin gerencia peças" ON public.cosmetic_pieces
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_cosmetic_pieces_touch
  BEFORE UPDATE ON public.cosmetic_pieces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_cosmetic_pieces_slot ON public.cosmetic_pieces(slot, sort_order);

-- Equipamento cosmético por personagem (1 peça por slot)
CREATE TABLE public.character_cosmetics (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  slot public.cosmetic_slot NOT NULL,
  piece_id uuid NOT NULL REFERENCES public.cosmetic_pieces(id) ON DELETE CASCADE,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_cosmetics TO authenticated;
GRANT ALL ON public.character_cosmetics TO service_role;
ALTER TABLE public.character_cosmetics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver cosméticos" ON public.character_cosmetics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "dono gerencia próprios cosméticos" ON public.character_cosmetics
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "admin gerencia todos cosméticos" ON public.character_cosmetics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_character_cosmetics_piece ON public.character_cosmetics(piece_id);
