import { db } from "@/db";
import { tracks } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { detectLanguageFromLyrics } from "@/lib/providers/llm";

/**
 * Fire-and-forget: detects the track's language from its lyrics and saves it,
 * but only if the track doesn't already have one. Safe to call redundantly
 * from multiple finalization paths — the DB write is guarded by `language IS NULL`.
 */
export async function detectAndSaveLanguageIfMissing(track: {
  id: string;
  language?: string | null;
  lyrics?: string | null;
  instrumental?: boolean | null;
}): Promise<void> {
  if (track.language || track.instrumental || !track.lyrics?.trim()) return;

  try {
    const detected = await detectLanguageFromLyrics(track.lyrics);
    if (!detected) return;

    await db
      .update(tracks)
      .set({ language: detected })
      .where(and(eq(tracks.id, track.id), isNull(tracks.language)));
  } catch (error) {
    console.error(`[language-detect] failed for track ${track.id}:`, error);
  }
}
