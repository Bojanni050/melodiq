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
  "language" varchar(50),
  "instrumental" boolean NOT NULL DEFAULT false,
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
  "conversion_id" VARCHAR(255),
  "audio_id" VARCHAR(255),
  "rating" VARCHAR(10),
  "play_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

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
`;

// These ALTER TABLE statements handle existing databases. On fresh installs,
// the columns above are already in createTablesSql. IF NOT EXISTS makes this safe either way.
const alterTracksSql = `
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS format VARCHAR(10) DEFAULT 'mp3';
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS format_hd VARCHAR(10);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_cover TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_id VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_url_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_hd TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS rating VARCHAR(10);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS play_count integer NOT NULL DEFAULT 0;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS wav_job_id VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS conversion_id VARCHAR(255);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS workspace_id uuid;
DO $$ BEGIN
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
END $$;
`;

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
    await targetClient`SELECT 1 FROM "users" LIMIT 1`;
    console.log("Tables already exist, skipping creation");
  } catch {
    console.log("Tables do not exist, creating...");
    try {
      const statements = createTablesSql
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        await targetClient.unsafe(statement + ";");
      }
      console.log("Tables created successfully");
    } catch (error) {
      console.error("Error creating tables:", error);
    }
  } finally {
    try {
      const alterStatements = alterTracksSql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of alterStatements) {
        await targetClient.unsafe(statement + ";");
      }
    } catch (error) {
      console.error("Error applying tracks alter statements:", error);
    }

    await targetClient.end();
  }
}
