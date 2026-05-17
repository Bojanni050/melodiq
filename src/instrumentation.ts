async function ensureSuperuser(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;

  const email = "bojan.vanderheide@outlook.com";
  const password = "75XpW7oeHf4Mct";
  const name = "Bojan";

  const postgres = (await import("postgres")).default;
  const bcrypt = await import("bcrypt");
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
    const { initializeDatabase } = await import("./db/init");
    const { default: postgres } = await import("postgres");
    const { default: bcrypt } = await import("bcrypt");

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return;

    await initializeDatabase();

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
}
