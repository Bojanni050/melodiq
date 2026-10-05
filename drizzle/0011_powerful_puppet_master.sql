ALTER TABLE "tracks" ADD COLUMN "suno_variety" varchar(10);--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "suno_max_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "suno_audio_format" varchar(10);