"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import { usePlayerStore, usePlaylistStore } from "@/lib/store";

interface Track {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  rating?: string | null;
}

export default function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const playlists = usePlaylistStore((state) => state.playlists);
  const selectedPlaylistId = usePlaylistStore((state) => state.selectedPlaylistId);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const removeTrackFromPlaylist = usePlaylistStore((state) => state.removeTrackFromPlaylist);
  const deletePlaylist = usePlaylistStore((state) => state.deletePlaylist);
  const setSelectedPlaylistId = usePlaylistStore((state) => state.setSelectedPlaylistId);

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    const hasDoneWithoutCover = tracks.some(
      (t) => t.status === "done" && !t.coverUrl
    );
    const hasDoneWithoutHd = tracks.some(
      (t) => t.status === "done" && t.provider === "poyo" && !t.s3KeyHd
    );

    const interval = hasDoneWithoutCover || hasDoneWithoutHd ? 15000 : null;

    if (interval) {
      const timer = setInterval(() => {
        fetchTracks();
      }, interval);

      return () => clearInterval(timer);
    }
  }, [tracks]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  function startRightPanelResize(e: React.MouseEvent<HTMLDivElement>) {
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = rightPanelWidth;

    const onMouseMove = (event: MouseEvent) => {
      const delta = resizeStartXRef.current - event.clientX;
      setRightPanelWidth(resizeStartWidthRef.current + delta);
    };

    const onMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  async function fetchTracks() {
    const res = await fetch("/api/tracks");
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks.filter((t: Track) => t.status === "done"));
    }
    setLoading(false);
  }

  function handleDeleteTrack(trackId: string) {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    for (const playlist of playlists) {
      removeTrackFromPlaylist(playlist.id, trackId);
    }
    if (selectedTrack?.id === trackId) setSelectedTrack(null);
  }

  function handleTitleUpdate(trackId: string, newTitle: string) {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t))
    );
    if (selectedTrack?.id === trackId) {
      setSelectedTrack((prev) => (prev ? { ...prev, title: newTitle } : null));
    }
  }

  function handleAddToQueue(track: Track) {
    usePlayerStore.getState().enqueueTrack({
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
      duration: null,
      lyrics: track.lyrics,
      createdAt: track.createdAt,
      error: track.error,
    });
  }

  function handleCreatePlaylist() {
    const id = createPlaylist(newPlaylistName);
    if (id) {
      setSelectedPlaylistId(id);
      setNewPlaylistName("");
      setShowCreatePlaylist(false);
    }
  }

  function handleAddToPlaylist(trackId: string, playlistId: string) {
    addTrackToPlaylist(playlistId, trackId);
  }

  const selectedPlaylist =
    selectedPlaylistId === null
      ? null
      : playlists.find((playlist) => playlist.id === selectedPlaylistId) || null;

  const visibleTracks = selectedPlaylist
    ? tracks.filter((track) => selectedPlaylist.trackIds.includes(track.id))
    : tracks;

  function handlePlayTrack(url: string) {
    if (selectedTrack) {
      const player = usePlayerStore.getState();

      const playContext = visibleTracks
        .filter((t) => t.status === "done")
        .map((t) => ({
          id: t.id,
          title: t.title,
          provider: t.provider,
          providerModel: t.providerModel,
          prompt: t.prompt,
          status: t.status,
          audioUrl: t.audioUrl,
          audioUrlHd: t.audioUrlHd,
          format: t.format,
          formatHd: t.formatHd,
          s3Key: null,
          s3KeyHd: t.s3KeyHd,
          duration: null,
          lyrics: t.lyrics,
          createdAt: t.createdAt,
          error: t.error,
        }));

      player.setPlayContext(playContext);

      if (player.autoPlayNext) {
        const index = playContext.findIndex((t) => t.id === selectedTrack.id);
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
        duration: null,
        lyrics: selectedTrack.lyrics,
        createdAt: selectedTrack.createdAt,
        error: selectedTrack.error,
      });
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Sidebar credits={null} />
        <div className="lg:ml-60 flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar credits={null} />
      <div className="lg:ml-60 lg:flex">
        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
            <div className="px-4 py-3 space-y-3">
              <div>
                <h1 className="text-lg font-bold">Library</h1>
                <p className="text-xs text-white/40 mt-0.5">{visibleTracks.length} tracks shown</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setSelectedPlaylistId(null)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    selectedPlaylistId === null
                      ? "bg-primary-500/25 text-primary-200 border border-primary-400/30"
                      : "bg-white/5 text-white/60 hover:text-white/80"
                  }`}
                >
                  All tracks
                </button>
                {playlists.map((playlist) => (
                  <div key={playlist.id} className="flex items-center rounded-md bg-white/5 border border-white/10">
                    <button
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                      className={`px-2.5 py-1 text-xs rounded-l-md transition-colors ${
                        selectedPlaylistId === playlist.id ? "text-white bg-white/10" : "text-white/60 hover:text-white/80"
                      }`}
                    >
                      {playlist.name}
                    </button>
                    <button
                      onClick={() => deletePlaylist(playlist.id)}
                      className="px-2 py-1 text-xs text-white/40 hover:text-red-400 transition-colors"
                      title="Delete playlist"
                    >
                      x
                    </button>
                  </div>
                ))}

                {showCreatePlaylist ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="Playlist name"
                      className="h-7 px-2 rounded-md bg-white/5 border border-white/15 text-xs text-white placeholder:text-white/30"
                    />
                    <button
                      onClick={handleCreatePlaylist}
                      className="h-7 px-2 rounded-md bg-primary-500/80 text-white text-xs hover:bg-primary-500"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowCreatePlaylist(false);
                        setNewPlaylistName("");
                      }}
                      className="h-7 px-2 rounded-md bg-white/5 text-xs text-white/60 hover:text-white/80"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreatePlaylist(true)}
                    className="px-2.5 py-1 rounded-md bg-white/5 text-xs text-white/70 hover:text-white/90"
                  >
                    + Playlist
                  </button>
                )}
              </div>
            </div>
          </div>

          <main className="p-4 pb-32">
            <TrackList
              tracks={visibleTracks}
              autoQueueAfterPlay
              onSelect={(t) => setSelectedTrack(t)}
              onDelete={handleDeleteTrack}
              onAddToQueue={handleAddToQueue}
              onAddToPlaylist={handleAddToPlaylist}
              playlists={playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }))}
              onTitleUpdate={handleTitleUpdate}
            />
          </main>
        </div>

        {showTrackDetailsPanel && (
          <div
            className="hidden lg:block w-1 cursor-col-resize bg-transparent hover:bg-white/10 transition-colors"
            onMouseDown={startRightPanelResize}
            title="Resize details panel"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize details panel"
          />
        )}

        {showTrackDetailsPanel && (
          <aside className="right-details-panel hidden lg:block shrink-0 border-l border-white/5 bg-[#0d0d12]">
            <div className="sticky top-0 h-screen pb-28">
              {selectedTrack ? (
                <TrackDetail
                  mode="sidebar"
                  track={selectedTrack}
                  onClose={() => setSelectedTrack(null)}
                  onPlay={handlePlayTrack}
                  onDownload={handleDownloadTrack}
                />
              ) : (
                <div className="h-full px-5 py-6 text-white/45">
                  <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                  <p className="text-sm mt-3">Select a track or press play to show song info and lyrics.</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {showTrackDetailsPanel && selectedTrack && (
        <div className="lg:hidden">
          <TrackDetail
            mode="overlay"
            track={selectedTrack}
            onClose={() => setSelectedTrack(null)}
            onPlay={handlePlayTrack}
            onDownload={handleDownloadTrack}
          />
        </div>
      )}
    </div>
  );
}
