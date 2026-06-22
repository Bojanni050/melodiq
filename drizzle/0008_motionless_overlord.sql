CREATE TABLE "saved_lyrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"lyrics" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"prompt" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "s3_key_cover" varchar(512);--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "s3_key_cover_thumb" varchar(512);--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "s3_key_mp3" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "suno_style_influence" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "suno_weirdness" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "saved_lyrics_user_id_idx" ON "saved_lyrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "style_presets_user_id_idx" ON "style_presets" USING btree ("user_id");