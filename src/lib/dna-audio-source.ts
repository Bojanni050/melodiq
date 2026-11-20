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

export interface DnaAudioSourceOptions {
  /**
   * Keep the returned MP3 at or under this many bytes. Only used for LLM
   * uploads: the provider rejects big requests with HTTP 413 long before the
   * audio itself is a problem (see LLM_AUDIO_MAX_BYTES), so long/high-bitrate
   * tracks are re-encoded smaller (mono, lower bitrate) before they go out.
   * Voice cloning deliberately does NOT pass this — it needs the full quality.
   */
  maxBytes?: number;
}

/**
 * The provider (hopscotch / Vertex) answers 413 once the JSON request body gets
 * too big, and base64 costs 4/3 of the audio bytes. Measured on production: a
 * 5.72 MB upload (≈7.6 MB body) succeeded, while 7.15 MB and 7.31 MB (≈9.5 MB
 * body) both came back 413 — so the ceiling sits somewhere around 8–10 MB.
 * 5 MB of audio keeps the body at ~6.7 MB, with room for the prompt and JSON.
 */
export const LLM_AUDIO_MAX_BYTES = 5 * 1024 * 1024;

/** Re-encode passes tried when the source MP3 is above the byte budget. */
const COMPACT_BITRATES = [96, 64, 48, 32];

/**
 * Resolves a track's audio as an in-memory MP3, for the server-side processors
 * that only speak MP3 — the Track DNA analyses and APIMart voice cloning.
 *
 * Always hands the caller an MP3: the best available source
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
  tr: TrackAudioFields & { id: string },
  options: DnaAudioSourceOptions = {}
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
  let mp3Buffer: Buffer;
  if (source.format === "mp3") {
    log(`[dna-audio] track ${tr.id}: using mp3 as-is (${source.s3Key}, ${sourceBuffer.length} bytes)`);
    mp3Buffer = sourceBuffer;
  } else {
    try {
      mp3Buffer = await transcodeToMp3(sourceBuffer);
      log(
        `[dna-audio] track ${tr.id}: transcoded ${source.format} (${source.s3Key}, ${sourceBuffer.length} bytes) to mp3 in-memory (${mp3Buffer.length} bytes); not persisted`
      );
    } catch (error) {
      warn(`[dna-audio] track ${tr.id}: mp3 transcode failed for source ${source.s3Key}:`, error);
      return null;
    }
  }

  const audioBuffer = await fitWithinByteBudget(mp3Buffer, sourceBuffer, tr.id, options.maxBytes);
  return { audioBuffer, format: "mp3", s3Key: source.s3Key };
}

/**
 * Shrinks an MP3 until it fits the caller's byte budget.
 *
 * Re-encodes from the ORIGINAL source every pass (never from the previous
 * smaller MP3), so the loss does not stack, and stops at the first pass that
 * fits. Mono downmix at a lower bitrate is exactly what an LLM transcription/
 * analysis needs — stereo image is the only thing it loses.
 */
async function fitWithinByteBudget(
  mp3Buffer: Buffer,
  originalBuffer: Buffer,
  trackId: string,
  maxBytes: number | undefined
): Promise<Buffer> {
  if (!maxBytes || mp3Buffer.length <= maxBytes) return mp3Buffer;

  let best = mp3Buffer;
  for (const bitrate of COMPACT_BITRATES) {
    try {
      const candidate = await transcodeToMp3(originalBuffer, bitrate, { channels: 1 });
      if (candidate.length < best.length) best = candidate;
      if (best.length <= maxBytes) {
        log(
          `[dna-audio] track ${trackId}: re-encoded ${bitrate}kbps mono to fit the ${maxBytes}-byte LLM budget (${mp3Buffer.length} -> ${best.length} bytes)`
        );
        return best;
      }
    } catch (error) {
      warn(`[dna-audio] track ${trackId}: ${bitrate}kbps mono re-encode failed:`, error);
      break;
    }
  }

  warn(
    `[dna-audio] track ${trackId}: audio still ${best.length} bytes after compaction (budget ${maxBytes}) — the upload may be rejected`
  );
  return best;
}
