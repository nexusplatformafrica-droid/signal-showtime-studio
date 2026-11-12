
CREATE POLICY "staff read thumbnails" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media-thumbnails' AND public.is_staff(auth.uid()));
