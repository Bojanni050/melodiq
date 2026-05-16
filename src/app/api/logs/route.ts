import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");

  const logs = await db
    .select()
    .from(apiLogs)
    .where(eq(apiLogs.userId, userId))
    .orderBy(desc(apiLogs.createdAt))
    .limit(limit);

  return NextResponse.json({ logs });
}
