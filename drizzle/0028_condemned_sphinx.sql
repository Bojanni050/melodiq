ALTER TABLE "cloned_voices" ADD COLUMN "styles" varchar(200);--> statement-breakpoint
ALTER TABLE "cloned_voices" ADD COLUMN "describe" text;--> statement-breakpoint
ALTER TABLE "cloned_voices" ADD COLUMN "source_track_id" uuid;