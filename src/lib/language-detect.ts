import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { detectLyricsLanguage } from "@/lib/detect-lyrics-language";

/**
 * Fire-and-forget: detects the track's language from its lyrics and saves it,
 * but only if the track doesn't already have one. Safe to call redundantly
 * from multiple finalization paths — the DB write is guarded by `language IS NULL`.
 *
 * This used to call the LLM (detectLanguageFromLyrics). It is local now, which
 * matters for two reasons. The feature was effectively dead before: detection
 * only ever ran from the playback hook, so a library you generate but never play
 * kept a NULL language column and Smart Archive's language signal did nothing
 * for those tracks. And an LLM call per track is a network round trip and an
 * API bill for something a 272 KB library does offline in microseconds.
 *
 * Runs on every finalization path (upload, every provider webhook, sync), so the
 * column is now filled as the library is built instead of as it is played.
 */
export async function detectAndSaveLanguageIfMissing(track: {
  id: string;
  language?: string | null;
  lyrics?: string | null;
  instrumental?: boolean | null;
}): Promise<void> {
  if (track.language || track.instrumental || !track.lyrics?.trim()) return;

  try {
    const detected = detectLyricsLanguage(track.lyrics);
    if (!detected) return;

    await db
      .update(tracks)
      .set({ language: detected })
      .where(and(eq(tracks.id, track.id), isNull(tracks.language)));
  } catch (error) {
    console.error(`[language-detect] failed for track ${track.id}:`, error);
  }
}
