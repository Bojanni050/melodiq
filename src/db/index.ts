import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const FALLBACK_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/postgres";

function getConnectionString(): string {
	const configured = process.env.DATABASE_URL;
	if (!configured) return FALLBACK_DATABASE_URL;

	try {
		// Validate once so malformed values do not crash module evaluation.
		new URL(configured);
		return configured;
	} catch {
		return FALLBACK_DATABASE_URL;
	}
}

const client = postgres(getConnectionString(), {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });
