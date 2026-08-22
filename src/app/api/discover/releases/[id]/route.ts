import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { releaseTracks, releases, tracks, users } from "@/db/schema";
import { prefixCdn } from "@/lib/cdn";
import { getCdnUrl } from "@/lib/cdn-server";

export const dynamic = "force-dynamic";

// Public, no auth: a published release and its published tracks, for the
// Discover release detail page. Mirrors /api/discover/playlists/[id].
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [release] = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      kind: releases.kind,
      artistName: releases.artistName,
      description: releases.description,
      s3KeyCover: releases.s3KeyCover,
      publishedAt: releases.publishedAt,
      releaseDate: releases.releaseDate,
      ownerArtistAlias: users.artistAlias,
      ownerName: users.name,
    })
    .from(releases)
    .leftJoin(users, eq(users.id, releases.userId))
    .where(and(eq(releases.id, id), eq(releases.isPublic, true)))
    .limit(1);

  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  const releaseTrackRows = await db
    .select({
      trackId: releaseTracks.trackId,
      position: releaseTracks.position,
      side: releaseTracks.side,
      title: tracks.title,
      artistName: tracks.artistName,
      composerName: tracks.composerName,
      writerName: tracks.writerName,
      coverUrl: tracks.coverUrl,
      s3KeyCover: tracks.s3KeyCover,
      duration: tracks.duration,
      playCount: tracks.playCount,
      othersPlayCount: tracks.othersPlayCount,
      lyrics: tracks.lyrics,
      lyricsTimestamps: tracks.lyricsTimestamps,
      releaseStatus: tracks.releaseStatus,
    })
    .from(releaseTracks)
    .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
    .where(eq(releaseTracks.releaseId, id))
    .orderBy(asc(releaseTracks.position));

  const cdnUrl = await getCdnUrl();
  const publishedRows = releaseTrackRows.filter((row) => row.releaseStatus === "published");
  const serialized = publishedRows.map((row) => ({
    id: row.trackId,
    title: row.title || "Untitled",
    artistName: row.artistName,
    composerName: row.composerName,
    writerName: row.writerName,
    coverUrl: row.coverUrl?.startsWith("/api/tracks/")
      ? prefixCdn(cdnUrl, row.coverUrl.replace("/api/tracks/", "/api/discover/"))
      : row.coverUrl,
    hasCoverProxy: !row.coverUrl && !!row.s3KeyCover,
    duration: row.duration,
    totalPlays: (row.playCount ?? 0) + (row.othersPlayCount ?? 0),
    lyrics: row.lyrics || null,
    lyricsTimestamps: row.lyricsTimestamps || null,
    side: row.side,
  }));

  // Own cover, or a random cover among the release's tracks — the proxy
  // route resolves the fallback itself, this just decides whether one exists.
  const hasCover = !!release.s3KeyCover || releaseTrackRows.some((row) => !!row.s3KeyCover);

  return NextResponse.json({
    release: {
      id: release.id,
      title: release.title,
      type: release.type,
      kind: release.kind,
      description: release.description,
      artistName: release.artistName || release.ownerArtistAlias || release.ownerName || "Unknown Artist",
      publishedAt: release.publishedAt,
      releaseDate: release.releaseDate,
      coverUrl: hasCover ? prefixCdn(cdnUrl, `/api/discover/releases/${release.id}/cover`) : null,
      tracks: serialized,
    },
  });
}
