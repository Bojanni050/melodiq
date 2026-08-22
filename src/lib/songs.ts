import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { tracks, users } from "@/db/schema";
import { prefixCdn } from "@/lib/cdn";
import { getCdnUrl } from "@/lib/cdn-server";

export type PublicTrackSummary = {
  id: string;
  title: string;
  artistName: string | null;
  artistId: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean;
  publishDate: string | null;
  lyrics: string | null;
  lyricsTimestamps: string | null;
  composerName: string | null;
  writerName: string | null;
};

function toPublicTrackSummary(
  track: typeof tracks.$inferSelect,
  ownerById: Map<string, { id: string; artistAlias: string | null; name: string | null }>,
  cdnUrl: string
): PublicTrackSummary {
  const owner = ownerById.get(track.userId);
  return {
    id: track.id,
    title: track.title || "Untitled",
    artistName: track.artistName || owner?.artistAlias || owner?.name || null,
    artistId: owner?.id || track.userId,
    coverUrl: track.coverUrl?.startsWith("/api/tracks/")
      ? prefixCdn(cdnUrl, track.coverUrl.replace("/api/tracks/", "/api/discover/"))
      : track.coverUrl || null,
    hasCoverProxy: Boolean(!track.coverUrl && track.s3KeyCover),
    duration: track.duration,
    totalPlays: track.playCount + track.othersPlayCount,
    instrumental: track.instrumental,
    publishDate: track.publishDate ? track.publishDate.toISOString() : null,
    lyrics: track.lyrics || null,
    lyricsTimestamps: track.lyricsTimestamps || null,
    composerName: track.composerName || null,
    writerName: track.writerName || null,
  };
}

// Public, cross-user: every individually published track. Includes lyrics
// (normal + time-coded) so listeners can view them read-only; never includes
// prompt/trackDna — those stay private.
export async function getPublishedTracksFeed(limit = 50): Promise<PublicTrackSummary[]> {
  const rows = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.releaseStatus, "published"), eq(tracks.status, "done"), isNull(tracks.deletedAt), isNull(tracks.archivedAt)))
    .orderBy(desc(tracks.publishDate))
    .limit(limit);

  if (rows.length === 0) return [];

  const ownerIds = Array.from(new Set(rows.map((r) => r.userId)));
  const [owners, cdnUrl] = await Promise.all([
    db
      .select({ id: users.id, artistAlias: users.artistAlias, name: users.name })
      .from(users)
      .where(inArray(users.id, ownerIds)),
    getCdnUrl(),
  ]);
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return rows.map((track) => toPublicTrackSummary(track, ownerById, cdnUrl));
}

// Public, no auth: the gate for every discover media/vote route. Re-verifies
// a track is still published on every call — never trusts a client-supplied
// id alone.
export async function getPublishedTrackById(trackId: string) {
  const [track] = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.id, trackId),
        eq(tracks.releaseStatus, "published"),
        eq(tracks.status, "done"),
        isNull(tracks.deletedAt),
        isNull(tracks.archivedAt)
      )
    )
    .limit(1);

  return track ?? null;
}

// Track DNA access for the app's own track rows (Library/Workspaces pages):
// the owner can always see/vote on their own track regardless of publish
// status; everyone else falls back to the public published-only gate above.
// Never trusts a client-supplied ownership claim — re-checks tracks.userId
// against the caller's session on every call.
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
  compositionScore: number | null;
  compositionNotes: string | null;
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
