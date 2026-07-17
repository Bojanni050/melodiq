import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { songs, trackDnaVotes, tracks, users, workspaces } from "@/db/schema";
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

export type PublicTrackSummary = {
  id: string;
  songId: string | null;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean;
  publishDate: string | null;
};

function toPublicTrackSummary(
  track: typeof tracks.$inferSelect,
  songPublishDate: Date | null,
  ownerById: Map<string, { artistAlias: string | null; name: string | null }>
): PublicTrackSummary {
  const owner = ownerById.get(track.userId);
  const publishDate = track.publishDate ?? songPublishDate;
  return {
    id: track.id,
    songId: track.songId,
    title: track.title || "Untitled",
    artistName: track.artistName || owner?.artistAlias || owner?.name || null,
    coverUrl: track.coverUrl || null,
    hasCoverProxy: Boolean(!track.coverUrl && track.s3KeyCover),
    duration: track.duration,
    totalPlays: track.playCount,
    instrumental: track.instrumental,
    publishDate: publishDate ? publishDate.toISOString() : null,
  };
}

// A track is publicly visible either because it's individually published, or
// because it belongs to a song that's published (publishing a song does not
// cascade releaseStatus down to its track rows — see api/songs/[id]/route.ts).
const PUBLIC_TRACK_CONDITION = or(eq(tracks.releaseStatus, "published"), eq(songs.releaseStatus, "published"));

// Public, cross-user: every published track version (individually, or via its
// song). Never includes lyrics/prompt/trackDna — those stay private.
export async function getPublishedTracksFeed(limit = 50): Promise<PublicTrackSummary[]> {
  const rows = await db
    .select({ track: tracks, songPublishDate: songs.publishDate })
    .from(tracks)
    .leftJoin(songs, eq(tracks.songId, songs.id))
    .where(and(PUBLIC_TRACK_CONDITION, eq(tracks.status, "done"), isNull(tracks.deletedAt)))
    .orderBy(desc(sql`coalesce(${tracks.publishDate}, ${songs.publishDate})`))
    .limit(limit);

  if (rows.length === 0) return [];

  const ownerIds = Array.from(new Set(rows.map((r) => r.track.userId)));
  const owners = await db
    .select({ id: users.id, artistAlias: users.artistAlias, name: users.name })
    .from(users)
    .where(inArray(users.id, ownerIds));
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return rows.map((r) => toPublicTrackSummary(r.track, r.songPublishDate, ownerById));
}

// Public, no auth: the gate for every discover media/vote route. Re-verifies
// a track is still published (individually, or via its song) on every call —
// never trusts a client-supplied id alone.
export async function getPublishedTrackById(trackId: string) {
  const [row] = await db
    .select({ track: tracks })
    .from(tracks)
    .leftJoin(songs, eq(tracks.songId, songs.id))
    .where(
      and(
        eq(tracks.id, trackId),
        PUBLIC_TRACK_CONDITION,
        eq(tracks.status, "done"),
        isNull(tracks.deletedAt)
      )
    )
    .limit(1);

  return row?.track ?? null;
}

// Track DNA access for the app's own track rows (Song/Library/Workspaces
// pages): the owner can always see/vote on their own track regardless of
// publish status; everyone else falls back to the public published-only
// gate above. Never trusts a client-supplied ownership claim — re-checks
// tracks.userId against the caller's session on every call.
export async function getTrackDnaAccess(trackId: string, viewerUserId: string | null) {
  if (viewerUserId) {
    const [owned] = await db
      .select()
      .from(tracks)
      .where(and(eq(tracks.id, trackId), eq(tracks.userId, viewerUserId)))
      .limit(1);
    if (owned) return owned;
  }

  return getPublishedTrackById(trackId);
}

export type TrackDnaCategory = "vocal" | "instrumental" | "atmosphere" | "lyrics";
export type TrackDnaStats = Record<TrackDnaCategory, { average: number | null; count: number }>;

export async function getTrackDnaStats(trackId: string): Promise<TrackDnaStats> {
  const [row] = await db
    .select({
      vocalAvg: sql<string | null>`avg(${trackDnaVotes.vocal})`,
      vocalCount: sql<number>`count(${trackDnaVotes.vocal})`,
      instrumentalAvg: sql<string | null>`avg(${trackDnaVotes.instrumental})`,
      instrumentalCount: sql<number>`count(${trackDnaVotes.instrumental})`,
      atmosphereAvg: sql<string | null>`avg(${trackDnaVotes.atmosphere})`,
      atmosphereCount: sql<number>`count(${trackDnaVotes.atmosphere})`,
      lyricsAvg: sql<string | null>`avg(${trackDnaVotes.lyrics})`,
      lyricsCount: sql<number>`count(${trackDnaVotes.lyrics})`,
    })
    .from(trackDnaVotes)
    .where(eq(trackDnaVotes.trackId, trackId));

  const toStat = (avg: string | null | undefined, count: number | undefined) => ({
    average: avg != null ? Math.round(Number(avg) * 10) / 10 : null,
    count: Number(count ?? 0),
  });

  return {
    vocal: toStat(row?.vocalAvg, row?.vocalCount),
    instrumental: toStat(row?.instrumentalAvg, row?.instrumentalCount),
    atmosphere: toStat(row?.atmosphereAvg, row?.atmosphereCount),
    lyrics: toStat(row?.lyricsAvg, row?.lyricsCount),
  };
}

export async function getUserTrackDnaVote(trackId: string, userId: string) {
  const [vote] = await db
    .select()
    .from(trackDnaVotes)
    .where(and(eq(trackDnaVotes.trackId, trackId), eq(trackDnaVotes.userId, userId)))
    .limit(1);
  return vote ?? null;
}

export async function upsertTrackDnaVote(
  trackId: string,
  userId: string,
  scores: { vocal: number; instrumental: number; atmosphere: number; lyrics: number | null }
) {
  const [vote] = await db
    .insert(trackDnaVotes)
    .values({ trackId, userId, ...scores })
    .onConflictDoUpdate({
      target: [trackDnaVotes.trackId, trackDnaVotes.userId],
      set: { ...scores, updatedAt: new Date() },
    })
    .returning();

  return vote;
}
