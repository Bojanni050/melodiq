import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";
import { getPublishedTrackById, getTrackDnaStats, getUserTrackDnaVote } from "@/lib/songs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Public, no auth required to view: the Track DNA page's data — track
// summary, aggregate DNA stats, and (only when a valid session cookie is
// present) the caller's own existing vote so their sliders start prefilled.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const track = await getPublishedTrackById(trackId);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const stats = await getTrackDnaStats(trackId);

  let myVote = null;
  const token = (await cookies()).get("token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    myVote = await getUserTrackDnaVote(trackId, payload.userId);
  }

  const [owner] = await db
    .select({ artistAlias: users.artistAlias, name: users.name })
    .from(users)
    .where(eq(users.id, track.userId))
    .limit(1);

  return NextResponse.json({
    track: {
      id: track.id,
      songId: track.songId,
      title: track.title || "Untitled",
      artistName: track.artistName || owner?.artistAlias || owner?.name || null,
      coverUrl: track.coverUrl || null,
      hasCoverProxy: Boolean(!track.coverUrl && track.s3KeyCover),
      duration: track.duration,
      totalPlays: track.playCount,
      instrumental: track.instrumental,
      publishDate: track.publishDate ? track.publishDate.toISOString() : null,
    },
    stats,
    myVote: myVote
      ? {
          vocal: myVote.vocal,
          instrumental: myVote.instrumental,
          atmosphere: myVote.atmosphere,
          lyrics: myVote.lyrics,
        }
      : null,
    loggedIn: Boolean(payload),
  });
}
