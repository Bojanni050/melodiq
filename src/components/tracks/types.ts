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
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  s3KeyCoverThumb?: string | null;
  rating?: string | null;
  playCount?: number | null;
  lyricsTimestamps?: string | null;
  artistName?: string | null;
  composerName?: string | null;
  instrumental?: boolean | null;
  language?: string | null;
  sunoStyleInfluence?: number | null;
  sunoWeirdness?: number | null;
}

export interface PlaylistOption {
  id: string;
  name: string;
  trackIds?: string[];
}
