import { parseBuffer } from "music-metadata";

/**
 * Extract audio duration in seconds from an audio file buffer
 * @param buffer Audio file buffer
 * @returns Duration in seconds (rounded to nearest integer), or null if unable to extract
 */
export async function extractAudioDuration(buffer: Buffer): Promise<number | null> {
  try {
    const metadata = await parseBuffer(buffer, { mimeType: "audio/mpeg" });
    const duration = metadata.format.duration;
    return duration ? Math.round(duration) : null;
  } catch (error) {
    console.warn("[audio-duration] Failed to extract duration:", error);
    return null;
  }
}
