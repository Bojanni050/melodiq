DROP INDEX "tracks_user_id_created_at_idx";--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "s3_key_cover_thumb" text;--> statement-breakpoint
CREATE INDEX "tracks_user_id_created_at_idx" ON "tracks" USING btree ("user_id","created_at");