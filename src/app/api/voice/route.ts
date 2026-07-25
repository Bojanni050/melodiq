import { NextResponse } from "next/server";
import { db } from "@/db";
import { clonedVoices } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const voices = await db
    .select()
    .from(clonedVoices)
    .where(eq(clonedVoices.userId, userId))
    .orderBy(desc(clonedVoices.createdAt));

  return NextResponse.json({ voices });
}
