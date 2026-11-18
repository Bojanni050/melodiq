CREATE TABLE "dna_trait_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"trait_key" varchar(60) NOT NULL,
	"category" varchar(20) NOT NULL,
	"previous_display" varchar(255),
	"display" varchar(255),
	"previous_number" real,
	"value_number" real,
	"direction" varchar(10) NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dna_traits" ADD COLUMN "first_seen_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "dna_traits" ADD COLUMN "last_changed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "dna_traits" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
CREATE INDEX "dna_trait_history_profile_key_idx" ON "dna_trait_history" USING btree ("profile_id","trait_key");--> statement-breakpoint
CREATE INDEX "dna_trait_history_user_changed_idx" ON "dna_trait_history" USING btree ("user_id","changed_at");