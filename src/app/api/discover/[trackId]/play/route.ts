import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { getPublishedTrackById } from "@/lib/songs";

// Public, no auth: counts a play against the published track a visitor just
// heard via the discover stream route. Re-verifies the track is published.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const track = await getPublishedTrackById(trackId);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const updated = await db
    .update(tracks)
    .set({ othersPlayCount: sql`${tracks.othersPlayCount} + 1`, updatedAt: new Date() })
    .where(eq(tracks.id, track.id))
    .returning({ othersPlayCount: tracks.othersPlayCount });

  return NextResponse.json({ othersPlayCount: updated[0]?.othersPlayCount ?? track.othersPlayCount });
}
