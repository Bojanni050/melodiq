"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { usePlayerStore, usePlaylistStore, useSidebarStore, useUserStore } from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";
import { formatTotalDuration } from "@/lib/track-utils";

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const router = useRouter();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const playlistId = params?.playlistId;
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  useEffect(() => { if (!user) void loadUser(); }, [user, loadUser]);

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const {
    playlists,
    addTrackToPlaylist,
    reorderPlaylistTracks,
    localMovePlaylistTrack,
    loadPlaylists,
  } = usePlaylistStore();

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<TrackItem | null>(null);
  const [isEditingPlaylistOrder, setIsEditingPlaylistOrder] = useState(false);
  const [togglingPlaylistPublic, setTogglingPlaylistPublic] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const res = await fetch("/api/tracks?status=done");
      if (!active) return;

      if (res.ok) {
        const data = await res.json();
        setTracks((data.tracks || []).map((t: TrackItem) => ({ ...t })));
      }

      if (active) setLoading(false);
    }

    fetchTracks();
    void loadPlaylists();

    return () => {
      active = false;
    };
  }, [loadPlaylists, playlistId]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  const selectedPlaylist = useMemo(
    () => (playlistId ? playlists.find((playlist) => playlist.id === playlistId) ?? null : null),
    [playlistId, playlists],
  );

  const playlistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return selectedPlaylist.trackIds.map((id) => byId.get(id)).filter((t): t is TrackItem => Boolean(t));
  }, [selectedPlaylist, tracks]);

  const playlistTracksTotalDuration = useMemo(
    () => formatTotalDuration(playlistTracks.reduce((s, t) => s + (t.duration ?? 0), 0)),
    [playlistTracks],
  );

  useEffect(() => {
    if (!showTrackDetailsPanel) return;

    setSelectedTrack((prev) => {
      if (prev) {
        const found = tracks.find((t) => t.id === prev.id);
        if (found) return found;
        return prev;
      }
      if (currentTrack) {
        const found = tracks.find((t) => t.id === currentTrack.id);
        if (found) return found;
        return currentTrack as unknown as TrackItem;
      }
      return null;
    });
  }, [showTrackDetailsPanel, tracks, currentTrack]);

  const prevIsPlaying = useRef(isPlaying);
  const prevCurrentTrackId = useRef(currentTrack?.id);

  useEffect(() => {
    const playResumed = isPlaying && !prevIsPlaying.current;
    const trackChanged = currentTrack?.id !== prevCurrentTrackId.current;

    prevIsPlaying.current = isPlaying;
    prevCurrentTrackId.current = currentTrack?.id;

    if (showTrackDetailsPanel && currentTrack && (playResumed || trackChanged)) {
      setSelectedTrack((prev) => {
        if (prev?.id === currentTrack.id) return prev;
        const matched = tracks.find((t) => t.id === currentTrack.id);
        return matched || (currentTrack as unknown as TrackItem);
      });
    }
  }, [isPlaying, currentTrack, showTrackDetailsPanel, tracks]);

  function handleDeleteTrack(trackId: string) {
    setTracks((current) => current.filter((track) => track.id !== trackId));
  }

  function handleSelectTrack(track: TrackItem) {
    setSelectedTrack(track);
    setShowTrackDetailsPanel(true);
  }

  function handleCloseTrackDetails() {
    setShowTrackDetailsPanel(false);
  }

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;

    const player = usePlayerStore.getState();
    const playContext = playlistTracks
      .filter((track) => track.status === "done")
      .map((track) => ({
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
      audioUrl: url,
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

  async function handleTogglePlaylistPublic() {
    if (!selectedPlaylist) return;
    setTogglingPlaylistPublic(true);
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-public" }),
      });
      if (!res.ok) {
        console.error(`Failed to toggle playlist public: HTTP ${res.status}`);
        return;
      }
      const data = await res.json().catch(() => null);
      const updated = data?.playlist;
      if (updated) {
        const { hydratePlaylistsFromServer, playlists: storePlaylists } = usePlaylistStore.getState();
        hydratePlaylistsFromServer(storePlaylists.map((p) => p.id === selectedPlaylist.id ? { ...p, isPublic: updated.isPublic, publishedAt: updated.publishedAt } : p));
      }
      window.dispatchEvent(new CustomEvent("discover-playlists-changed"));
    } catch (error) {
      console.error("Failed to toggle playlist public:", error);
    } finally {
      setTogglingPlaylistPublic(false);
    }
  }

  if (!loading && !selectedPlaylist) {
    return (
      <div className="h-screen bg-[#09090d] overflow-hidden text-white">
        <Sidebar credits={null} />
        <div className="h-[calc(100vh-var(--player-height))] flex items-center justify-center px-6" style={{ marginLeft: sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/70">Playlist not found.</p>
            <button
              type="button"
              onClick={() => router.push("/playlists")}
              className="mt-4 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            >
              Back to playlists
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="h-[calc(100vh-var(--player-height))] flex" style={{ marginLeft: sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => router.push("/playlists")}
                className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All playlists
              </button>
            </div>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold truncate">{selectedPlaylist?.name}</h2>
                    {selectedPlaylist?.isPublic && (
                      <span className="shrink-0 rounded-full border border-fuchsia-400/40 bg-fuchsia-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
                        ● Published
                      </span>
                    )}
                    {selectedPlaylist && !selectedPlaylist.isSystem && user?.role === "admin" && (
                      <button
                        type="button"
                        onClick={() => void handleTogglePlaylistPublic()}
                        disabled={togglingPlaylistPublic}
                        className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {togglingPlaylistPublic
                          ? selectedPlaylist.isPublic
                            ? "Unpublishing…"
                            : "Publishing…"
                          : selectedPlaylist.isPublic
                            ? "Unpublish"
                            : "Publish"}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white/55">{playlistTracks.length} songs in this playlist{playlistTracksTotalDuration ? ` (${playlistTracksTotalDuration})` : ""}.</p>
                  {selectedPlaylist?.description && (
                    <p className="text-sm text-white/40 mt-1 max-w-xl">{selectedPlaylist.description}</p>
                  )}
                </div>
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingPlaylistOrder && selectedPlaylist) {
                        reorderPlaylistTracks(selectedPlaylist.id, selectedPlaylist.trackIds);
                      }
                      setIsEditingPlaylistOrder((v) => !v);
                    }}
                    className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${isEditingPlaylistOrder ? "border-white bg-white text-black hover:bg-white/90" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"}`}
                  >
                    {isEditingPlaylistOrder ? "Save order" : "Edit order"}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading tracks...</div>
              ) : playlistTracks.length > 0 ? (
                <TrackList
                  tracks={playlistTracks}
                  autoQueueAfterPlay
                  enableDragReorder={isEditingPlaylistOrder}
                  dragOrderKey={selectedPlaylist?.id}
                  onTrackMoved={(trackId, toIndex) => {
                    if (!selectedPlaylist) return;
                    localMovePlaylistTrack(selectedPlaylist.id, trackId, toIndex);
                  }}
                  onSelect={handleSelectTrack}
                  onDelete={handleDeleteTrack}
                  onAddToPlaylist={(trackId, targetPlaylistId, options) => addTrackToPlaylist(targetPlaylistId, trackId, options)}
                  playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                  onTitleUpdate={(trackId, newTitle) =>
                    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)))
                  }
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                  This playlist has no tracks yet. Use track actions and choose Add to Playlist.
                </div>
              )}
            </section>
          </div>
        </main>

        <ResizablePanel show={showTrackDetailsPanel} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="h-full overflow-y-auto">
            {selectedTrack ? (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={handleCloseTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Select a track to show track info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {showTrackDetailsPanel && selectedTrack && (
        <div className="lg:hidden">
          <TrackDetail
            track={selectedTrack}
            onClose={handleCloseTrackDetails}
            onPlay={handlePlayTrack}
            onDownload={handleDownloadTrack}
            mode="overlay"
          />
        </div>
      )}
    </div>
  );
}
