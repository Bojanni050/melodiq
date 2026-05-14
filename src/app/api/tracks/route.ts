import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

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

  const now = Date.now();
  const timedOutIds: string[] = [];

  for (const track of result) {
    if (track.status === "generating" && track.createdAt) {
      const elapsed = now - new Date(track.createdAt).getTime();
      if (elapsed > GENERATION_TIMEOUT_MS) {
        timedOutIds.push(track.id!);
      }
    }
  }

  if (timedOutIds.length > 0) {
    await db
      .update(tracks)
      .set({ status: "failed", error: "Generation timed out. Please try again." })
      .where(inArray(tracks.id, timedOutIds));

    const refreshed = await db
      .select()
      .from(tracks)
      .where(eq(tracks.userId, decoded.userId))
      .orderBy(desc(tracks.createdAt));

    return NextResponse.json({ tracks: refreshed });
  }

  return NextResponse.json({ tracks: result });
}
