import type { Track } from "@/lib/store";

export interface ArchiveEntry {
  id: string;
  parentId: string | null;
  language: string | null;
  title: string;
  lyrics: string;
  prompt: string;
  notes: string;
  trackId: string | null;
  trackTitle: string | null;
  trackCoverUrl?: string | null;
  trackS3KeyCoverThumb?: string | null;
  // Full track data from joined query
  trackAudioUrl?: string | null;
  trackAudioUrlHd?: string | null;
  trackFormat?: string | null;
  trackFormatHd?: string | null;
  trackS3KeyHd?: string | null;
  trackDuration?: number | null;
  trackLyrics?: string | null;
  trackLyricsTimestamps?: string | null;
  trackProvider?: string | null;
  trackProviderModel?: string | null;
  trackStatus?: string | null;
  trackCreatedAt?: string | null;
  trackInstrumental?: boolean | null;
  trackArtistName?: string | null;
  trackReleaseStatus?: string | null;
  trackPublishDate?: string | null;
  releaseStatus?: string | null;
  publishDate?: string | null;
  createdAt: string;
  updatedAt: string;
  translations?: ArchiveEntry[];
}

export interface TrackOption {
  id: string;
  title: string | null;
}

export type EditingTarget =
  | { mode: "new-original" }
  | { mode: "new-translation"; parentId: string; parentTitle: string }
  | { mode: "edit"; entry: ArchiveEntry };

export function entryCoverSrc(entry: Pick<ArchiveEntry, "trackId" | "trackCoverUrl" | "trackS3KeyCoverThumb">): string | null {
  if (entry.trackCoverUrl) return entry.trackCoverUrl;
  if (entry.trackId && entry.trackS3KeyCoverThumb) return `/api/tracks/${entry.trackId}/cover?thumb=1`;
  return null;
}

export function entryToTrack(entry: ArchiveEntry): Track | null {
  if (!entry.trackId || entry.trackStatus !== "done") return null;
  return {
    id: entry.trackId,
    title: entry.trackTitle ?? entry.title,
    provider: entry.trackProvider ?? "upload",
    providerModel: entry.trackProviderModel ?? "",
    prompt: entry.prompt,
    lyrics: entry.trackLyrics ?? entry.lyrics,
    language: null,
    translatedLyrics: null,
    translatedLanguage: null,
    status: "done",
    audioUrl: entry.trackAudioUrl ?? null,
    audioUrlHd: entry.trackAudioUrlHd ?? null,
    format: entry.trackFormat ?? null,
    formatHd: entry.trackFormatHd ?? null,
    duration: entry.trackDuration ?? null,
    createdAt: entry.trackCreatedAt ?? entry.createdAt,
    error: null,
    s3Key: null,
    s3KeyHd: entry.trackS3KeyHd ?? null,
    coverUrl: entry.trackCoverUrl ?? null,
    s3KeyCover: null,
    s3KeyCoverThumb: entry.trackS3KeyCoverThumb ?? null,
    rating: null,
    playCount: null,
    othersPlayCount: null,
    votedAt: null,
    instrumental: entry.trackInstrumental ?? null,
    artistName: entry.trackArtistName ?? null,
    composerName: null,
    writerName: null,
    lyricsTimestamps: entry.trackLyricsTimestamps ?? null,
    releaseStatus: null,
    publishDate: null,
    trackDna: null,
    audioDna: null,
    deletedAt: null,
  };
}
