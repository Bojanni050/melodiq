import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { playlistTracks, playlists } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      trackCount: sql<number>`count(${playlistTracks.id})::int`,
    })
    .from(playlists)
    .leftJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
    .where(and(eq(playlists.isPublic, true), eq(playlists.isSystem, false)))
    .groupBy(playlists.id, playlists.name, playlists.description, playlists.publishedAt)
    .orderBy(desc(playlists.publishedAt));

  return NextResponse.json({ playlists: rows });
}
