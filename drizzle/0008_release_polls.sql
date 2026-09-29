CREATE TABLE "release_poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"voter_id" varchar(64) NOT NULL,
	"voter_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"closes_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "release_polls_release_id_unique" UNIQUE("release_id")
);
--> statement-breakpoint
CREATE INDEX "release_poll_options_poll_id_idx" ON "release_poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_poll_options_poll_track_unique" ON "release_poll_options" USING btree ("poll_id","track_id");--> statement-breakpoint
CREATE INDEX "release_poll_votes_poll_id_idx" ON "release_poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "release_poll_votes_option_id_idx" ON "release_poll_votes" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_poll_votes_poll_voter_unique" ON "release_poll_votes" USING btree ("poll_id","voter_id");--> statement-breakpoint
CREATE INDEX "release_polls_release_id_idx" ON "release_polls" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "release_polls_user_id_idx" ON "release_polls" USING btree ("user_id");