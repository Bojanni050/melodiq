"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { getWorkspaceCoverCollage } from "@/lib/track-utils";
import { DEFAULT_WORKSPACE_ID, usePlayerStore, usePlaylistStore, useWorkspaceStore } from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const SWATCH_COLORS = [
  "bg-violet-600",
  "bg-sky-500",
  "bg-orange-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-teal-500",
] as const;

function getWorkspaceSwatchClass(workspaceId: string) {
  return SWATCH_COLORS[hashString(workspaceId) % SWATCH_COLORS.length];
}

export default function WorkspaceDetailPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const workspaceId = params?.workspaceId;

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const { playlists, addTrackToPlaylist, loadPlaylists } = usePlaylistStore();
  const {
    workspaces,
    setSelectedWorkspaceId,
    createWorkspaceFolder,
    hydrateWorkspacesFromServer,
  } = useWorkspaceStore();

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<TrackItem | null>(null);

  useEffect(() => {
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId);
    }
  }, [setSelectedWorkspaceId, workspaceId]);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const res = await fetch("/api/tracks");
      if (!active) return;

      if (res.ok) {
        const data = await res.json();
        const cleanedTracks = (data.tracks || [])
          .filter((track: TrackItem) => track.status === "done")
          .map((t: TrackItem) => ({
            ...t,
            title: t.title ? t.title.replace(/\s*\(2\)\s*$/, "") : t.title,
          }));
        setTracks(cleanedTracks);
        if (Array.isArray(data.workspaces)) {
          hydrateWorkspacesFromServer(data.workspaces);
        }
      }

      setLoading(false);
    }

    fetchTracks();
    void loadPlaylists();

    return () => {
      active = false;
    };
  }, [loadPlaylists]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  const selectedWorkspace = useMemo(
    () => (workspaceId ? workspaces.find((workspace) => workspace.id === workspaceId) ?? null : null),
    [workspaceId, workspaces],
  );

  const childWorkspacesByParent = useMemo(() => {
    const grouped = new Map<string, typeof workspaces>();
    workspaces
      .filter((workspace) => Boolean(workspace.parentWorkspaceId))
      .forEach((workspace) => {
        const parentId = workspace.parentWorkspaceId as string;
        const list = grouped.get(parentId) ?? [];
        grouped.set(parentId, [...list, workspace]);
      });
    return grouped;
  }, [workspaces]);

  const selectedWorkspaceChildren = useMemo(() => {
    if (!selectedWorkspace) return [];
    return childWorkspacesByParent.get(selectedWorkspace.id) ?? [];
  }, [childWorkspacesByParent, selectedWorkspace]);

  const selectedWorkspaceParent = useMemo(() => {
    if (!selectedWorkspace?.parentWorkspaceId) return null;
    return (
      workspaces.find((workspace) => workspace.id === selectedWorkspace.parentWorkspaceId) ?? null
    );
  }, [selectedWorkspace, workspaces]);

  const selectedWorkspaceTracks = useMemo(
    () => (selectedWorkspace ? tracks.filter((track) => selectedWorkspace.trackIds.includes(track.id)) : []),
    [selectedWorkspace, tracks],
  );

  useEffect(() => {
    if (!showTrackDetailsPanel) return;

    setSelectedTrack((prev) => {
      if (prev) {
        const found = tracks.find((t) => t.id === prev.id);
        if (found) return found as TrackItem;
        return prev;
      }
      if (currentTrack) {
        const found = tracks.find((t) => t.id === currentTrack.id);
        if (found) return found as TrackItem;
        return currentTrack as TrackItem;
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

  const defaultSortedWorkspaceTracks = useMemo(() => {
    const list = [...selectedWorkspaceTracks];
    list.sort((left, right) => {
      const leftTime = Number(new Date(left.createdAt));
      const rightTime = Number(new Date(right.createdAt));
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
      return rightTime - leftTime;
    });
    return list;
  }, [selectedWorkspaceTracks]);

  const headerCoverUrl = useMemo(() => {
    const coverUrlForTrack = (track: { id: string; coverUrl?: string | null; s3KeyCover?: string | null } | null) =>
      track?.coverUrl || (track?.s3KeyCover ? `/api/tracks/${track.id}/cover` : null);

    const firstTrack = defaultSortedWorkspaceTracks[0] ?? null;

    if (currentTrack && selectedWorkspace?.trackIds.includes(currentTrack.id)) {
      return coverUrlForTrack(currentTrack);
    }

    return coverUrlForTrack(firstTrack);
  }, [currentTrack, defaultSortedWorkspaceTracks, selectedWorkspace?.trackIds]);

  function backToFolderView() {
    if (selectedWorkspaceParent) {
      router.push(`/workspaces/${selectedWorkspaceParent.id}`);
      return;
    }

    router.push("/workspaces");
  }

  function openWorkspace(nextWorkspaceId: string) {
    setSelectedWorkspaceId(nextWorkspaceId);
    router.push(`/workspaces/${nextWorkspaceId}`);
  }

  function handleCreateFolder() {
    if (!selectedWorkspace || selectedWorkspace.parentWorkspaceId) return;
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    const folderId = createWorkspaceFolder(selectedWorkspace.id, trimmed);
    if (!folderId) return;

    setNewFolderName("");
    setShowCreateFolder(false);
    openWorkspace(folderId);
  }

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
    const playContext = selectedWorkspaceTracks
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
        playCount: track.playCount ?? null,
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
      playCount: selectedTrack.playCount ?? null,
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

  if (!selectedWorkspace) {
    return (
      <div className="h-screen bg-[#09090d] overflow-hidden text-white">
        <Sidebar credits={null} />
        <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/70">Workspace not found.</p>
            <button
              type="button"
              onClick={() => router.push("/workspaces")}
              className="mt-4 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            >
              Back to folders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex">
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-[73px] lg:pt-5">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(135deg,#11111a_0%,#0b0b11_100%)] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              {headerCoverUrl ? (
                <div aria-hidden="true" className="absolute inset-0">
                  <img
                    src={headerCoverUrl}
                    alt=""
                    className="h-full w-full object-cover scale-125 blur-2xl opacity-55"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_45%),linear-gradient(135deg,rgba(9,9,13,0.35)_0%,rgba(9,9,13,0.86)_70%,rgba(9,9,13,0.98)_100%)]" />
                </div>
              ) : null}

              <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/35">Workspace</p>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight truncate">{selectedWorkspace.name}</h1>
                  <p className="text-sm text-white/60 mt-1">
                    {selectedWorkspaceTracks.length} songs in this folder.
                  </p>
                </div>

                {selectedWorkspace.id === DEFAULT_WORKSPACE_ID ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">Default workspace</span>
                ) : null}
              </div>
            </section>

            <div className="flex items-center">
              <button
                type="button"
                onClick={backToFolderView}
                className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to folders
              </button>
            </div>

            <section className="space-y-4">
              <h2 className="text-base font-semibold">Tracks</h2>
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading tracks...</div>
              ) : selectedWorkspaceTracks.length > 0 ? (
                <TrackList
                  tracks={selectedWorkspaceTracks}
                  autoQueueAfterPlay
                  onSelect={handleSelectTrack}
                  onDelete={handleDeleteTrack}
                  onAddToPlaylist={(trackId, playlistId, options) => addTrackToPlaylist(playlistId, trackId, options)}
                  playlists={playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }))}
                  onTitleUpdate={(trackId, newTitle) =>
                    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)))
                  }
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                  This workspace has no songs yet. Use track actions and choose Move To Workspace.
                </div>
              )}
            </section>

            {!selectedWorkspace.parentWorkspaceId && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Subfolders</h2>
                  {showCreateFolder ? (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                      <input
                        value={newFolderName}
                        onChange={(event) => setNewFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleCreateFolder();
                          if (event.key === "Escape") {
                            setShowCreateFolder(false);
                            setNewFolderName("");
                          }
                        }}
                        placeholder="Subfolder name"
                        className="h-9 w-44 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateFolder(false);
                          setNewFolderName("");
                        }}
                        className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCreateFolder(true)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      + Add subfolder
                    </button>
                  )}
                </div>

                {selectedWorkspaceChildren.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="space-y-1.5">
                      {selectedWorkspaceChildren.map((childWorkspace) => {
                        const childTracks = tracks.filter((track) => childWorkspace.trackIds.includes(track.id));
                        const childCover = getWorkspaceCoverCollage(childWorkspace.id, childTracks)[0];
                        return (
                          <button
                            key={childWorkspace.id}
                            type="button"
                            onClick={() => openWorkspace(childWorkspace.id)}
                            className="group flex w-full items-center gap-3 rounded-xl border border-white/8 bg-[#0f1017] px-3 py-2 text-left transition-colors hover:bg-white/4"
                          >
                            <div className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ${getWorkspaceSwatchClass(childWorkspace.id)}`}>
                              {childCover ? (
                                <img src={childCover} alt={childWorkspace.name} loading="lazy" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{childWorkspace.name}</p>
                            </div>
                            <span className="text-xs text-white/45">{childTracks.length} songs</span>
                            <svg className="h-4 w-4 shrink-0 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/55">
                    No subfolders yet.
                  </div>
                )}
              </section>
            )}
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
                <p className="text-sm mt-3">Select a track to show song info and lyrics.</p>
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
