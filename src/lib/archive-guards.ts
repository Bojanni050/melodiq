import { db } from "@/db";
import { tracks, songArchive, playlistTracks } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

// A warning describes a condition the user should know about before archiving.
// It is deliberately NOT a hard block: archiving a published track, a Master
// Track or a playlist member is a legitimate choice — it just needs to be an
// informed one. All applicable warnings are collected (rather than stopping at
// the first hit) so the confirmation can show the full picture in one pass.
export type ArchiveWarning = {
  type: "published" | "master_track" | "in_playlist" | "not_found";
  detail: string;
};

export type ArchiveWarningResult = {
  /** True when the track does not exist (or is not owned by this user). */
  notFound: boolean;
  warnings: ArchiveWarning[];
};

/**
 * Collects everything worth warning about before a track is archived. Mirrors
 * the existing auth/IDOR pattern (id + userId on every read) so a client-supplied
 * id alone is never trusted.
 *
 * Note on consequences, surfaced in the warning texts:
 * - a published track is removed from its release(s) when archived
 * - a Master Track is the source of truth for a Song Archive entry's
 *   lyrics/prompt, so archiving it strips that entry of its origin
 */
export async function collectArchiveWarnings(
  trackId: string,
  userId: string
): Promise<ArchiveWarningResult> {
  const trackRows = await db
    .select({ releaseStatus: tracks.releaseStatus })
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));

  if (trackRows.length === 0) {
    return { notFound: true, warnings: [] };
  }

  const warnings: ArchiveWarning[] = [];

  if (trackRows[0].releaseStatus === "published") {
    warnings.push({
      type: "published",
      detail:
        "Deze track is gepubliceerd in een release. Bij archiveren wordt hij uit die release(s) gehaald en niet meer afspeelbaar voor luisteraars.",
    });
  }

  // Master Track = a Song Archive entry with no parent (top-level source of
  // truth for the song's lyrics/prompt). Translations are allowed to be
  // archived, but the original master track is worth warning about — see
  // songArchive schema.
  const masterRows = await db
    .select({ id: songArchive.id })
    .from(songArchive)
    .where(and(eq(songArchive.trackId, trackId), isNull(songArchive.parentId)));

  if (masterRows.length > 0) {
    warnings.push({
      type: "master_track",
      detail:
        "Deze track is een Master Track in Song Archive en de bron voor de lyrics/prompt van dat song-archiefitem.",
    });
  }

  const playlistRows = await db
    .select({ id: playlistTracks.id })
    .from(playlistTracks)
    .where(eq(playlistTracks.trackId, trackId));

  if (playlistRows.length > 0) {
    warnings.push({
      type: "in_playlist",
      detail: `Deze track staat in ${playlistRows.length} playlist${playlistRows.length === 1 ? "" : "s"}.`,
    });
  }

  return { notFound: false, warnings };
}
