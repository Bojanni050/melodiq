CREATE TABLE IF NOT EXISTS "track_stems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stem_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"job_id" varchar(255),
	"audio_url" text,
	"s3_key" text,
	"format" varchar(10) DEFAULT 'mp3',
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "track_stems_track_id_idx" ON "track_stems" USING btree ("track_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "track_stems_track_id_stem_type_unique" ON "track_stems" USING btree ("track_id","stem_type");
