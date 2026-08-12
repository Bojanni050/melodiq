import { db } from "@/db";
import { tracks, songArchive, playlistTracks } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export type ArchiveGuardResult =
  | { blocked: false }
  | { blocked: true; reason: "published" | "master_track" | "in_playlist"; message: string };

/**
 * Pre-flight checks before a track can be archived. Stops at the first hit so
 * the caller gets a single, actionable reason. Mirrors the existing auth/IDOR
 * pattern (id + userId on every read) so a client-supplied id alone is never
 * trusted.
 */
export async function checkArchiveGuards(trackId: string, userId: string): Promise<ArchiveGuardResult> {
  const trackRows = await db
    .select({ releaseStatus: tracks.releaseStatus })
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));

  if (trackRows.length === 0) {
    return { blocked: true, reason: "published", message: "Track niet gevonden." };
  }

  if (trackRows[0].releaseStatus === "published") {
    return {
      blocked: true,
      reason: "published",
      message: "Track is gepubliceerd in een release en kan niet gearchiveerd worden.",
    };
  }

  // Master Track = a Song Archive entry with no parent (top-level source of
  // truth for the song's lyrics/prompt). Translations are allowed to be
  // archived, but the original master track is not — see songArchive schema.
  const masterRows = await db
    .select({ id: songArchive.id })
    .from(songArchive)
    .where(and(eq(songArchive.trackId, trackId), isNull(songArchive.parentId)));

  if (masterRows.length > 0) {
    return {
      blocked: true,
      reason: "master_track",
      message: "Track is een Master Track in Song Archive en kan niet gearchiveerd worden.",
    };
  }

  const playlistRows = await db
    .select({ id: playlistTracks.id })
    .from(playlistTracks)
    .where(eq(playlistTracks.trackId, trackId));

  if (playlistRows.length > 0) {
    return {
      blocked: true,
      reason: "in_playlist",
      message: "Track zit in een of meer playlists. Verwijder de track eerst uit alle playlists.",
    };
  }

  return { blocked: false };
}