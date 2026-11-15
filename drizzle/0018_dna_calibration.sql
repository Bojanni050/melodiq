CREATE TABLE "dna_calibration_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trait_key" varchar(60) NOT NULL,
	"track_a_id" uuid NOT NULL,
	"track_b_id" uuid NOT NULL,
	"choice" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dna_calibration_answers_user_idx" ON "dna_calibration_answers" USING btree ("user_id","created_at");