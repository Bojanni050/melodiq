import postgres from "postgres";

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "5432"),
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1),
    ssl: parsed.searchParams.get("sslmode") === "require",
  };
}

const createTablesSql = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL UNIQUE,
  "password" text NOT NULL,
  "name" varchar(255),
  "artist_alias" varchar(255),
  "role" varchar(20) NOT NULL DEFAULT 'user',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "workspace_id" uuid,
  "title" varchar(255),
  "provider" varchar(50) NOT NULL,
  "provider_model" varchar(50) NOT NULL,
  "prompt" text NOT NULL,
  "lyrics" text,
  "lyrics_timestamps" text,
  "language" varchar(50),
  "instrumental" boolean NOT NULL DEFAULT false,
  "is_collaboration" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "audio_url" text,
  "audio_url_hd" text,
  "s3_key" text,
  "s3_key_hd" text,
  "duration" integer,
  "job_id" varchar(255),
  "credits_used" integer NOT NULL DEFAULT 0,
  "error" text,
  "format" VARCHAR(10) DEFAULT 'mp3',
  "format_hd" VARCHAR(10),
  "cover_url" TEXT,
  "s3_key_cover" TEXT,
  "s3_key_cover_thumb" TEXT,
  "conversion_id" VARCHAR(255),
  "audio_id" VARCHAR(255),
  "wav_job_id" VARCHAR(255),
  "rating" VARCHAR(10),
  "play_count" integer NOT NULL DEFAULT 0,
  "others_play_count" integer NOT NULL DEFAULT 0,
  "release_status" VARCHAR(20) NOT NULL DEFAULT 'concept',
  "publish_date" timestamp,
  "track_dna" text,
  "polls_open_at" timestamp,
  "polls_close_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "track_stems" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "track_id" uuid NOT NULL REFERENCES "tracks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stem_type" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "job_id" varchar(255),
  "audio_url" text,
  "s3_key" text,
  "format" varchar(10) DEFAULT 'mp3',
  "error" text,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "track_stems_track_id_idx" ON "track_stems"("track_id");
CREATE UNIQUE INDEX IF NOT EXISTS "track_stems_track_id_stem_type_unique" ON "track_stems"("track_id", "stem_type");

CREATE TABLE IF NOT EXISTS "track_masters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "track_id" uuid NOT NULL REFERENCES "tracks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "variation_category" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "job_id" varchar(255),
  "audio_url" text,
  "s3_key" text,
  "format" varchar(10) DEFAULT 'mp3',
  "error" text,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "track_masters_track_id_idx" ON "track_masters"("track_id");
CREATE UNIQUE INDEX IF NOT EXISTS "track_masters_track_id_variation_unique" ON "track_masters"("track_id", "variation_category");

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "parent_workspace_id" uuid REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "folder_gradient" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workspaces_user_idx" ON "workspaces"("user_id");
CREATE INDEX IF NOT EXISTS "workspaces_parent_idx" ON "workspaces"("parent_workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_single_default_per_user_idx" ON "workspaces"("user_id") WHERE "is_default" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "tracks_user_provider_audio_id_unique" ON "tracks"("user_id", "provider", "audio_id");

CREATE TABLE IF NOT EXISTS "playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" varchar(500),
  "s3_key_cover" varchar(512),
  "s3_key_cover_thumb" varchar(512),
  "is_system" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "playlist_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "playlist_id" uuid NOT NULL REFERENCES "playlists"("id") ON DELETE CASCADE,
  "track_id" uuid NOT NULL REFERENCES "tracks"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "playlists_user_id_idx" ON "playlists"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "playlists_user_name_unique" ON "playlists"("user_id", "name");
CREATE INDEX IF NOT EXISTS "playlist_tracks_playlist_idx" ON "playlist_tracks"("playlist_id");
CREATE INDEX IF NOT EXISTS "playlist_tracks_track_idx" ON "playlist_tracks"("track_id");
CREATE UNIQUE INDEX IF NOT EXISTS "playlist_tracks_playlist_position_unique" ON "playlist_tracks"("playlist_id", "position");

CREATE TABLE IF NOT EXISTS "releases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "type" varchar(20) NOT NULL,
  "kind" varchar(30),
  "artist_name" varchar(255),
  "description" text,
  "cover_url" text,
  "s3_key_cover" text,
  "s3_key_cover_thumb" text,
  "release_date" timestamp,
  "is_public" boolean NOT NULL DEFAULT false,
  "published_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "release_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "release_id" uuid NOT NULL REFERENCES "releases"("id") ON DELETE CASCADE,
  "track_id" uuid NOT NULL REFERENCES "tracks"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "side" varchar(10),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "releases_user_id_idx" ON "releases"("user_id");
CREATE INDEX IF NOT EXISTS "release_tracks_release_idx" ON "release_tracks"("release_id");
CREATE INDEX IF NOT EXISTS "release_tracks_track_idx" ON "release_tracks"("track_id");
CREATE UNIQUE INDEX IF NOT EXISTS "release_tracks_release_position_unique" ON "release_tracks"("release_id", "position");

CREATE TABLE IF NOT EXISTS "api_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id"),
  "type" varchar(50) NOT NULL,
  "provider" varchar(50) NOT NULL,
  "endpoint" varchar(255) NOT NULL,
  "request" text NOT NULL,
  "response" text,
  "status_code" integer,
  "duration" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" varchar(255) NOT NULL UNIQUE,
  "value" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "saved_lyrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "lyrics" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "saved_lyrics_user_id_idx" ON "saved_lyrics"("user_id");

CREATE TABLE IF NOT EXISTS "style_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "prompt" text NOT NULL,
  "notes" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "style_presets_user_id_idx" ON "style_presets"("user_id");

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_unique" ON "push_subscriptions"("endpoint");

CREATE TABLE IF NOT EXISTS "track_dna_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "track_id" uuid NOT NULL REFERENCES "tracks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "vocal" real NOT NULL,
  "instrumental" real NOT NULL,
  "atmosphere" real NOT NULL,
  "lyrics" real,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE track_dna_votes ALTER COLUMN vocal TYPE real;
ALTER TABLE track_dna_votes ALTER COLUMN instrumental TYPE real;
ALTER TABLE track_dna_votes ALTER COLUMN atmosphere TYPE real;
ALTER TABLE track_dna_votes ALTER COLUMN lyrics TYPE real;

CREATE UNIQUE INDEX IF NOT EXISTS "track_dna_votes_track_user_unique" ON "track_dna_votes"("track_id", "user_id");
CREATE INDEX IF NOT EXISTS "track_dna_votes_track_id_idx" ON "track_dna_votes"("track_id");

CREATE TABLE IF NOT EXISTS "song_archive" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "parent_id" uuid REFERENCES "song_archive"("id") ON DELETE CASCADE,
  "language" varchar(50),
  "title" varchar(255) NOT NULL,
  "lyrics" text NOT NULL DEFAULT '',
  "prompt" text NOT NULL DEFAULT '',
  "notes" text NOT NULL DEFAULT '',
  "track_id" uuid REFERENCES "tracks"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "song_archive_user_id_idx" ON "song_archive"("user_id");
CREATE INDEX IF NOT EXISTS "song_archive_track_id_idx" ON "song_archive"("track_id");
CREATE INDEX IF NOT EXISTS "song_archive_parent_id_idx" ON "song_archive"("parent_id");
`;

// These ALTER TABLE statements handle existing databases. On fresh installs,
// the columns above are already in createTablesSql. IF NOT EXISTS makes this safe either way.
const alterTracksSql = `
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS format VARCHAR(10) DEFAULT 'mp3';
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS format_hd VARCHAR(10);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_cover TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_cover_thumb TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_id VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_url_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS rating VARCHAR(10);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS play_count integer NOT NULL DEFAULT 0;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS others_play_count integer NOT NULL DEFAULT 0;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS wav_job_id VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS conversion_id VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS lyrics_timestamps TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS composer_name VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS writer_name VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS translated_lyrics TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS translated_language VARCHAR(50);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_mp3 TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS wav_retry_at timestamp;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS wav_retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_name VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS suno_style_influence integer;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS suno_weirdness integer;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_license TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS voted_at timestamp;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS release_status VARCHAR(20) NOT NULL DEFAULT 'concept';
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS publish_date timestamp;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS track_dna text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_dna text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS advanced_dna text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS polls_open_at timestamp;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS polls_close_at timestamp;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS completed_at timestamp;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS is_collaboration boolean NOT NULL DEFAULT false;
ALTER TABLE track_stems ADD COLUMN IF NOT EXISTS completed_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS "tracks_user_provider_audio_id_unique" ON "tracks"("user_id", "provider", "audio_id");
CREATE UNIQUE INDEX IF NOT EXISTS "playlists_user_name_unique" ON "playlists"("user_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "playlist_tracks_playlist_position_unique" ON "playlist_tracks"("playlist_id", "position");
`;

const alterUsersSql = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_alias varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS composer_alias varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS writer_alias varchar(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'user';
`;

// Handles existing databases where playlists was created before these columns existed.
const alterPlaylistsSql = `
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS description varchar(500);
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS s3_key_cover varchar(512);
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS s3_key_cover_thumb varchar(512);
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
`;

const tracksWorkspaceFkSql = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tracks_workspace_id_workspaces_id_fk'
  ) THEN
    ALTER TABLE tracks
      ADD CONSTRAINT tracks_workspace_id_workspaces_id_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      ON DELETE SET NULL;
  END IF;
END
$$;
`;

// The "songs" concept (grouping track variants for the old voting/Song-DNA
// feature) has been removed in favor of per-track DNA — subfolders now live
// entirely on the "workspaces" table via parent_workspace_id. Drop the
// leftover table/column on every boot so existing databases catch up.
const dropSongsSql = `
DROP TABLE IF EXISTS songs CASCADE;
ALTER TABLE tracks DROP COLUMN IF EXISTS song_id;
`;

// Stamps completed_at the moment a generation job (track or stem — and any
// future job table with the same status/completed_at shape, e.g. mastering)
// first transitions into a terminal status, so "generation duration" is just
// completed_at - created_at with no per-webhook bookkeeping required. Resets
// completed_at to NULL if a retry moves the row back out of a terminal
// status, so the next completion gets a fresh duration.
const completedAtTriggerSql = `
CREATE OR REPLACE FUNCTION set_completed_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('done', 'completed', 'failed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.completed_at := now();
  ELSIF NEW.status NOT IN ('done', 'completed', 'failed') AND OLD.status IN ('done', 'completed', 'failed') THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tracks_set_completed_at ON tracks;
CREATE TRIGGER tracks_set_completed_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();

DROP TRIGGER IF EXISTS track_stems_set_completed_at ON track_stems;
CREATE TRIGGER track_stems_set_completed_at
  BEFORE UPDATE ON track_stems
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();

DROP TRIGGER IF EXISTS track_masters_set_completed_at ON track_masters;
CREATE TRIGGER track_masters_set_completed_at
  BEFORE UPDATE ON track_masters
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();
`;

async function executeSqlStatements(client: postgres.Sql, sqlBlob: string) {
  const statements = sqlBlob
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await client.unsafe(`${statement};`);
  }
}

export async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    return;
  }

  const config = parseDatabaseUrl(databaseUrl);
  const targetDb = config.database;
  if (!targetDb) {
    console.error("No database name found in DATABASE_URL");
    return;
  }

  const postgresUrl = `postgres://${config.user}:${config.password}@${config.host}:${config.port}/postgres`;
  const client = postgres(postgresUrl);

  try {
    const result = await client`SELECT 1 FROM pg_database WHERE datname = ${targetDb}`;

    if (result.length === 0) {
      console.log(`Database "${targetDb}" does not exist, creating...`);
      await client.unsafe(`CREATE DATABASE "${targetDb}"`);
      console.log(`Database "${targetDb}" created successfully`);
    } else {
      console.log(`Database "${targetDb}" already exists`);
    }
  } catch (error) {
    console.error("Error checking/creating database:", error);
  } finally {
    await client.end();
  }

  const targetClient = postgres(databaseUrl);

  try {
    await executeSqlStatements(targetClient, createTablesSql);
    await executeSqlStatements(targetClient, alterUsersSql);
    await executeSqlStatements(targetClient, alterTracksSql);
    await executeSqlStatements(targetClient, alterPlaylistsSql);
    await targetClient.unsafe(tracksWorkspaceFkSql);
    await executeSqlStatements(targetClient, dropSongsSql);
    await targetClient.unsafe(completedAtTriggerSql);
    console.log("Database schema ensured (tables, indexes, columns, constraints)");
  } catch (error) {
    console.error("Error ensuring database schema:", error);
  } finally {
    await targetClient.end();
  }
}
