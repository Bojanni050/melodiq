CREATE INDEX IF NOT EXISTS "tracks_release_status_status_idx" ON "tracks" USING btree ("release_status","status");
