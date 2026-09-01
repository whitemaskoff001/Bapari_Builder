/*
# Create site-images storage bucket

1. Storage
- Create a new public bucket `site-images` for admin-uploaded website images
  (hero, process, about, material category images).
- Public read so visitors can see images without authentication.
- Only authenticated admins can insert/update/delete.

2. Policies
- SELECT: public (anon + authenticated) — website images are publicly visible
- INSERT: authenticated only (any signed-in staff can upload; UI restricts to admin)
- UPDATE: authenticated only
- DELETE: authenticated only
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "site_images_select_public" ON storage.objects;
CREATE POLICY "site_images_select_public"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'site-images');

DROP POLICY IF EXISTS "site_images_insert_staff" ON storage.objects;
CREATE POLICY "site_images_insert_staff"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-images');

DROP POLICY IF EXISTS "site_images_update_staff" ON storage.objects;
CREATE POLICY "site_images_update_staff"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'site-images');

DROP POLICY IF EXISTS "site_images_delete_staff" ON storage.objects;
CREATE POLICY "site_images_delete_staff"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'site-images');
