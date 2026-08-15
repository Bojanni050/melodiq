"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlayerStore } from "@/lib/store";
import { formatDuration } from "@/lib/track-utils";
import { withCdn } from "@/lib/cdn";

interface PublicTrack {
  id: string;
  title: string;
  artistName: string | null;
  artistId: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean | null;
  publishDate: string | null;
}

export default function ExplorePage() {
  const [published, setPublished] = useState<PublicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);

  useEffect(() => {
    let active = true;
    async function fetchFeed() {
      const res = await fetch("/api/discover");
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setPublished(data.published || []);
      }
      setLoading(false);
    }
    fetchFeed();
    return () => {
      active = false;
    };
  }, []);

  function coverSrc(track: PublicTrack): string | null {
    if (track.coverUrl) return track.coverUrl;
    if (track.hasCoverProxy) return withCdn(`/api/discover/${track.id}/cover`);
    return null;
  }

  function handlePlay(track: PublicTrack) {
    if (currentTrack?.id === track.id) {
      usePlayerStore.getState().setIsPlaying(!globalIsPlaying);
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
      artistName: track.artistName,
      instrumental: track.instrumental,
      publicSource: true,
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/5 bg-[#0d0d12]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <Link href="/explore" className="flex items-center gap-2">
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

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Published Tracks</h1>
          <p className="mt-2 text-white/50">
            Discover songs made with MelodIQ. Browse published tracks and follow the artists behind them.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-3 animate-pulse">
                <div className="aspect-square w-full rounded-xl bg-white/10" />
                <div className="mt-3 h-4 w-3/4 rounded bg-white/10" />
                <div className="mt-2 h-3 w-1/2 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : published.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
            <p className="text-white/40">No published tracks yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {published.map((track) => {
              const cover = coverSrc(track);
              const isPlaying = currentTrack?.id === track.id && globalIsPlaying;
              return (
                <div
                  key={track.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-white/20"
                >
                  <button
                    type="button"
                    onClick={() => handlePlay(track)}
                    className="group relative aspect-square w-full overflow-hidden rounded-xl"
                    aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  >
                    {cover ? (
                      <img src={cover} alt={track.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600/40 to-primary-900/40">
                        <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0zM3 13l6-1.5M3 13v-2l6-1.5" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 transition-opacity ${
                          isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isPlaying ? (
                          <svg className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg className="ml-0.5 h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="min-w-0">
                    <Link
                      href={`/discover/track/${track.id}`}
                      className="block truncate text-sm font-medium text-white hover:text-primary-300 transition-colors"
                    >
                      {track.title}
                    </Link>
                    {track.artistId ? (
                      <Link
                        href={`/discover/artist/${track.artistId}`}
                        className="block truncate text-sm text-white/45 hover:text-primary-300 transition-colors"
                      >
                        {track.artistName || "Unknown Artist"}
                      </Link>
                    ) : (
                      <p className="truncate text-sm text-white/45">{track.artistName || "Unknown Artist"}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/35">
                    <span>{formatDuration(track.duration)}</span>
                    <span>{track.totalPlays.toLocaleString()} plays</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
