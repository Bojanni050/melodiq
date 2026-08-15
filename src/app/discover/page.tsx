"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import InlineAuthForm from "@/components/discover/InlineAuthForm";
import TrackDetail, { type TrackDetailTrack } from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { formatDuration } from "@/lib/track-utils";
import { usePlayerStore, useSidebarStore, useUserStore } from "@/lib/store";
import { withCdn } from "@/lib/cdn";

interface PublicTrack {
  id: string;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean;
  publishDate: string | null;
  lyrics: string | null;
  lyricsTimestamps: string | null;
}

interface PublicPlaylist {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
}

interface MyTrack {
  id: string;
  title: string | null;
  prompt: string;
  provider: string;
  providerModel: string;
  status: string;
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  s3Key: string | null;
  s3KeyHd: string | null;
  duration: number | null;
  lyrics: string | null;
  lyricsTimestamps: string | null;
  createdAt: string;
  error: string | null;
  coverUrl: string | null;
  s3KeyCover: string | null;
  artistName: string | null;
  instrumental: boolean | null;
  playCount: number | null;
  rating: string | null;
}

export default function DiscoverPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [published, setPublished] = useState<PublicTrack[]>([]);
  const [trending, setTrending] = useState<PublicTrack[]>([]);
  const [publishedPlaylists, setPublishedPlaylists] = useState<PublicPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTracks, setMyTracks] = useState<MyTrack[]>([]);
  const [myTracksLoading, setMyTracksLoading] = useState(true);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const setGlobalIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);
  const showTrackDetailsPanel = usePlayerStore((s) => s.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((s) => s.setShowTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((s) => s.setRightPanelWidth);
  const [selectedTrack, setSelectedTrack] = useState<TrackDetailTrack | null>(null);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);

  const isListener = user?.role === "listener";
  const showOwnerSections = isLoggedIn && !isListener;

  useEffect(() => {
    if (!user) void loadUser();
  }, [user, loadUser]);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (active) {
          setIsLoggedIn(res.ok);
          if (res.ok) void loadUser();
        }
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

  useEffect(() => {
    let active = true;
    async function fetchPlaylists() {
      const res = await fetch("/api/discover/playlists");
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setPublishedPlaylists(data.playlists || []);
      }
    }
    fetchPlaylists();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !isLoggedIn) {
      setMyTracksLoading(false);
      return;
    }
    let active = true;
    async function fetchMyTracks() {
      try {
        const res = await fetch("/api/tracks?status=done", { cache: "no-store" });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setMyTracks(Array.isArray(data.tracks) ? data.tracks : []);
        }
      } finally {
        if (active) setMyTracksLoading(false);
      }
    }
    fetchMyTracks();
    return () => {
      active = false;
    };
  }, [authChecked, isLoggedIn]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  useEffect(() => {
    if (isLoggedIn) setShowTrackDetailsPanel(true);
  }, [isLoggedIn, setShowTrackDetailsPanel]);

  const totalTrackCount = myTracks.length;
  const topPlayedTracks = [...myTracks]
    .filter((track) => track.status === "done")
    .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
    .slice(0, 10);
  const recentTracks = [...myTracks]
    .filter((track) => track.status === "done")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const tracksThisWeek = myTracks.filter(
    (track) => now - new Date(track.createdAt).getTime() <= 7 * DAY_MS
  ).length;
  const tracksThisMonth = myTracks.filter(
    (track) => now - new Date(track.createdAt).getTime() <= 30 * DAY_MS
  ).length;

  function myTrackCoverSrc(track: MyTrack) {
    return track.coverUrl || (track.s3KeyCover ? `/api/tracks/${track.id}/cover` : null);
  }

  function handlePlayMyTrack(track: MyTrack) {
    setSelectedTrack({
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      prompt: track.prompt,
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
      status: track.status as "pending" | "generating" | "done" | "failed",
      audioUrl: track.audioUrl,
      audioUrlHd: track.audioUrlHd,
      format: track.format,
      formatHd: track.formatHd,
      duration: track.duration,
      createdAt: track.createdAt,
      error: track.error,
      s3KeyHd: track.s3KeyHd,
      coverUrl: myTrackCoverSrc(track),
      s3KeyCover: track.s3KeyCover,
      rating: track.rating,
      instrumental: track.instrumental,
      artistName: track.artistName,
    });
    setShowTrackDetailsPanel(true);

    if (currentTrack?.id === track.id) {
      setGlobalIsPlaying(!globalIsPlaying);
      return;
    }
    playTrackFromGesture({
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      prompt: track.prompt,
      status: track.status as "pending" | "generating" | "done" | "failed",
      audioUrl: track.audioUrl,
      audioUrlHd: track.audioUrlHd,
      s3Key: track.s3Key,
      s3KeyHd: track.s3KeyHd,
      format: track.format,
      formatHd: track.formatHd,
      duration: track.duration,
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
      createdAt: track.createdAt,
      error: track.error,
      coverUrl: myTrackCoverSrc(track),
      s3KeyCover: track.s3KeyCover,
      artistName: track.artistName,
      instrumental: track.instrumental,
      playCount: track.playCount,
      rating: track.rating,
    });
  }

  function handleCloseTrackDetails() {
    setShowTrackDetailsPanel(false);
  }

  function handleDetailPlay(url: string) {
    if (!selectedTrack) return;
    const track = myTracks.find((t) => t.id === selectedTrack.id);
    if (!track) return;
    if (currentTrack?.id === track.id) {
      setGlobalIsPlaying(!globalIsPlaying);
      return;
    }
    playTrackFromGesture({
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      prompt: track.prompt,
      status: track.status as "pending" | "generating" | "done" | "failed",
      audioUrl: url,
      audioUrlHd: track.audioUrlHd,
      s3Key: track.s3Key,
      s3KeyHd: track.s3KeyHd,
      format: track.format,
      formatHd: track.formatHd,
      duration: track.duration,
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
      createdAt: track.createdAt,
      error: track.error,
      coverUrl: myTrackCoverSrc(track),
      s3KeyCover: track.s3KeyCover,
      artistName: track.artistName,
      instrumental: track.instrumental,
      playCount: track.playCount,
      rating: track.rating,
    });
  }

  function handleDownloadTrack(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd
      ? (selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3")
      : (selectedTrack?.format ?? "mp3");
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }

  function MyTrackCard({ track }: { track: MyTrack }) {
    const cover = myTrackCoverSrc(track);
    const isPlaying = currentTrack?.id === track.id && globalIsPlaying;
    return (
      <button
        type="button"
        onClick={() => handlePlayMyTrack(track)}
        className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:border-white/20"
      >
        <div className="group relative aspect-square w-full overflow-hidden rounded-xl">
          {cover ? (
            <img src={cover} alt={track.title ?? "Track"} className="h-full w-full object-cover" />
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
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{track.title || track.prompt.substring(0, 40)}</p>
          <p className="truncate text-sm text-white/45">{track.artistName || "Unknown Artist"}</p>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/35">
          <span>{formatDuration(track.duration)}</span>
          <span>{(track.playCount ?? 0).toLocaleString()} plays</span>
        </div>
      </button>
    );
  }

  function coverSrc(track: PublicTrack) {
    const url = track.coverUrl;
    if (url && (url.startsWith("http") || url.startsWith("/"))) return url;
    if (track.hasCoverProxy) return withCdn(`/api/discover/${track.id}/cover`);
    return null;
  }

  function handlePlay(track: PublicTrack) {
    setSelectedTrack({
      id: track.id,
      title: track.title,
      provider: "discover",
      providerModel: "discover",
      prompt: "",
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
      status: "done",
      audioUrl: null,
      audioUrlHd: null,
      format: null,
      formatHd: null,
      duration: track.duration,
      createdAt: new Date().toISOString(),
      error: null,
      s3KeyHd: null,
      coverUrl: coverSrc(track),
      s3KeyCover: null,
      artistName: track.artistName,
      instrumental: track.instrumental,
    });
    setShowTrackDetailsPanel(true);

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
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
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
          <p className="truncate text-sm text-white/45">{track.artistName || "Unknown Artist"}</p>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/35">
          <span>{formatDuration(track.duration)}</span>
          <span>{track.totalPlays.toLocaleString()} plays</span>
        </div>
      </Link>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {isLoggedIn && <Sidebar credits={null} />}
      <div
        className={isLoggedIn ? "h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex" : "min-h-screen flex"}
        style={isLoggedIn ? { marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 } : undefined}
      >
      <main className="flex-1 min-w-0 overflow-y-auto px-4 py-6 sm:px-8">
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

        <div className="space-y-8 pb-16">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/35">Overview</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Discover</h1>
            <p className="mt-1 text-sm text-white/55">Your tracks, and published tracks from the MelodIQ community.</p>
          </div>

          {authChecked && !isLoggedIn && <InlineAuthForm onAuthenticated={() => setIsLoggedIn(true)} />}

          {showOwnerSections && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Your Tracks</h2>
                {!myTracksLoading && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                      {totalTrackCount} generated
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                      {tracksThisWeek} this week
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                      {tracksThisMonth} this month
                    </span>
                  </div>
                )}
              </div>
              {myTracksLoading ? (
                <p className="text-sm text-white/50">Loadingâ€¦</p>
              ) : topPlayedTracks.length > 0 ? (
                <>
                  <p className="text-xs text-white/40">Top {topPlayedTracks.length} most played</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {topPlayedTracks.map((track) => (
                      <MyTrackCard key={track.id} track={track} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-white/45">
                  No tracks yet. Head to <Link href="/studio" className="text-primary-400 hover:underline">Music</Link> to generate your first one.
                </p>
              )}
            </section>
          )}

          {showOwnerSections && recentTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Recently Generated</h2>
                <Link href="/library" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  View all
                </Link>
              </div>
              <p className="text-xs text-white/40">Your {recentTracks.length} latest track{recentTracks.length !== 1 ? "s" : ""}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {recentTracks.map((track) => (
                  <MyTrackCard key={track.id} track={track} />
                ))}
              </div>
            </section>
          )}

          {loading ? (
            <p className="text-sm text-white/50">Loadingâ€¦</p>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Current Trends</h2>
                {trending.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {trending.map((track) => (
                      <TrackCard key={track.id} track={track} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">Nothing trending yet.</p>
                )}
              </section>

              {publishedPlaylists.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold">Published Playlists</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {publishedPlaylists.map((playlist) => (
                      <Link
                        key={playlist.id}
                        href={`/discover/playlist/${playlist.id}`}
                        className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-white/20"
                      >
                        <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/40 to-primary-900/40">
                          <svg className="h-10 w-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM3 13l6-1.5M3 13v-2l6-1.5" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{playlist.name}</p>
                          {playlist.description && (
                            <p className="truncate text-xs text-white/45">{playlist.description}</p>
                          )}
                        </div>
                        <p className="text-[11px] text-white/35">
                          {playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h2 className="text-base font-semibold">Published Tracks</h2>
                {published.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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

      {isLoggedIn && (
        <ResizablePanel show={showTrackDetailsPanel} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="h-full overflow-y-auto pb-4">
            {selectedTrack ? (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={handleCloseTrackDetails}
                onPlay={handleDetailPlay}
                onDownload={handleDownloadTrack}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Play one of your tracks to show its info and lyrics here.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      )}
      </div>
    </div>
  );
}
