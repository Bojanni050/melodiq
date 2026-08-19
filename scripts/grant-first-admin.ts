/**
 * One-time: grant the 'admin' role to a user.
 *
 * With no argument, only proceeds if there is EXACTLY one user in the
 * database (the expected case for a single-user MelodIQ instance) — refuses
 * to guess if there's more than one, to avoid promoting the wrong account.
 *
 * To target a specific account instead (e.g. once there's more than one
 * user), pass its email:
 *   npx tsx --tsconfig tsconfig.json scripts/grant-first-admin.ts you@example.com
 *
 * Run with:
 *   npx tsx --tsconfig tsconfig.json scripts/grant-first-admin.ts
 */

import "dotenv/config";
import { loadEnvConfig } from "@next/env";
import path from "path";

loadEnvConfig(path.resolve(process.cwd()));

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const targetEmail = process.argv[2]?.trim();

  if (targetEmail) {
    const [updated] = await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.email, targetEmail))
      .returning({ id: users.id, email: users.email });

    if (!updated) {
      console.error(`No user found with email "${targetEmail}".`);
      process.exit(1);
    }

    console.log(`Granted admin to ${updated.email} (${updated.id}).`);
    return;
  }

  const allUsers = await db.select({ id: users.id, email: users.email, role: users.role }).from(users);

  if (allUsers.length === 0) {
    console.error("No users found.");
    process.exit(1);
  }

  if (allUsers.length > 1) {
    console.error(
      `Found ${allUsers.length} users — refusing to guess which one. Re-run with an email:\n` +
        allUsers.map((u) => `  npx tsx --tsconfig tsconfig.json scripts/grant-first-admin.ts ${u.email}`).join("\n")
    );
    process.exit(1);
  }

  const [user] = allUsers;
  const [updated] = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, user.id))
    .returning({ id: users.id, email: users.email });

  console.log(`Granted admin to ${updated.email} (${updated.id}).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
