
CREATE POLICY "minigames read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'minigames');
CREATE POLICY "minigames admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'minigames' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "minigames admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'minigames' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "minigames admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'minigames' AND public.has_role(auth.uid(),'admin'));
