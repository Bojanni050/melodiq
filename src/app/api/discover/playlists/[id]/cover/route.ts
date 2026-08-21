import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistTracks, tracks } from "@/db/schema";
import { getCachedCover } from "@/lib/cover-cache";

// Public, no auth: only ever serves art for a published, non-system playlist.
// Falls back to a random cover among the playlist's tracks when the playlist
// has no cover of its own.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [playlist] = await db
    .select({ s3KeyCover: playlists.s3KeyCover, s3KeyCoverThumb: playlists.s3KeyCoverThumb })
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.isPublic, true), eq(playlists.isSystem, false)))
    .limit(1);

  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  let s3Key = playlist.s3KeyCover;
  let s3KeyThumb = playlist.s3KeyCoverThumb;

  if (!s3Key) {
    const candidates = await db
      .select({ s3KeyCover: tracks.s3KeyCover, s3KeyCoverThumb: tracks.s3KeyCoverThumb })
      .from(playlistTracks)
      .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
      .where(and(eq(playlistTracks.playlistId, id), isNotNull(tracks.s3KeyCover)));

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No cover art available" }, { status: 404 });
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    s3Key = pick.s3KeyCover;
    s3KeyThumb = pick.s3KeyCoverThumb;
  }

  const isThumb = new URL(request.url).searchParams.get("thumb") === "1";
  const key = isThumb && s3KeyThumb ? s3KeyThumb : s3Key!;

  try {
    const { buffer, cached, contentType } = await getCachedCover(key);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        // Shorter than the owned-cover routes: a random fallback pick should
        // still rotate occasionally rather than being locked in for a day.
        "Cache-Control": "public, max-age=3600",
        "X-Cover-Cache": cached ? "hit" : "miss",
      },
    });
  } catch (error: any) {
    console.error(`[discover-playlist-cover] failed for playlist ${id}:`, error?.message ?? error);
    return NextResponse.json(
      { error: "Cover not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=300" } }
    );
  }
}
