DROP INDEX "dna_profiles_user_unique";--> statement-breakpoint
ALTER TABLE "dna_calibration_answers" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "dna_feedback_events" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "dna_profiles" ADD COLUMN "artist_alias" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_events" ADD COLUMN "artist_alias" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "dna_profiles_user_alias_unique" ON "dna_profiles" USING btree ("user_id","artist_alias");