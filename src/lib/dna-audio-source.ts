import { downloadFromS3 } from "@/lib/s3";
import { transcodeToMp3 } from "@/lib/transcode";
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
  format: "mp3";
  s3Key: string;
}

/**
 * Resolves the audio sent to Track DNA analyses.
 *
 * Always hands the analysis an MP3: the best available source
 * (WAV/FLAC → OGG/MP3 → fallback) is downloaded and, unless it is already
 * an MP3, transcoded to MP3 (192kbps) in-memory. Nothing is uploaded to
 * S3 or written to disk — the buffer lives only for the duration of the
 * analysis, so there is nothing to clean up afterwards. Original sources
 * on S3 are never touched.
 *
 * Returns null when the track has no usable audio at all, or when the
 * transcode fails.
 */
export async function resolveDnaAudioSource(
  tr: TrackAudioFields & { id: string }
): Promise<DnaAudioSource | null> {
  // Best quality source first (WAV/FLAC/MP3); fall back to an OGG when the
  // track only has OGG audio (getBestSourceForOggConversion skips pure-OGG tracks).
  const source =
    getBestSourceForOggConversion(tr) ??
    (tr.s3KeyOgg
      ? { s3Key: tr.s3KeyOgg, format: "ogg" }
      : tr.format === "ogg" && tr.s3Key
        ? { s3Key: tr.s3Key, format: "ogg" }
        : null);

  if (!source?.s3Key) {
    warn(`[dna-audio] track ${tr.id}: no audio source available at all`);
    return null;
  }

  const sourceBuffer = await downloadFromS3(source.s3Key);
  if (!sourceBuffer?.length) {
    warn(`[dna-audio] track ${tr.id}: download of ${source.s3Key} returned no audio`);
    return null;
  }

  // Already MP3 — send it as-is, no needless re-encode (that would only
  // add generational loss). This satisfies "always send MP3" directly.
  if (source.format === "mp3") {
    log(`[dna-audio] track ${tr.id}: using mp3 as-is (${source.s3Key}, ${sourceBuffer.length} bytes)`);
    return { audioBuffer: sourceBuffer, format: "mp3", s3Key: source.s3Key };
  }

  try {
    const mp3Buffer = await transcodeToMp3(sourceBuffer);
    log(
      `[dna-audio] track ${tr.id}: transcoded ${source.format} (${source.s3Key}, ${sourceBuffer.length} bytes) to mp3 in-memory (${mp3Buffer.length} bytes); not persisted`
    );
    return { audioBuffer: mp3Buffer, format: "mp3", s3Key: source.s3Key };
  } catch (error) {
    warn(`[dna-audio] track ${tr.id}: mp3 transcode failed for source ${source.s3Key}:`, error);
    return null;
  }
}
