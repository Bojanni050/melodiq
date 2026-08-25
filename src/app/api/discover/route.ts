import { NextResponse } from "next/server";
import { db } from "@/db";
import { releases, releaseTracks, tracks } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getPublishedTracksFeed } from "@/lib/songs";

export const dynamic = "force-dynamic";

// Public, no auth: browsable catalog of published tracks. Includes lyrics
// (read-only) but never prompt/trackDna — see getPublishedTracksFeed for
// what's exposed.
export async function GET() {
  const published = await getPublishedTracksFeed(50);
  const trending = [...published].sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 11);

  // Get spotlight release (the most recently published one marked as spotlight)
  const spotlightRows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      kind: releases.kind,
      artistName: releases.artistName,
      coverUrl: releases.coverUrl,
      s3KeyCover: releases.s3KeyCover,
      publishedAt: releases.publishedAt,
    })
    .from(releases)
    .where(and(eq(releases.isPublic, true), eq(releases.isSpotlight, true)))
    .orderBy(desc(releases.publishedAt))
    .limit(1);

  let spotlight = null;
  if (spotlightRows.length > 0) {
    const release = spotlightRows[0];
    // Get the first track of the spotlight release for display
    const firstTrackRows = await db
      .select({
        trackId: releaseTracks.trackId,
        title: tracks.title,
        audioUrl: tracks.audioUrl,
        duration: tracks.duration,
        coverUrl: tracks.coverUrl,
        s3KeyCover: tracks.s3KeyCover,
        totalPlays: tracks.playCount,
      })
      .from(releaseTracks)
      .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
      .where(
        and(
          eq(releaseTracks.releaseId, release.id),
          eq(tracks.releaseStatus, "published")
        )
      )
      .orderBy(releaseTracks.position)
      .limit(1);

    if (firstTrackRows.length > 0) {
      const track = firstTrackRows[0];
      spotlight = {
        releaseId: release.id,
        releaseTitle: release.title,
        releaseType: release.type,
        releaseKind: release.kind,
        releaseArtistName: release.artistName,
        releaseCoverUrl: release.coverUrl,
        releaseS3KeyCover: release.s3KeyCover,
        releasePublishedAt: release.publishedAt?.toISOString() ?? null,
        trackId: track.trackId,
        trackTitle: track.title,
        trackAudioUrl: track.audioUrl,
        trackDuration: track.duration,
        trackCoverUrl: track.coverUrl,
        trackS3KeyCover: track.s3KeyCover,
        trackTotalPlays: track.totalPlays ?? 0,
      };
    }
  }

  return NextResponse.json({ published, trending, spotlight });
}
