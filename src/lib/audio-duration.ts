import { parseBuffer } from "music-metadata";
import { contentTypeForFormat } from "./audio-format";

/**
 * Extract audio duration in seconds from an audio file buffer
 * @param buffer Audio file buffer
 * @param format Optional format identifier (e.g. 'mp3', 'wav', 'flac', 'ogg') or MIME type
 * @returns Duration in seconds (rounded to nearest integer), or null if unable to extract
 */
export async function extractAudioDuration(
  buffer: Buffer,
  format?: string
): Promise<number | null> {
  try {
    const mimeType = format
      ? (format.includes("/") ? format : contentTypeForFormat(format))
      : undefined;
    const metadata = await parseBuffer(buffer, mimeType ? { mimeType } : undefined);
    const duration = metadata.format.duration;
    return duration ? Math.round(duration) : null;
  } catch (error) {
    console.warn("[audio-duration] Failed to extract duration:", error);
    return null;
  }
}
