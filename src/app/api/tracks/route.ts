import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const decoded = verifyToken(token || "");

  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.userId, decoded.userId))
    .orderBy(desc(tracks.createdAt));

  return NextResponse.json({ tracks: result });
}
