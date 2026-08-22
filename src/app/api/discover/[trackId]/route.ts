import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";
import { getAudioDna, getTrackDnaAccess } from "@/lib/songs";
import { getCdnUrl } from "@/lib/cdn-server";
import { prefixCdn } from "@/lib/cdn";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Public, no auth required to view: the Track DNA page's data — track
// summary and auto-computed DNA (tempo/key/energy/loudness, atmosphere tags,
// lyrics score). The track's owner can always reach this for their own track
// regardless of publish status (see getTrackDnaAccess); everyone else needs
// it published.
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

  const audioDna = await getAudioDna(trackId);

  const [owner] = await db
    .select({ artistAlias: users.artistAlias, name: users.name })
    .from(users)
    .where(eq(users.id, track.userId))
    .limit(1);

  // A generated track's coverUrl in the DB is often the owner-gated
  // /api/tracks/{id}/cover proxy (requireAuth + ownership check) — fine for
  // the owner viewing their own track, but a 401 for anyone else, which is
  // most viewers of this public page. Rewrite it to the public
  // /api/discover/{id}/cover proxy for non-owner viewers, same as the
  // discover feed does in getPublishedTracksFeed.
  const isOwner = payload?.userId === track.userId;
  const cdnUrl = await getCdnUrl();
  const coverUrl =
    !isOwner && track.coverUrl?.startsWith("/api/tracks/")
      ? prefixCdn(cdnUrl, track.coverUrl.replace("/api/tracks/", "/api/discover/"))
      : track.coverUrl || null;

  return NextResponse.json({
    track: {
      id: track.id,
      title: track.title || "Untitled",
      artistName: track.artistName || owner?.artistAlias || owner?.name || null,
      writerName: track.writerName || null,
      composerName: track.composerName || null,
      coverUrl,
      hasCoverProxy: Boolean(!track.coverUrl && track.s3KeyCover),
      duration: track.duration,
      totalPlays: track.playCount + track.othersPlayCount,
      instrumental: track.instrumental,
      publishDate: track.publishDate ? track.publishDate.toISOString() : null,
      lyricsTimestamps: track.lyricsTimestamps || null,
    },
    audioDna,
    loggedIn: Boolean(payload),
  });
}
