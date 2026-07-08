
-- 1) ENUMS
CREATE TYPE public.ninja_rank AS ENUM ('estudante','genin','chunin','tokubetsu_jonin','jonin','anbu','sannin','kage');
CREATE TYPE public.proficiency_kind AS ENUM ('kenjutsu','shurikenjutsu','taijutsu','ninjutsu','genjutsu','fuinjutsu','iryo');
CREATE TYPE public.skill_classification AS ENUM ('ofensivo','defensivo','suplementar');
CREATE TYPE public.skill_range AS ENUM ('curto','medio','longo');

-- 2) CHARACTERS: patente + proficiências
ALTER TABLE public.characters
  ADD COLUMN rank public.ninja_rank NOT NULL DEFAULT 'estudante',
  ADD COLUMN proficiencies jsonb NOT NULL DEFAULT jsonb_build_object(
    'kenjutsu',0,'shurikenjutsu',0,'taijutsu',0,'ninjutsu',0,'genjutsu',0,'fuinjutsu',0,'iryo',0
  );

-- 3) MISSIONS
CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  rank public.ninja_rank NOT NULL DEFAULT 'genin',
  description text,
  reward_xp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.missions TO anon, authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions public read" ON public.missions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "missions admin write" ON public.missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.character_missions (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (character_id, mission_id)
);
GRANT SELECT, INSERT, DELETE ON public.character_missions TO authenticated;
GRANT ALL ON public.character_missions TO service_role;
ALTER TABLE public.character_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own char missions read" ON public.character_missions FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.characters c WHERE c.id = character_missions.character_id AND c.user_id = auth.uid()));
CREATE POLICY "admin char missions" ON public.character_missions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4) ITEMS: rank, durabilidade, imagem, requisitos
ALTER TABLE public.items
  ADD COLUMN rank public.skill_rank NOT NULL DEFAULT 'E',
  ADD COLUMN durability integer,
  ADD COLUMN image_url text,
  ADD COLUMN req_rank public.ninja_rank,
  ADD COLUMN req_proficiency_kind public.proficiency_kind,
  ADD COLUMN req_proficiency_level integer,
  ADD COLUMN req_mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  ADD COLUMN req_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL;

-- 5) SKILLS: classificação, classe, alcance, imagem, requisitos
ALTER TABLE public.skills
  ADD COLUMN classification public.skill_classification,
  ADD COLUMN skill_class text,
  ADD COLUMN range public.skill_range,
  ADD COLUMN image_url text,
  ADD COLUMN req_rank public.ninja_rank,
  ADD COLUMN req_proficiency_kind public.proficiency_kind,
  ADD COLUMN req_proficiency_level integer,
  ADD COLUMN req_mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  ADD COLUMN req_prereq_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  ADD COLUMN clan_id uuid REFERENCES public.clans(id) ON DELETE SET NULL;

-- 6) ÁRVORE LINEAR DE CLÃ
CREATE TABLE public.clan_skills (
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  position integer NOT NULL,
  PRIMARY KEY (clan_id, skill_id),
  UNIQUE (clan_id, position)
);
GRANT SELECT ON public.clan_skills TO anon, authenticated;
GRANT ALL ON public.clan_skills TO service_role;
ALTER TABLE public.clan_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clan skills public read" ON public.clan_skills FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "clan skills admin write" ON public.clan_skills FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
