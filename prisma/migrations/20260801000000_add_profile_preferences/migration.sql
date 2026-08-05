ALTER TABLE "Fan"
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT 'system';

ALTER TABLE "Fan"
  ADD CONSTRAINT "Fan_themePreference_check"
  CHECK ("themePreference" IN ('system', 'light', 'dark'));

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Profile avatars insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

CREATE POLICY "Profile avatars delete own objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND owner_id = (SELECT auth.jwt()->>'sub')
);
