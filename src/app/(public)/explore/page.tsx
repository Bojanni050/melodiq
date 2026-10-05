"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import ArtistLink from "@/components/artist/ArtistLink";
import { usePlayerStore } from "@/lib/store";
import { formatDuration } from "@/lib/track-utils";
import { withCdn } from "@/lib/cdn-client";

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
    <div className="min-h-screen bg-canvas text-ink">
      <PublicNav />

      <main className="px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">Published Tracks</h1>
          <p className="mt-2 text-ink-dim">
            Discover songs made with MelodIQ. Browse published tracks and follow the artists behind them.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,300px))] gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square w-full  bg-white/10" />
                <div className="mt-3 h-4 w-3/4 rounded bg-white/10" />
                <div className="mt-2 h-3 w-1/2 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : published.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center  border border-dashed border-line bg-white/[0.02] text-center">
            <p className="text-ink-dim">No published tracks yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,300px))] gap-3">
            {published.map((track) => {
              const cover = coverSrc(track);
              const isPlaying = currentTrack?.id === track.id && globalIsPlaying;
              return (
                <div
                  key={track.id}
                  className="flex flex-col gap-1.5"
                >
                  <div className="group relative aspect-square w-full">
                  <button
                    type="button"
                    onClick={() => handlePlay(track)}
                    className="absolute inset-0 overflow-hidden "
                    aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  >
                    {cover ? (
                      <img src={cover} alt={track.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-surface-2">
                        <svg className="h-8 w-8 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-12 text-left">
                    <Link
                      href={`/discover/track/${track.id}`}
                      className="pointer-events-auto block truncate text-sm font-semibold text-ink drop-shadow hover:text-accent transition-colors"
                    >
                      {track.title}
                    </Link>
                    <ArtistLink
                      name={track.artistName || "Unknown Artist"}
                      {...(track.artistId ? { fallbackHref: `/discover/artist/${track.artistId}` } : {})}
                      className="pointer-events-auto block truncate text-xs text-ink-muted hover:text-accent transition-colors"
                    />
                  </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-dim">
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
