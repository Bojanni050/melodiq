import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

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

// Bulk counterpart to getTrackDnaAccess: which of the given track ids the
// viewer may see DNA for (owns it, or it's published) — used to filter a
// batch request down before computing scores, never trusting the caller's
// id list alone.
export async function getAccessibleTrackIds(trackIds: string[], viewerUserId: string | null): Promise<Set<string>> {
  if (trackIds.length === 0) return new Set();

  const rows = await db
    .select({ id: tracks.id })
    .from(tracks)
    .leftJoin(songs, eq(tracks.songId, songs.id))
    .where(
      and(
        inArray(tracks.id, trackIds),
        eq(tracks.status, "done"),
        isNull(tracks.deletedAt),
        viewerUserId ? or(eq(tracks.userId, viewerUserId), PUBLIC_TRACK_CONDITION) : PUBLIC_TRACK_CONDITION
      )
    );

  return new Set(rows.map((r) => r.id));
}

// Auto-computed Track DNA, written once by the webhook handlers right after a
// track finishes rendering (see src/lib/audio-features.ts and the
// scoreLyricsQuality/extractAtmosphereTags helpers in providers/llm.ts).
// Replaces the old vote-based track_dna_votes table, which stays in the
// database untouched as a read-only archive but is no longer read or written.
export type AudioDna = {
  tempo: number | null;
  key: string | null;
  energy: number | null;
  loudness: number | null;
  atmosphereTags: string[] | null;
  lyricsScore: number | null;
  lyricsNotes: string | null;
  computedAt: string;
};

function parseAudioDna(raw: string | null): AudioDna | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AudioDna;
  } catch {
    return null;
  }
}

export async function getAudioDna(trackId: string): Promise<AudioDna | null> {
  const [row] = await db
    .select({ audioDna: tracks.audioDna })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  return parseAudioDna(row?.audioDna ?? null);
}

// Bulk counterpart to getAudioDna. Callers must pre-filter trackIds via
// getAccessibleTrackIds.
export async function getAudioDnaBulk(trackIds: string[]): Promise<Map<string, AudioDna | null>> {
  const result = new Map<string, AudioDna | null>(trackIds.map((id) => [id, null]));
  if (trackIds.length === 0) return result;

  const rows = await db
    .select({ id: tracks.id, audioDna: tracks.audioDna })
    .from(tracks)
    .where(inArray(tracks.id, trackIds));

  for (const row of rows) {
    result.set(row.id, parseAudioDna(row.audioDna));
  }

  return result;
}
