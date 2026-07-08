
CREATE POLICY "items skills public read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('items','skills'));
CREATE POLICY "items skills admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('items','skills') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "items skills admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('items','skills') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "items skills admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('items','skills') AND public.has_role(auth.uid(),'admin'));
