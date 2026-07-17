import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";
import { getTrackDnaAccess, getTrackDnaStats, getUserTrackDnaVote } from "@/lib/songs";
import { db } from "@/db";
import { songs, users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Public, no auth required to view: the Track DNA page's data — track
// summary, aggregate DNA stats, and (only when a valid session cookie is
// present) the caller's own existing vote so their sliders start prefilled.
// The track's owner can always reach this for their own track regardless of
// publish status (see getTrackDnaAccess); everyone else needs it published.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await params;

  const token = (await cookies()).get("token")?.value;
  const payload = token ? verifyToken(token) : null;

  const track = await getTrackDnaAccess(trackId, payload?.userId ?? null);
  if (!track) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const stats = await getTrackDnaStats(trackId);

  let myVote = null;
  if (payload) {
    myVote = await getUserTrackDnaVote(trackId, payload.userId);
  }

  const [owner] = await db
    .select({ artistAlias: users.artistAlias, name: users.name })
    .from(users)
    .where(eq(users.id, track.userId))
    .limit(1);

  let songPublishDate: Date | null = null;
  if (track.songId) {
    const [song] = await db
      .select({ publishDate: songs.publishDate })
      .from(songs)
      .where(eq(songs.id, track.songId))
      .limit(1);
    songPublishDate = song?.publishDate ?? null;
  }
  const publishDate = track.publishDate ?? songPublishDate;

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
      publishDate: publishDate ? publishDate.toISOString() : null,
      pollsCloseAt: track.pollsCloseAt ? track.pollsCloseAt.toISOString() : null,
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
