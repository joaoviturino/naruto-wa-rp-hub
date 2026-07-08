
CREATE POLICY "npcs bucket read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'npcs');
CREATE POLICY "npcs bucket admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'npcs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "npcs bucket admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'npcs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "npcs bucket admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'npcs' AND public.has_role(auth.uid(), 'admin'));
