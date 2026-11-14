CREATE TABLE "dna_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(160),
	"summary" text,
	"source_count" integer DEFAULT 0 NOT NULL,
	"rated_count" integer DEFAULT 0 NOT NULL,
	"liked_count" integer DEFAULT 0 NOT NULL,
	"disliked_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dna_traits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(20) NOT NULL,
	"trait_key" varchar(60) NOT NULL,
	"label" varchar(160) NOT NULL,
	"kind" varchar(20) NOT NULL,
	"value_number" real,
	"value_text" text,
	"unit" varchar(20),
	"display" varchar(255),
	"confidence" real DEFAULT 0 NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"weight" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "dna_profiles_user_unique" ON "dna_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dna_traits_profile_key_unique" ON "dna_traits" USING btree ("profile_id","trait_key");--> statement-breakpoint
CREATE INDEX "dna_traits_user_id_idx" ON "dna_traits" USING btree ("user_id");