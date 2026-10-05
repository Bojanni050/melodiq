export interface LibraryTrack {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  instrumental?: boolean | null;
  isCollaboration?: boolean | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3Key?: string | null;
  s3KeyHd: string | null;
  s3KeyMp3?: string | null;
  s3KeyOgg?: string | null;
  coverUrl: string | null;
  s3KeyCover: string | null;
  s3KeyCoverThumb?: string | null;
  rating?: string | null;
  lyricsTimestamps?: string | null;
  artistName?: string | null;
  artistId?: string | null;
  composerName?: string | null;
  writerName?: string | null;
  deletedAt?: string | null;
  archivedAt?: string | null;
  hiddenAt?: string | null;
  uploadIndex?: number;
}

export type LibraryView = "songs" | "trash" | "archive";

export const MAX_UPLOAD_QUEUE = 10;

export const UPLOAD_PROVIDERS = [
  { value: "upload", label: "Unknown / Other" },
  { value: "suno", label: "Suno" },
  { value: "mureka", label: "Mureka" },
  { value: "heartmula", label: "HeartMuLa" },
  { value: "udio", label: "Udio" },
  { value: "poyo", label: "PoYo" },
  { value: "tempolor", label: "Tempolor" },
  { value: "apiframe", label: "APIFrame" },
  { value: "apimart", label: "APIMart" },
  { value: "musicgpt", label: "MusicGPT" },
] as const;

export type QueuedUploadItem = {
  id: string;
  file: File;
  title: string;
  artistName: string;
  composerName: string;
  writerName: string;
  coverFile: File | null;
  metadataFile: File | null;
  prompt: string;
  lyrics: string;
  instrumental: boolean;
  sourceProvider: string;
  /** Chosen model/version for the source (Suno v3.5..v6, Mureka V6..V9.5, …). */
  sourceModel: string | null;
  sunoStyleInfluence: number | null;
  sunoWeirdness: number | null;
  /** APIMart Suno v6 options (recorded only when source = Suno v6). */
  sunoVariety: string | null;
  sunoMaxMode: boolean;
  sunoAudioFormat: string | null;
  licenseFile: File | null;
};

/**
 * Selectable versions per upload source. Suno uses the APIMart model ids
 * (incl. the v6 family); Mureka goes up to V9.5.
 */
export const UPLOAD_PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  suno: [
    { value: "v3.5", label: "v3.5" },
    { value: "v4", label: "v4" },
    { value: "v4.5", label: "v4.5" },
    { value: "v4.5+", label: "v4.5+" },
    { value: "v4.5-all", label: "v4.5-all" },
    { value: "v5", label: "v5" },
    { value: "v5.5", label: "v5.5" },
    { value: "v6", label: "v6" },
    { value: "v6-mini", label: "v6-mini" },
    { value: "v6-wild", label: "v6-wild" },
  ],
  mureka: [
    { value: "V6", label: "V6" },
    { value: "V7", label: "V7" },
    { value: "V8", label: "V8" },
    { value: "V9", label: "V9" },
    { value: "V9.5", label: "V9.5" },
  ],
};

/** True when a Suno model id is one of the v6 variants with extra options. */
export function isSunoV6Model(model: string | null | undefined): boolean {
  return model === "v6" || model === "v6-mini" || model === "v6-wild";
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSupportedAudioFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type.includes("mpeg") ||
    type.includes("mp3") ||
    type.includes("wav") ||
    type.includes("wave") ||
    type.includes("ogg") ||
    type.includes("vorbis") ||
    type.includes("flac") ||
    name.endsWith(".mp3") ||
    name.endsWith(".wav") ||
    name.endsWith(".ogg") ||
    name.endsWith(".oga") ||
    name.endsWith(".flac")
  );
}

export function titleFromUploadFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "").trim();
  const withoutCopySuffix = withoutExtension.replace(/\s*\(\d+\)$/, "").trim();
  return withoutCopySuffix || "Untitled Upload";
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readApiPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.toLowerCase().includes("application/json")) {
    return response.json().catch(() => null);
  }

  const rawText = await response.text().catch(() => "");
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return { __rawText: rawText };
  }
}
