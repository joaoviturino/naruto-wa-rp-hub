
-- Catálogo de proficiências (classes de habilidade) editável pelo admin
CREATE TABLE public.proficiencies (
  value text PRIMARY KEY,
  label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.proficiencies TO authenticated;
GRANT ALL ON public.proficiencies TO service_role;

ALTER TABLE public.proficiencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read proficiencies"
  ON public.proficiencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage proficiencies"
  ON public.proficiencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_proficiencies_updated
  BEFORE UPDATE ON public.proficiencies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed com valores atuais (todos correspondem a valores já existentes no enum skill_class)
INSERT INTO public.proficiencies (value, label, description, sort_order) VALUES
  ('genjutsu','Genjutsu','Ilusões que atacam o sistema nervoso e a percepção.',10),
  ('selos_de_mao','Selos de Mão','Domínio dos selos manuais que moldam e liberam o chakra.',20),
  ('ninjutsu','Ninjutsu','Técnicas de chakra puras (elementais, invocações, etc.).',30),
  ('katon','Katon (Fogo)','Afinidade elemental de fogo — chamas, brasas e explosões.',40),
  ('suiton','Suiton (Água)','Afinidade elemental de água — correntes, ondas e névoa.',50),
  ('fuuton','Fuuton (Vento)','Afinidade elemental de vento — cortes, rajadas e pressão.',60),
  ('doton','Doton (Terra)','Afinidade elemental de terra — pedra, solo e defesas.',70),
  ('raiton','Raiton (Raio)','Afinidade elemental de raio — descargas e velocidade elétrica.',80),
  ('taijutsu','Taijutsu','Combate corpo a corpo baseado em força física.',90),
  ('shinjutsu','Shinjutsu','Técnicas divinas ligadas ao chakra do Shinju/Ootsutsuki.',100),
  ('armadilha','Armadilha','Preparação de armadilhas e explosivos.',110),
  ('boujutsu','Boujutsu','Combate com bastões.',120),
  ('bukijutsu','Bukijutsu','Uso genérico de armas ninja.',130),
  ('bunshinjutsu','Bunshinjutsu','Criação de clones.',140),
  ('doujutsu','Doujutsu','Técnicas oculares (Sharingan, Byakugan, etc.).',150),
  ('fluxo_de_chakra','Fluxo de Chakra','Canaliza chakra elemental em armas.',160),
  ('formacao','Formação','Táticas coordenadas entre múltiplos ninjas.',170),
  ('estilo_de_luta','Estilo de Luta','Estilos marciais específicos (Gōken, Jūken...).',180),
  ('fuuinjutsu','Fuuinjutsu','Selamento de objetos, chakra ou seres.',190),
  ('gijutsu','Gijutsu','Técnicas científicas / tecnologia ninja.',200),
  ('hiden','Hiden','Técnicas secretas de clã ou vila, passadas por herança.',210),
  ('juinjutsu','Juinjutsu','Selos amaldiçoados que dominam o portador.',220),
  ('jujutsu','Jujutsu','Combate com projeção e alavancagem.',230),
  ('jutsu_basico','Jutsu Básico','Técnicas fundamentais ensinadas na Academia.',240),
  ('kaijutsu','Kaijutsu','Contra-medidas: dispersa ou anula outras técnicas.',250),
  ('kekkaijutsu','Kekkaijutsu','Barreiras de chakra.',260),
  ('kekkei_genkai','Kekkei Genkai','Habilidades hereditárias (linhagem sanguínea).',270),
  ('kekkei_moura','Kekkei Mōra','Kekkei ancestral únicas dos Ōtsutsuki.',280),
  ('kekkei_touta','Kekkei Tōta','Combinação avançada de três naturezas elementares.',290),
  ('kenjutsu','Kenjutsu','Combate com espadas.',300),
  ('kinjutsu','Kinjutsu','Técnicas proibidas por seu custo ou tabu.',310),
  ('kinkojutsu','Kinkojutsu','Técnicas de aprisionamento e imobilização.',320),
  ('konbijutsu','Konbijutsu','Técnicas combinadas entre dois ou mais ninjas.',330),
  ('kugutsujutsu','Kugutsujutsu','Manipulação de marionetes ninja.',340),
  ('kyuuinjutsu','Kyuuinjutsu','Absorção de chakra ou de outras técnicas.',350),
  ('ninjutsu_espaco_tempo','Ninjutsu Espaço-Tempo','Manipula distância e dimensões (teletransporte, Kamui).',360),
  ('ninjutsu_medico','Ninjutsu Médico','Cura e cirurgia via chakra.',370),
  ('nintaijutsu','Nintaijutsu','Fusão de ninjutsu com taijutsu (Rasengan, Chidori).',380),
  ('saiseijutsu','Saiseijutsu','Regeneração acelerada.',390),
  ('senjutsu','Senjutsu','Uso da energia natural (Modo Sábio).',400),
  ('shurikenjutsu','Shurikenjutsu','Uso de shuriken, kunai e projéteis.',410),
  ('tansakujutsu','Tansakujutsu','Rastreamento e detecção (sensores).',420),
  ('tenseijutsu','Tenseijutsu','Ressurreição de mortos (Edo Tensei, Rinne Tensei).',430),
  ('tonjutsu','Tonjutsu','Técnicas de evasão e fuga furtiva.',440),
  ('yuugoujutsu','Yuugoujutsu','Fusão entre criaturas ou entre ninja e criatura.',450)
ON CONFLICT (value) DO NOTHING;

-- RPC para admins adicionarem uma nova proficiência + valor do enum skill_class.
-- Delete lógico via coluna active; enum não permite remoção de valor.
CREATE OR REPLACE FUNCTION public.add_proficiency(_value text, _label text, _desc text DEFAULT NULL, _sort int DEFAULT 999)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v := lower(regexp_replace(trim(_value), '[^a-z0-9_]+', '_', 'g'));
  IF v = '' OR v IS NULL THEN RAISE EXCEPTION 'invalid value'; END IF;
  -- Adiciona ao enum se ainda não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'skill_class' AND e.enumlabel = v
  ) THEN
    EXECUTE format('ALTER TYPE public.skill_class ADD VALUE %L', v);
  END IF;
  INSERT INTO public.proficiencies(value, label, description, sort_order)
  VALUES (v, _label, _desc, _sort)
  ON CONFLICT (value) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, active = true;
END $$;

REVOKE ALL ON FUNCTION public.add_proficiency(text,text,text,int) FROM public;
GRANT EXECUTE ON FUNCTION public.add_proficiency(text,text,text,int) TO authenticated;
