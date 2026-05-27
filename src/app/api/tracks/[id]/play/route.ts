import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const updated = await db
    .update(tracks)
    .set({
      playCount: sql`${tracks.playCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
    .returning({ playCount: tracks.playCount });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  return NextResponse.json({ playCount: updated[0].playCount });
}
