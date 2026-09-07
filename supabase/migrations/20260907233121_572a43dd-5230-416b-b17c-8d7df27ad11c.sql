CREATE POLICY "Owners can read their post images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'post-images'
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND storage.objects.name = p.id::text || '.png'
  )
);

CREATE POLICY "Owners can upload their post images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND storage.objects.name = p.id::text || '.png'
  )
);

CREATE POLICY "Owners can update their post images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'post-images'
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND storage.objects.name = p.id::text || '.png'
  )
)
WITH CHECK (
  bucket_id = 'post-images'
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND storage.objects.name = p.id::text || '.png'
  )
);

CREATE POLICY "Owners can delete their post images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'post-images'
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND storage.objects.name = p.id::text || '.png'
  )
);