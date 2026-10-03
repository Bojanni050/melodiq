"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlaylistStore, useReleaseStore, useSidebarStore, useWorkspaceStore, useStudioStore } from "@/lib/store";
import { usePlayerStore } from "@/lib/store";
import Sidebar from "@/components/Sidebar";
import StudioForm from "@/components/StudioForm";
import TrackDetail from "@/components/TrackDetail";
import TrackEditPanel from "@/components/tracks/TrackEditPanel";
import ResizablePanel from "@/components/studio/ResizablePanel";
import NoticeBar from "@/components/studio/NoticeBar";
import StudioTabBar from "@/components/studio/StudioTabBar";
import WorkspacePanel from "@/components/studio/WorkspacePanel";
import RecentTracksPanel from "@/components/studio/RecentTracksPanel";
import { useTrackManager, type Track } from "@/hooks/useTrackManager";
import { useStudioActions } from "@/hooks/useStudioActions";
import { useWorkspaceView } from "@/hooks/useWorkspaceView";
import { useTrackPlayer } from "@/hooks/useTrackPlayer";
import { useT } from "@/hooks/useT";

const STUDIO_FORM_WIDTH_KEY = "melodiq-studio-form-width";
const STUDIO_FORM_WIDTH_DEFAULT = 500;
const STUDIO_FORM_WIDTH_MIN = 360;
const STUDIO_FORM_WIDTH_MAX = 820;

function clampFormWidth(value: number) {
  if (!Number.isFinite(value)) return STUDIO_FORM_WIDTH_DEFAULT;
  return Math.min(STUDIO_FORM_WIDTH_MAX, Math.max(STUDIO_FORM_WIDTH_MIN, Math.round(value)));
}

/** True on xl screens and up — the only breakpoint where the studio columns sit side by side. */
function useXlBreakpoint() {
  const [isXl, setIsXl] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    setIsXl(query.matches);
    const handler = (event: MediaQueryListEvent) => setIsXl(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return isXl;
}

export default function StudioPage() {
  const t = useT();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const { tracks, tracksRef, fetchTracks, handleDeleteTrack, handleTitleUpdate, handleTrackUpdate } = useTrackManager();
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const workspaceView = useWorkspaceView(tracks);
  const { setStudioTab } = workspaceView;
  const handleWorkspaceOpened = useCallback(() => setStudioTab("workspaces"), [setStudioTab]);

  const {
    generating,
    notice,
    setNotice,
    handleOptimize,
    handleGenerateTitle,
    handleGenerate,
    handleReusePrompt,
  } = useStudioActions({
    tracksRef,
    fetchTracks,
    onWorkspaceOpened: handleWorkspaceOpened,
  });

  const {
    credits,
    creditValue,
    selectedTrack,
    showTrackDetailsPanel,
    rightPanelWidth,
    setRightPanelWidth,
    handleSelectTrack,
    handleCloseTrackDetails,
    handleDeleteTrackFromPlayer,
    handlePlayTrack,
    handleDownloadTrack,
    handleAddToQueue,
    handleAddToPlaylist,
    handleMoveTrackToWorkspace,
  } = useTrackPlayer({ tracksRef });

  const handleDelete = (trackId: string) => {
    handleDeleteTrack(trackId);
    handleDeleteTrackFromPlayer(trackId);
  };

  const ensureDefaultWorkspace = useWorkspaceStore((state) => state.ensureDefaultWorkspace);
  const loadPlaylists = usePlaylistStore((state) => state.loadPlaylists);
  const loadReleases = useReleaseStore((state) => state.loadReleases);
  useEffect(() => {
    ensureDefaultWorkspace();
    useStudioStore.persist.rehydrate();
    void loadPlaylists();
    void loadReleases();
    try {
      const raw = sessionStorage.getItem("lyrics-studio-payload");
      if (raw) {
        sessionStorage.removeItem("lyrics-studio-payload");
        const payload = JSON.parse(raw) as { lyrics: string; style: string; title: string; lyricsOnly?: boolean; styleOnly?: boolean };
        const studio = useStudioStore.getState();
        if (payload.lyricsOnly) {
          if (typeof payload.lyrics === "string") studio.setLyrics(payload.lyrics);
        } else if (payload.styleOnly) {
          // Alleen style overnemen (Melody had geen lyrics) — Studio-lyrics en titel behouden.
          if (typeof payload.style === "string" && payload.style.trim()) studio.setSongIdea(payload.style);
        } else {
          studio.reset();
          studio.setLyrics(payload.lyrics);
          studio.setSongIdea(payload.style);
          studio.setTitle(payload.title);
        }
      }

      const reuseRaw = sessionStorage.getItem("melodiq-reuse-prompt-payload");
      if (reuseRaw) {
        sessionStorage.removeItem("melodiq-reuse-prompt-payload");
        const payload = JSON.parse(reuseRaw) as { songIdea: string; lyrics: string };
        const studio = useStudioStore.getState();
        studio.setSongIdea(payload.songIdea);
        studio.setLyrics(payload.lyrics);
      }
    } catch {
      // ignore
    }
  }, [ensureDefaultWorkspace, loadPlaylists, loadReleases]);

  const playlists = usePlaylistStore((state) => state.playlists);
  const memoizedPlaylists = useMemo(
    () => playlists.map((p) => ({ id: p.id, name: p.name })),
    [playlists]
  );

  const rightPanelWidthFromStore = usePlayerStore((state) => state.rightPanelWidth);

  const isXl = useXlBreakpoint();
  const [formWidth, setFormWidth] = useState(() => {
    try {
      return clampFormWidth(Number(window.localStorage.getItem(STUDIO_FORM_WIDTH_KEY)));
    } catch {
      return STUDIO_FORM_WIDTH_DEFAULT;
    }
  });
  const formColRef = useRef<HTMLDivElement>(null);

  function startFormResize(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = formWidth;

    const onMouseMove = (event: MouseEvent) => {
      const next = clampFormWidth(startWidth + (event.clientX - startX));
      // Write directly to the DOM — zero React re-renders while dragging
      if (formColRef.current) {
        formColRef.current.style.width = `${next}px`;
      }
    };

    const onMouseUp = (event: MouseEvent) => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      // Single state + persist update when drag ends
      const next = clampFormWidth(startWidth + (event.clientX - startX));
      setFormWidth(next);
      try {
        window.localStorage.setItem(STUDIO_FORM_WIDTH_KEY, String(next));
      } catch {
        // ignore
      }
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={creditValue} />

      <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] overflow-hidden flex flex-col lg:flex-row" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pt-[53px] lg:pt-0">
          <NoticeBar notice={notice} onClose={() => setNotice(null)} />

          <main className="p-4">
            <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">
              {/* Studio form (resizable on xl) */}
              <div
                ref={formColRef}
                style={isXl ? { width: formWidth } : undefined}
                className="relative w-full xl:w-auto xl:shrink-0 xl:self-start xl:sticky xl:top-4 xl:h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px)-32px)]"
              >
                <StudioForm
                  credits={credits}
                  isGenerating={generating}
                  onGenerate={handleGenerate}
                  onOptimize={handleOptimize}
                  onGenerateTitle={handleGenerateTitle}
                />
                {isXl && (
                  <div
                    className="absolute top-0 -right-4 bottom-0 w-2 cursor-col-resize bg-transparent hover:bg-white/10 transition-colors"
                    onMouseDown={startFormResize}
                    title={t("studio.resizeFormColumn")}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t("studio.resizeFormColumn")}
                  />
                )}
              </div>

              {/* Track list column */}
              <div className="w-full xl:flex-1 xl:min-w-[280px] self-start xl:sticky xl:top-4 min-h-[400px] xl:h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px)-32px)]">
                <div className="flex flex-col h-full min-h-0">
                  <StudioTabBar activeTab={workspaceView.studioTab} onTabChange={workspaceView.setStudioTab} />

                  {workspaceView.studioTab === "workspaces" && (
                    <WorkspacePanel
                      tracks={tracks}
                      workspaces={workspaceView.workspaces}
                      selectedWorkspaceId={workspaceView.selectedWorkspaceId}
                      setSelectedWorkspaceId={workspaceView.setSelectedWorkspaceId}
                      selectedWorkspace={workspaceView.selectedWorkspace}
                      rootWorkspaces={workspaceView.rootWorkspaces}
                      selectedWorkspaceParent={workspaceView.selectedWorkspaceParent}
                      selectedWorkspaceChildren={workspaceView.selectedWorkspaceChildren}
                      selectedWorkspaceTracks={workspaceView.selectedWorkspaceTracks}
                      workspaceViewMode={workspaceView.workspaceViewMode}
                      setWorkspaceViewMode={workspaceView.setWorkspaceViewMode}
                      workspaceGridSize={workspaceView.workspaceGridSize}
                      setWorkspaceGridSize={workspaceView.setWorkspaceGridSize}
                      showCreateWorkspace={workspaceView.showCreateWorkspace}
                      setShowCreateWorkspace={workspaceView.setShowCreateWorkspace}
                      newWorkspaceName={workspaceView.newWorkspaceName}
                      setNewWorkspaceName={workspaceView.setNewWorkspaceName}
                      handleCreateWorkspace={workspaceView.handleCreateWorkspace}
                      handleCreateWorkspaceKeyDown={workspaceView.handleCreateWorkspaceKeyDown}
                      showCreateFolder={workspaceView.showCreateFolder}
                      setShowCreateFolder={workspaceView.setShowCreateFolder}
                      newFolderName={workspaceView.newFolderName}
                      setNewFolderName={workspaceView.setNewFolderName}
                      handleCreateFolder={workspaceView.handleCreateFolder}
                      handleCreateFolderKeyDown={workspaceView.handleCreateFolderKeyDown}
                      onSelectTrack={handleSelectTrack}
                      onDeleteTrack={handleDelete}
                      onReusePrompt={handleReusePrompt}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                      onMoveToWorkspace={handleMoveTrackToWorkspace}
                      onTitleUpdate={handleTitleUpdate}
                      onArtistUpdate={(trackId, artistName) => handleTrackUpdate({ id: trackId, artistName })}
                      enableInspoDrag
                      onEditDetails={setEditingTrack}
                      playlists={memoizedPlaylists}
                    />
                  )}

                  {workspaceView.studioTab === "recent" && (
                    <RecentTracksPanel
                      tracks={tracks}
                      isGenerating={generating}
                      onSelect={handleSelectTrack}
                      onDelete={handleDelete}
                      onReusePrompt={handleReusePrompt}
                      onAddToQueue={handleAddToQueue}
                      onAddToPlaylist={handleAddToPlaylist}
                      onMoveToWorkspace={handleMoveTrackToWorkspace}
                      onTitleUpdate={handleTitleUpdate}
                      onArtistUpdate={(trackId, artistName) => handleTrackUpdate({ id: trackId, artistName })}
                      enableInspoDrag
                      onEditDetails={setEditingTrack}
                      playlists={memoizedPlaylists}
                    />
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

        <ResizablePanel show={showTrackDetailsPanel} width={rightPanelWidthFromStore} setWidth={setRightPanelWidth}>
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
          onClose={() => setEditingTrack(null)}
          onSaved={(updated) => {
            handleTrackUpdate(updated);
            setEditingTrack(null);
          }}
        />
      )}
    </div>
  );
}
