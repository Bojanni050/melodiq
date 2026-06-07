CREATE UNIQUE INDEX IF NOT EXISTS "tracks_user_provider_audio_id_unique" ON "tracks" USING btree ("user_id","provider","audio_id");
