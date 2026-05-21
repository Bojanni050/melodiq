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
  const [libraryView, setLibraryView] = useState<"songs" | "playlists">("songs");
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
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
    if (!showTrackDetailsPanel || !currentTrack) return;

    const matchedTrack = tracks.find((track) => track.id === currentTrack.id);
    if (matchedTrack) {
      setSelectedTrack(matchedTrack);
      return;
    }

    setSelectedTrack({
      id: currentTrack.id,
      title: currentTrack.title,
      provider: currentTrack.provider,
      providerModel: currentTrack.providerModel,
      prompt: currentTrack.prompt,
      lyrics: currentTrack.lyrics,
      status: currentTrack.status,
      audioUrl: currentTrack.audioUrl,
      audioUrlHd: currentTrack.audioUrlHd,
      format: currentTrack.format ?? null,
      formatHd: currentTrack.formatHd ?? null,
      duration: currentTrack.duration ?? null,
      createdAt: currentTrack.createdAt,
      error: currentTrack.error,
      s3KeyHd: currentTrack.s3KeyHd,
      coverUrl: null,
      s3KeyCover: null,
    });
  }, [showTrackDetailsPanel, currentTrack, tracks]);

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

  function handleCloseTrackDetails() {
    setSelectedTrack(null);
    setShowTrackDetailsPanel(false);
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
      coverUrl: track.coverUrl,
      s3KeyCover: track.s3KeyCover,
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

  function getPlaylistTracks(playlistId: string) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return [] as Track[];
    return tracks.filter((track) => playlist.trackIds.includes(track.id));
  }

  function getPlaylistCoverImages(playlistId: string) {
    return getPlaylistTracks(playlistId)
      .map((track) => track.coverUrl)
      .filter((cover): cover is string => !!cover)
      .slice(0, 4);
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
          coverUrl: t.coverUrl,
          s3KeyCover: t.s3KeyCover,
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
        coverUrl: selectedTrack.coverUrl,
        s3KeyCover: selectedTrack.s3KeyCover,
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
                <p className="text-xs text-white/40 mt-0.5">
                  {libraryView === "songs"
                    ? `${visibleTracks.length} tracks shown`
                    : `${playlists.length} playlists`}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLibraryView("songs")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    libraryView === "songs"
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  Songs
                </button>
                <button
                  onClick={() => setLibraryView("playlists")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    libraryView === "playlists"
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  Playlists
                </button>
              </div>

              {libraryView === "songs" && (
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
              )}

              {libraryView === "playlists" && (
                <div>
                  {showCreatePlaylist ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder="Playlist name"
                        className="h-8 px-2.5 rounded-md bg-white/5 border border-white/15 text-xs text-white placeholder:text-white/30"
                      />
                      <button
                        onClick={handleCreatePlaylist}
                        className="h-8 px-3 rounded-md bg-primary-500/80 text-white text-xs hover:bg-primary-500"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowCreatePlaylist(false);
                          setNewPlaylistName("");
                        }}
                        className="h-8 px-3 rounded-md bg-white/5 text-xs text-white/60 hover:text-white/80"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCreatePlaylist(true)}
                      className="px-3 py-1.5 rounded-md bg-white/5 text-xs text-white/70 hover:text-white/90"
                    >
                      + Create Playlist
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <main className="p-4">
            {libraryView === "songs" ? (
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
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <button
                  onClick={() => setShowCreatePlaylist(true)}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors p-4 min-h-55 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-3xl text-white/80 mb-3">+</div>
                  <p className="text-sm font-medium text-white/90">Create Playlist</p>
                </button>

                {playlists.map((playlist) => {
                  const playlistTracks = getPlaylistTracks(playlist.id);
                  const coverImages = getPlaylistCoverImages(playlist.id);
                  const coverGrid = [...coverImages];
                  while (coverGrid.length > 0 && coverGrid.length < 4) {
                    coverGrid.push(coverGrid[coverGrid.length - 1]);
                  }

                  return (
                    <div key={playlist.id} className="space-y-2">
                      <button
                        onClick={() => {
                          setSelectedPlaylistId(playlist.id);
                          setLibraryView("songs");
                        }}
                        className="w-full text-left"
                      >
                        <div className="aspect-square rounded-2xl overflow-hidden border border-white/10 bg-[#13131b] relative">
                          {coverGrid.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-white/5 to-white/2">
                              <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 19V6l12-3v13M9 19c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2zm12-3c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2zM9 10l12-3" />
                              </svg>
                            </div>
                          ) : coverGrid.length === 1 ? (
                            <img src={coverGrid[0]} alt={playlist.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-px bg-black/40">
                              {coverGrid.slice(0, 4).map((cover, index) => (
                                <img key={`${playlist.id}-${index}`} src={cover} alt={playlist.name} className="w-full h-full object-cover" />
                              ))}
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="px-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => {
                              setSelectedPlaylistId(playlist.id);
                              setLibraryView("songs");
                            }}
                            className="text-left min-w-0"
                          >
                            <p className="text-white/95 text-sm font-medium truncate">{playlist.name}</p>
                            <p className="text-white/60 text-xs">{playlistTracks.length} songs</p>
                          </button>
                          <button
                            onClick={() => deletePlaylist(playlist.id)}
                            className="text-white/35 hover:text-red-400 transition-colors text-xs px-1.5 py-1"
                            title="Delete playlist"
                          >
                            x
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  onClose={handleCloseTrackDetails}
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
            onClose={handleCloseTrackDetails}
            onPlay={handlePlayTrack}
            onDownload={handleDownloadTrack}
          />
        </div>
      )}
    </div>
  );
}
