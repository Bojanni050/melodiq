import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { scoreCompositionQuality, scoreLyricsQuality } from "@/lib/providers/llm";
import { downloadFromS3 } from "@/lib/s3";
import type { AudioDna } from "@/lib/songs";

/**
 * On-demand Track DNA analysis — same signals as the automatic Track DNA
 * computation (audio-dna.ts), but callable for a single already-finished
 * track instead of only running once at generation time. Used by the manual
 * "Analyze Composition" track action and by the Master Tracks link flow
 * (analyze automatically the moment a track is linked as a master track).
 *
 * Never throws — a failing sub-analysis just leaves that field untouched, so
 * callers can safely fire this without awaiting.
 */
export async function analyzeTrackDna(
  trackId: string,
  opts: { includeLyricsIfMissing?: boolean } = {}
): Promise<AudioDna | null> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track || track.status !== "done" || !track.s3Key) return null;

  const existing: Partial<AudioDna> = track.audioDna ? JSON.parse(track.audioDna) : {};
  const needsLyrics =
    !!opts.includeLyricsIfMissing &&
    existing.lyricsScore == null &&
    !track.instrumental &&
    !!track.lyrics?.trim();

  try {
    const audioBuffer = await downloadFromS3(track.s3Key);

    const [composition, lyrics] = await Promise.all([
      scoreCompositionQuality(audioBuffer, track.format || "mp3").catch((error) => {
        console.warn(`[track-dna-analysis] composition scoring failed for track ${trackId}:`, error);
        return null;
      }),
      needsLyrics
        ? scoreLyricsQuality(track.lyrics!).catch((error) => {
            console.warn(`[track-dna-analysis] lyrics scoring failed for track ${trackId}:`, error);
            return null;
          })
        : Promise.resolve(null),
    ]);

    if (!composition && !lyrics) return null;

    const audioDna: AudioDna = {
      tempo: existing.tempo ?? null,
      key: existing.key ?? null,
      energy: existing.energy ?? null,
      loudness: existing.loudness ?? null,
      atmosphereTags: existing.atmosphereTags ?? null,
      lyricsScore: lyrics?.score ?? existing.lyricsScore ?? null,
      lyricsNotes: lyrics?.notes ?? existing.lyricsNotes ?? null,
      compositionScore: composition?.score ?? existing.compositionScore ?? null,
      compositionNotes: composition?.notes ?? existing.compositionNotes ?? null,
      computedAt: new Date().toISOString(),
    };

    await db.update(tracks).set({ audioDna: JSON.stringify(audioDna) }).where(eq(tracks.id, trackId));
    return audioDna;
  } catch (error) {
    console.error(`[track-dna-analysis] failed for track ${trackId}:`, error);
    return null;
  }
}
