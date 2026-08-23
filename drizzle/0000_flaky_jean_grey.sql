CREATE TABLE "api_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" varchar(50) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"request" text NOT NULL,
	"response" text,
	"status_code" integer,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloned_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"apimart_task_id" varchar(255) NOT NULL,
	"persona_id" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"source_audio_url" text NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"s3_key_cover" varchar(512),
	"s3_key_cover_thumb" varchar(512),
	"is_system" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"side" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"kind" varchar(30),
	"artist_name" varchar(255),
	"credits" text,
	"description" text,
	"cover_url" text,
	"s3_key_cover" text,
	"s3_key_cover_thumb" text,
	"release_date" timestamp,
	"is_public" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_lyrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"lyrics" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "song_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"language" varchar(50),
	"title" varchar(255) NOT NULL,
	"lyrics" text DEFAULT '' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"track_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"prompt" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_alignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"engine" varchar(30) DEFAULT 'quicklrc' NOT NULL,
	"confidence" real,
	"tcl" text,
	"error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_dna_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vocal" real NOT NULL,
	"instrumental" real NOT NULL,
	"atmosphere" real NOT NULL,
	"lyrics" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_masters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"variation_category" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"job_id" varchar(255),
	"audio_url" text,
	"s3_key" text,
	"format" varchar(10) DEFAULT 'mp3',
	"error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_stems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stem_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"job_id" varchar(255),
	"audio_url" text,
	"s3_key" text,
	"format" varchar(10) DEFAULT 'mp3',
	"error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"title" varchar(255),
	"provider" varchar(50) NOT NULL,
	"provider_model" varchar(50) NOT NULL,
	"prompt" text NOT NULL,
	"lyrics" text,
	"lyrics_timestamps" text,
	"language" varchar(50),
	"translated_lyrics" text,
	"translated_language" varchar(50),
	"instrumental" boolean DEFAULT false NOT NULL,
	"is_collaboration" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"audio_url" text,
	"audio_url_hd" text,
	"s3_key" text,
	"s3_key_hd" text,
	"s3_key_mp3" text,
	"format" varchar(10) DEFAULT 'mp3',
	"format_hd" varchar(10),
	"duration" integer,
	"job_id" varchar(255),
	"conversion_id" varchar(255),
	"audio_id" varchar(255),
	"wav_job_id" varchar(255),
	"wav_retry_at" timestamp,
	"wav_retry_count" integer DEFAULT 0 NOT NULL,
	"wav_user_requested" boolean DEFAULT false NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"error" text,
	"cover_url" text,
	"s3_key_cover" text,
	"s3_key_cover_thumb" text,
	"artist_name" varchar(255),
	"composer_name" varchar(255),
	"writer_name" varchar(255),
	"suno_style_influence" integer,
	"suno_weirdness" integer,
	"s3_key_license" text,
	"rating" varchar(10),
	"play_count" integer DEFAULT 0 NOT NULL,
	"others_play_count" integer DEFAULT 0 NOT NULL,
	"voted_at" timestamp,
	"release_status" varchar(20) DEFAULT 'concept' NOT NULL,
	"publish_date" timestamp,
	"track_dna" text,
	"audio_dna" text,
	"advanced_dna" text,
	"polls_open_at" timestamp,
	"polls_close_at" timestamp,
	"archived_at" timestamp,
	"deleted_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"name" varchar(255),
	"artist_alias" varchar(255),
	"artist_aliases" text,
	"composer_alias" varchar(255),
	"writer_alias" varchar(255),
	"bio" text,
	"profile_image_url" text,
	"hero_image_url" text,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
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
ALTER TABLE "song_archive" ADD CONSTRAINT "song_archive_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_archive" ADD CONSTRAINT "song_archive_parent_id_song_archive_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."song_archive"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_archive" ADD CONSTRAINT "song_archive_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cloned_voices_user_id_idx" ON "cloned_voices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playlist_tracks_playlist_idx" ON "playlist_tracks" USING btree ("playlist_id");--> statement-breakpoint
CREATE INDEX "playlist_tracks_track_idx" ON "playlist_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_tracks_playlist_position_unique" ON "playlist_tracks" USING btree ("playlist_id","position");--> statement-breakpoint
CREATE INDEX "playlists_user_id_idx" ON "playlists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playlists_user_name_unique" ON "playlists" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "release_tracks_release_idx" ON "release_tracks" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "release_tracks_track_idx" ON "release_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_tracks_release_position_unique" ON "release_tracks" USING btree ("release_id","position");--> statement-breakpoint
CREATE INDEX "releases_user_id_idx" ON "releases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_lyrics_user_id_idx" ON "saved_lyrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "song_archive_user_id_idx" ON "song_archive" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "song_archive_track_id_idx" ON "song_archive" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "song_archive_parent_id_idx" ON "song_archive" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "style_presets_user_id_idx" ON "style_presets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_alignments_track_id_unique" ON "track_alignments" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_alignments_user_id_idx" ON "track_alignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_dna_votes_track_user_unique" ON "track_dna_votes" USING btree ("track_id","user_id");--> statement-breakpoint
CREATE INDEX "track_dna_votes_track_id_idx" ON "track_dna_votes" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_masters_track_id_idx" ON "track_masters" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_masters_track_id_variation_unique" ON "track_masters" USING btree ("track_id","variation_category");--> statement-breakpoint
CREATE INDEX "track_stems_track_id_idx" ON "track_stems" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_stems_track_id_stem_type_unique" ON "track_stems" USING btree ("track_id","stem_type");--> statement-breakpoint
CREATE INDEX "tracks_user_id_idx" ON "tracks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tracks_user_id_status_idx" ON "tracks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tracks_status_idx" ON "tracks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tracks_user_id_created_at_idx" ON "tracks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "tracks_archived_at_idx" ON "tracks" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_user_provider_audio_id_unique" ON "tracks" USING btree ("user_id","provider","audio_id");--> statement-breakpoint
CREATE INDEX "workspaces_user_id_idx" ON "workspaces" USING btree ("user_id");