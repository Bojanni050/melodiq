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
import { useSmartBack } from "@/lib/smart-back";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";
import { publicReleaseTracksToTrackItems, type PublicReleaseSummary } from "@/lib/public-release";

interface PublicReleaseData extends PublicReleaseSummary {
  description: string | null;
  releaseDate: string | null;
}

export default function PublicReleasePage() {
  const params = useParams<{ releaseId: string }>();
  const router = useRouter();
  const releaseId = params?.releaseId;

  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  const isListener = user?.role === "listener" || user?.role == null;
  const backTarget = useSmartBack({ href: "/discover/releases", label: "Back to Releases" });

  useEffect(() => {
    if (!user) void loadUser();
  }, [user, loadUser]);

  const [release, setRelease] = useState<PublicReleaseData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const rightPanelWidth = usePlayerStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((s) => s.setRightPanelWidth);
  const { playlists, addTrackToPlaylist, loadPlaylists } = usePlaylistStore();

  useEffect(() => {
    if (!releaseId) return;
    let active = true;

    async function fetchRelease() {
      const res = await fetch(`/api/discover/releases/${releaseId}`);
      if (!active) return;

      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setRelease(data.release);
      }
      setLoading(false);
    }

    fetchRelease();
    void loadPlaylists();

    return () => {
      active = false;
    };
  }, [releaseId, loadPlaylists]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  const releaseTracks: TrackItem[] = useMemo(() => {
    if (!release) return [];
    return publicReleaseTracksToTrackItems(release);
  }, [release]);

  const releaseTracksTotalDuration = useMemo(
    () => formatTotalDuration(releaseTracks.reduce((s, t) => s + (t.duration ?? 0), 0)),
    [releaseTracks],
  );

  const {
    selectedTrack,
    showTrackDetailsPanel,
    openTrackDetails,
    closeTrackDetails,
  } = useTrackDetailsPanel<TrackItem>(releaseTracks);

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;

    const player = usePlayerStore.getState();
    const playContext = releaseTracks.map((track) => ({
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      prompt: track.prompt,
      status: track.status,
      audioUrl: track.audioUrl,
      audioUrlHd: track.audioUrlHd,
      format: track.format,
      formatHd: track.formatHd,
      s3Key: null,
      s3KeyHd: track.s3KeyHd,
      duration: track.duration,
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
      createdAt: track.createdAt,
      error: track.error,
      coverUrl: track.coverUrl ?? null,
      s3KeyCover: track.s3KeyCover ?? null,
      rating: track.rating ?? null,
      artistName: track.artistName ?? null,
      publicSource: true,
    }));

    player.setPlayContext(playContext);

    if (player.autoPlayNext) {
      const index = playContext.findIndex((track) => track.id === selectedTrack.id);
      if (index >= 0) {
        player.setQueue(playContext.slice(index + 1));
      }
    }

    player.playTrackFromGesture({
      id: selectedTrack.id,
      title: selectedTrack.title,
      provider: selectedTrack.provider,
      providerModel: selectedTrack.providerModel,
      prompt: selectedTrack.prompt,
      status: selectedTrack.status,
      audioUrl: url || null,
      audioUrlHd: selectedTrack.audioUrlHd,
      format: selectedTrack.format,
      formatHd: selectedTrack.formatHd,
      s3Key: null,
      s3KeyHd: selectedTrack.s3KeyHd,
      duration: selectedTrack.duration,
      lyrics: selectedTrack.lyrics,
      lyricsTimestamps: selectedTrack.lyricsTimestamps,
      createdAt: selectedTrack.createdAt,
      error: selectedTrack.error,
      coverUrl: selectedTrack.coverUrl ?? null,
      s3KeyCover: selectedTrack.s3KeyCover ?? null,
      rating: selectedTrack.rating ?? null,
      artistName: selectedTrack.artistName ?? null,
      publicSource: true,
    });
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
    release?.coverUrl;

  if (notFound || (!loading && !release)) {
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
            <h2 className="text-lg font-semibold text-white">Release not found</h2>
            <p className="text-sm text-white/60 mt-2">
              This release is unavailable or was unpublished.
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
            {/* Hero header — cover art left, artist/writer info beside it */}
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                <div className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1b25] shadow-2xl shadow-black/50 sm:h-44 sm:w-44">
                  {release?.coverUrl ? (
                    <img src={release.coverUrl} alt={release.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-600/40 to-primary-900/40">
                      <svg className="h-10 w-10 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="shrink-0 rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-white/60">
                      {release?.type}
                    </span>
                    <span className="shrink-0 rounded-full border border-fuchsia-400/40 bg-fuchsia-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
                      ● Public
                    </span>
                  </div>
                  <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {release?.title}
                  </h1>
                  <p className="text-sm text-white/60">
                    <span className="text-white/85 font-semibold">{release?.artistName}</span>
                    {releaseTracks.length > 0 && (
                      <>
                        {" "}
                        · {releaseTracks.length} {releaseTracks.length === 1 ? "track" : "tracks"}
                        {releaseTracksTotalDuration ? `, ${releaseTracksTotalDuration}` : ""}
                      </>
                    )}
                  </p>
                  {release?.description && (
                    <p className="text-sm text-white/45 max-w-xl">{release.description}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => router.push(backTarget.href)}
                  className="h-9 shrink-0 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white inline-flex items-center gap-1.5 self-start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {backTarget.label}
                </button>
              </div>
            </section>

            {/* Track List Section */}
            <section className="space-y-4">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">
                  Loading release tracks...
                </div>
              ) : releaseTracks.length > 0 ? (
                <TrackList
                  tracks={releaseTracks}
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
                  This release has no published tracks.
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
