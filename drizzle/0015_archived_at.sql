ALTER TABLE "tracks" ADD COLUMN "archived_at" timestamp;
CREATE INDEX "tracks_user_id_archived_at_idx" ON "tracks" USING btree ("user_id","archived_at");
