import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlistTracks, playlists, tracks } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      trackCount: sql<number>`count(distinct ${playlistTracks.id})::int`,
      hasCover: sql<boolean>`(${playlists.s3KeyCover} is not null) or bool_or(${tracks.s3KeyCover} is not null)`,
    })
    .from(playlists)
    .leftJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
    .leftJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .where(and(eq(playlists.isPublic, true), eq(playlists.isSystem, false)))
    .groupBy(playlists.id, playlists.name, playlists.description, playlists.publishedAt, playlists.s3KeyCover)
    .orderBy(desc(playlists.publishedAt));

  return NextResponse.json({
    playlists: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      trackCount: row.trackCount,
      coverUrl: row.hasCover ? `/api/discover/playlists/${row.id}/cover` : null,
    })),
  });
}
