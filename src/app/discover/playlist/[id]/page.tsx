"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import {
  usePlayerStore,
  usePlaylistStore,
  useSidebarStore,
  useUserStore,
} from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";
import { formatTotalDuration } from "@/lib/track-utils";
import { withCdn } from "@/lib/cdn-client";
import { useSmartBack } from "@/lib/smart-back";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";

interface PublicPlaylistTrack {
  id: string;
  title: string;
  artistName: string | null;
  composerName: string | null;
  writerName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  lyrics: string | null;
  lyricsTimestamps: string | null;
}

interface PublicPlaylistData {
  id: string;
  name: string;
  description: string | null;
  artistName: string;
  publishedAt: string | null;
  coverUrl: string | null;
  tracks: PublicPlaylistTrack[];
}

export default function PublicPlaylistPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playlistId = params?.id;

  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  const isListener = user?.role === "listener" || user?.role == null;
  const backTarget = useSmartBack({ href: "/discover", label: "Back to Discover" });

  useEffect(() => {
    if (!user) void loadUser();
  }, [user, loadUser]);

  const [playlist, setPlaylist] = useState<PublicPlaylistData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const rightPanelWidth = usePlayerStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((s) => s.setRightPanelWidth);
  const { playlists, addTrackToPlaylist, loadPlaylists } = usePlaylistStore();

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
    void loadPlaylists();

    return () => {
      active = false;
    };
  }, [playlistId, loadPlaylists]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  function coverSrc(track: PublicPlaylistTrack): string | null {
    const url = track.coverUrl;
    if (url && (url.startsWith("http") || url.startsWith("/"))) return url;
    if (track.hasCoverProxy) return withCdn(`/api/discover/${track.id}/cover`);
    return null;
  }

  const playlistTracks: TrackItem[] = useMemo(() => {
    if (!playlist?.tracks) return [];
    return playlist.tracks.map((t) => ({
      id: t.id,
      title: t.title ?? null,
      provider: "discover",
      providerModel: "discover",
      prompt: "",
      lyrics: t.lyrics ?? null,
      lyricsTimestamps: t.lyricsTimestamps ?? null,
      status: "done",
      audioUrl: null,
      audioUrlHd: null,
      format: null,
      formatHd: null,
      duration: t.duration ?? null,
      createdAt: playlist.publishedAt ?? new Date().toISOString(),
      error: null,
      s3KeyHd: null,
      coverUrl: coverSrc(t),
      s3KeyCover: null,
      rating: null,
      instrumental: null,
      publicSource: true,
      artistName: t.artistName ?? playlist.artistName ?? null,
      composerName: t.composerName ?? null,
      writerName: t.writerName ?? null,
    }));
  }, [playlist]);

  const playlistTracksTotalDuration = useMemo(
    () => formatTotalDuration(playlistTracks.reduce((s, t) => s + (t.duration ?? 0), 0)),
    [playlistTracks],
  );

  const {
    selectedTrack,
    setSelectedTrack,
    showTrackDetailsPanel,
    openTrackDetails,
    closeTrackDetails,
  } = useTrackDetailsPanel<TrackItem>(playlistTracks);

  function toPlayContextTrack(t: TrackItem, audioUrlOverride?: string | null) {
    return {
      id: t.id,
      title: t.title,
      provider: t.provider,
      providerModel: t.providerModel,
      prompt: t.prompt,
      status: t.status,
      audioUrl: audioUrlOverride !== undefined ? audioUrlOverride : t.audioUrl,
      audioUrlHd: t.audioUrlHd,
      format: t.format,
      formatHd: t.formatHd,
      s3Key: null,
      s3KeyHd: t.s3KeyHd,
      duration: t.duration,
      lyrics: t.lyrics,
      lyricsTimestamps: t.lyricsTimestamps,
      createdAt: t.createdAt,
      error: t.error,
      coverUrl: t.coverUrl ?? null,
      s3KeyCover: t.s3KeyCover ?? null,
      rating: t.rating ?? null,
      artistName: t.artistName ?? null,
      publicSource: true,
    };
  }

  function playTrack(track: TrackItem, audioUrlOverride?: string | null) {
    const player = usePlayerStore.getState();
    const playContext = playlistTracks.map((t) => toPlayContextTrack(t));

    player.setPlayContext(playContext);
    if (player.autoPlayNext) {
      const index = playContext.findIndex((t) => t.id === track.id);
      if (index >= 0) {
        player.setQueue(playContext.slice(index + 1));
      }
    }

    player.playTrackFromGesture(toPlayContextTrack(track, audioUrlOverride ?? null));
  }

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;
    playTrack(selectedTrack, url || null);
  }

  function handlePlayFromStart() {
    if (playlistTracks.length === 0) return;
    if (currentTrack && playlistTracks.some((t) => t.id === currentTrack.id)) {
      const player = usePlayerStore.getState();
      player.setIsPlaying(!player.isPlaying);
      return;
    }
    playTrack(playlistTracks[0]);
  }

  function handleDownloadTrack(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd
      ? selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3"
      : selectedTrack?.format ?? "mp3";
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }

  const coverUrl =
    currentTrack?.coverUrl ||
    (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null) ||
    playlist?.coverUrl;

  if (notFound || (!loading && !playlist)) {
    return (
      <div className="relative h-screen bg-[#09090d] overflow-hidden text-white">
        <Sidebar credits={null} />
        <div
          className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex items-center justify-center px-6"
          style={{
            marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240,
          }}
        >
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center max-w-md">
            <h2 className="text-lg font-semibold text-white">Playlist not found</h2>
            <p className="text-sm text-white/60 mt-2">
              This public playlist is unavailable or was unpublished.
            </p>
            <button
              type="button"
              onClick={() => router.push(backTarget.href)}
              className="mt-5 rounded-full border border-white/12 bg-white/8 px-5 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            >
              {backTarget.label}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-[#09090d] overflow-hidden text-white">
      {/* Blurred cover art as background */}
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-115 blur-[80px] opacity-20 saturate-200 pointer-events-none"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex"
        style={{
          marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240,
        }}
      >
        <main
          className={`relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${
            isListener ? "lg:pt-20" : "lg:pt-5"
          }`}
        >
          <div className="max-w-400 mx-auto space-y-6">
            {/* Header matching Library & Playlist styling */}
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-end gap-4 min-w-0">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1b25] shadow-xl shadow-black/40 sm:h-24 sm:w-24">
                    {playlist?.coverUrl ? (
                      <?xml encoding="UTF-8"?>
<?xml encoding="UTF-8"?>
<img loading="lazy" loading="lazy" src={playlist.coverUrl} alt={playlist.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-600/40 to-primary-900/40">
                        <svg className="h-7 w-7 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                        Discover
                        <span className="mx-2 text-white/25 font-light">/</span>
                        <span className="text-white/60">
                          {playlist?.name ?? "Playlist"}
                        </span>
                      </h1>
                      <span className="shrink-0 rounded-full border border-fuchsia-400/40 bg-fuchsia-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
                        ● Public
                      </span>
                      {playlistTracks.length > 0 && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 shrink-0">
                          {playlistTracks.length} tracks
                          {playlistTracksTotalDuration ? ` (${playlistTracksTotalDuration})` : ""}
                        </span>
                      )}
                    </div>
                    {playlist?.artistName && (
                      <p className="text-xs text-white/40">
                        Curated by <span className="text-white/70">{playlist.artistName}</span>
                      </p>
                    )}
                    {playlist?.description && (
                      <p className="text-sm text-white/50 max-w-xl">
                        {playlist.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {playlistTracks.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePlayFromStart}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg shadow-primary-500/30 transition-transform hover:scale-105 active:scale-95"
                      aria-label={`Play ${playlist?.name ?? "playlist"}`}
                      title={`Play ${playlist?.name ?? "playlist"}`}
                    >
                      <svg className="h-4.5 w-4.5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(backTarget.href)}
                    className="h-9 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white inline-flex items-center gap-1.5"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    {backTarget.label}
                  </button>
                </div>
              </div>
            </section>

            {/* Track List Section */}
            <section className="space-y-4">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">
                  Loading playlist tracks...
                </div>
              ) : playlistTracks.length > 0 ? (
                <TrackList
                  tracks={playlistTracks}
                  autoQueueAfterPlay
                  onSelect={(track) => {
                    openTrackDetails({
                      ...track,
                      coverUrl: track.coverUrl ?? null,
                      s3KeyCover: track.s3KeyCover ?? null,
                      rating: track.rating ?? null,
                    });
                  }}
                  onAddToPlaylist={(trackId, targetPlaylistId, options) =>
                    addTrackToPlaylist(targetPlaylistId, trackId, options)
                  }
                  playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                  selectedTrackId={selectedTrack?.id ?? null}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-center text-sm text-white/55">
                  This playlist has no tracks.
                </div>
              )}
            </section>
          </div>
        </main>

        <ResizablePanel
          show={showTrackDetailsPanel}
          width={rightPanelWidth}
          setWidth={setRightPanelWidth}
        >
          <div className="h-full overflow-y-auto pb-4">
            {selectedTrack ? (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={closeTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Select a track to show song info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}
