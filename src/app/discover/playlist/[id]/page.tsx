"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePlayerStore } from "@/lib/store";
import { formatDuration } from "@/lib/track-utils";

interface PublicPlaylistTrack {
  id: string;
  title: string;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
}

interface PublicPlaylistData {
  id: string;
  name: string;
  description: string | null;
  artistName: string;
  publishedAt: string | null;
  tracks: PublicPlaylistTrack[];
}

export default function PublicPlaylistPage() {
  const params = useParams<{ id: string }>();
  const playlistId = params?.id;
  const [playlist, setPlaylist] = useState<PublicPlaylistData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const setGlobalIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);

  useEffect(() => {
    if (!playlistId) return;
    let active = true;
    async function fetchPlaylist() {
      const res = await fetch(`/api/discover/playlists/${playlistId}`);
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data.playlist);
      }
      setLoading(false);
    }
    fetchPlaylist();
    return () => {
      active = false;
    };
  }, [playlistId]);

  function coverSrc(track: PublicPlaylistTrack): string | null {
    const url = track.coverUrl;
    if (url && (url.startsWith("http") || url.startsWith("/"))) return url;
    if (track.hasCoverProxy) return `/api/discover/${track.id}/cover`;
    return null;
  }

  function handlePlay(track: PublicPlaylistTrack) {
    if (currentTrack?.id === track.id) {
      setGlobalIsPlaying(!globalIsPlaying);
      return;
    }
    playTrackFromGesture({
      id: track.id,
      title: track.title,
      provider: "discover",
      providerModel: "discover",
      prompt: "",
      status: "done",
      audioUrl: null,
      audioUrlHd: null,
      s3Key: null,
      s3KeyHd: null,
      format: null,
      formatHd: null,
      duration: track.duration,
      lyrics: null,
      createdAt: new Date().toISOString(),
      error: null,
      coverUrl: coverSrc(track),
      s3KeyCover: null,
      instrumental: null,
      publicSource: true,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <p className="text-white/50">Loading…</p>
      </div>
    );
  }

  if (notFound || !playlist) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center gap-3">
        <p className="text-white/50">Playlist not found.</p>
        <Link href="/discover" className="text-sm text-primary-400 hover:underline">
          ← Back to Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/5 bg-[#0d0d12]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/discover" className="flex items-center gap-2">
            <svg className="h-7 w-7 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span className="bg-linear-to-r from-primary-400 to-primary-500 bg-clip-text text-lg font-bold text-transparent">
              MelodIQ
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
        <Link
          href="/discover"
          className="mb-4 inline-flex items-center gap-1 text-sm text-white/45 hover:text-white/70"
        >
          ← Back to Discover
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">{playlist.name}</h1>
          {playlist.description && (
            <p className="mt-2 text-white/60">{playlist.description}</p>
          )}
          <p className="mt-2 text-sm text-white/40">
            by {playlist.artistName} · {playlist.tracks.length} {playlist.tracks.length === 1 ? "track" : "tracks"}
          </p>
        </div>

        <div className="space-y-2">
          {playlist.tracks.map((track, index) => {
            const cover = coverSrc(track);
            const isPlaying = currentTrack?.id === track.id && globalIsPlaying;
            return (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 transition-colors hover:border-white/20"
              >
                <button
                  type="button"
                  onClick={() => handlePlay(track)}
                  className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"
                  aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                >
                  {cover ? (
                    <img src={cover} alt={track.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600/40 to-primary-900/40">
                      <svg className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                    {isPlaying ? (
                      <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg className="ml-0.5 h-4 w-4 text-white opacity-0 group-hover:opacity-100" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                </button>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/discover/track/${track.id}`}
                    className="block truncate text-sm font-medium text-white hover:text-primary-300"
                  >
                    {track.title}
                  </Link>
                  <p className="text-xs text-white/40">
                    {formatDuration(track.duration)} · {track.totalPlays.toLocaleString()} plays
                  </p>
                </div>
                <span className="text-xs text-white/30">{index + 1}</span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
