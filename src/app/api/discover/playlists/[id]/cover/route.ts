import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistTracks, tracks } from "@/db/schema";
import { getCachedCover } from "@/lib/cover-cache";

// Public, no auth: only ever serves a cover for a playlist that is
// isPublic === true && isSystem === false — re-verified on every request.
// If the playlist has no explicit cover, falls back to the cover of the
// first published, cover-bearing track in it.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [playlist] = await db
    .select({
      s3KeyCover: playlists.s3KeyCover,
      s3KeyCoverThumb: playlists.s3KeyCoverThumb,
      isPublic: playlists.isPublic,
      isSystem: playlists.isSystem,
    })
    .from(playlists)
    .where(eq(playlists.id, id))
    .limit(1);

  if (!playlist || !playlist.isPublic || playlist.isSystem) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  const isThumb = new URL(request.url).searchParams.get("thumb") === "1";

  let s3Key: string | null = null;
  if (playlist.s3KeyCover) {
    s3Key = isThumb && playlist.s3KeyCoverThumb ? playlist.s3KeyCoverThumb : playlist.s3KeyCover;
  } else {
    const [fallbackTrack] = await db
      .select({
        s3KeyCover: tracks.s3KeyCover,
        s3KeyCoverThumb: tracks.s3KeyCoverThumb,
      })
      .from(playlistTracks)
      .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
      .where(
        and(
          eq(playlistTracks.playlistId, id),
          eq(tracks.releaseStatus, "published"),
          isNotNull(tracks.s3KeyCover)
        )
      )
      .orderBy(asc(playlistTracks.position))
      .limit(1);

    if (fallbackTrack) {
      s3Key = isThumb && fallbackTrack.s3KeyCoverThumb ? fallbackTrack.s3KeyCoverThumb : fallbackTrack.s3KeyCover;
    }
  }

  if (!s3Key) {
    return NextResponse.json({ error: "No cover art available" }, { status: 404 });
  }

  try {
    const { buffer, cached, contentType } = await getCachedCover(s3Key);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Cover-Cache": cached ? "hit" : "miss",
      },
    });
  } catch (error: any) {
    console.error(`[discover/playlists/cover] failed for playlist ${id}:`, error?.message ?? error);
    return NextResponse.json(
      { error: "Cover not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}
