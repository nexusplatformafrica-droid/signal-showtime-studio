
CREATE POLICY "media roles upload thumbnails" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media-thumbnails' AND public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager','graphics_designer']::public.app_role[]));
CREATE POLICY "media roles update thumbnails" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media-thumbnails' AND public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager','graphics_designer']::public.app_role[]));
CREATE POLICY "media roles delete thumbnails" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media-thumbnails' AND public.has_any_role(auth.uid(), ARRAY['super_admin','station_manager','media_manager','advertising_manager','graphics_designer']::public.app_role[]));
