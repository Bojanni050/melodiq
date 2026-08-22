import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";

export type PlaylistPayload = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  trackIds: string[];
  isSystem: boolean;
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
};

export async function getUserPlaylistsWithTrackIds(userId: string): Promise<PlaylistPayload[]> {
  const playlistRows = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      s3KeyCover: playlists.s3KeyCover,
      isSystem: playlists.isSystem,
      isPublic: playlists.isPublic,
      publishedAt: playlists.publishedAt,
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
    description: row.description ?? null,
    coverUrl: row.s3KeyCover ? `/api/playlists/${row.id}/cover` : null,
    trackIds: tracksByPlaylistId.get(row.id) ?? [],
    isSystem: row.isSystem,
    isPublic: row.isPublic,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getUserPlaylistById(userId: string, playlistId: string) {
  const rows = await db
    .select({
      id: playlists.id,
      userId: playlists.userId,
      name: playlists.name,
      description: playlists.description,
      isSystem: playlists.isSystem,
      isPublic: playlists.isPublic,
      createdAt: playlists.createdAt,
    })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.id, playlistId)))
    .limit(1);

  return rows[0] ?? null;
}

const MASTER_TRACKS_PLAYLIST_NAME = "Master Tracks";

/**
 * Find-or-create the user's system-managed "Master Tracks" playlist —
 * private (unpublished) by default, never deletable/renamable, and its
 * tracks can only be reordered, never added/removed by hand. See the
 * isSystem guards in /api/playlists/[id] and /api/playlists.
 */
export async function ensureMasterTracksPlaylist(userId: string): Promise<{ id: string }> {
  const existing = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.name, MASTER_TRACKS_PLAYLIST_NAME)))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(playlists)
    .values({ userId, name: MASTER_TRACKS_PLAYLIST_NAME, isSystem: true })
    .onConflictDoNothing({ target: [playlists.userId, playlists.name] })
    .returning({ id: playlists.id });
  if (inserted[0]) return inserted[0];

  // Lost the create race to a concurrent request — read back what it made.
  const [row] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.name, MASTER_TRACKS_PLAYLIST_NAME)))
    .limit(1);
  return row;
}

/**
 * Adds a track to the user's Master Tracks playlist if it isn't already
 * there. Tracks are never removed from this playlist automatically either
 * — even if later unlinked from Master Tracks in the archive, they stay as
 * a historical record (matches the "tracks can't be deleted" rule).
 */
export async function addTrackToMasterTracksPlaylist(userId: string, trackId: string): Promise<void> {
  const { id: playlistId } = await ensureMasterTracksPlaylist(userId);

  const already = await db
    .select({ id: playlistTracks.id })
    .from(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId)))
    .limit(1);
  if (already[0]) return;

  const maxPos = await db
    .select({ value: sql<number>`coalesce(max(${playlistTracks.position}), -1)` })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId));
  const nextPosition = Number(maxPos[0]?.value ?? -1) + 1;

  await db.insert(playlistTracks).values({ playlistId, trackId, position: nextPosition });
}

const FAVORITES_PLAYLIST_NAME = "Favorieten";

/**
 * Find-or-create the user's system-managed "Favorieten" playlist — private
 * (unpublished) by default, never deletable/renamable, and its tracks can
 * only be reordered, never added/removed by hand (same isSystem guards as
 * Master Tracks). Membership is instead driven entirely by a track's
 * `rating` — see addTrackToFavoritesPlaylist / removeTrackFromFavoritesPlaylist.
 */
export async function ensureFavoritesPlaylist(userId: string): Promise<{ id: string }> {
  const existing = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.name, FAVORITES_PLAYLIST_NAME)))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(playlists)
    .values({ userId, name: FAVORITES_PLAYLIST_NAME, isSystem: true })
    .onConflictDoNothing({ target: [playlists.userId, playlists.name] })
    .returning({ id: playlists.id });
  if (inserted[0]) return inserted[0];

  // Lost the create race to a concurrent request — read back what it made.
  const [row] = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.name, FAVORITES_PLAYLIST_NAME)))
    .limit(1);
  return row;
}

/** Adds a track to the user's Favorieten playlist if it isn't already there. */
export async function addTrackToFavoritesPlaylist(userId: string, trackId: string): Promise<void> {
  const { id: playlistId } = await ensureFavoritesPlaylist(userId);

  const already = await db
    .select({ id: playlistTracks.id })
    .from(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId)))
    .limit(1);
  if (already[0]) return;

  const maxPos = await db
    .select({ value: sql<number>`coalesce(max(${playlistTracks.position}), -1)` })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId));
  const nextPosition = Number(maxPos[0]?.value ?? -1) + 1;

  await db.insert(playlistTracks).values({ playlistId, trackId, position: nextPosition });
}

/** Removes a track from the user's Favorieten playlist, e.g. when un-favorited. */
export async function removeTrackFromFavoritesPlaylist(userId: string, trackId: string): Promise<void> {
  const { id: playlistId } = await ensureFavoritesPlaylist(userId);
  await db
    .delete(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId)));
}
