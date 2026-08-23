ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "s3_key_cover" varchar(512);
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "s3_key_cover_thumb" varchar(512);
