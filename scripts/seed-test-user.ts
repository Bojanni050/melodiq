import bcrypt from "bcrypt";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = "test@melodiq.local";
  const password = "TestAccount123!";

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.log("Test user already exists:", existing[0].id);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await db
    .insert(users)
    .values({ email, password: hashedPassword, name: "Test Account" })
    .returning();

  console.log("Created test user:", result[0].id, email);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
