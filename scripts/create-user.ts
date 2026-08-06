/**
 * One-time: create a user directly in the database, bypassing the
 * REGISTRATION_ENABLED gate on the /api/auth/register route.
 *
 * Run with:
 *   npx tsx --tsconfig tsconfig.json scripts/create-user.ts <email> <password> <name> [role]
 *
 * role defaults to "user"; pass "admin" to create the account as an admin.
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import path from "path";

loadEnvConfig(path.resolve(process.cwd()));

import bcrypt from "bcrypt";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [email, password, name, role = "user"] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx --tsconfig tsconfig.json scripts/create-user.ts <email> <password> <name> [role]");
    process.exit(1);
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    console.error(`A user with email "${email}" already exists.`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(users)
    .values({ email, password: hashedPassword, name: name || null, role })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

  console.log(`Created user ${created.email} (${created.id}) with role "${created.role}".`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
