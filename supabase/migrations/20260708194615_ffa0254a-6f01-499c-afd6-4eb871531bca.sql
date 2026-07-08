
-- SCENES
CREATE POLICY "scenes read authed" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scenes');
CREATE POLICY "scenes owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scenes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "scenes owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'scenes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "scenes owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scenes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- LOCATIONS
CREATE POLICY "locations read authed" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'locations');
CREATE POLICY "locations admin write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'locations' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'locations' AND public.has_role(auth.uid(),'admin'));
