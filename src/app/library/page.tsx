"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail, { type TrackDetailTrack } from "@/components/TrackDetail";
import TrackEditPanel from "@/components/tracks/TrackEditPanel";
import type { TrackItem } from "@/components/tracks/types";
import ResizablePanel from "@/components/studio/ResizablePanel";
import TrashPanel from "@/components/library/TrashPanel";
import ArchivePanel from "@/components/library/ArchivePanel";
import UploadPanel from "@/components/library/UploadPanel";
import ReuseConfirmDialog from "@/components/library/ReuseConfirmDialog";
import type { LibraryTrack, LibraryView } from "@/components/library/types";
import {
  DEFAULT_WORKSPACE_ID,
  usePlayerStore,
  usePlaylistStore,
  useReleaseStore,
  useSidebarStore,
  useStudioStore,
  useUserStore,
  useWorkspaceStore,
} from "@/lib/store";
import { formatTotalDuration } from "@/lib/track-utils";
import { withCdn } from "@/lib/cdn";

export default function LibraryPage() {
  const router = useRouter();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  const isListener = user?.role === "listener";
  const allowLyricsEdit = user?.role === "admin";
  useEffect(() => { if (!user) void loadUser(); }, [user, loadUser]);
  const [reuseConfirmTrack, setReuseConfirmTrack] = useState<TrackItem | null>(null);
  const { playlists, addTrackToPlaylist, loadPlaylists } = usePlaylistStore();
  const loadReleases = useReleaseStore((state) => state.loadReleases);
  const {
    workspaces,
    selectedWorkspaceId,
    moveTracksToWorkspace,
    ensureDefaultWorkspace,
    hydrateWorkspacesFromServer,
  } = useWorkspaceStore();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const knownArtistNames = useMemo(() => {
    const names = new Set<string>();
    tracks.forEach((t) => { if (t.artistName) names.add(t.artistName); });
    return Array.from(names).sort();
  }, [tracks]);

  const knownComposerNames = useMemo(() => {
    const names = new Set<string>();
    tracks.forEach((t) => { if (t.composerName) names.add(t.composerName); });
    return Array.from(names).sort();
  }, [tracks]);

  const knownWriterNames = useMemo(() => {
    const names = new Set<string>();
    tracks.forEach((t) => { if (t.writerName) names.add(t.writerName); });
    return Array.from(names).sort();
  }, [tracks]);
  const [view, setView] = useState<LibraryView>("songs");
  const [trashedTracks, setTrashedTracks] = useState<LibraryTrack[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [archivedTracks, setArchivedTracks] = useState<LibraryTrack[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<LibraryTrack | null>(null);
  const [editingTrack, setEditingTrack] = useState<LibraryTrack | null>(null);
  const [uploadWorkspaceId, setUploadWorkspaceId] = useState<string>(DEFAULT_WORKSPACE_ID);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);

  const fetchTracks = useCallback(async (activeCheck?: () => boolean) => {
    if (activeCheck && !activeCheck()) return;
    if (isListener) {
      // Listeners browse published tracks from the community, not their own library
      const res = await fetch("/api/discover");
      if (activeCheck && !activeCheck()) return;
      if (res.ok) {
        const data = await res.json();
        const published = (data.published || []).map((t: any) => ({
          // Discover tracks carry a PublicTrackSummary (no prompt/audio fields,
          // but lyrics are included read-only). Normalize into a full
          // LibraryTrack so TrackCard / TrackDetail / the player never hit
          // undefined fields, and point the cover at the public discover route
          // (the feed's /api/tracks/{id}/cover is an owner-only route and
          // 404s for listeners).
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
          error: null,
          s3Key: null,
          s3KeyHd: null,
          coverUrl: withCdn(`/api/discover/${t.id}/cover`),
          s3KeyCover: null,
          artistName: t.artistName ?? null,
          artistId: t.artistId ?? null,
          instrumental: t.instrumental ?? false,
          createdAt: t.publishDate ?? new Date().toISOString(),
          // Mark as public source so playback routes through the discover API
          publicSource: true,
        }));
        setTracks(published);
      }
      setLoading(false);
      return;
    }

    const res = await fetch("/api/tracks?status=done");
    if (activeCheck && !activeCheck()) return;
    if (res.ok) {
      const data = await res.json();
      const cleanedTracks = (data.tracks || []).map((t: any) => ({ ...t }));
      setTracks(cleanedTracks);
      if (Array.isArray(data.workspaces)) {
        hydrateWorkspacesFromServer(data.workspaces);
      }
    }
    setLoading(false);
  }, [isListener]);

  const fetchTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const res = await fetch("/api/tracks?trash=true");
      if (res.ok) {
        const data = await res.json();
        setTrashedTracks((data.tracks || []).map((t: any) => ({ ...t })));
      }
    } finally {
      setTrashLoading(false);
    }
  }, []);

  const fetchArchived = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch("/api/tracks?archived=true");
      if (res.ok) {
        const data = await res.json();
        setArchivedTracks((data.tracks || []).map((t: any) => ({ ...t })));
      }
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  const handleRestoreArchivedTrack = useCallback(async (trackId: string) => {
    await fetch(`/api/tracks/${trackId}/archive`, { method: "DELETE" });
    setArchivedTracks((prev) => prev.filter((t) => t.id !== trackId));
    await fetchTracks();
  }, [fetchTracks]);

  const handleRestoreTrack = useCallback(async (trackId: string) => {
    await fetch(`/api/tracks/${trackId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restore: true }) });
    setTrashedTracks((prev) => prev.filter((t) => t.id !== trackId));
    await fetchTracks();
  }, [fetchTracks]);

  const handleDeleteTrackForever = useCallback(async (trackId: string) => {
    const track = trashedTracks.find((t) => t.id === trackId);
    if (!confirm(`Permanently delete "${track?.title || "this track"}"? This cannot be undone.`)) return;
    await fetch(`/api/tracks/${trackId}?permanent=true`, { method: "DELETE" });
    setTrashedTracks((prev) => prev.filter((t) => t.id !== trackId));
  }, [trashedTracks]);

  const handleUploadFinished = useCallback((uploadedTracks: LibraryTrack[], workspaceId: string) => {
    if (uploadedTracks.length > 0) {
      const uploadedTrackIds = uploadedTracks.map((track) => track.id);
      moveTracksToWorkspace(workspaceId, uploadedTrackIds);

      setTracks((current) => {
        const byId = new Map(current.map((track) => [track.id, track]));
        uploadedTracks.forEach((track) => byId.set(track.id, track));
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("melodiq:tracks-uploaded", {
            detail: { trackIds: uploadedTrackIds, workspaceId },
          })
        );
      }
    }

    void fetchTracks();
  }, [moveTracksToWorkspace, fetchTracks]);

  useEffect(() => {
    function consumeJumpToTrack() {
      const trackId = sessionStorage.getItem("melodiq-jump-to-track");
      if (!trackId) return;
      sessionStorage.removeItem("melodiq-jump-to-track");
      setView("songs");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("melodiq:scroll-to-track", { detail: { trackId } }));
      }, 300);
    }

    consumeJumpToTrack();
    window.addEventListener("melodiq:jump-to-now-playing", consumeJumpToTrack);
    return () => window.removeEventListener("melodiq:jump-to-now-playing", consumeJumpToTrack);
  }, []);

  useEffect(() => {
    let active = true;
    fetchTracks(() => active);
    void loadPlaylists();
    void loadReleases();
    return () => {
      active = false;
    };
  }, [fetchTracks, loadPlaylists, loadReleases]);

  useEffect(() => {
    function onTracksChanged() {
      let active = true;
      fetchTracks(() => active);
      return () => { active = false; };
    }
    window.addEventListener("tracks-changed", onTracksChanged);
    return () => window.removeEventListener("tracks-changed", onTracksChanged);
  }, [fetchTracks]);

  useEffect(() => {
    useWorkspaceStore.persist.rehydrate();
  }, []);


  useEffect(() => {
    if (useWorkspaceStore.persist.hasHydrated()) {
      ensureDefaultWorkspace();
      return;
    }

    const unsubscribe = useWorkspaceStore.persist.onFinishHydration(() => {
      ensureDefaultWorkspace();
    });

    return () => {
      unsubscribe();
    };
  }, [ensureDefaultWorkspace]);

  useEffect(() => {
    if (selectedWorkspaceId && workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setUploadWorkspaceId((current) => {
        if (current && workspaces.some((workspace) => workspace.id === current)) return current;
        return selectedWorkspaceId;
      });
      return;
    }

    setUploadWorkspaceId((current) => {
      if (current && workspaces.some((workspace) => workspace.id === current)) return current;
      return DEFAULT_WORKSPACE_ID;
    });
  }, [selectedWorkspaceId, workspaces]);

  useEffect(() => {
    if (!showTrackDetailsPanel) return;

    setSelectedTrack((prev) => {
      if (prev) {
        const matched = tracks.find((t) => t.id === prev.id);
        if (matched) return matched;
        return prev;
      }
      if (currentTrack) {
        const matchedTrack = tracks.find((track) => track.id === currentTrack.id);
        if (matchedTrack) return matchedTrack;

        return {
          id: currentTrack.id,
          title: currentTrack.title,
          provider: currentTrack.provider,
          providerModel: currentTrack.providerModel,
          prompt: currentTrack.prompt,
          lyrics: currentTrack.lyrics,
          lyricsTimestamps: currentTrack.lyricsTimestamps,
          status: currentTrack.status,
          audioUrl: currentTrack.audioUrl,
          audioUrlHd: currentTrack.audioUrlHd,
          format: currentTrack.format ?? null,
          formatHd: currentTrack.formatHd ?? null,
          duration: currentTrack.duration ?? null,
          createdAt: currentTrack.createdAt,
          error: currentTrack.error,
          s3KeyHd: currentTrack.s3KeyHd,
          coverUrl: currentTrack.coverUrl ?? null,
          s3KeyCover: currentTrack.s3KeyCover ?? null,
          rating: currentTrack.rating ?? null,
          instrumental: currentTrack.instrumental ?? null,
        };
      }
      return null;
    });
  }, [showTrackDetailsPanel, currentTrack, tracks]);

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
        return matched || (currentTrack as unknown as LibraryTrack);
      });
    }
  }, [isPlaying, currentTrack, showTrackDetailsPanel, tracks]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  const totalDuration = useMemo(
    () => formatTotalDuration(tracks.reduce((s, t) => s + (t.duration ?? 0), 0)),
    [tracks],
  );

  const parentWorkspaceNameById = useMemo(
    () =>
      workspaces.reduce<Record<string, string>>((acc, workspace) => {
        acc[workspace.id] = workspace.name;
        return acc;
      }, {}),
    [workspaces],
  );

  const uploadWorkspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        id: workspace.id,
        label: workspace.parentWorkspaceId
          ? `${parentWorkspaceNameById[workspace.parentWorkspaceId] || "Workspace"} / ${workspace.name}`
          : workspace.name,
      })),
    [parentWorkspaceNameById, workspaces],
  );

  function handleCloseTrackDetails() {
    setSelectedTrack(null);
    setShowTrackDetailsPanel(false);
  }

  function performReusePrompt(track: TrackItem) {
    sessionStorage.setItem(
      "melodiq-reuse-prompt-payload",
      JSON.stringify({ songIdea: track.prompt || "", lyrics: track.lyrics || "" })
    );
    router.push("/studio");
  }

  function handleReusePrompt(track: TrackItem) {
    const { songIdea, lyrics } = useStudioStore.getState();
    if (songIdea.trim() || lyrics.trim()) {
      setReuseConfirmTrack(track);
      return;
    }
    performReusePrompt(track);
  }

  const handleTrackUpdated = useCallback((updatedTrack: TrackDetailTrack) => {
    const normalizedTrack: LibraryTrack = {
      ...updatedTrack,
      coverUrl: updatedTrack.coverUrl ?? null,
      s3KeyCover: updatedTrack.s3KeyCover ?? null,
    };

    setTracks((current) =>
      current.map((track) =>
        track.id === normalizedTrack.id
          ? { ...track, ...normalizedTrack }
          : track
      )
    );

    setSelectedTrack((current) =>
      current && current.id === normalizedTrack.id
        ? { ...current, ...normalizedTrack }
        : current
    );
  }, []);

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;

    const player = usePlayerStore.getState();
    const playContext = tracks
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
        coverUrl: track.coverUrl,
        s3KeyCover: track.s3KeyCover,
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
      coverUrl: selectedTrack.coverUrl,
      s3KeyCover: selectedTrack.s3KeyCover,
      rating: selectedTrack.rating ?? null,
      artistName: selectedTrack.artistName ?? null,
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

  const coverUrl = currentTrack?.coverUrl || (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);

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

      <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <main className={`relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${isListener ? "lg:pt-20" : "lg:pt-5"}`}>
          <div className="max-w-400 mx-auto space-y-6">

            {/* Header */}
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                      Library
                      <span className="mx-2 text-white/25 font-light">/</span>
                      <span className="text-white/60">
                        {view === "trash" ? "Recycle Bin" : view === "archive" ? "Archief" : "Tracks"}
                      </span>
                    </h1>
                    {tracks.length > 0 && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 shrink-0">
                        {tracks.length} tracks{totalDuration ? ` (${totalDuration})` : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
                    {/* All Tracks */}
                    <button
                      type="button"
                      onClick={() => { setView("songs"); }}
                      className={`h-8 rounded-full px-3 text-sm font-medium transition-colors ${view === "songs" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                    >
                      Tracks
                    </button>

                    {/* Recycle Bin */}
                    {/* Recycle Bin */}
                    <button
                      type="button"
                      onClick={() => { setView("trash"); void fetchTrash(); }}
                      className={`h-8 rounded-full px-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${view === "trash" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Bin
                    </button>

                    {/* Archive */}
                    <button
                      type="button"
                      onClick={() => { setView("archive"); void fetchArchived(); }}
                      className={`h-8 rounded-full px-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${view === "archive" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8v14a2 2 0 002 2h10a2 2 0 002-2V8M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2m-6 0h6" />
                      </svg>
                      Archief
                    </button>
                  </div>
                </div>
                {!isListener && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsUploadPanelOpen(true)}
                      className="h-10 rounded-full border border-white/10 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
                    >
                      Upload Files
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Songs view */}
            {view === "songs" && (
              <section className="space-y-4">
                {loading ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading tracks...</div>
                ) : (
                  <TrackList
                    tracks={tracks}
                    autoQueueAfterPlay
                    onReusePrompt={handleReusePrompt}
                    onSelect={(track) => {
                      setSelectedTrack({
                        ...track,
                        coverUrl: track.coverUrl ?? null,
                        s3KeyCover: track.s3KeyCover ?? null,
                        rating: track.rating ?? null,
                      });
                      setShowTrackDetailsPanel(true);
                    }}
                    onAddToPlaylist={(trackId, playlistId, options) => addTrackToPlaylist(playlistId, trackId, options)}
                    playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                    onTitleUpdate={(trackId, newTitle) =>
                      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)))
                    }
                    onEditDetails={(track) =>
                      setEditingTrack({
                        ...track,
                        coverUrl: track.coverUrl ?? null,
                        s3KeyCover: track.s3KeyCover ?? null,
                        rating: track.rating ?? null,
                      })
                    }
                    selectedTrackId={selectedTrack?.id ?? null}
                  />
                )}
              </section>
            )}

            {/* Recycle Bin view */}
            {view === "trash" && (
              <TrashPanel
                tracks={trashedTracks}
                loading={trashLoading}
                onRestore={handleRestoreTrack}
                onDeleteForever={handleDeleteTrackForever}
              />
            )}

            {/* Archive view */}
            {view === "archive" && (
              <ArchivePanel
                tracks={archivedTracks}
                loading={archiveLoading}
                onRestore={handleRestoreArchivedTrack}
              />
            )}

          </div>
        </main>

        <ResizablePanel show={showTrackDetailsPanel} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="h-full overflow-y-auto pb-4">
            {selectedTrack ? (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={handleCloseTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
                allowLyricsEdit={allowLyricsEdit}
                onTrackUpdated={handleTrackUpdated}
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

      {editingTrack && (
        <TrackEditPanel
          track={editingTrack}
          knownArtistNames={knownArtistNames}
          knownComposerNames={knownComposerNames}
          knownWriterNames={knownWriterNames}
          onClose={() => setEditingTrack(null)}
          onSaved={(updated) => {
            const normalized: LibraryTrack = {
              ...updated,
              coverUrl: updated.coverUrl ?? null,
              s3KeyCover: updated.s3KeyCover ?? null,
              rating: updated.rating ?? null,
            };
            setTracks((prev) => prev.map((t) => t.id === normalized.id ? { ...t, ...normalized } : t));
            setSelectedTrack((prev) => prev?.id === normalized.id ? { ...prev, ...normalized } : prev);
            usePlayerStore.getState().syncTrackSnapshots([{ ...normalized, s3Key: null }]);
          }}
        />
      )}

      <UploadPanel
        isOpen={isUploadPanelOpen}
        onClose={() => setIsUploadPanelOpen(false)}
        workspaceOptions={uploadWorkspaceOptions}
        defaultWorkspaceId={uploadWorkspaceId}
        knownArtistNames={knownArtistNames}
        knownComposerNames={knownComposerNames}
        knownWriterNames={knownWriterNames}
        onUploadFinished={handleUploadFinished}
      />

      {reuseConfirmTrack && (
        <ReuseConfirmDialog
          onConfirm={() => {
            const track = reuseConfirmTrack;
            setReuseConfirmTrack(null);
            if (track) performReusePrompt(track);
          }}
          onCancel={() => setReuseConfirmTrack(null)}
        />
      )}
    </div>
  );
}
