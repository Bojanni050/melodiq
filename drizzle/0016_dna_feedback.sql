CREATE TABLE "dna_feedback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trait_key" varchar(60) NOT NULL,
	"category" varchar(20),
	"kind" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dna_feedback_events_user_idx" ON "dna_feedback_events" USING btree ("user_id","created_at");