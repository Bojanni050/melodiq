import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { tracks } from "@/db/schema";
import { getPublishedTrackById } from "@/lib/songs";
import { verifyToken } from "@/lib/auth";

// Public, no auth: counts a play against the published track a visitor just
// heard via the discover stream route. Re-verifies the track is published.
// It also checks the cookie to see if the listener is actually the track owner,
// routing the play to playCount instead of othersPlayCount if so.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const track = await getPublishedTrackById(trackId);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let isOwner = false;
  if (token) {
    const payload = verifyToken(token);
    if (payload?.userId === track.userId) {
      isOwner = true;
    }
  }

  const updated = await db
    .update(tracks)
    .set({
      ...(isOwner
        ? { playCount: sql`${tracks.playCount} + 1` }
        : { othersPlayCount: sql`${tracks.othersPlayCount} + 1` }),
      updatedAt: new Date(),
    })
    .where(eq(tracks.id, track.id))
    .returning({ playCount: tracks.playCount, othersPlayCount: tracks.othersPlayCount });

  return NextResponse.json({
    playCount: updated[0]?.playCount ?? track.playCount,
    othersPlayCount: updated[0]?.othersPlayCount ?? track.othersPlayCount,
  });
}
