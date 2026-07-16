import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { songs, tracks } from "@/db/schema";

export type SongWithTrackVersions = typeof songs.$inferSelect & {
  trackVersions: (typeof tracks.$inferSelect)[];
};

export async function getUserSongsWithTrackVersions(
  userId: string,
  options?: { workspaceId?: string }
): Promise<SongWithTrackVersions[]> {
  const songRows = await db
    .select()
    .from(songs)
    .where(
      options?.workspaceId
        ? and(eq(songs.userId, userId), eq(songs.workspaceId, options.workspaceId))
        : eq(songs.userId, userId)
    )
    .orderBy(desc(songs.createdAt));

  if (songRows.length === 0) return [];

  const songIds = songRows.map((song) => song.id);
  const trackRows = await db
    .select()
    .from(tracks)
    .where(inArray(tracks.songId, songIds))
    .orderBy(asc(tracks.createdAt));

  const trackVersionsBySongId = new Map<string, (typeof tracks.$inferSelect)[]>();
  for (const track of trackRows) {
    if (!track.songId) continue;
    const list = trackVersionsBySongId.get(track.songId) ?? [];
    list.push(track);
    trackVersionsBySongId.set(track.songId, list);
  }

  return songRows.map((song) => ({
    ...song,
    trackVersions: trackVersionsBySongId.get(song.id) ?? [],
  }));
}

export async function getUserSongWithTrackVersions(
  userId: string,
  songId: string
): Promise<SongWithTrackVersions | null> {
  const [song] = await db
    .select()
    .from(songs)
    .where(and(eq(songs.id, songId), eq(songs.userId, userId)))
    .limit(1);

  if (!song) return null;

  const trackVersions = await db
    .select()
    .from(tracks)
    .where(eq(tracks.songId, songId))
    .orderBy(asc(tracks.createdAt));

  return { ...song, trackVersions };
}
