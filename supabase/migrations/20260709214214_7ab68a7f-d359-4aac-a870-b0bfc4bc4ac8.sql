-- 1) Cooldown de habilidades
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS cooldown_turns integer NOT NULL DEFAULT 0;

-- 2) Enum de classes de habilidade (mesmos valores do SKILL_CLASSES do front)
DO $$ BEGIN
  CREATE TYPE public.skill_class AS ENUM (
    'genjutsu','ninjutsu','taijutsu','shinjutsu','armadilha','boujutsu','bukijutsu','bunshinjutsu',
    'doujutsu','fluxo_de_chakra','formacao','estilo_de_luta','fuuinjutsu','gijutsu','hiden','juinjutsu',
    'jujutsu','jutsu_basico','kaijutsu','kekkaijutsu','kekkei_genkai','kekkei_moura','kekkei_touta',
    'kenjutsu','kinjutsu','kinkojutsu','konbijutsu','kugutsujutsu','kyuuinjutsu','ninjutsu_espaco_tempo',
    'ninjutsu_medico','nintaijutsu','saiseijutsu','senjutsu','shurikenjutsu','tansakujutsu',
    'tenseijutsu','tonjutsu','yuugoujutsu'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Substitui req_proficiency_kind + req_proficiency_level em items e skills
ALTER TABLE public.items DROP COLUMN IF EXISTS req_proficiency_kind;
ALTER TABLE public.items DROP COLUMN IF EXISTS req_proficiency_level;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS req_class public.skill_class;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS req_nivel public.skill_rank;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS req_maestria public.skill_rank;

ALTER TABLE public.skills DROP COLUMN IF EXISTS req_proficiency_kind;
ALTER TABLE public.skills DROP COLUMN IF EXISTS req_proficiency_level;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS req_class public.skill_class;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS req_nivel public.skill_rank;
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS req_maestria public.skill_rank;

-- 4) Zera proficiencies antigas (formato numérico) — jogo em dev, sem preservar
UPDATE public.characters SET proficiencies = '{}'::jsonb;