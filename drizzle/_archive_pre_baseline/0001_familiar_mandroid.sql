CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_workspace_id" uuid,
	"folder_gradient" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "conversion_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "wav_job_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "play_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "artist_alias" varchar(255);--> statement-breakpoint
CREATE INDEX "workspaces_user_id_idx" ON "workspaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tracks_user_id_idx" ON "tracks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tracks_user_id_status_idx" ON "tracks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tracks_status_idx" ON "tracks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tracks_user_id_created_at_idx" ON "tracks" USING btree ("user_id","created_at" DESC);