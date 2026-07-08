
-- ============ LOCATIONS ============
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations read all authed" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations admin write" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER locations_touch BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CONNECTIONS (bidirecional; guardamos uma linha por par ordenado) ============
CREATE TABLE public.location_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  b_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (a_id <> b_id),
  CHECK (a_id < b_id),
  UNIQUE (a_id, b_id)
);
CREATE INDEX loc_conn_a ON public.location_connections(a_id);
CREATE INDEX loc_conn_b ON public.location_connections(b_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_connections TO authenticated;
GRANT ALL ON public.location_connections TO service_role;
ALTER TABLE public.location_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conn read all authed" ON public.location_connections FOR SELECT TO authenticated USING (true);
CREATE POLICY "conn admin write" ON public.location_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- normaliza a<b via trigger para simplificar inserts
CREATE OR REPLACE FUNCTION public.normalize_location_conn()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.a_id > NEW.b_id THEN
    NEW := ROW(NEW.id, NEW.b_id, NEW.a_id, NEW.created_at)::public.location_connections;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER loc_conn_normalize BEFORE INSERT OR UPDATE ON public.location_connections
  FOR EACH ROW EXECUTE FUNCTION public.normalize_location_conn();

-- ============ CHARACTERS: current_location_id ============
ALTER TABLE public.characters ADD COLUMN current_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX characters_loc ON public.characters(current_location_id);

-- helper: usuário atual tem algum personagem no local?
CREATE OR REPLACE FUNCTION public.user_at_location(_loc uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.characters
    WHERE user_id = auth.uid() AND current_location_id = _loc
  )
$$;

-- ============ SCENE IMAGES ============
CREATE TABLE public.scene_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scene_images_char ON public.scene_images(character_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_images TO authenticated;
GRANT ALL ON public.scene_images TO service_role;
ALTER TABLE public.scene_images ENABLE ROW LEVEL SECURITY;

-- dono lê/escreve suas cenas; qualquer authed também pode ler (para renderizar em mensagens)
CREATE POLICY "scenes read authed" ON public.scene_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "scenes owner insert" ON public.scene_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "scenes owner update" ON public.scene_images FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "scenes owner delete" ON public.scene_images FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));

-- limite: 10 por personagem
CREATE OR REPLACE FUNCTION public.enforce_scene_images_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.scene_images WHERE character_id = NEW.character_id;
  IF cnt >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 imagens de cena por personagem atingido';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER scene_images_limit BEFORE INSERT ON public.scene_images
  FOR EACH ROW EXECUTE FUNCTION public.enforce_scene_images_limit();

-- ============ LOCATION MESSAGES ============
CREATE TABLE public.location_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loc_msg_loc_created ON public.location_messages(location_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.location_messages TO authenticated;
GRANT ALL ON public.location_messages TO service_role;
ALTER TABLE public.location_messages ENABLE ROW LEVEL SECURITY;

-- só quem estiver no local vê
CREATE POLICY "msg present read" ON public.location_messages FOR SELECT TO authenticated
  USING (public.user_at_location(location_id) OR public.has_role(auth.uid(),'admin'));

-- só o dono do personagem, e o personagem tem que estar no local
CREATE POLICY "msg present insert" ON public.location_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_id
        AND c.user_id = auth.uid()
        AND c.current_location_id = location_id
    )
  );

-- autor ou admin apaga
CREATE POLICY "msg author or admin delete" ON public.location_messages FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.location_messages;
ALTER TABLE public.location_messages REPLICA IDENTITY FULL;
