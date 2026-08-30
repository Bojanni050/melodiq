export interface TrackItem {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  completedAt?: string | null;
  createdAt: string;
  error: string | null;
  s3Key?: string | null;
  s3KeyHd: string | null;
  s3KeyMp3?: string | null;
  s3KeyOgg?: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  s3KeyCoverThumb?: string | null;
  rating?: string | null;
  playCount?: number | null;
  othersPlayCount?: number | null;
  votedAt?: string | null;
  workspaceId?: string | null;
  archivedAt?: string | null;
  releaseStatus?: string | null;
  publishDate?: string | null;
  trackDna?: string | null;
  audioDna?: string | null;
  advancedDna?: string | null;
  /** Set by the track list, which omits the advancedDna body itself. */
  hasAdvancedDna?: boolean | null;
  hasTclDocument?: boolean | null;
  publicSource?: boolean;
  pollsOpenAt?: string | null;
  pollsCloseAt?: string | null;
  lyricsTimestamps?: string | null;
  artistName?: string | null;
  artistId?: string | null;
  composerName?: string | null;
  writerName?: string | null;
  instrumental?: boolean | null;
  isCollaboration?: boolean | null;
  language?: string | null;
  translatedLyrics?: string | null;
  translatedLanguage?: string | null;
  sunoStyleInfluence?: number | null;
  sunoWeirdness?: number | null;
  jobId?: string | null;
}

export interface PlaylistOption {
  id: string;
  name: string;
  trackIds?: string[];
}
