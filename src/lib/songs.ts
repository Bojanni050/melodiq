import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { songs, tracks, users, workspaces } from "@/db/schema";
import { ensureDefaultWorkspaceForUser } from "@/lib/workspaces";

export type SongWithTrackVersions = typeof songs.$inferSelect & {
  trackVersions: (typeof tracks.$inferSelect)[];
};

export type SongWithTrackIds = {
  id: string;
  title: string | null;
  workspaceId: string;
  folderGradient?: string;
  trackIds: string[];
  createdAt: string;
  releaseStatus: string;
  publishDate: string | null;
};

export async function getUserSongsWithTrackIds(userId: string): Promise<SongWithTrackIds[]> {
  const defaultWorkspace = await ensureDefaultWorkspaceForUser(userId);

  const [workspaceRows, songRows] = await Promise.all([
    db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.userId, userId)),
    db.select().from(songs).where(eq(songs.userId, userId)).orderBy(desc(songs.createdAt)),
  ]);

  if (songRows.length === 0) return [];

  const workspaceIds = new Set(workspaceRows.map((workspace) => workspace.id));

  const songIds = songRows.map((song) => song.id);
  const trackRows = await db
    .select({ id: tracks.id, songId: tracks.songId })
    .from(tracks)
    .where(inArray(tracks.songId, songIds));

  const trackIdsBySongId = new Map<string, string[]>();
  for (const track of trackRows) {
    if (!track.songId) continue;
    const list = trackIdsBySongId.get(track.songId) ?? [];
    list.push(track.id);
    trackIdsBySongId.set(track.songId, list);
  }

  return songRows.map((song) => ({
    id: song.id,
    title: song.title,
    workspaceId:
      song.workspaceId && workspaceIds.has(song.workspaceId) ? song.workspaceId : defaultWorkspace.id,
    folderGradient: song.folderGradient || undefined,
    trackIds: trackIdsBySongId.get(song.id) ?? [],
    createdAt: song.createdAt.toISOString(),
    releaseStatus: song.releaseStatus,
    publishDate: song.publishDate ? song.publishDate.toISOString() : null,
  }));
}

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

export type PublicSongSummary = {
  id: string;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  publishDate: string | null;
};

// Picks the track version a public listener actually hears for a published
// song: prefer a version that's itself published, otherwise the earliest
// finished, non-deleted version. Only ever called for songs already
// confirmed to have releaseStatus === "published" by the caller.
function pickRepresentativeTrack(versions: (typeof tracks.$inferSelect)[]) {
  return versions.find((t) => t.releaseStatus === "published") ?? versions[0];
}

async function getPlayableVersionsBySongId(songIds: string[]) {
  if (songIds.length === 0) return new Map<string, (typeof tracks.$inferSelect)[]>();

  const trackRows = await db
    .select()
    .from(tracks)
    .where(and(inArray(tracks.songId, songIds), eq(tracks.status, "done"), isNull(tracks.deletedAt)))
    .orderBy(asc(tracks.createdAt));

  const bySongId = new Map<string, (typeof tracks.$inferSelect)[]>();
  for (const track of trackRows) {
    if (!track.songId) continue;
    const list = bySongId.get(track.songId) ?? [];
    list.push(track);
    bySongId.set(track.songId, list);
  }
  return bySongId;
}

// Public, cross-user: every published song with at least one playable track
// version. Never includes lyrics/prompt/notes/songDna — those stay private.
export async function getPublishedSongsFeed(limit = 50): Promise<PublicSongSummary[]> {
  const publishedSongs = await db
    .select()
    .from(songs)
    .where(eq(songs.releaseStatus, "published"))
    .orderBy(desc(songs.publishDate));

  if (publishedSongs.length === 0) return [];

  const songIds = publishedSongs.map((s) => s.id);
  const versionsBySongId = await getPlayableVersionsBySongId(songIds);

  const ownerIds = Array.from(new Set(publishedSongs.map((s) => s.userId)));
  const owners = ownerIds.length
    ? await db
        .select({ id: users.id, artistAlias: users.artistAlias, name: users.name })
        .from(users)
        .where(inArray(users.id, ownerIds))
    : [];
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  const results: PublicSongSummary[] = [];

  for (const song of publishedSongs) {
    const versions = versionsBySongId.get(song.id) ?? [];
    if (versions.length === 0) continue;

    const representative = pickRepresentativeTrack(versions);
    const totalPlays = versions.reduce((sum, t) => sum + (t.playCount ?? 0), 0);
    const owner = ownerById.get(song.userId);
    const artistName = representative.artistName || owner?.artistAlias || owner?.name || null;

    results.push({
      id: song.id,
      title: song.title || "Untitled",
      artistName,
      coverUrl: representative.coverUrl || null,
      hasCoverProxy: Boolean(!representative.coverUrl && representative.s3KeyCover),
      duration: representative.duration,
      totalPlays,
      publishDate: song.publishDate ? song.publishDate.toISOString() : null,
    });

    if (results.length >= limit) break;
  }

  return results;
}

// Returns the representative playable track for a song, but ONLY if the
// song is currently published — used to gate the public stream/cover routes.
export async function getPublishedSongPlayableTrack(songId: string) {
  const [song] = await db
    .select({ id: songs.id, releaseStatus: songs.releaseStatus })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  if (!song || song.releaseStatus !== "published") return null;

  const versionsBySongId = await getPlayableVersionsBySongId([songId]);
  const versions = versionsBySongId.get(songId) ?? [];
  if (versions.length === 0) return null;

  return pickRepresentativeTrack(versions);
}
