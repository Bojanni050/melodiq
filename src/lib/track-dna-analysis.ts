import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { scoreLyricsQuality } from "@/lib/providers/llm";
import { extractAudioFeatures } from "@/lib/audio-features";
import { downloadFromS3 } from "@/lib/s3";
import { logToFile } from "@/lib/file-logger";
import type { AudioDna } from "@/lib/songs";

const LOG_FILE = "track-dna.log";
function log(message: string): void {
  console.info(message);
  logToFile(LOG_FILE, message);
}
function warn(message: string, error?: unknown): void {
  console.warn(message, error ?? "");
  logToFile(LOG_FILE, error ? `${message} ${error instanceof Error ? error.stack || error.message : String(error)}` : message);
}

/**
 * On-demand lyrics scoring for a single already-finished track, backfilling
 * the "Lyrics" Track DNA signal when it's missing. Used by the Master Tracks
 * link flow (analyze automatically the moment a track is linked as a master
 * track). Composition/arrangement critique now lives entirely in "Advanced
 * Track DNA" (advanced-dna-analysis.ts), so it's not part of this anymore.
 *
 * Never throws — a failing sub-analysis just leaves that field untouched, so
 * callers can safely fire this without awaiting.
 */
export async function analyzeTrackDna(
  trackId: string,
  opts: { includeLyricsIfMissing?: boolean } = {}
): Promise<AudioDna | null> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track || track.status !== "done") return null;

  const existing: Partial<AudioDna> = track.audioDna ? JSON.parse(track.audioDna) : {};
  const needsLyrics =
    !!opts.includeLyricsIfMissing &&
    existing.lyricsScore == null &&
    !track.instrumental &&
    !!track.lyrics?.trim();

  if (!needsLyrics) return null;

  try {
    const lyrics = await scoreLyricsQuality(track.lyrics!).catch((error) => {
      warn(`[track-dna-analysis] lyrics scoring failed for track ${trackId}:`, error);
      return null;
    });

    log(`[track-dna-analysis] track ${trackId}: lyrics=${lyrics ? JSON.stringify(lyrics) : "null"}`);

    if (!lyrics) return null;

    const audioDna: AudioDna = {
      tempo: existing.tempo ?? null,
      key: existing.key ?? null,
      energy: existing.energy ?? null,
      loudness: existing.loudness ?? null,
      atmosphereTags: existing.atmosphereTags ?? null,
      lyricsScore: lyrics.score,
      lyricsNotes: lyrics.notes,
      compositionScore: existing.compositionScore ?? null,
      compositionNotes: existing.compositionNotes ?? null,
      computedAt: new Date().toISOString(),
    };

    await db.update(tracks).set({ audioDna: JSON.stringify(audioDna) }).where(eq(tracks.id, trackId));
    return audioDna;
  } catch (error) {
    warn(`[track-dna-analysis] failed for track ${trackId}:`, error);
    return null;
  }
}

/**
 * Re-runs just the DSP-derived signals (tempo/key/energy/loudness) for a
 * single already-finished track, keeping every other Track DNA field
 * untouched. Exists to backfill/repair tracks whose original extraction
 * silently failed (e.g. the ffmpeg-static/Alpine incompatibility) without
 * re-running the paid LLM composition/lyrics analysis.
 */
export async function reanalyzeAudioFeatures(trackId: string): Promise<AudioDna | null> {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track || track.status !== "done" || !track.s3Key) return null;

  const existing: Partial<AudioDna> = track.audioDna ? JSON.parse(track.audioDna) : {};

  try {
    const audioBuffer = await downloadFromS3(track.s3Key);
    const features = await extractAudioFeatures(audioBuffer);
    if (!features) return null;

    const audioDna: AudioDna = {
      tempo: features.tempo ?? existing.tempo ?? null,
      key: features.key ?? existing.key ?? null,
      energy: features.energy ?? existing.energy ?? null,
      loudness: features.loudness ?? existing.loudness ?? null,
      atmosphereTags: existing.atmosphereTags ?? null,
      lyricsScore: existing.lyricsScore ?? null,
      lyricsNotes: existing.lyricsNotes ?? null,
      compositionScore: existing.compositionScore ?? null,
      compositionNotes: existing.compositionNotes ?? null,
      computedAt: new Date().toISOString(),
    };

    await db.update(tracks).set({ audioDna: JSON.stringify(audioDna) }).where(eq(tracks.id, trackId));
    return audioDna;
  } catch (error) {
    console.error(`[track-dna-analysis] audio re-analysis failed for track ${trackId}:`, error);
    return null;
  }
}
