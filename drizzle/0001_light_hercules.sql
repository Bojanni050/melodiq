CREATE TABLE "cover_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"s3_key_thumb" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX "cover_images_entity_idx" ON "cover_images" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "cover_images_user_idx" ON "cover_images" USING btree ("user_id");