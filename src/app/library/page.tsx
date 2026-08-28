"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";
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
import { withCdn } from "@/lib/cdn-client";
import { useT } from "@/hooks/useT";

export default function LibraryPage() {
  const router = useRouter();
  const t = useT();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  const isListener = user?.role === "listener";
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
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    selectedTrack,
    setSelectedTrack,
    showTrackDetailsPanel,
    openTrackDetails,
    closeTrackDetails,
  } = useTrackDetailsPanel<LibraryTrack>(tracks);

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
  const [editingTrack, setEditingTrack] = useState<LibraryTrack | null>(null);
  const [uploadWorkspaceId, setUploadWorkspaceId] = useState<string>(DEFAULT_WORKSPACE_ID);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [uploadToast, setUploadToast] = useState<{ title: string; message: string } | null>(null);

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
          composerName: t.composerName ?? null,
          writerName: t.writerName ?? null,
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
    if (!confirm(t("library.confirmDeleteForever", { title: track?.title || t("library.thisTrack") }))) return;
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

      const count = uploadedTracks.length;
      const firstTitle = uploadedTracks[0]?.title || "Track";
      const message = count === 1 ? `"${firstTitle}" uploaded successfully` : `${count} tracks uploaded successfully`;
      setUploadToast({ title: "Upload Successful", message });
      window.setTimeout(() => {
        setUploadToast((prev) => (prev?.message === message ? null : prev));
      }, 5000);

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
    if (typeof window === "undefined" || tracks.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetTrackId = params.get("trackId");
    if (!targetTrackId) return;

    const foundTrack = tracks.find((t) => t.id === targetTrackId);
    if (foundTrack) {
      openTrackDetails(foundTrack);
      setView("songs");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("melodiq:scroll-to-track", { detail: { trackId: targetTrackId } }));
      }, 300);
    }
  }, [tracks, openTrackDetails]);

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
        s3Key: track.s3Key ?? null,
        s3KeyHd: track.s3KeyHd ?? null,
        s3KeyMp3: track.s3KeyMp3 ?? null,
        s3KeyOgg: track.s3KeyOgg ?? null,
        duration: track.duration,
        lyrics: track.lyrics,
        lyricsTimestamps: track.lyricsTimestamps,
        createdAt: track.createdAt,
        error: track.error,
        coverUrl: track.coverUrl,
        s3KeyCover: track.s3KeyCover,
        s3KeyCoverThumb: track.s3KeyCoverThumb,
        artistName: track.artistName ?? null,
        composerName: track.composerName ?? null,
        writerName: track.writerName ?? null,
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
      s3Key: selectedTrack.s3Key ?? null,
      s3KeyHd: selectedTrack.s3KeyHd ?? null,
      s3KeyMp3: selectedTrack.s3KeyMp3 ?? null,
      s3KeyOgg: selectedTrack.s3KeyOgg ?? null,
      duration: selectedTrack.duration,
      lyrics: selectedTrack.lyrics,
      lyricsTimestamps: selectedTrack.lyricsTimestamps,
      createdAt: selectedTrack.createdAt,
      error: selectedTrack.error,
      coverUrl: selectedTrack.coverUrl,
      s3KeyCover: selectedTrack.s3KeyCover,
      s3KeyCoverThumb: selectedTrack.s3KeyCoverThumb,
      rating: selectedTrack.rating ?? null,
      artistName: selectedTrack.artistName ?? null,
      composerName: selectedTrack.composerName ?? null,
      writerName: selectedTrack.writerName ?? null,
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
                      {t("library.title")}
                      <span className="mx-2 text-white/25 font-light">/</span>
                      <span className="text-white/60">
                        {view === "trash" ? t("library.recycleBin") : view === "archive" ? t("library.archive") : t("library.tracksView")}
                      </span>
                    </h1>
                    {tracks.length > 0 && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 shrink-0">
                        {tracks.length} {t("library.tracksSuffix")}{totalDuration ? ` (${totalDuration})` : ""}
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
                      {t("library.tracksTab")}
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
                      {t("library.binTab")}
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
                      {t("library.archiveTab")}
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
                      {t("library.uploadFiles")}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Songs view */}
            {view === "songs" && (
              <section className="space-y-4">
                {loading ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">{t("library.loadingTracks")}</div>
                ) : (
                  <TrackList
                    tracks={tracks}
                    autoQueueAfterPlay
                    onReusePrompt={handleReusePrompt}
                    onSelect={(track) => {
                      openTrackDetails({
                        ...track,
                        coverUrl: track.coverUrl ?? null,
                        s3KeyCover: track.s3KeyCover ?? null,
                        rating: track.rating ?? null,
                      });
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
                onClose={closeTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
                onTrackUpdated={handleTrackUpdated}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">{t("common.trackDetails")}</h3>
                <p className="text-sm mt-3">{t("common.selectTrackHint")}</p>
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

      {uploadToast && (
        <div className="fixed bottom-24 right-6 z-60 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#12131d]/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="min-w-0 pr-2">
            <p className="text-sm font-semibold text-white">{uploadToast.title}</p>
            <p className="truncate text-xs text-white/70">{uploadToast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setUploadToast(null)}
            className="ml-1 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
