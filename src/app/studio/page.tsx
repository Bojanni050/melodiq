"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlaylistStore, useWorkspaceStore, useStudioStore } from "@/lib/store";
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

export default function StudioPage() {
  const { tracks, tracksRef, fetchTracks, handleDeleteTrack, handleTitleUpdate, handleTrackUpdate } = useTrackManager();
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const {
    generating,
    notice,
    setNotice,
    showLyricsOverlay,
    handleOptimize,
    handleGenerateLyrics,
    handleGenerateTitle,
    handleGenerate,
    handleReusePrompt,
  } = useStudioActions({ tracksRef, fetchTracks });

  const workspaceView = useWorkspaceView(tracks);

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
  useEffect(() => {
    ensureDefaultWorkspace();
    useStudioStore.persist.rehydrate();
    void loadPlaylists();
    try {
      const raw = sessionStorage.getItem("lyrics-studio-payload");
      if (raw) {
        sessionStorage.removeItem("lyrics-studio-payload");
        const payload = JSON.parse(raw) as { lyrics: string; style: string; title: string };
        const studio = useStudioStore.getState();
        studio.reset();
        studio.setLyrics(payload.lyrics);
        studio.setSongIdea(payload.style);
        studio.setTitle(payload.title);
      }
    } catch {
      // ignore
    }
  }, [ensureDefaultWorkspace, loadPlaylists]);

  const playlists = usePlaylistStore((state) => state.playlists);
  const memoizedPlaylists = useMemo(
    () => playlists.map((p) => ({ id: p.id, name: p.name })),
    [playlists]
  );

  const rightPanelWidthFromStore = usePlayerStore((state) => state.rightPanelWidth);

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={creditValue} />

      <div className="h-[calc(100vh-var(--player-height))] overflow-hidden flex flex-col lg:flex-row lg:ml-60">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pt-[53px] lg:pt-0">
          <NoticeBar notice={notice} onClose={() => setNotice(null)} />

          <main className="p-4">
            <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">
              {/* Studio form */}
              <div className="w-full xl:w-[500px] xl:shrink-0 xl:self-start xl:sticky xl:top-4 xl:h-[calc(100vh-var(--player-height)-32px)]">
                <StudioForm
                  credits={credits}
                  isGenerating={generating}
                  onGenerate={handleGenerate}
                  onOptimize={handleOptimize}
                  onGenerateLyrics={handleGenerateLyrics}
                  onGenerateTitle={handleGenerateTitle}
                />
              </div>

              {/* Track list column */}
              <div className="w-full xl:flex-1 self-start xl:sticky xl:top-4 min-h-[400px] xl:h-[calc(100vh-var(--player-height)-32px)]">
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
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Select a track or press play to show song info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {showLyricsOverlay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 bg-primary-400 rounded-full animate-bounce ${i === 1 ? "animation-delay-150" : i === 2 ? "animation-delay-300" : ""}`}
                />
              ))}
            </div>
            <h2 className="text-xl font-bold mb-2">Writing lyrics</h2>
            <p className="text-white/50 text-sm">Crafting your song lyrics...</p>
          </div>
        </div>
      )}

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
