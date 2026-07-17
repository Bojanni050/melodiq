"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { formatDuration } from "@/lib/track-utils";

interface PublicSong {
  id: string;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  publishDate: string | null;
}

export default function DiscoverPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [published, setPublished] = useState<PublicSong[]>([]);
  const [trending, setTrending] = useState<PublicSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

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

  function coverSrc(song: PublicSong) {
    if (song.coverUrl) return song.coverUrl;
    if (song.hasCoverProxy) return `/api/discover/${song.id}/cover`;
    return null;
  }

  function handlePlay(song: PublicSong) {
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = `/api/discover/${song.id}/stream`;
      audioRef.current.play().catch(() => {});
      void fetch(`/api/discover/${song.id}/play`, { method: "POST" });
    }
    setPlayingId(song.id);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        authMode === "login"
          ? { email, password }
          : { email, password, name: name.trim() || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAuthError(data.error || "Something went wrong");
        return;
      }

      setIsLoggedIn(true);
    } catch {
      setAuthError("An unexpected error occurred");
    } finally {
      setAuthLoading(false);
    }
  }

  function SongCard({ song }: { song: PublicSong }) {
    const cover = coverSrc(song);
    const isPlaying = playingId === song.id;
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
        <button
          type="button"
          onClick={() => handlePlay(song)}
          className="group relative aspect-square w-full overflow-hidden rounded-xl"
          aria-label={isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
        >
          {cover ? (
            <img src={cover} alt={song.title} className="h-full w-full object-cover" />
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
          <p className="truncate text-sm font-medium text-white">{song.title}</p>
          <p className="truncate text-xs text-white/45">{song.artistName || "Unknown Artist"}</p>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/35">
          <span>{formatDuration(song.duration)}</span>
          <span>{song.totalPlays.toLocaleString()} plays</span>
        </div>
      </div>
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
            <p className="mt-1 text-sm text-white/55">Published songs from the MelodIQ community.</p>
          </div>

          {authChecked && !isLoggedIn && (
            <section className="max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                  }}
                  className={`rounded-full px-3 py-1.5 transition-colors ${authMode === "login" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                  }}
                  className={`rounded-full px-3 py-1.5 transition-colors ${authMode === "register" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                >
                  Sign Up
                </button>
              </div>
              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {authMode === "register" && (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name (optional)"
                    className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                  />
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                />
                {authError && <p className="text-xs text-red-400">{authError}</p>}
                <button
                  type="submit"
                  disabled={authLoading || !email || !password}
                  className="h-10 w-full rounded-xl bg-white text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-60"
                >
                  {authLoading ? "…" : authMode === "login" ? "Sign In" : "Sign Up"}
                </button>
              </form>
              <p className="mt-3 text-center text-xs text-white/35">
                {authMode === "login" ? (
                  <>
                    New here?{" "}
                    <button type="button" onClick={() => setAuthMode("register")} className="text-white/60 hover:text-white">
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => setAuthMode("login")} className="text-white/60 hover:text-white">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </section>
          )}

          {loading ? (
            <p className="text-sm text-white/50">Loading…</p>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Current Trends</h2>
                {trending.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {trending.map((song) => (
                      <SongCard key={song.id} song={song} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">Nothing trending yet.</p>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-semibold">Published Songs</h2>
                {published.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {published.map((song) => (
                      <SongCard key={song.id} song={song} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">No published songs yet.</p>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />
    </div>
  );
}
