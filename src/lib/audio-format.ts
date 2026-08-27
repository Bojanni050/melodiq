export type AudioFormat = "mp3" | "wav" | "flac" | "ogg";

/** Detect audio format from a URL or Content-Type header value */
export function detectFormatFromUrl(url: string): AudioFormat {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".ogg") || lower.endsWith(".oga")) return "ogg";
  if (lower.endsWith(".flac")) return "flac";
  if (lower.endsWith(".wav")) return "wav";
  return "mp3";
}

export function detectFormatFromContentType(contentType: string): AudioFormat {
  const lower = contentType.toLowerCase();
  if (lower.includes("ogg") || lower.includes("vorbis")) return "ogg";
  if (lower.includes("flac")) return "flac";
  if (lower.includes("wav")) return "wav";
  return "mp3";
}

export function contentTypeForFormat(format: AudioFormat | string): string {
  const lower = (format || "").toLowerCase();
  if (lower === "ogg") return "audio/ogg";
  if (lower === "wav") return "audio/wav";
  if (lower === "flac") return "audio/flac";
  if (lower === "m4a") return "audio/mp4";
  if (lower === "webm") return "audio/webm";
  return "audio/mpeg";
}

export interface TrackAudioSourceOptions {
  hd?: boolean;
}

export interface TrackAudioFields {
  s3Key?: string | null;
  s3KeyHd?: string | null;
  s3KeyMp3?: string | null;
  s3KeyOgg?: string | null;
  format?: string | null;
  formatHd?: string | null;
}

export interface ResolvedAudioSource {
  s3Key: string;
  format: AudioFormat | string;
}

/**
 * Resolves the S3 key and audio format to play/stream for a track according to
 * MelodIQ playback priorities:
 *
 * - Standard (default non-HD) playback:
 *     1. OGG Vorbis (s3KeyOgg or format='ogg')
 *     2. MP3 (s3KeyMp3 or format='mp3')
 *     3. FLAC (formatHd='flac' or format='flac')
 *     4. WAV (formatHd='wav' or format='wav')
 *     5. s3Key fallback
 *
 * - HD (highest quality) playback:
 *     1. FLAC (formatHd='flac' or format='flac')
 *     2. WAV (formatHd='wav' or format='wav')
 *     3. OGG Vorbis (s3KeyOgg or format='ogg')
 *     4. MP3 (s3KeyMp3 or format='mp3')
 *     5. s3Key fallback
 */
export function resolveTrackAudioSource(
  track: TrackAudioFields,
  options?: TrackAudioSourceOptions
): ResolvedAudioSource | null {
  const hd = Boolean(options?.hd);

  if (hd) {
    // 1. Lossless FLAC
    if (track.formatHd === "flac" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "flac" };
    if (track.format === "flac" && track.s3Key) return { s3Key: track.s3Key, format: "flac" };

    // 2. Uncompressed WAV
    if (track.formatHd === "wav" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "wav" };
    if (track.format === "wav" && track.s3Key) return { s3Key: track.s3Key, format: "wav" };

    // 3. OGG Vorbis
    if (track.s3KeyOgg) return { s3Key: track.s3KeyOgg, format: "ogg" };
    if (track.formatHd === "ogg" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "ogg" };
    if (track.format === "ogg" && track.s3Key) return { s3Key: track.s3Key, format: "ogg" };

    // 4. MP3
    if (track.s3KeyMp3) return { s3Key: track.s3KeyMp3, format: "mp3" };
    if (track.formatHd === "mp3" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "mp3" };
    if (track.format === "mp3" && track.s3Key) return { s3Key: track.s3Key, format: "mp3" };

    if (track.s3KeyHd) return { s3Key: track.s3KeyHd, format: track.formatHd ?? "wav" };
    if (track.s3Key) return { s3Key: track.s3Key, format: track.format ?? "mp3" };
    return null;
  }

  // Default playback: OGG -> MP3 -> FLAC -> WAV
  // 1. OGG Vorbis
  if (track.s3KeyOgg) return { s3Key: track.s3KeyOgg, format: "ogg" };
  if (track.format === "ogg" && track.s3Key) return { s3Key: track.s3Key, format: "ogg" };
  if (track.formatHd === "ogg" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "ogg" };

  // 2. MP3
  if (track.s3KeyMp3) return { s3Key: track.s3KeyMp3, format: "mp3" };
  if (track.format === "mp3" && track.s3Key) return { s3Key: track.s3Key, format: "mp3" };
  if (track.formatHd === "mp3" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "mp3" };

  // 3. FLAC
  if (track.formatHd === "flac" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "flac" };
  if (track.format === "flac" && track.s3Key) return { s3Key: track.s3Key, format: "flac" };

  // 4. WAV
  if (track.formatHd === "wav" && track.s3KeyHd) return { s3Key: track.s3KeyHd, format: "wav" };
  if (track.format === "wav" && track.s3Key) return { s3Key: track.s3Key, format: "wav" };

  // 5. General fallback
  if (track.s3Key) return { s3Key: track.s3Key, format: track.format ?? "mp3" };
  if (track.s3KeyHd) return { s3Key: track.s3KeyHd, format: track.formatHd ?? "wav" };

  return null;
}
