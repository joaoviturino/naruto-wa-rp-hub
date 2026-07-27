
CREATE POLICY "cosmetics view auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'cosmetics');
CREATE POLICY "cosmetics admin insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cosmetics' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "cosmetics admin update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cosmetics' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "cosmetics admin delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'cosmetics' AND public.has_role(auth.uid(),'admin'));
