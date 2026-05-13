import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { apiLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");

  const logs = await db
    .select()
    .from(apiLogs)
    .where(eq(apiLogs.userId, decoded.userId))
    .orderBy(desc(apiLogs.createdAt))
    .limit(limit);

  return NextResponse.json({ logs });
}
