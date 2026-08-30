-- Reconciles the migration chain with src/db/schema.ts.
--
-- s3_key_ogg and is_spotlight were both live in schema.ts (and in the runtime
-- schema that src/db/init.ts maintains) without ever reaching an applied
-- migration: is_spotlight was written to 0003_lumpy_grim_reaper.sql, which a
-- re-baseline left out of meta/_journal.json, so it never ran. Every statement
-- here is idempotent, so this is a no-op on databases that already have them.
ALTER TABLE "tracks" ADD COLUMN IF NOT EXISTS "s3_key_ogg" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "is_spotlight" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracks_release_status_status_idx" ON "tracks" USING btree ("release_status","status");
