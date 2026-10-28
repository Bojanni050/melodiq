import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { downloadFromS3, uploadToS3 } from "@/lib/s3";
import { transcodeToOgg } from "@/lib/transcode";
import { getBestSourceForOggConversion, type TrackAudioFields } from "@/lib/audio-format";
import { logToFile } from "@/lib/file-logger";

const LOG_FILE = "track-dna.log";
function log(message: string): void {
  console.info(message);
  logToFile(LOG_FILE, message);
}
function warn(message: string, error?: unknown): void {
  console.warn(message, error ?? "");
  logToFile(LOG_FILE, error ? `${message} ${error instanceof Error ? error.stack || error.message : String(error)}` : message);
}

export interface DnaAudioSource {
  audioBuffer: Buffer;
  format: "mp3" | "ogg";
  s3Key: string;
}

/**
 * Resolves the smallest available audio file for Track DNA analyses:
 *
 * 1. OGG Vorbis (s3KeyOgg, or format='ogg' on s3Key) — smallest
 * 2. MP3 (s3KeyMp3, or format='mp3' on s3Key)
 * 3. Nothing lossy available: transcode the best remaining source
 *    (WAV/FLAC/master) to Ogg Vorbis, upload it as the track's s3KeyOgg
 *    (so it persists for playback and future analyses) and return it
 *    in-memory. Original sources are never deleted or overwritten.
 *
 * Falls back to MP3 when the OGG download fails. Returns null when the
 * track has no usable audio at all. Never throws for the transcode/upload
 * path's side effects — the analysis can still proceed with the buffer.
 */
export async function resolveDnaAudioSource(
  tr: TrackAudioFields & { id: string }
): Promise<DnaAudioSource | null> {
  const oggKey = tr.s3KeyOgg || (tr.format === "ogg" && tr.s3Key ? tr.s3Key : null);
  if (oggKey) {
    try {
      const audioBuffer = await downloadFromS3(oggKey);
      log(`[dna-audio] track ${tr.id}: using ogg (${oggKey}, ${audioBuffer?.length ?? 0} bytes)`);
      return { audioBuffer, format: "ogg", s3Key: oggKey };
    } catch (error) {
      warn(`[dna-audio] track ${tr.id}: ogg download failed, falling back to mp3:`, error);
    }
  }

  const mp3Key = tr.s3KeyMp3 || (tr.format === "mp3" && tr.s3Key ? tr.s3Key : null);
  if (mp3Key) {
    const audioBuffer = await downloadFromS3(mp3Key);
    log(`[dna-audio] track ${tr.id}: using mp3 (${mp3Key}, ${audioBuffer?.length ?? 0} bytes)`);
    return { audioBuffer, format: "mp3", s3Key: mp3Key };
  }

  // No mp3/ogg available — create the ogg first, then hand it to the analysis.
  const source = getBestSourceForOggConversion(tr);
  if (!source?.s3Key) {
    warn(`[dna-audio] track ${tr.id}: no audio source available at all`);
    return null;
  }

  try {
    const sourceBuffer = await downloadFromS3(source.s3Key);
    const oggBuffer = await transcodeToOgg(sourceBuffer);
    const s3KeyOgg = `tracks/${tr.id}/audio.ogg`;
    log(`[dna-audio] track ${tr.id}: no mp3/ogg — transcoded ${source.s3Key} (${source.format}, ${sourceBuffer?.length ?? 0} bytes) to ogg (${oggBuffer?.length ?? 0} bytes)`);

    // Persist the transcode so playback and later analyses reuse it
    // (best-effort: a failed upload still lets the analysis continue).
    try {
      await uploadToS3(s3KeyOgg, oggBuffer, "audio/ogg");
      await db.update(tracks).set({ s3KeyOgg }).where(eq(tracks.id, tr.id));
      log(`[dna-audio] track ${tr.id}: uploaded ogg as ${s3KeyOgg} and stored it in s3KeyOgg`);
    } catch (error) {
      warn(`[dna-audio] track ${tr.id}: ogg upload/persist failed (analysis continues with in-memory buffer):`, error);
    }

    return { audioBuffer: oggBuffer, format: "ogg", s3Key: s3KeyOgg };
  } catch (error) {
    warn(`[dna-audio] track ${tr.id}: ogg transcode failed for source ${source.s3Key}:`, error);
    return null;
  }
}
