import { createHash } from "node:crypto";
import { parseLyrics } from "@/lib/parse-lyrics";

export function extractAudioUrls(body: any): string[] {
  if (!body || typeof body !== "object") return [];
  const urls: string[] = [];

  const tracksList = body.result?.tracks || body.tracks;
  if (Array.isArray(tracksList)) {
    for (const t of tracksList) {
      if (t?.audioUrl) urls.push(t.audioUrl);
      else if (t?.url) urls.push(t.url);
      else if (t?.audio_url) urls.push(t.audio_url);
    }
  }

  const songs = body.result?.songs || body.songs;
  if (Array.isArray(songs)) {
    for (const s of songs) {
      if (s?.audioUrl) urls.push(s.audioUrl);
      else if (s?.audio_url) urls.push(s.audio_url);
      else if (s?.url) urls.push(s.url);
    }
  }

  if (urls.length === 0) {
    const scan = (val: any) => {
      if (typeof val === "string") {
        if (val.startsWith("http") && (val.includes(".mp3") || val.includes(".wav") || val.includes("/audio/"))) {
          urls.push(val);
        }
      } else if (Array.isArray(val)) {
        val.forEach(scan);
      } else if (typeof val === "object" && val !== null) {
        Object.values(val).forEach(scan);
      }
    };
    scan(body);
  }

  return urls;
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function detectUploadFormat(file: File): "mp3" | "wav" | "ogg" | "flac" | null {
  const type = file.type.toLowerCase();
  const filename = file.name.toLowerCase();

  if (
    type.includes("mpeg") ||
    type.includes("mp3") ||
    filename.endsWith(".mp3")
  ) {
    return "mp3";
  }

  if (
    type.includes("wav") ||
    type.includes("wave") ||
    filename.endsWith(".wav")
  ) {
    return "wav";
  }

  if (
    type.includes("ogg") ||
    type.includes("vorbis") ||
    filename.endsWith(".ogg") ||
    filename.endsWith(".oga")
  ) {
    return "ogg";
  }

  if (
    type.includes("flac") ||
    filename.endsWith(".flac")
  ) {
    return "flac";
  }

  return null;
}

export function stripMp3Metadata(buffer: Buffer): Buffer {
  let start = 0;
  let end = buffer.length;

  // Remove leading ID3v2 tag when present.
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "ID3") {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    const headerAndTagBytes = 10 + tagSize;
    if (headerAndTagBytes > 0 && headerAndTagBytes < buffer.length) {
      start = headerAndTagBytes;
    }
  }

  // Remove trailing ID3v1 tag when present.
  if (end - start >= 128 && buffer.toString("ascii", end - 128, end - 125) === "TAG") {
    end -= 128;
  }

  return buffer.subarray(start, end);
}

export function stripWavMetadata(buffer: Buffer): Buffer {
  const minimumHeaderSize = 12;
  if (buffer.length < minimumHeaderSize) return buffer;

  const riffId = buffer.toString("ascii", 0, 4);
  const waveId = buffer.toString("ascii", 8, 12);
  if (riffId !== "RIFF" || waveId !== "WAVE") return buffer;

  const dataChunks: Buffer[] = [];
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = Math.min(chunkDataStart + chunkSize, buffer.length);

    if (chunkId === "data" && chunkDataEnd > chunkDataStart) {
      dataChunks.push(buffer.subarray(chunkDataStart, chunkDataEnd));
    }

    // WAV chunks are word-aligned, so odd-sized chunks include one pad byte.
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataChunks.length === 0) return buffer;
  return Buffer.concat(dataChunks);
}

export function getAudioOnlyBytesForHash(audioBuffer: Buffer, format: string): Buffer {
  if (format === "mp3") return stripMp3Metadata(audioBuffer);
  if (format === "wav") return stripWavMetadata(audioBuffer);
  return audioBuffer;
}

export function computeUploadAudioHash(audioBuffer: Buffer, format: string): string {
  const hashBytes = getAudioOnlyBytesForHash(audioBuffer, format);
  return createHash("sha256").update(hashBytes).digest("hex");
}

export function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "").trim();
  const withoutCopySuffix = withoutExtension.replace(/\s*\(\d+\)$/, "").trim();
  return withoutCopySuffix || "Untitled Upload";
}

export type UploadMetadata = {
  prompt: string | null;
  lyrics: string | null;
  lyricsTimestamps: string | null;
};

export type UploadItemOverride = {
  title: string | null;
  artistName: string | null;
  composerName: string | null;
  writerName: string | null;
  prompt: string | null;
  lyrics: string | null;
  instrumental: boolean | null;
  sourceProvider: string | null;
  sunoStyleInfluence: number | null;
  sunoWeirdness: number | null;
};

export function normalizeUploadText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function baseNameWithoutExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, "").trim().toLowerCase();
}

export function isSupportedMetadataFilename(filename: string) {
  const normalized = filename.toLowerCase();
  return normalized.endsWith(".txt") || normalized.endsWith(".lrc");
}

export function extractLyricsFromTimestampedText(timestampedText: string): string | null {
  const lines = parseLyrics(null, timestampedText)
    .map((line) => line.text.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return null;
  return lines.join("\n");
}

export function parseMetadataText(text: string): UploadMetadata {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return { prompt: null, lyrics: null, lyricsTimestamps: null };

  const promptMatch = normalized.match(/(?:^|\n)\s*prompt\s*:\s*([\s\S]*?)(?=\n\s*lyrics\s*:|$)/i);
  const lyricsMatch = normalized.match(/(?:^|\n)\s*lyrics\s*:\s*([\s\S]*)$/i);

  if (!promptMatch && !lyricsMatch) {
    return { prompt: null, lyrics: normalized, lyricsTimestamps: null };
  }

  const prompt = promptMatch?.[1]?.trim() || null;
  const lyrics = lyricsMatch?.[1]?.trim() || null;

  return { prompt, lyrics, lyricsTimestamps: null };
}

export function parseMetadataFile(file: File, content: string): UploadMetadata {
  if (file.name.toLowerCase().endsWith(".lrc")) {
    const normalized = content.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return { prompt: null, lyrics: null, lyricsTimestamps: null };
    }

    return {
      prompt: null,
      lyrics: extractLyricsFromTimestampedText(normalized),
      lyricsTimestamps: normalized,
    };
  }

  return parseMetadataText(content);
}

export function parseUploadItemOverrides(value: FormDataEntryValue | null): UploadItemOverride[] {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => {
      if (!isJsonObject(item)) return { title: null, artistName: null, composerName: null, writerName: null, prompt: null, lyrics: null, instrumental: null, sourceProvider: null, sunoStyleInfluence: null, sunoWeirdness: null };
      const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : null;
      const artistName = typeof item.artistName === "string" && item.artistName.trim() ? item.artistName.trim() : null;
      const composerName = typeof item.composerName === "string" && item.composerName.trim() ? item.composerName.trim() : null;
      const writerName = typeof item.writerName === "string" && item.writerName.trim() ? item.writerName.trim() : null;
      const prompt = typeof item.prompt === "string" && item.prompt.trim() ? item.prompt.trim() : null;
      const lyrics = typeof item.lyrics === "string" && item.lyrics.trim() ? item.lyrics.trim() : null;
      const instrumental = typeof item.instrumental === "boolean" ? item.instrumental : null;
      const sourceProvider = typeof item.sourceProvider === "string" && item.sourceProvider.trim() ? item.sourceProvider.trim() : null;
      const sunoStyleInfluence = typeof item.sunoStyleInfluence === "number" ? Math.min(100, Math.max(1, Math.round(item.sunoStyleInfluence))) : null;
      const sunoWeirdness = typeof item.sunoWeirdness === "number" ? Math.min(100, Math.max(1, Math.round(item.sunoWeirdness))) : null;
      return { title, artistName, composerName, writerName, prompt, lyrics, instrumental, sourceProvider, sunoStyleInfluence, sunoWeirdness };
    });
  } catch {
    return [];
  }
}

export function getUploadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (isJsonObject(error)) {
    if (typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }

    if (typeof error.error === "string" && error.error.trim()) {
      return error.error.trim();
    }

    const cause = error.cause;
    if (cause instanceof Error && cause.message.trim()) {
      return cause.message.trim();
    }

    if (typeof error.code === "string" && error.code.trim()) {
      return `${fallback} (${error.code.trim()})`;
    }
  }

  return fallback;
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === "string" && maybeCode === "23505") {
    return true;
  }

  const maybeCause = (error as { cause?: unknown }).cause;
  if (maybeCause && typeof maybeCause === "object") {
    const nestedCode = (maybeCause as { code?: unknown }).code;
    return typeof nestedCode === "string" && nestedCode === "23505";
  }

  return false;
}
