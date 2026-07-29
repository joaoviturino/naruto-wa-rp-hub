ALTER TABLE public.server_config ADD COLUMN IF NOT EXISTS default_sprite_url text;
ALTER TABLE public.cosmetic_pieces ADD COLUMN IF NOT EXISTS customizable boolean NOT NULL DEFAULT true;

UPDATE public.server_config
SET default_sprite_url = COALESCE(default_sprite_url, '/__l5e/assets-v1/9726db70-fe21-48d4-8a45-50829d9970ef/sprite-test-base.png')
WHERE id = 'main';

CREATE OR REPLACE FUNCTION public.enforce_cosmetic_customizable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cosmetic_pieces p
    WHERE p.id = NEW.piece_id AND p.active AND p.customizable
  ) THEN
    RAISE EXCEPTION 'Peca exclusiva: somente admins podem equipar.';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_cosmetic_customizable ON public.character_cosmetics;
CREATE TRIGGER trg_cosmetic_customizable
BEFORE INSERT OR UPDATE ON public.character_cosmetics
FOR EACH ROW EXECUTE FUNCTION public.enforce_cosmetic_customizable();