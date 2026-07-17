import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { getPublishedSongPlayableTrack } from "@/lib/songs";

// Public, no auth: counts a play against the published track a visitor just
// heard via the discover stream route. Re-verifies the song is published.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;

  const track = await getPublishedSongPlayableTrack(songId);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const updated = await db
    .update(tracks)
    .set({ playCount: sql`${tracks.playCount} + 1`, updatedAt: new Date() })
    .where(eq(tracks.id, track.id))
    .returning({ playCount: tracks.playCount });

  return NextResponse.json({ playCount: updated[0]?.playCount ?? track.playCount });
}
