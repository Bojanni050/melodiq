import { initializeDatabase } from "./db/init";
import postgres from "postgres";
import bcrypt from "bcrypt";

async function ensureSuperuser(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  const email = "bojan.vanderheide@outlook.com";
  const password = "75XpW7oeHf4Mct";
  const name = "Bojan";

  const sql = postgres(databaseUrl);

  try {
    const existing = await sql`SELECT id FROM "users" WHERE email = ${email}`;
    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await sql`INSERT INTO "users" ("email", "password", "name") VALUES (${email}, ${hashedPassword}, ${name})`;
      console.log(`Superuser "${email}" created`);
    } else {
      console.log(`Superuser "${email}" already exists`);
    }
  } finally {
    await sql.end();
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await initializeDatabase();
    await ensureSuperuser();
  }
}
