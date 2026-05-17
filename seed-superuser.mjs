import bcrypt from "bcrypt";
import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let val = trimmed.slice(eqIndex + 1).trim();
      val = val.replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  }
}

const email = "bojan@sonara.dev";
const password = "75XpW7oeHf!Mct";
const name = "Bojan";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    const existing = await sql`SELECT id FROM "users" WHERE email = ${email}`;
    if (existing.length > 0) {
      console.log(`User "${email}" already exists (id: ${existing[0].id})`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await sql`
      INSERT INTO "users" ("email", "password", "name")
      VALUES (${email}, ${hashedPassword}, ${name})
      RETURNING id, email, name
    `;

    console.log(`Superuser created:`, result[0]);
  } finally {
    await sql.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
