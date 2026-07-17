import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const result = await db
    .select({ id: tracks.id, songId: tracks.songId, votedAt: tracks.votedAt })
    .from(tracks)
    .where(and(eq(tracks.id, id), eq(tracks.userId, userId)));

  const track = result[0];
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  try {
    if (track.votedAt) {
      const [updated] = await db
        .update(tracks)
        .set({ votedAt: null })
        .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
        .returning();

      return NextResponse.json({ track: updated });
    }

    if (track.songId) {
      await db
        .update(tracks)
        .set({ votedAt: null })
        .where(
          and(eq(tracks.songId, track.songId), eq(tracks.userId, userId), ne(tracks.id, id))
        );
    }

    const [updated] = await db
      .update(tracks)
      .set({ votedAt: new Date() })
      .where(and(eq(tracks.id, id), eq(tracks.userId, userId)))
      .returning();

    return NextResponse.json({ track: updated });
  } catch (error) {
    console.error("[tracks/vote]", error);
    return NextResponse.json({ error: "Failed to update vote" }, { status: 500 });
  }
}
