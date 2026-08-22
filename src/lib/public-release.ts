import { withCdn } from "@/lib/cdn-client";
import type { TrackItem } from "@/components/tracks/types";

export interface PublicReleaseTrack {
  id: string;
  title: string;
  artistName: string | null;
  composerName: string | null;
  writerName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  lyricsTimestamps: string | null;
  side: string | null;
}

export interface PublicReleaseSummary {
  id: string;
  title: string;
  type: string;
  kind: string | null;
  artistName: string;
  publishedAt: string | null;
  coverUrl: string | null;
  tracks: PublicReleaseTrack[];
}

export function publicReleaseTrackCoverSrc(track: PublicReleaseTrack): string | null {
  const url = track.coverUrl;
  if (url && (url.startsWith("http") || url.startsWith("/"))) return url;
  if (track.hasCoverProxy) return withCdn(`/api/discover/${track.id}/cover`);
  return null;
}

/** Maps a public release's tracks to the shared TrackItem shape TrackCard/TrackList expect. */
export function publicReleaseTracksToTrackItems(
  release: Pick<PublicReleaseSummary, "tracks" | "artistName" | "publishedAt">
): TrackItem[] {
  return release.tracks.map((t) => ({
    id: t.id,
    title: t.title ?? null,
    provider: "discover",
    providerModel: "discover",
    prompt: "",
    lyrics: null,
    lyricsTimestamps: t.lyricsTimestamps ?? null,
    status: "done",
    audioUrl: null,
    audioUrlHd: null,
    format: null,
    formatHd: null,
    duration: t.duration ?? null,
    createdAt: release.publishedAt ?? new Date().toISOString(),
    error: null,
    s3KeyHd: null,
    coverUrl: publicReleaseTrackCoverSrc(t),
    s3KeyCover: null,
    rating: null,
    instrumental: null,
    publicSource: true,
    artistName: t.artistName ?? release.artistName ?? null,
    composerName: t.composerName ?? null,
    writerName: t.writerName ?? null,
  }));
}
