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
  sunoStyleInfluence: number | null;
  sunoWeirdness: number | null;
  licenseFile: File | null;
};

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
