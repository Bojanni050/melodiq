"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import InlineAuthForm from "@/components/discover/InlineAuthForm";
import { formatDuration } from "@/lib/track-utils";
import { usePlayerStore } from "@/lib/store";

interface PublicTrack {
  id: string;
  songId: string | null;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean;
  publishDate: string | null;
}

export default function DiscoverPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [published, setPublished] = useState<PublicTrack[]>([]);
  const [trending, setTrending] = useState<PublicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const setGlobalIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (active) setIsLoggedIn(res.ok);
      } catch {
        if (active) setIsLoggedIn(false);
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchFeed() {
      const res = await fetch("/api/discover");
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setPublished(data.published || []);
        setTrending(data.trending || []);
      }
      setLoading(false);
    }
    fetchFeed();
    return () => {
      active = false;
    };
  }, []);

  function coverSrc(track: PublicTrack) {
    if (track.coverUrl) return track.coverUrl;
    if (track.hasCoverProxy) return `/api/discover/${track.id}/cover`;
    return null;
  }

  function handlePlay(track: PublicTrack) {
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
      artistName: track.artistName,
      instrumental: track.instrumental,
      publicSource: true,
    });
  }

  function TrackCard({ track }: { track: PublicTrack }) {
    const cover = coverSrc(track);
    const isPlaying = currentTrack?.id === track.id && globalIsPlaying;
    return (
      <Link
        href={`/discover/track/${track.id}`}
        className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-white/20"
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePlay(track);
          }}
          className="group relative aspect-square w-full overflow-hidden rounded-xl"
          aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
        >
          {cover ? (
            <img src={cover} alt={track.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600/40 to-primary-900/40">
              <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
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
          <p className="truncate text-sm font-medium text-white">{track.title}</p>
          <p className="truncate text-xs text-white/45">{track.artistName || "Unknown Artist"}</p>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/35">
          <span>{formatDuration(track.duration)}</span>
          <span>{track.totalPlays.toLocaleString()} plays</span>
        </div>
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      {isLoggedIn && <Sidebar credits={null} />}
      <main className={`flex-1 overflow-y-auto px-4 py-6 sm:px-8 ${isLoggedIn ? "lg:pl-64" : ""}`}>
        {authChecked && !isLoggedIn && (
          <header className="mb-8 flex items-center gap-2">
            <svg className="h-7 w-7 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span className="bg-linear-to-r from-primary-400 to-primary-500 bg-clip-text text-lg font-bold text-transparent">
              MelodIQ
            </span>
          </header>
        )}

        <div className="mx-auto max-w-5xl space-y-8 pb-16">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/35">Song DNA</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Discover</h1>
            <p className="mt-1 text-sm text-white/55">Published tracks from the MelodIQ community.</p>
          </div>

          {authChecked && !isLoggedIn && <InlineAuthForm onAuthenticated={() => setIsLoggedIn(true)} />}

          {loading ? (
            <p className="text-sm text-white/50">Loading…</p>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Current Trends</h2>
                {trending.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {trending.map((track) => (
                      <TrackCard key={track.id} track={track} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">Nothing trending yet.</p>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-semibold">Published Tracks</h2>
                {published.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {published.map((track) => (
                      <TrackCard key={track.id} track={track} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">No published tracks yet.</p>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
