"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/tracks/ConfirmDialog";
import { isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import WaveformBars from "@/components/tracks/WaveformBars";
import { usePlayerStore, usePlaylistStore, useWorkspaceStore, useSelectionStore, type Workspace } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { formatDuration, formatTrackDateTime } from "@/lib/track-utils";
import type { PlaylistOption, TrackItem } from "@/components/tracks/types";

// Extracted Sub-components
import CreatePlaylistDialog from "./CreatePlaylistDialog";
import DuplicatePlaylistDialog from "./DuplicatePlaylistDialog";
import MergeWorkspaceDialog from "./MergeWorkspaceDialog";
import MoveToWorkspaceDialog from "./MoveToWorkspaceDialog";
import TrackPlayButton from "./TrackPlayButton";
import TrackRating from "./TrackRating";
import TrackActionMenu from "./TrackActionMenu";

const TrackCard = memo(function TrackCard({
  track,
  onPlay,
  onSelect,
  onDelete,
  onDeleteTracks,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  onMoveToWorkspace: onMoveToWorkspaceProp,
  playlists,
  onTitleUpdate,
  workspaceById: workspaceByIdProp,
  orderedWorkspaceOptions: orderedWorkspaceOptionsProp,
  workspaceDisplayNameById: workspaceDisplayNameByIdProp,
  workspaceCoverById: workspaceCoverByIdProp,
  onToggleSelection,
}: {
  track: TrackItem;
  onPlay: (track: TrackItem) => void;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
  onDeleteTracks?: (trackIds: string[]) => Promise<void> | void;
  onReusePrompt?: (track: TrackItem) => void;
  onAddToQueue?: (track: TrackItem) => void;
  onAddToPlaylist?: (
    trackId: string,
    playlistId: string,
    options?: { allowDuplicate?: boolean }
  ) => void;
  onMoveToWorkspace?: (trackId: string, workspaceId: string) => void;
  playlists?: PlaylistOption[];
  onTitleUpdate?: (trackId: string, newTitle: string) => void;
  workspaceById?: Map<string, Workspace>;
  orderedWorkspaceOptions?: { workspace: Workspace; depth: number }[];
  workspaceDisplayNameById?: Map<string, string>;
  workspaceCoverById?: Map<string, string | null>;
  onToggleSelection?: (trackId: string, shiftKey: boolean) => void;
}) {
  const isSelected = useSelectionStore((state) => state.selectedIds.has(track.id));
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setIsFullscreen = usePlayerStore((state) => state.setIsFullscreen);
  const isCurrentlyPlaying = currentTrack?.id === track.id;
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(track.title ? track.title.replace(/\s*\(2\)\s*$/, "") : "");
  const [isRegeneratingCover, setIsRegeneratingCover] = useState(false);
  const [coverOverrideUrl, setCoverOverrideUrl] = useState<string | null>(null);
  const [currentRating, setCurrentRating] = useState<string | null>(track.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showCreatePlaylistDialog, setShowCreatePlaylistDialog] = useState(false);
  const [showDuplicatePlaylistDialog, setShowDuplicatePlaylistDialog] = useState(false);
  const [pendingPlaylistAdd, setPendingPlaylistAdd] = useState<{ id: string; name: string } | null>(null);
  const [showMergeWorkspaceDialog, setShowMergeWorkspaceDialog] = useState(false);
  const [pendingWorkspaceMerge, setPendingWorkspaceMerge] = useState<{ id: string; name: string } | null>(null);
  const [optimisticPlayCount, setOptimisticPlayCount] = useState(track.playCount ?? 0);
  const playClickCooldownRef = useRef(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const removeTrackFromPlaylist = usePlaylistStore((state) => state.removeTrackFromPlaylist);
  const { createWorkspace, moveTrackToWorkspace } = useWorkspaceStore(
    useShallow((s) => ({ createWorkspace: s.createWorkspace, moveTrackToWorkspace: s.moveTrackToWorkspace }))
  );

  // workspaces is derived from props passed by TrackList (computed once there, not per card)
  const workspaces = useMemo(() => {
    return workspaceByIdProp ? Array.from(workspaceByIdProp.values()) : [];
  }, [workspaceByIdProp]);
  const workspaceById = useMemo(
    () => workspaceByIdProp ?? new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaceByIdProp, workspaces]
  );
  const orderedWorkspaceOptions = useMemo(() => {
    if (orderedWorkspaceOptionsProp) return orderedWorkspaceOptionsProp;
    const roots = workspaces.filter((workspace) => !workspace.parentWorkspaceId);
    const childrenByParent = new Map<string, typeof workspaces>();
    workspaces
      .filter((workspace) => Boolean(workspace.parentWorkspaceId))
      .forEach((workspace) => {
        const parentId = workspace.parentWorkspaceId as string;
        const list = childrenByParent.get(parentId) ?? [];
        childrenByParent.set(parentId, [...list, workspace]);
      });
    return roots.flatMap((root) => {
      const children = childrenByParent.get(root.id) ?? [];
      return [{ workspace: root, depth: 0 }, ...children.map((child) => ({ workspace: child, depth: 1 }))];
    });
  }, [orderedWorkspaceOptionsProp, workspaces]);

  const workspaceDisplayNameById = useMemo(() => {
    if (workspaceDisplayNameByIdProp) return workspaceDisplayNameByIdProp;
    const map = new Map<string, string>();
    workspaces.forEach((workspace) => {
      if (!workspace.parentWorkspaceId) {
        map.set(workspace.id, workspace.name);
        return;
      }
      const parentName = workspaceById.get(workspace.parentWorkspaceId)?.name;
      map.set(workspace.id, parentName ? `${parentName} / ${workspace.name}` : workspace.name);
    });
    return map;
  }, [workspaceDisplayNameByIdProp, workspaceById, workspaces]);

  const assignedWorkspaceName = useMemo(() => {
    const assignedWorkspace = workspaces.find((workspace) => workspaceById.get(workspace.id)?.trackIds.includes(track.id));
    if (!assignedWorkspace) return null;
    return workspaceDisplayNameById.get(assignedWorkspace.id) ?? assignedWorkspace.name;
  }, [track.id, workspaces, workspaceById, workspaceDisplayNameById]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    setOptimisticPlayCount(track.playCount ?? 0);
  }, [track.playCount]);

  useEffect(() => {
    function handleTrackPlayed(event: Event) {
      const customEvent = event as CustomEvent<{ trackId?: string; playCount?: number }>;
      if (customEvent.detail?.trackId !== track.id) return;
      const nextCount = customEvent.detail?.playCount;
      if (typeof nextCount === "number" && Number.isFinite(nextCount)) {
        setOptimisticPlayCount(nextCount);
        return;
      }
      setOptimisticPlayCount((count) => Math.max(1, count + 1));
    }

    window.addEventListener("melodiq:track-played", handleTrackPlayed);
    return () => window.removeEventListener("melodiq:track-played", handleTrackPlayed);
  }, [track.id]);

  useEffect(() => {
    function handleCoverRegenerated(event: Event) {
      const customEvent = event as CustomEvent<{ trackIds?: string[]; ts?: number }>;
      const ids = customEvent.detail?.trackIds;
      if (!Array.isArray(ids) || !ids.includes(track.id)) return;
      const ts = typeof customEvent.detail?.ts === "number" ? customEvent.detail.ts : Date.now();
      setCoverOverrideUrl(`/api/tracks/${track.id}/cover?t=${ts}`);
    }

    window.addEventListener("melodiq:cover-regenerated", handleCoverRegenerated);
    return () => window.removeEventListener("melodiq:cover-regenerated", handleCoverRegenerated);
  }, [track.id]);

  async function executeDelete() {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      const ids = pendingDeleteIds && pendingDeleteIds.length > 0 ? pendingDeleteIds : [track.id];

      if (onDeleteTracks) {
        await onDeleteTracks(ids);
      } else {
        for (const id of ids) {
          const res = await fetch(`/api/tracks/${id}`, { method: "DELETE" });
          if (res.ok) onDelete?.(id);
        }
      }
    } catch {
      // silently fail
    }
    setDeleting(false);
    setPendingDeleteIds(null);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const activeSelection = useSelectionStore.getState().selectedIds;
    if (activeSelection.size > 0 && activeSelection.has(track.id)) {
      setPendingDeleteIds(Array.from(activeSelection));
    } else {
      setPendingDeleteIds([track.id]);
    }
    setConfirmDelete(true);
  }

  async function handleRegenerateCover() {
    if (isRegeneratingCover) return;

    setIsRegeneratingCover(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateCoverArt: true }),
      });

      if (res.ok) {
        setCoverOverrideUrl(`/api/tracks/${track.id}/cover?t=${Date.now()}`);
      }
    } catch {
      // silently fail
    } finally {
      setIsRegeneratingCover(false);
    }
  }

  function discardTitle() {
    setIsEditingTitle(false);
    setEditTitle(track.title ? track.title.replace(/\s*\(2\)\s*$/, "") : "");
  }

  function saveTitle() {
    const trimmedTitle = editTitle.trim();
    setIsEditingTitle(false);
    if (!trimmedTitle || trimmedTitle === track.title) return;
    onTitleUpdate?.(track.id, trimmedTitle);
    fetch(`/api/tracks/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmedTitle }),
    }).catch(() => {});
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle();
    } else if (e.key === "Escape") {
      discardTitle();
    }
  }

  function handleTitleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(track.title ? track.title.replace(/\s*\(2\)\s*$/, "") : track.prompt.substring(0, 50));
  }

  function handleDownload(url: string, hd = false) {
    setDownloading(true);
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd ? (track.formatHd ?? track.format ?? "mp3") : (track.format ?? "mp3");
    a.download = `${(track.title || "track").replace(/\s*\(2\)\s*$/, "")}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
    setTimeout(() => setDownloading(false), 1000);
  }

  async function handleRating(newRating: "up" | "down") {
    const rating = currentRating === newRating ? null : newRating;
    
    setRatingLoading(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (res.ok) {
        setCurrentRating(rating);
      }
    } catch (error) {
      console.error("Failed to update rating:", error);
    } finally {
      setRatingLoading(false);
    }
  }

  function handleCreatePlaylist(name: string) {
    const playlistId = createPlaylist(name);
    if (playlistId) {
      addTrackToPlaylist(playlistId, track.id);
    }
    setShowCreatePlaylistDialog(false);
  }

  function executeAddToPlaylist(playlistId: string, options?: { allowDuplicate?: boolean }) {
    if (onAddToPlaylist) {
      onAddToPlaylist(track.id, playlistId, options);
      return;
    }

    addTrackToPlaylist(playlistId, track.id, options);
  }

  function confirmDuplicatePlaylistAdd() {
    if (!pendingPlaylistAdd) return;
    executeAddToPlaylist(pendingPlaylistAdd.id, { allowDuplicate: true });
    setPendingPlaylistAdd(null);
    setShowDuplicatePlaylistDialog(false);
  }

  function handleAddToPlaylistClick(playlistId: string, playlistName: string, isDuplicate: boolean) {
    if (isDuplicate) {
      setPendingPlaylistAdd({ id: playlistId, name: playlistName });
      setShowDuplicatePlaylistDialog(true);
      return;
    }

    executeAddToPlaylist(playlistId);
  }

  function handleRemoveFromPlaylistClick(playlistId: string) {
    removeTrackFromPlaylist(playlistId, track.id);
  }

  function handleMoveToWorkspace(workspaceId: string) {
    if (onMoveToWorkspaceProp) {
      onMoveToWorkspaceProp(track.id, workspaceId);
    } else {
      moveTrackToWorkspace(workspaceId, track.id);
    }
    setWorkspaceMenuOpen(false);
  }

  function confirmWorkspaceMerge() {
    if (!pendingWorkspaceMerge) return;

    if (onMoveToWorkspaceProp) {
      onMoveToWorkspaceProp(track.id, pendingWorkspaceMerge.id);
    } else {
      moveTrackToWorkspace(pendingWorkspaceMerge.id, track.id);
    }

    setPendingWorkspaceMerge(null);
    setShowMergeWorkspaceDialog(false);
    setWorkspaceMenuOpen(false);
  }

  function handleMergeWorkspaceTrigger(existingWorkspace: { id: string; name: string }) {
    setPendingWorkspaceMerge({ id: existingWorkspace.id, name: existingWorkspace.name });
    setShowMergeWorkspaceDialog(true);
  }

  function handleCreateWorkspace(name: string) {
    const workspaceId = createWorkspace(name);
    if (workspaceId) {
      if (onMoveToWorkspaceProp) {
        onMoveToWorkspaceProp(track.id, workspaceId);
      } else {
        moveTrackToWorkspace(workspaceId, track.id);
      }
    }
    setWorkspaceMenuOpen(false);
  }

  const workspaceCoverById = workspaceCoverByIdProp ?? new Map<string, string | null>();

  const statusConfig = {
    pending: { color: "bg-yellow-500/20 text-yellow-300", label: "Queued" },
    generating: { color: "bg-blue-500/20 text-blue-300", label: "Creating" },
    done: { color: "bg-green-500/20 text-green-300", label: "Ready" },
    failed: { color: "bg-red-500/20 text-red-300", label: "Failed" },
  };
  const baseStatus = statusConfig[track.status];
  const status = isCurrentlyPlaying
    ? isPlaying
      ? { color: "bg-primary-500/20 text-primary-200 border border-primary-500/30", label: "Now playing" }
      : { color: "bg-white/5 text-white/60 border border-white/10", label: "Paused" }
    : baseStatus;
  const statusAnimationClass = track.status === "generating" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : "";

  const createdAt = formatTrackDateTime(new Date(track.createdAt));
  const title = (track.title || track.prompt.substring(0, 50)).replace(/\s*\(2\)\s*$/, "");
  const styleDesc = track.prompt.length > 80 ? track.prompt.substring(0, 80) + "..." : track.prompt;
  const playCount = optimisticPlayCount;
  const isNewUnplayed = track.status === "done" && playCount === 0;
  const mp3Label = (track.format ?? "mp3").toUpperCase();
  const hdLabel = track.formatHd ? track.formatHd.toUpperCase() : "HD";
  const isUploadedTrack = track.provider === "upload";
  const effectiveCoverUrl = coverOverrideUrl ?? track.coverUrl ?? null;
  const effectiveThumbUrl = coverOverrideUrl
    ? `${coverOverrideUrl}&thumb=1`
    : track.s3KeyCoverThumb
      ? `/api/tracks/${track.id}/cover?thumb=1`
      : effectiveCoverUrl;
  const deleteCount = pendingDeleteIds && pendingDeleteIds.length > 0 ? pendingDeleteIds.length : 1;
  const deleteMessage =
    deleteCount === 1
      ? "Delete this song? This cannot be undone."
      : `Delete ${deleteCount} selected songs? This cannot be undone.`;

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message={deleteMessage}
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      
      <CreatePlaylistDialog
        isOpen={showCreatePlaylistDialog}
        onClose={() => setShowCreatePlaylistDialog(false)}
        onCreate={handleCreatePlaylist}
      />

      <MoveToWorkspaceDialog
        isOpen={workspaceMenuOpen}
        onClose={() => setWorkspaceMenuOpen(false)}
        track={track}
        orderedWorkspaceOptions={orderedWorkspaceOptions}
        workspaceCoverById={workspaceCoverById}
        workspaceDisplayNameById={workspaceDisplayNameById}
        workspaces={workspaces}
        onMoveToWorkspace={handleMoveToWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onMergeWorkspaceTrigger={handleMergeWorkspaceTrigger}
      />

      <DuplicatePlaylistDialog
        isOpen={showDuplicatePlaylistDialog}
        onClose={() => {
          setShowDuplicatePlaylistDialog(false);
          setPendingPlaylistAdd(null);
        }}
        playlistName={pendingPlaylistAdd?.name || ""}
        onConfirm={confirmDuplicatePlaylistAdd}
      />

      <MergeWorkspaceDialog
        isOpen={showMergeWorkspaceDialog}
        onClose={() => {
          setShowMergeWorkspaceDialog(false);
          setPendingWorkspaceMerge(null);
        }}
        workspaceName={pendingWorkspaceMerge?.name || ""}
        onConfirm={confirmWorkspaceMerge}
      />

      <div
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
          isCurrentlyPlaying
            ? "bg-primary-500/20 border border-primary-500/25 border-l-4 border-l-primary-400 shadow-[0_0_0_1px_rgba(99,102,241,0.2)] pl-2"
            : track.status === "generating" || track.status === "pending"
              ? "bg-primary-600/5 border border-primary-600/20"
              : "hover:bg-white/5"
        } ${isCurrentlyPlaying ? `now-playing ${isPlaying ? "is-playing" : "is-paused"}` : ""}`}
        data-now-playing={isCurrentlyPlaying ? "true" : undefined}
        data-playing={isCurrentlyPlaying ? (isPlaying ? "true" : "false") : undefined}
        onClick={(e) => {
          if (e.shiftKey) {
            onToggleSelection?.(track.id, true);
            return;
          }
          onSelect(track);
        }}
        onDoubleClick={(e) => {
          if (e.shiftKey) return;
          if (track.status !== "done") return;
          if (!isCurrentlyPlaying) onPlay(track);
          setIsFullscreen(true);
        }}
      >
        {/* Selection dot */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection?.(track.id, e.shiftKey);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
          }}
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
          title="Select track"
        >
          {isSelected ? (
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : isCurrentlyPlaying ? (
            <div className="w-4 h-4 rounded-full bg-primary-500/25 border border-primary-500/35 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite]">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-200" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 group-hover:border-white/40 transition-colors" />
          )}
        </button>

        {/* Play button / artwork placeholder */}
        <TrackPlayButton
          track={track}
          isCurrentlyPlaying={isCurrentlyPlaying}
          isPlaying={isPlaying}
          effectiveCoverUrl={effectiveCoverUrl}
          effectiveThumbUrl={effectiveThumbUrl}
          onPlayClick={() => {
            const now = Date.now();
            if (now - playClickCooldownRef.current < 350) return;
            playClickCooldownRef.current = now;
            if (isCurrentlyPlaying) {
              setIsPlaying(!isPlaying);
            } else {
              onPlay(track);
            }
          }}
        />

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0 w-full">
            {isNewUnplayed && (
              <span
                className="h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_0_2px_rgba(253,224,71,0.25),0_0_10px_rgba(253,224,71,0.85)]"
                title="New track"
                aria-label="New unplayed track"
              />
            )}
            {isEditingTitle ? (
              <div className="flex items-center gap-1 min-w-0 max-w-full" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={discardTitle}
                  aria-label="Edit track title"
                  placeholder="Track title"
                  className="field-sizing-content w-auto min-w-[10ch] max-w-[55vw] sm:max-w-[40ch] text-sm font-medium bg-white/10 border border-primary-500/40 rounded px-2 py-0.5 focus:outline-none focus:border-primary-500"
                  maxLength={200}
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); saveTitle(); }}
                  className="shrink-0 p-0.5 text-green-400 hover:text-green-300 transition-colors"
                  title="Save title (Enter)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); discardTitle(); }}
                  className="shrink-0 p-0.5 text-red-400 hover:text-red-300 transition-colors"
                  title="Discard changes (Esc)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <h3
                className={`text-sm font-medium truncate cursor-text flex-1 min-w-0 ${isCurrentlyPlaying ? "text-primary-200" : ""}`}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={handleTitleDoubleClick}
                title="Double-click to edit"
              >
                {title}
              </h3>
            )}
            <span className={`${status.label === "Ready" ? "hidden sm:inline-flex" : "inline-flex"} text-[10px] px-1.5 py-0.5 rounded ${status.color} ${statusAnimationClass} shrink-0`}>
              {status.label}
            </span>
            {track.status === "done" && track.lyricsTimestamps && !isLyricsTaskSubmission(track.lyricsTimestamps) && (
              <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded border border-blue-300/30 bg-blue-400/10 text-blue-200 shrink-0 font-medium cursor-help" title="timecodedlyrics">
                TCL
              </span>
            )}
            {isUploadedTrack && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 shrink-0">
                Uploaded
              </span>
            )}
            {assignedWorkspaceName && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/65 truncate max-w-[140px] shrink-0" title={assignedWorkspaceName}>
                {assignedWorkspaceName}
              </span>
            )}
          </div>

          {/* Mobile Download Buttons Row */}
          {track.status === "done" && track.audioUrl && (
            <div className="flex sm:hidden items-center gap-2 mt-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(track.audioUrl!);
                }}
                disabled={downloading}
                className="px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 text-white/50 hover:text-white/80 active:bg-white/10 transition-all shrink-0"
                title={`Download ${mp3Label}`}
              >
                📥 {mp3Label}
              </button>
              {track.s3KeyHd && track.audioUrlHd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(track.audioUrlHd!, true);
                  }}
                  disabled={downloading}
                  className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 active:scale-95 transition-all shrink-0"
                  title={`Download ${hdLabel}`}
                >
                  📥 {hdLabel}
                </button>
              )}
            </div>
          )}

          {track.status === "generating" || track.status === "pending" ? (
            <div className="mt-1.5 text-primary-500/40 w-full">
              <WaveformBars count={32} className="h-2 w-full" />
            </div>
          ) : (
            <>
              <p className="hidden sm:block text-xs text-white/30 truncate mt-0.5">{styleDesc}</p>
              <p className="hidden sm:block text-[10px] text-white/40 mt-0.5 uppercase tracking-[0.12em]">
                {playCount} {playCount === 1 ? "play" : "plays"}
              </p>
            </>
          )}
          {track.error && (
            <p className="text-xs text-red-400 mt-0.5">{track.error}</p>
          )}
        </div>

        {/* Time + actions */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="mr-1 text-right leading-tight">
            <p className="hidden sm:block text-[11px] text-white/30 whitespace-nowrap">{createdAt.date}</p>
            <p className="hidden sm:block text-[10px] text-white/20 whitespace-nowrap">{createdAt.time}</p>
            {track.duration && track.status === "done" && (
              <p className="text-[10px] text-white/40 sm:text-white/20 whitespace-nowrap mt-0.5">{formatDuration(track.duration)}</p>
            )}
          </div>
          {track.status === "done" && (
            <TrackRating
              rating={currentRating}
              ratingLoading={ratingLoading}
              onRate={handleRating}
            />
          )}
          {track.status === "done" && track.audioUrl && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(track.audioUrl!);
                }}
                disabled={downloading}
                className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                title={`Download ${mp3Label}`}
              >
                {mp3Label}
              </button>
              {track.s3KeyHd && track.audioUrlHd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(track.audioUrlHd!, true);
                  }}
                  disabled={downloading}
                  className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                  title={`Download ${hdLabel}`}
                >
                  {hdLabel}
                </button>
              )}
            </>
          )}
          {track.status === "done" && (
            <TrackActionMenu
              track={track}
              playlists={playlists}
              onReusePrompt={onReusePrompt}
              onRegenerateCover={handleRegenerateCover}
              isRegeneratingCover={isRegeneratingCover}
              onMoveToWorkspaceClick={() => setWorkspaceMenuOpen(true)}
              onAddToQueue={onAddToQueue}
              onCreatePlaylistClick={() => setShowCreatePlaylistDialog(true)}
              onAddToPlaylistClick={handleAddToPlaylistClick}
              onRemoveFromPlaylistClick={handleRemoveFromPlaylistClick}
            />
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title={deleting ? "Deleting..." : "Delete track"}
          >
            {deleting ? (
              <div className="w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.track.id === nextProps.track.id &&
    prevProps.track.title === nextProps.track.title &&
    prevProps.track.status === nextProps.track.status &&
    prevProps.track.playCount === nextProps.track.playCount &&
    prevProps.track.coverUrl === nextProps.track.coverUrl &&
    prevProps.track.rating === nextProps.track.rating &&
    prevProps.track.s3KeyHd === nextProps.track.s3KeyHd &&
    prevProps.track.lyricsTimestamps === nextProps.track.lyricsTimestamps &&
    prevProps.playlists?.length === nextProps.playlists?.length &&
    prevProps.workspaceById?.size === nextProps.workspaceById?.size
  );
});

export default TrackCard;
