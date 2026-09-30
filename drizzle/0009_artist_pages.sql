CREATE TABLE "artist_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alias" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"bio" text,
	"image_s3_key" text,
	"hero_s3_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "artist_pages_user_id_idx" ON "artist_pages" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_pages_user_alias_unique" ON "artist_pages" USING btree ("user_id","alias");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_pages_slug_unique" ON "artist_pages" USING btree ("slug");