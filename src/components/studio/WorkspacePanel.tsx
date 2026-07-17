import clsx from "clsx";
import { getWorkspaceCoverCollage, getWorkspaceGradient } from "@/lib/track-utils";
import CreateWorkspaceDialog from "@/components/studio/CreateWorkspaceDialog";
import TrackList from "@/components/TrackList";
import type { Track } from "@/hooks/useTrackManager";
import type { Workspace } from "@/lib/store";

const SEGMENTED_ICON_BUTTON_BASE = "rounded-md p-1.5 transition";
const SEGMENTED_SIZE_BUTTON_BASE = "rounded-md px-2 py-1 text-[11px] transition";
const SEGMENTED_BUTTON_ACTIVE = "bg-primary-500 text-white";
const SEGMENTED_BUTTON_INACTIVE = "text-white/65 hover:bg-white/10 hover:text-white";
const WORKSPACE_GRID_CLASS_BY_SIZE: Record<4 | 8 | 12 | 16, string> = {
  4: "grid-cols-[repeat(4,minmax(0,1fr))]",
  8: "grid-cols-[repeat(8,minmax(0,1fr))]",
  12: "grid-cols-[repeat(12,minmax(0,1fr))]",
  16: "grid-cols-[repeat(16,minmax(0,1fr))]",
};

interface WorkspacePanelProps {
  tracks: Track[];
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: (id: string | null) => void;
  selectedWorkspace: Workspace | null;
  rootWorkspaces: Workspace[];
  selectedWorkspaceParent: Workspace | null;
  selectedWorkspaceChildren: Workspace[];
  selectedWorkspaceTracks: Track[];
  workspaceViewMode: "grid" | "list";
  setWorkspaceViewMode: (mode: "grid" | "list") => void;
  workspaceGridSize: 4 | 8 | 12 | 16;
  setWorkspaceGridSize: (size: 4 | 8 | 12 | 16) => void;
  showCreateWorkspace: boolean;
  setShowCreateWorkspace: (show: boolean) => void;
  newWorkspaceName: string;
  setNewWorkspaceName: (name: string) => void;
  handleCreateWorkspace: () => void;
  handleCreateWorkspaceKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  showCreateFolder: boolean;
  setShowCreateFolder: (show: boolean) => void;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  handleCreateFolder: () => void;
  handleCreateFolderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectTrack: (track: Track) => void;
  onDeleteTrack: (trackId: string) => void;
  onReusePrompt: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (trackId: string, playlistId: string, options?: { allowDuplicate?: boolean }) => void;
  onMoveToWorkspace: (trackId: string, workspaceId: string) => void;
  onTitleUpdate: (trackId: string, newTitle: string) => void;
  onEditDetails?: (track: Track) => void;
  playlists: { id: string; name: string }[];
}

export default function WorkspacePanel({
  tracks,
  workspaces,
  selectedWorkspaceId,
  setSelectedWorkspaceId,
  selectedWorkspace,
  rootWorkspaces,
  selectedWorkspaceParent,
  selectedWorkspaceChildren,
  selectedWorkspaceTracks,
  workspaceViewMode,
  setWorkspaceViewMode,
  workspaceGridSize,
  setWorkspaceGridSize,
  showCreateWorkspace,
  setShowCreateWorkspace,
  newWorkspaceName,
  setNewWorkspaceName,
  handleCreateWorkspace,
  handleCreateWorkspaceKeyDown,
  showCreateFolder,
  setShowCreateFolder,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  handleCreateFolderKeyDown,
  onSelectTrack,
  onDeleteTrack,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  onMoveToWorkspace,
  onTitleUpdate,
  onEditDetails,
  playlists,
}: WorkspacePanelProps) {
  const isWorkspaceFolderOpen = Boolean(selectedWorkspace);
  const workspaceGridClass = WORKSPACE_GRID_CLASS_BY_SIZE[workspaceGridSize];

  return (
    <section className="section-card flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white/80">Workspace folders</h2>
          <p className="text-xs text-white/40">
            {isWorkspaceFolderOpen
              ? "Folder geopend. Alleen tracks uit deze workspace worden getoond."
              : workspaceViewMode === "grid"
                ? `${workspaceGridSize} columns per row.`
                : `${rootWorkspaces.length} workspaces.`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View mode toggle */}
          {!isWorkspaceFolderOpen && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setWorkspaceViewMode("list")}
                className={clsx(
                  SEGMENTED_ICON_BUTTON_BASE,
                  workspaceViewMode === "list" ? SEGMENTED_BUTTON_ACTIVE : SEGMENTED_BUTTON_INACTIVE
                )}
                title="List view"
                aria-label="List view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 10h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceViewMode("grid")}
                className={clsx(
                  SEGMENTED_ICON_BUTTON_BASE,
                  workspaceViewMode === "grid" ? SEGMENTED_BUTTON_ACTIVE : SEGMENTED_BUTTON_INACTIVE
                )}
                title="Grid view"
                aria-label="Grid view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z" />
                </svg>
              </button>
            </div>
          )}

          {/* Grid size picker */}
          {!isWorkspaceFolderOpen && workspaceViewMode === "grid" && (
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
              {([4, 8, 12, 16] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setWorkspaceGridSize(size)}
                  className={clsx(
                    SEGMENTED_SIZE_BUTTON_BASE,
                    workspaceGridSize === size ? SEGMENTED_BUTTON_ACTIVE : SEGMENTED_BUTTON_INACTIVE
                  )}
                  title={`Show ${size} workspace cards`}
                  aria-label={`Show ${size} workspace cards`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}

          {/* Back button */}
          {isWorkspaceFolderOpen && (
            <button
              type="button"
              onClick={() => {
                if (selectedWorkspace?.parentWorkspaceId) {
                  setSelectedWorkspaceId(selectedWorkspace.parentWorkspaceId);
                  return;
                }
                setSelectedWorkspaceId(null);
              }}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 hover:text-white"
              title="Back to workspace overview"
            >
              {selectedWorkspace?.parentWorkspaceId ? "← Back to parent" : "← Back to folders"}
            </button>
          )}

          {/* Create workspace dialog */}
          <CreateWorkspaceDialog
            open={showCreateWorkspace}
            value={newWorkspaceName}
            onOpen={() => setShowCreateWorkspace(true)}
            onChange={setNewWorkspaceName}
            onSubmit={handleCreateWorkspace}
            onCancel={() => {
              setShowCreateWorkspace(false);
              setNewWorkspaceName("");
              setShowCreateFolder(false);
              setNewFolderName("");
            }}
            onKeyDown={handleCreateWorkspaceKeyDown}
          />

          {/* Create song */}
          {isWorkspaceFolderOpen && !selectedWorkspace?.parentWorkspaceId && (
            showCreateFolder ? (
              <div className="flex items-center gap-1">
                <input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={handleCreateFolderKeyDown}
                  placeholder="Song name"
                  className="h-8 rounded-md border border-white/15 bg-white/5 px-2.5 text-xs text-white placeholder:text-white/30"
                  aria-label="Song name"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="h-8 rounded-md bg-primary-500/80 px-3 text-xs text-white hover:bg-primary-500"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}
                  className="h-8 rounded-md bg-white/5 px-3 text-xs text-white/60 hover:text-white/80"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white/90"
              >
                + Add Song
              </button>
            )
          )}
        </div>
      </div>

      {/* Workspace grid or list */}
      {!isWorkspaceFolderOpen && (
        <div className="mb-3 overflow-y-auto pr-1">
          {workspaceViewMode === "grid" ? (
            <div className={`grid gap-3 ${workspaceGridClass}`}>
              {rootWorkspaces.map((workspace) => {
                const workspaceTracks = tracks.filter((track) => workspace.trackIds.includes(track.id));
                const coverUrls = getWorkspaceCoverCollage(workspace.id, workspaceTracks);
                const gradient = getWorkspaceGradient(workspace.id, workspace.folderGradient);
                const childCount = workspaces.filter((child) => child.parentWorkspaceId === workspace.id).length;
                const hasSingleCover = coverUrls.length === 1;

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                    className={`group cursor-pointer rounded-3xl border border-white/10 text-left transition-transform hover:-translate-y-0.5 ${selectedWorkspaceId === workspace.id ? "ring-2 ring-primary-500/40" : ""}`}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-3xl" style={{ backgroundImage: gradient }}>
                      <div className="pointer-events-none absolute inset-0 bg-black/10" />
                      {coverUrls.length > 0 ? (
                        <div className={`pointer-events-none absolute inset-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-inner ${hasSingleCover ? "flex items-center justify-center" : "grid grid-cols-2 grid-rows-2 gap-1.5"}`}>
                          {coverUrls.map((cover, index) => (
                            <img
                              key={`${workspace.id}-${index}`}
                              src={cover}
                              alt={workspace.name}
                              draggable={false}
                              className={`${hasSingleCover ? "h-full w-full max-w-[80%] rounded-xl" : "h-full w-full"} object-cover`}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                            <svg className="h-12 w-12 text-white/85" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-sm">
                          <p className="text-sm font-semibold text-white truncate">{workspace.name}</p>
                          <p className="text-xs text-white/65">
                            {workspaceTracks.length} tracks{childCount > 0 ? ` • ${childCount} songs` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              {rootWorkspaces.map((workspace) => {
                const workspaceTracks = tracks.filter((track) => workspace.trackIds.includes(track.id));
                const gradient = getWorkspaceGradient(workspace.id, workspace.folderGradient);
                const childCount = workspaces.filter((child) => child.parentWorkspaceId === workspace.id).length;

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                    className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-left transition hover:bg-white/5 ${selectedWorkspaceId === workspace.id ? "ring-2 ring-primary-500/40 bg-white/5" : ""}`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundImage: gradient }}
                    >
                      <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{workspace.name}</p>
                    </div>
                    <span className="text-xs text-white/40 shrink-0">
                      {workspaceTracks.length} {workspaceTracks.length === 1 ? "track" : "tracks"}
                      {childCount > 0 ? ` • ${childCount} songs` : ""}
                    </span>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb and track count */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-white/35 mb-1 truncate">
            <button
              type="button"
              onClick={() => {
                if (selectedWorkspace?.parentWorkspaceId) {
                  setSelectedWorkspaceId(selectedWorkspace.parentWorkspaceId);
                  return;
                }
                setSelectedWorkspaceId(null);
              }}
              className="text-white/60 hover:text-white/80 transition-colors"
              title="Back to workspace overview"
            >
              {selectedWorkspace?.parentWorkspaceId ? selectedWorkspaceParent?.name ?? "Workspaces" : "Workspaces"}
            </button>
            <span className="mx-1 text-white/20">&gt;</span>
            <span className="text-white/70">{selectedWorkspace?.name ?? "Overview"}</span>
          </div>
        </div>
        <span className="text-xs text-white/30 shrink-0">
          {selectedWorkspace ? `${selectedWorkspaceTracks.length} tracks` : "0 tracks"}
        </span>
      </div>

      {/* Songs */}
      {selectedWorkspace && !selectedWorkspace.parentWorkspaceId && selectedWorkspaceChildren.length > 0 && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/3 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/35">Songs</p>
          <div className="space-y-1.5">
            {selectedWorkspaceChildren.map((childWorkspace) => {
              const childTracks = tracks.filter((track) => childWorkspace.trackIds.includes(track.id));
              const childCover = getWorkspaceCoverCollage(childWorkspace.id, childTracks)[0];

              return (
                <button
                  key={childWorkspace.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(childWorkspace.id)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-amber-300/20 bg-[#11131f]">
                    {childCover ? (
                      <img src={childCover} alt={childWorkspace.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg className="h-4 w-4 text-amber-300/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">{childWorkspace.name}</p>
                  </div>
                  {childWorkspace.releaseStatus && childWorkspace.releaseStatus !== "concept" && (
                    <span
                      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                        childWorkspace.releaseStatus === "published"
                          ? "border border-green-300/30 bg-green-400/10 text-green-200"
                          : "border border-red-300/30 bg-red-400/10 text-red-200"
                      }`}
                    >
                      {childWorkspace.releaseStatus === "published" ? "Published" : "Unpublished"}
                    </span>
                  )}
                  <span className="text-[11px] text-white/45">
                    {childTracks.length} {childTracks.length === 1 ? "track" : "tracks"}
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Track list for selected workspace */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {selectedWorkspace ? (
          <TrackList
            tracks={selectedWorkspaceTracks}
            autoQueueAfterPlay
            onSelect={onSelectTrack}
            onDelete={onDeleteTrack}
            onReusePrompt={onReusePrompt}
            onAddToQueue={onAddToQueue}
            onAddToPlaylist={onAddToPlaylist}
            onMoveToWorkspace={onMoveToWorkspace}
            playlists={playlists}
            onTitleUpdate={onTitleUpdate}
            onEditDetails={onEditDetails}
          />
        ) : (
          <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/2 p-4 text-center">
            <p className="text-sm text-white/45">
              Select or create a workspace above to pin its tracks here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
