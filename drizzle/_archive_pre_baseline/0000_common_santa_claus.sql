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
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255),
	"provider" varchar(50) NOT NULL,
	"provider_model" varchar(50) NOT NULL,
	"prompt" text NOT NULL,
	"lyrics" text,
	"language" varchar(50),
	"instrumental" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"audio_url" text,
	"audio_url_hd" text,
	"s3_key" text,
	"s3_key_hd" text,
	"format" varchar(10) DEFAULT 'mp3',
	"format_hd" varchar(10),
	"duration" integer,
	"job_id" varchar(255),
	"audio_id" varchar(255),
	"credits_used" integer DEFAULT 0 NOT NULL,
	"error" text,
	"cover_url" text,
	"s3_key_cover" text,
	"rating" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
