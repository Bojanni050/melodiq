import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { releases, releaseTracks, tracks, users } from "@/db/schema";

export const dynamic = "force-dynamic";

// Public, no auth: every published (isPublic) release, for the Discover
// Releases browse grid. Mirrors /api/discover/playlists.
export async function GET() {
  const rows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      kind: releases.kind,
      artistName: releases.artistName,
      publishedAt: releases.publishedAt,
      ownerArtistAlias: users.artistAlias,
      ownerName: users.name,
      trackCount: sql<number>`count(distinct ${releaseTracks.id})::int`,
      totalDuration: sql<number>`coalesce(sum(distinct ${tracks.duration}), 0)::int`,
      hasCover: sql<boolean>`(${releases.s3KeyCover} is not null) or bool_or(${tracks.s3KeyCover} is not null)`,
    })
    .from(releases)
    .leftJoin(users, eq(users.id, releases.userId))
    .leftJoin(releaseTracks, eq(releaseTracks.releaseId, releases.id))
    .leftJoin(tracks, eq(tracks.id, releaseTracks.trackId))
    .where(eq(releases.isPublic, true))
    .groupBy(
      releases.id,
      releases.title,
      releases.type,
      releases.kind,
      releases.artistName,
      releases.publishedAt,
      releases.s3KeyCover,
      users.artistAlias,
      users.name
    )
    .orderBy(desc(releases.publishedAt));

  return NextResponse.json({
    releases: rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      kind: row.kind,
      artistName: row.artistName || row.ownerArtistAlias || row.ownerName || "Unknown Artist",
      publishedAt: row.publishedAt,
      trackCount: row.trackCount,
      totalDuration: row.totalDuration,
      coverUrl: row.hasCover ? `/api/discover/releases/${row.id}/cover` : null,
    })),
  });
}
