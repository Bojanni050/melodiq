/**
 * Shared env bootstrap for the admin scripts in this folder.
 *
 * Why this is its own module: ES module imports are evaluated before any
 * statement in the importing file, so a `loadEnvConfig(...)` call written above
 * `import { db } from "@/db"` runs *after* the db client has already read
 * DATABASE_URL. And `src/db/index.ts` deliberately falls back to a localhost
 * database when the variable is missing — which is how a backfill can quietly
 * point at the wrong Postgres (`relation "tracks" does not exist`). Importing
 * this module first guarantees the env is loaded before the client is built,
 * and it stops the script instead of letting that fallback happen.
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import path from "path";

loadEnvConfig(path.resolve(process.cwd()));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    [
      "DATABASE_URL is not set.",
      "",
      "Without it this script would fall back to the localhost database from",
      "src/db/index.ts, not MelodIQ's own database.",
      "",
      "On the VPS, run the script inside the app container (env comes from .env.production):",
      "  docker compose exec app npx tsx --tsconfig tsconfig.json scripts/<script>.ts",
      "",
      "Locally, put DATABASE_URL in .env.local in the project root.",
    ].join("\n"),
  );
  process.exit(1);
}

try {
  new URL(databaseUrl);
} catch {
  console.error("DATABASE_URL is not a valid URL.");
  process.exit(1);
}
