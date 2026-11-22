CREATE TABLE "dna_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"apimart_task_id" varchar(255) NOT NULL,
	"model_id" varchar(255),
	"name" varchar(160) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"training_track_ids" text NOT NULL,
	"training_track_count" integer DEFAULT 0 NOT NULL,
	"dna_profile_name" varchar(160),
	"dna_profile_computed_at" timestamp,
	"training_dna_snapshot" text,
	"is_selected" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "dna_model_id" uuid;--> statement-breakpoint
CREATE INDEX "dna_models_user_id_idx" ON "dna_models" USING btree ("user_id");