import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { playlistTracks, playlists, tracks, users } from "@/db/schema";
import { prefixCdn } from "@/lib/cdn";
import { getCdnUrl } from "@/lib/cdn-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [playlist] = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      publishedAt: playlists.publishedAt,
      userId: playlists.userId,
      artistName: users.artistAlias,
      artistFallback: users.name,
    })
    .from(playlists)
    .leftJoin(users, eq(users.id, playlists.userId))
    .where(and(eq(playlists.id, id), eq(playlists.isPublic, true), eq(playlists.isSystem, false)))
    .limit(1);

  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  const playlistTracksRows = await db
    .select({
      trackId: playlistTracks.trackId,
      position: playlistTracks.position,
      title: tracks.title,
      coverUrl: tracks.coverUrl,
      s3KeyCover: tracks.s3KeyCover,
      duration: tracks.duration,
      playCount: tracks.playCount,
      othersPlayCount: tracks.othersPlayCount,
      lyricsTimestamps: tracks.lyricsTimestamps,
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .where(eq(playlistTracks.playlistId, id))
    .orderBy(asc(playlistTracks.position));

  const cdnUrl = await getCdnUrl();
  const serialized = playlistTracksRows.map((row) => ({
    id: row.trackId,
    title: row.title || "Untitled",
    coverUrl: row.coverUrl?.startsWith("/api/tracks/")
      ? prefixCdn(cdnUrl, row.coverUrl.replace("/api/tracks/", "/api/discover/"))
      : row.coverUrl,
    hasCoverProxy: !row.coverUrl && !!row.s3KeyCover,
    duration: row.duration,
    totalPlays: (row.playCount ?? 0) + (row.othersPlayCount ?? 0),
    lyricsTimestamps: row.lyricsTimestamps || null,
  }));

  return NextResponse.json({
    playlist: {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      artistName: playlist.artistName || playlist.artistFallback || "Unknown Artist",
      publishedAt: playlist.publishedAt,
      tracks: serialized,
    },
  });
}
