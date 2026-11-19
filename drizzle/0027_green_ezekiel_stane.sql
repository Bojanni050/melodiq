CREATE TABLE "generation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_model" varchar(50),
	"origin" varchar(20) NOT NULL,
	"mode" varchar(10) NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "generation_events_user_created_idx" ON "generation_events" USING btree ("user_id","created_at");