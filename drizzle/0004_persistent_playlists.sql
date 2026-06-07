CREATE TABLE IF NOT EXISTS "playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playlist_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "playlist_id" uuid NOT NULL,
  "track_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'playlists_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "playlists"
      ADD CONSTRAINT "playlists_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'playlist_tracks_playlist_id_playlists_id_fk'
  ) THEN
    ALTER TABLE "playlist_tracks"
      ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk"
      FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id")
      ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'playlist_tracks_track_id_tracks_id_fk'
  ) THEN
    ALTER TABLE "playlist_tracks"
      ADD CONSTRAINT "playlist_tracks_track_id_tracks_id_fk"
      FOREIGN KEY ("track_id") REFERENCES "tracks"("id")
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "playlists_user_id_idx" ON "playlists" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "playlists_user_name_unique" ON "playlists" USING btree ("user_id", "name");
CREATE INDEX IF NOT EXISTS "playlist_tracks_playlist_idx" ON "playlist_tracks" USING btree ("playlist_id");
CREATE INDEX IF NOT EXISTS "playlist_tracks_track_idx" ON "playlist_tracks" USING btree ("track_id");
CREATE UNIQUE INDEX IF NOT EXISTS "playlist_tracks_playlist_position_unique" ON "playlist_tracks" USING btree ("playlist_id", "position");
