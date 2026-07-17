import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return auth;
}
