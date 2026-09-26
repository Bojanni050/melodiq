"use client";

import { useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/lib/store";

import TrackActionMenu from "./TrackActionMenu";
import { useTrackCardActions } from "./useTrackCardActions";
import AlreadyInPlaylistDialog from "./AlreadyInPlaylistDialog";
import CreatePlaylistDialog from "./CreatePlaylistDialog";
import DuplicatePlaylistDialog from "./DuplicatePlaylistDialog";
import MergeWorkspaceDialog from "./MergeWorkspaceDialog";
import MoveToWorkspaceDialog from "./MoveToWorkspaceDialog";
import PlaylistPickerDialog from "./PlaylistPickerDialog";
import ReleasePickerDialog from "./ReleasePickerDialog";
import type { TrackItem } from "./types";

interface TrackOptionsMenuProps {
  track: TrackItem;
  /** Cover shown before the track has one, and used by the picker's thumbnails. */
  tracksById?: Map<string, TrackItem>;
  onAddToQueue?: (track: TrackItem) => void;
  onHideClick?: () => void;
  onArchiveClick?: () => void;
  /**
   * Fired after a menu action changed something the parent displays. Slim
   * Archive owns its own copy of the track list and would otherwise keep showing
   * a stale cover, rating or playlist chip after an action changed it.
   */
  onChanged?: () => void;
}

/**
 * The library track options menu plus every dialog it opens, in one component.
 *
 * TrackCard already composes all of this, but it does so inline — roughly 60
 * lines of dialog plumbing that any second page wanting the same menu has to
 * copy. Smart Archive is that second page. This wrapper exists so the menu
 * behaves identically there without duplicating the wiring, and so a fix to the
 * shared dialogs lands in both places at once.
 */
export default function TrackOptionsMenu({
  track,
  tracksById,
  onAddToQueue,
  onHideClick,
  onArchiveClick,
  onChanged,
}: TrackOptionsMenuProps) {
  const actions = useTrackCardActions({ track, tracksById });
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  // Same derivation as TrackCard, so the workspace dialog lists the same tree.
  const orderedWorkspaceOptions = useMemo(() => {
    const roots = workspaces.filter((w) => !w.parentWorkspaceId);
    const childrenByParent = new Map<string, typeof workspaces>();
    workspaces
      .filter((w) => w.parentWorkspaceId)
      .forEach((child) => {
        const list = childrenByParent.get(child.parentWorkspaceId!) ?? [];
        list.push(child);
        childrenByParent.set(child.parentWorkspaceId!, list);
      });
    return roots.flatMap((root) => [
      { workspace: root, depth: 0 },
      ...(childrenByParent.get(root.id) ?? []).map((child) => ({
        workspace: child,
        depth: 1,
      })),
    ]);
  }, [workspaces]);

  const workspaceDisplayNameById = useMemo(
    () => new Map(workspaces.map((w) => [w.id, w.name])),
    [workspaces]
  );
  // Workspace has no cover image, only a folder gradient — the dialog accepts
  // a cover URL map, so pass nulls rather than inventing a field it lacks.
  const workspaceCoverById = useMemo(
    () => new Map<string, string | null>(workspaces.map((w) => [w.id, null])),
    [workspaces]
  );

  /** Hidden listener: the cover is regenerated on the server and announced with
   *  a window event, so a page showing its own copy of the track has to be told
   *  to re-fetch. Renders nothing. */
  function CoverRefreshSignal({ onChange }: { onChange: () => void }) {
    useEffect(() => {
      function handleCover(event: Event) {
        const trackIds = (event as CustomEvent<{ trackIds?: string[] }>).detail?.trackIds;
        if (Array.isArray(trackIds) && trackIds.includes(track.id)) onChange();
      }
      window.addEventListener("melodiq:cover-regenerated", handleCover);
      return () => window.removeEventListener("melodiq:cover-regenerated", handleCover);
    }, [track.id, onChange]);
    return null;
  }

  return (
    <>
      {/* The menu's own handlers cover actions that only affect the dialogs. The
          one that visibly changes this row is the cover, which is written by the
          server and only observed here through the re-fetch. */}
      {onChanged && <CoverRefreshSignal onChange={onChanged} />}

      <CreatePlaylistDialog
        isOpen={actions.showCreatePlaylistDialog}
        onClose={() => actions.setShowCreatePlaylistDialog(false)}
        onCreate={actions.handleCreatePlaylist}
      />

      <MoveToWorkspaceDialog
        isOpen={actions.workspaceMenuOpen}
        onClose={() => actions.setWorkspaceMenuOpen(false)}
        track={track}
        orderedWorkspaceOptions={orderedWorkspaceOptions}
        workspaceCoverById={workspaceCoverById}
        workspaceDisplayNameById={workspaceDisplayNameById}
        workspaces={workspaces}
        onMoveToWorkspace={actions.handleMoveToWorkspace}
        onCreateWorkspace={actions.handleCreateWorkspace}
        onMergeWorkspaceTrigger={actions.handleMergeWorkspaceTrigger}
      />

      <MergeWorkspaceDialog
        isOpen={actions.showMergeWorkspaceDialog}
        onClose={() => {
          actions.setShowMergeWorkspaceDialog(false);
          actions.setPendingWorkspaceMerge(null);
        }}
        workspaceName={actions.pendingWorkspaceMerge?.name || ""}
        onConfirm={actions.confirmWorkspaceMerge}
      />

      <DuplicatePlaylistDialog
        isOpen={actions.showDuplicatePlaylistDialog}
        onClose={() => {
          actions.setShowDuplicatePlaylistDialog(false);
          actions.setPendingPlaylistAdd(null);
        }}
        playlistName={actions.pendingPlaylistAdd?.name || ""}
        onConfirm={actions.confirmDuplicatePlaylistAdd}
      />

      <AlreadyInPlaylistDialog
        isOpen={actions.showAlreadyInPlaylistDialog}
        onClose={() => actions.setShowAlreadyInPlaylistDialog(false)}
        playlistName={actions.alreadyInPlaylistInfo?.playlistName ?? ""}
        duplicateTitles={(actions.alreadyInPlaylistInfo?.duplicateIds ?? []).map(
          (id) => tracksById?.get(id)?.title || id
        )}
        addedCount={actions.alreadyInPlaylistInfo?.addedCount ?? 0}
        onAddAnyway={actions.confirmAlreadyInPlaylistAdd}
      />

      <PlaylistPickerDialog
        isOpen={actions.showPlaylistPickerDialog}
        onClose={() => actions.setShowPlaylistPickerDialog(false)}
        track={track}
        onAddToPlaylist={actions.handleAddToPlaylistClick}
        onCreatePlaylistClick={() => {
          actions.setShowPlaylistPickerDialog(false);
          actions.setShowCreatePlaylistDialog(true);
        }}
        tracksById={tracksById}
      />

      <ReleasePickerDialog
        isOpen={actions.showReleasePickerDialog}
        onClose={() => actions.setShowReleasePickerDialog(false)}
        track={track}
        onAddToRelease={actions.handleAddToReleaseClick}
      />

      <TrackActionMenu
        track={track}
        onRegenerateCover={actions.handleRegenerateCover}
        isRegeneratingCover={actions.isRegeneratingCover}
        onRegenerateTitle={actions.handleRegenerateTitle}
        isRegeneratingTitle={actions.isRegeneratingTitle}
        onMoveToWorkspaceClick={() => actions.setWorkspaceMenuOpen(true)}
        onAddToQueue={onAddToQueue}
        onCreatePlaylistClick={() => actions.setShowCreatePlaylistDialog(true)}
        onAddToPlaylistClick={actions.handleAddToPlaylistClick}
        onOpenPlaylistPicker={() => actions.setShowPlaylistPickerDialog(true)}
        onRemoveFromPlaylistClick={actions.handleRemoveFromPlaylistClick}
        onOpenReleasePicker={() => actions.setShowReleasePickerDialog(true)}
        onRemoveFromReleaseClick={actions.handleRemoveFromReleaseClick}
        onHideClick={onHideClick}
        onArchiveClick={onArchiveClick}
      />
    </>
  );
}
