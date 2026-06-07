import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";

export type PlaylistPayload = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
};

export async function getUserPlaylistsWithTrackIds(userId: string): Promise<PlaylistPayload[]> {
  const playlistRows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      createdAt: playlists.createdAt,
    })
    .from(playlists)
    .where(eq(playlists.userId, userId))
    .orderBy(asc(playlists.createdAt));

  if (playlistRows.length === 0) return [];

  const playlistIds = playlistRows.map((row) => row.id);
  const playlistTrackRows = await db
    .select({
      playlistId: playlistTracks.playlistId,
      trackId: playlistTracks.trackId,
      position: playlistTracks.position,
    })
    .from(playlistTracks)
    .where(inArray(playlistTracks.playlistId, playlistIds))
    .orderBy(asc(playlistTracks.playlistId), asc(playlistTracks.position));

  const tracksByPlaylistId = new Map<string, string[]>();
  playlistTrackRows.forEach((row) => {
    const list = tracksByPlaylistId.get(row.playlistId) ?? [];
    list.push(row.trackId);
    tracksByPlaylistId.set(row.playlistId, list);
  });

  return playlistRows.map((row) => ({
    id: row.id,
    name: row.name,
    trackIds: tracksByPlaylistId.get(row.id) ?? [],
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getUserPlaylistById(userId: string, playlistId: string) {
  const rows = await db
    .select({
      id: playlists.id,
      userId: playlists.userId,
      name: playlists.name,
      createdAt: playlists.createdAt,
    })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.id, playlistId)))
    .limit(1);

  return rows[0] ?? null;
}
