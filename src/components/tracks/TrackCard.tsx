"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/tracks/ConfirmDialog";
import { isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import WaveformBars from "@/components/tracks/WaveformBars";
import { usePlayerStore, usePlaylistStore, useWorkspaceStore, useSelectionStore, type Workspace } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { formatDuration, formatTrackDateTime } from "@/lib/track-utils";
import type { PlaylistOption, TrackItem } from "@/components/tracks/types";

const TrackCard = memo(function TrackCard({
  track,
  onPlay,
  onSelect,
  onDelete,
  onDeleteTracks,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  onMoveToWorkspace,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(track.title ? track.title.replace(/\s*\(2\)\s*$/, "") : "");
  const [isRegeneratingCover, setIsRegeneratingCover] = useState(false);
  const [coverOverrideUrl, setCoverOverrideUrl] = useState<string | null>(null);
  const [currentRating, setCurrentRating] = useState<string | null>(track.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showCreatePlaylistDialog, setShowCreatePlaylistDialog] = useState(false);
  const [workspaceDraftOpen, setWorkspaceDraftOpen] = useState(false);
  const [showDuplicatePlaylistDialog, setShowDuplicatePlaylistDialog] = useState(false);
  const [pendingPlaylistAdd, setPendingPlaylistAdd] = useState<{ id: string; name: string } | null>(null);
  const [showMergeWorkspaceDialog, setShowMergeWorkspaceDialog] = useState(false);
  const [pendingWorkspaceMerge, setPendingWorkspaceMerge] = useState<{ id: string; name: string } | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [optimisticPlayCount, setOptimisticPlayCount] = useState(track.playCount ?? 0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const playClickCooldownRef = useRef(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const playlistInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceInputRef = useRef<HTMLInputElement | null>(null);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const allPlaylists = usePlaylistStore((state) => state.playlists);
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
    if (showCreatePlaylistDialog && playlistInputRef.current) {
      playlistInputRef.current.focus();
    }
  }, [showCreatePlaylistDialog]);

  useEffect(() => {
    if (workspaceDraftOpen && workspaceInputRef.current) {
      workspaceInputRef.current.focus();
    }
  }, [workspaceDraftOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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

  async function handleRegenerateCover(e: React.MouseEvent) {
    e.stopPropagation();
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
      setMenuOpen(false);
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

  async function handleRating(e: React.MouseEvent, newRating: "up" | "down") {
    e.stopPropagation();
    // Toggle: if same rating clicked, set to null
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

  function handleCreatePlaylist() {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;

    const playlistId = createPlaylist(trimmed);
    if (playlistId) {
      addTrackToPlaylist(playlistId, track.id);
    }
    
    setNewPlaylistName("");
    setShowCreatePlaylistDialog(false);
    setMenuOpen(false);
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

  function confirmWorkspaceMerge() {
    if (!pendingWorkspaceMerge) return;

    if (onMoveToWorkspace) {
      onMoveToWorkspace(track.id, pendingWorkspaceMerge.id);
    } else {
      moveTrackToWorkspace(pendingWorkspaceMerge.id, track.id);
    }

    setPendingWorkspaceMerge(null);
    setShowMergeWorkspaceDialog(false);
    setNewWorkspaceName("");
    setWorkspaceDraftOpen(false);
    setWorkspaceMenuOpen(false);
    setMenuOpen(false);
  }

  function handleCreateWorkspace() {
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;

    const normalizedName = trimmed.toLowerCase();
    const existingWorkspace = workspaces.find(
      (workspace) => workspace.name.trim().toLowerCase() === normalizedName
    );

    if (existingWorkspace) {
      setPendingWorkspaceMerge({ id: existingWorkspace.id, name: existingWorkspace.name });
      setShowMergeWorkspaceDialog(true);
      return;
    }

    const workspaceId = createWorkspace(trimmed);
    if (workspaceId) {
      if (onMoveToWorkspace) {
        onMoveToWorkspace(track.id, workspaceId);
      } else {
        moveTrackToWorkspace(workspaceId, track.id);
      }
    }

    setNewWorkspaceName("");
    setWorkspaceDraftOpen(false);
    setWorkspaceMenuOpen(false);
    setMenuOpen(false);
  }

  function handlePlaylistKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreatePlaylist();
    } else if (e.key === "Escape") {
      setShowCreatePlaylistDialog(false);
      setNewPlaylistName("");
    }
  }

  function handleWorkspaceKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateWorkspace();
    } else if (e.key === "Escape") {
      if (workspaceDraftOpen) {
        setWorkspaceDraftOpen(false);
        setNewWorkspaceName("");
      } else {
        setWorkspaceMenuOpen(false);
      }
    }
  }

  function openWorkspaceMoveMenu() {
    const suggestedName = (track.title || track.prompt || "").trim().replace(/\s*\(2\)\s*$/, "");
    setWorkspaceMenuOpen(true);
    setWorkspaceDraftOpen(false);
    if (suggestedName && !newWorkspaceName.trim()) {
      setNewWorkspaceName(suggestedName.slice(0, 100));
    }
    setMenuOpen(false);
  }

  const workspaceSwatches = [
    "bg-gradient-to-br from-orange-400 via-blue-500 to-indigo-700",
    "bg-gradient-to-br from-rose-300 via-red-500 to-purple-700",
    "bg-gradient-to-br from-emerald-300 via-lime-400 to-yellow-500",
    "bg-gradient-to-br from-sky-400 via-cyan-500 to-teal-700",
    "bg-gradient-to-br from-fuchsia-300 via-violet-500 to-blue-700",
  ];

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
  const hdLabel = track.formatHd === "wav" ? "WAV" : "HD";
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
      {showCreatePlaylistDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreatePlaylistDialog(false)} />
          <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-96 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-white mb-1">Create New Playlist</h3>
                <p className="text-sm text-white/60">Give your playlist a name</p>
              </div>
            </div>
            <input
              ref={playlistInputRef}
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={handlePlaylistKeyDown}
              placeholder="Playlist name"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500/50"
              maxLength={100}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreatePlaylistDialog(false);
                  setNewPlaylistName("");
                }}
                className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="px-4 py-1.5 rounded-lg text-sm bg-primary-500/80 hover:bg-primary-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create & Add
              </button>
            </div>
          </div>
        </div>
      )}
      {workspaceMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setWorkspaceMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#181822] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h3 className="text-xl leading-none font-medium text-white/90">Move to Workspace</h3>
              <button
                type="button"
                onClick={() => setWorkspaceMenuOpen(false)}
                className="h-11 w-11 rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close move to workspace menu"
              >
                <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto px-3 pb-2">
              <div className="space-y-1">
                {orderedWorkspaceOptions.map(({ workspace, depth }, index) => (
                  <button
                    key={workspace.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMoveToWorkspace) {
                        onMoveToWorkspace(track.id, workspace.id);
                      } else {
                        moveTrackToWorkspace(workspace.id, track.id);
                      }
                      setWorkspaceMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10"
                  >
                    {depth === 1 ? <span className="ml-2 text-[10px] text-white/30">-</span> : null}
                    <div className={`h-11 w-11 shrink-0 overflow-hidden rounded-md ${workspaceSwatches[index % workspaceSwatches.length]}`}>
                      {workspaceCoverById.get(workspace.id) ? (
                        <img
                          src={workspaceCoverById.get(workspace.id) || ""}
                          alt={workspace.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <span
                      className={`min-w-0 flex-1 truncate leading-tight font-medium ${depth === 1 ? "text-[13px] text-white/75" : "text-base"}`}
                    >
                      {workspaceDisplayNameById.get(workspace.id) ?? workspace.name}
                    </span>
                    <span className="shrink-0 text-xs text-white/60">{workspace.trackIds.length} clips</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 px-5 pb-4 pt-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    ref={workspaceInputRef}
                    type="text"
                    value={newWorkspaceName}
                    onFocus={() => setWorkspaceDraftOpen(true)}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    onKeyDown={handleWorkspaceKeyDown}
                    placeholder="Workspace name"
                    className="h-12 w-full rounded-lg border border-white/70 bg-transparent px-3 pr-16 text-sm font-medium text-white placeholder:text-white/45 focus:outline-none focus:border-white"
                    maxLength={100}
                    aria-label="Workspace name"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2 text-xs text-white/45">{newWorkspaceName.length}/100</span>
                </div>
                <button
                  type="button"
                  onClick={handleCreateWorkspace}
                  disabled={!newWorkspaceName.trim()}
                  className="h-12 rounded-lg bg-white/8 px-5 text-sm font-medium text-white/90 transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDuplicatePlaylistDialog && pendingPlaylistAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowDuplicatePlaylistDialog(false);
              setPendingPlaylistAdd(null);
            }}
          />
          <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-[420px] max-w-[90vw] flex flex-col gap-4">
            <h3 className="text-base font-semibold text-white">Song is already on the playlist</h3>
            <p className="text-sm text-white/65">
              This song is already in <span className="text-white/90">{pendingPlaylistAdd.name}</span>. Do you want to add it again?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicatePlaylistDialog(false);
                  setPendingPlaylistAdd(null);
                }}
                className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmDuplicatePlaylistAdd}
                className="rounded-lg bg-primary-500/80 px-4 py-1.5 text-sm text-white hover:bg-primary-500 transition-colors"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
      {showMergeWorkspaceDialog && pendingWorkspaceMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowMergeWorkspaceDialog(false);
              setPendingWorkspaceMerge(null);
            }}
          />
          <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-[440px] max-w-[90vw] flex flex-col gap-4">
            <h3 className="text-base font-semibold text-white">Workspace name bestaat al</h3>
            <p className="text-sm text-white/65">
              Er bestaat al een workspace met deze naam: <span className="text-white/90">{pendingWorkspaceMerge.name}</span>.
              Wil je de track(s) daaraan toevoegen en de workspaces samenvoegen?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMergeWorkspaceDialog(false);
                  setPendingWorkspaceMerge(null);
                }}
                className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                Nee
              </button>
              <button
                type="button"
                onClick={confirmWorkspaceMerge}
                className="rounded-lg bg-primary-500/80 px-4 py-1.5 text-sm text-white hover:bg-primary-500 transition-colors"
              >
                Ja, samenvoegen
              </button>
            </div>
          </div>
        </div>
      )}
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
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (track.status !== "done") return;
          const now = Date.now();
          if (now - playClickCooldownRef.current < 350) return;
          playClickCooldownRef.current = now;
          if (isCurrentlyPlaying) {
            setIsPlaying(!isPlaying);
          } else {
            onPlay(track);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
        }}
        className={`relative w-10 h-10 rounded-lg shrink-0 overflow-hidden transition-colors group/play ${isCurrentlyPlaying ? "ring-2 ring-primary-500/40" : ""}`}
        data-now-playing={isCurrentlyPlaying ? "true" : undefined}
        aria-label={isCurrentlyPlaying && isPlaying ? "Pause" : "Play"}
      >
        {(track.status === "generating" || track.status === "pending") ? (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400/30 border-t-primary-300" />
          </div>
        ) : effectiveCoverUrl ? (
          <>
            <img
              src={effectiveThumbUrl ?? effectiveCoverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {isCurrentlyPlaying ? (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                {isPlaying ? (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 bg-black/0 group-hover/play:bg-black/40 transition-colors flex items-center justify-center">
                <svg className="w-4 h-4 ml-0.5 text-white opacity-0 group-hover/play:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </>
        ) : track.status === "done" ? (
          <div className={`w-full h-full flex items-center justify-center relative ${
            isCurrentlyPlaying ? "bg-primary-600" : "bg-primary-600/80 hover:bg-primary-600"
          }`}>
            {isCurrentlyPlaying ? (
              isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        ) : track.status === "failed" ? (
          <div className="w-full h-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center text-primary-400/60">
            <WaveformBars count={4} className="h-3" />
          </div>
        )}
      </button>

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
            <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={discardTitle}
                aria-label="Edit track title"
                placeholder="Track title"
                className="flex-1 min-w-0 text-sm font-medium bg-white/10 border border-primary-500/40 rounded px-2 py-0.5 focus:outline-none focus:border-primary-500"
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

        {(track.status === "generating" || track.status === "pending") ? (
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
          <>
            {/* Rating buttons */}
            <button
              onClick={(e) => handleRating(e, "up")}
              disabled={ratingLoading}
              className={`hidden md:inline-flex p-1 rounded-lg transition-all duration-200 ${
                currentRating === "up"
                  ? "text-green-400"
                  : "text-white/20 hover:text-green-300"
              }`}
              style={{
                boxShadow: currentRating === "up"
                  ? "inset -1px -1px 3px rgba(74, 222, 128, 0.1), inset 1px 1px 3px rgba(0, 0, 0, 0.4)"
                  : "-1px -1px 3px rgba(255, 255, 255, 0.03), 1px 1px 3px rgba(0, 0, 0, 0.3)",
              }}
              title="Thumbs up"
              aria-label="Rate track positive"
            >
              <svg className="w-3.5 h-3.5" fill={currentRating === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>
            <button
              onClick={(e) => handleRating(e, "down")}
              disabled={ratingLoading}
              className={`hidden md:inline-flex p-1 rounded-lg transition-all duration-200 ${
                currentRating === "down"
                  ? "text-red-400"
                  : "text-white/20 hover:text-red-300"
              }`}
              style={{
                boxShadow: currentRating === "down"
                  ? "inset -1px -1px 3px rgba(248, 113, 113, 0.1), inset 1px 1px 3px rgba(0, 0, 0, 0.4)"
                  : "-1px -1px 3px rgba(255, 255, 255, 0.03), 1px 1px 3px rgba(0, 0, 0, 0.3)",
              }}
              title="Thumbs down"
              aria-label="Rate track negative"
            >
              <svg className="w-3.5 h-3.5" fill={currentRating === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </>
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
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((open) => !open);
              }}
              className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
              title="Track actions"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 min-w-48 rounded-lg border border-white/10 bg-[#12121a] shadow-xl p-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onReusePrompt?.(track);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                >
                  Reuse Prompt
                </button>
                <button
                  onClick={handleRegenerateCover}
                  disabled={isRegeneratingCover}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRegeneratingCover ? "Regenerating cover..." : "Regenerate Cover Art"}
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openWorkspaceMoveMenu();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 flex items-center justify-between gap-2"
                  >
                    <span>Move To Workspace</span>
                    <span className="text-white/30">›</span>
                  </button>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onAddToQueue?.(track);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                >
                  Add to queue
                </button>
                <div className="my-1 h-px bg-white/10" />
                <p className="px-2.5 pb-1 text-[11px] uppercase tracking-wide text-white/35">Add to playlist</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreatePlaylistDialog(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-primary-300 hover:bg-primary-500/10 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create new playlist
                </button>
                {playlists && playlists.length > 0 ? (
                  <>
                    <div className="my-1 h-px bg-white/10" />
                    {playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          const fullPlaylist = allPlaylists.find((entry) => entry.id === playlist.id);
                          const isDuplicate = Boolean(fullPlaylist?.trackIds.includes(track.id));

                          if (isDuplicate) {
                            setPendingPlaylistAdd({ id: playlist.id, name: playlist.name });
                            setShowDuplicatePlaylistDialog(true);
                            return;
                          }

                          executeAddToPlaylist(playlist.id);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                      >
                        {playlist.name}
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="px-2.5 py-1 text-xs text-white/40 italic">No playlists yet</p>
                )}
              </div>
            )}
          </div>
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
