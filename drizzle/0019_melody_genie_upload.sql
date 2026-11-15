ALTER TABLE "tracks" ADD COLUMN "melody_genie_artist_influence" varchar(255);--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "melody_genie_additions" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "melody_genie_style_influence" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "melody_genie_dna_influence" boolean DEFAULT false NOT NULL;