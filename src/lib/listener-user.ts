import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const LISTENER_EMAIL = "bojan_listen@melodiq.nl";

export async function ensureListenerUser() {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, LISTENER_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    if (user.role !== "listener") {
      const [updated] = await db
        .update(users)
        .set({ role: "listener", updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      return updated;
    }
    return user;
  }

  // Create default password hash for listener user
  const defaultPassword = process.env.LISTENER_USER_PASSWORD || "BojanListen2026!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  const [newUser] = await db
    .insert(users)
    .values({
      email: LISTENER_EMAIL,
      password: hashedPassword,
      name: "Bojan (Listener)",
      role: "listener",
    })
    .returning();

  return newUser;
}
