import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { releases, releaseTracks, tracks, users } from "@/db/schema";
import { prefixCdn } from "@/lib/cdn";
import { getCdnUrl } from "@/lib/cdn-server";

export const dynamic = "force-dynamic";

// Public, no auth: every published (isPublic) release with its published
// tracks, for the Discover Releases browse page. Mirrors
// /api/discover/releases/[id], but for every release at once so the listing
// page can render each release's tracklist inline without an extra
// round-trip per release.
export async function GET() {
  const releaseRows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      kind: releases.kind,
      artistName: releases.artistName,
      publishedAt: releases.publishedAt,
      s3KeyCover: releases.s3KeyCover,
      ownerArtistAlias: users.artistAlias,
      ownerName: users.name,
    })
    .from(releases)
    .leftJoin(users, eq(users.id, releases.userId))
    .where(eq(releases.isPublic, true))
    .orderBy(desc(releases.publishedAt));

  const trackRows = await db
    .select({
      releaseId: releaseTracks.releaseId,
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
    .where(eq(tracks.releaseStatus, "published"))
    .orderBy(asc(releaseTracks.position));

  const cdnUrl = await getCdnUrl();
  const tracksByRelease = new Map<string, typeof trackRows>();
  for (const row of trackRows) {
    const list = tracksByRelease.get(row.releaseId) ?? [];
    list.push(row);
    tracksByRelease.set(row.releaseId, list);
  }

  return NextResponse.json({
    releases: releaseRows.map((release) => {
      const releaseTrackRows = tracksByRelease.get(release.id) ?? [];
      const serializedTracks = releaseTrackRows.map((row) => ({
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

      const hasCover = !!release.s3KeyCover || releaseTrackRows.some((row) => !!row.s3KeyCover);
      const totalDuration = releaseTrackRows.reduce((sum, row) => sum + (row.duration ?? 0), 0);
      const totalPlays = releaseTrackRows.reduce(
        (sum, row) => sum + (row.playCount ?? 0) + (row.othersPlayCount ?? 0),
        0
      );

      return {
        id: release.id,
        title: release.title,
        type: release.type,
        kind: release.kind,
        artistName: release.artistName || release.ownerArtistAlias || release.ownerName || "Unknown Artist",
        publishedAt: release.publishedAt,
        trackCount: serializedTracks.length,
        totalDuration,
        totalPlays,
        coverUrl: hasCover ? prefixCdn(cdnUrl, `/api/discover/releases/${release.id}/cover`) : null,
        tracks: serializedTracks,
      };
    }),
  });
}
