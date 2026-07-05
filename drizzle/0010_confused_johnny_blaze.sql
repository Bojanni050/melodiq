ALTER TABLE "tracks" ADD COLUMN "wav_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "wav_retry_count" integer DEFAULT 0 NOT NULL;