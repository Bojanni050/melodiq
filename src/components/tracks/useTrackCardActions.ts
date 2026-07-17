"use client";

import { useEffect, useState } from "react";
import { usePlaylistStore, useWorkspaceStore, useSelectionStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { PlaylistOption, TrackItem } from "./types";

interface UseTrackCardActionsOptions {
  track: TrackItem;
  playlists?: PlaylistOption[];
  tracksById?: Map<string, TrackItem>;
  onDelete?: (trackId: string) => void;
  onDeleteTracks?: (trackIds: string[]) => Promise<void> | void;
  onAddToPlaylist?: (trackId: string, playlistId: string, options?: { allowDuplicate?: boolean }) => void;
  onMoveToWorkspace?: (trackId: string, workspaceId: string) => void;
}

export function useTrackCardActions({
  track,
  tracksById,
  onDelete,
  onDeleteTracks,
  onAddToPlaylist,
  onMoveToWorkspace: onMoveToWorkspaceProp,
}: UseTrackCardActionsOptions) {
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const removeTrackFromPlaylist = usePlaylistStore((state) => state.removeTrackFromPlaylist);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const { createWorkspace, createWorkspaceFolderAndAssign, moveTrackToWorkspace } = useWorkspaceStore(
    useShallow((s) => ({
      createWorkspace: s.createWorkspace,
      createWorkspaceFolderAndAssign: s.createWorkspaceFolderAndAssign,
      moveTrackToWorkspace: s.moveTrackToWorkspace,
    }))
  );

  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [isRegeneratingCover, setIsRegeneratingCover] = useState(false);
  const [coverOverrideUrl, setCoverOverrideUrl] = useState<string | null>(null);
  const [currentRating, setCurrentRating] = useState<string | null>(track.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [currentVotedAt, setCurrentVotedAt] = useState<string | null>(track.votedAt ?? null);
  const [voteLoading, setVoteLoading] = useState(false);
  const [showCreatePlaylistDialog, setShowCreatePlaylistDialog] = useState(false);
  const [showPlaylistPickerDialog, setShowPlaylistPickerDialog] = useState(false);
  const [showDuplicatePlaylistDialog, setShowDuplicatePlaylistDialog] = useState(false);
  const [pendingPlaylistAdd, setPendingPlaylistAdd] = useState<{ id: string; name: string } | null>(null);
  const [showAlreadyInPlaylistDialog, setShowAlreadyInPlaylistDialog] = useState(false);
  const [alreadyInPlaylistInfo, setAlreadyInPlaylistInfo] = useState<{
    playlistId: string;
    playlistName: string;
    duplicateIds: string[];
    addedCount: number;
  } | null>(null);
  const [showMergeWorkspaceDialog, setShowMergeWorkspaceDialog] = useState(false);
  const [pendingWorkspaceMerge, setPendingWorkspaceMerge] = useState<{ id: string; name: string } | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [showAddToSongDialog, setShowAddToSongDialog] = useState(false);

  useEffect(() => {
    function handleCoverRegenerated(event: Event) {
      const e = event as CustomEvent<{ trackIds?: string[]; ts?: number }>;
      const ids = e.detail?.trackIds;
      if (!Array.isArray(ids) || !ids.includes(track.id)) return;
      const ts = typeof e.detail?.ts === "number" ? e.detail.ts : Date.now();
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

  function handleDelete(e: React.MouseEvent) {
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
      if (res.status === 202) {
        const { requestedAt } = await res.json().catch(() => ({ requestedAt: Date.now() }));
        // Poll track until updatedAt is after requestedAt (cover replaced), max ~2 min
        const started = Date.now();
        const poll = async () => {
          if (Date.now() - started > 120_000) { setIsRegeneratingCover(false); return; }
          try {
            const r = await fetch(`/api/tracks/${track.id}`);
            if (r.ok) {
              const data = await r.json();
              const updatedAt = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
              if (data.s3KeyCover && updatedAt >= requestedAt) {
                const ts = Date.now();
                setCoverOverrideUrl(`/api/tracks/${track.id}/cover?t=${ts}`);
                window.dispatchEvent(new CustomEvent("melodiq:cover-regenerated", { detail: { trackIds: [track.id], ts } }));
                setIsRegeneratingCover(false);
                return;
              }
            }
          } catch { /* ignore */ }
          setTimeout(poll, 3000);
        };
        setTimeout(poll, 3000);
      } else if (res.ok) {
        setCoverOverrideUrl(`/api/tracks/${track.id}/cover?t=${Date.now()}`);
        setIsRegeneratingCover(false);
      } else {
        setIsRegeneratingCover(false);
      }
    } catch {
      setIsRegeneratingCover(false);
    }
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
      if (res.ok) setCurrentRating(rating);
    } catch (error) {
      console.error("Failed to update rating:", error);
    } finally {
      setRatingLoading(false);
    }
  }

  async function handleVote() {
    setVoteLoading(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}/vote`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCurrentVotedAt(data.track?.votedAt ?? null);
      }
    } catch (error) {
      console.error("Failed to update vote:", error);
    } finally {
      setVoteLoading(false);
    }
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

  function handleCreatePlaylist(name: string) {
    const playlistId = createPlaylist(name);
    if (playlistId) addTrackToPlaylist(playlistId, track.id);
    setShowCreatePlaylistDialog(false);
  }

  function executeAddToPlaylist(playlistId: string, options?: { allowDuplicate?: boolean }) {
    if (onAddToPlaylist) {
      onAddToPlaylist(track.id, playlistId, options);
    } else {
      addTrackToPlaylist(playlistId, track.id, options);
    }
    clearSelection();
  }

  function confirmDuplicatePlaylistAdd() {
    if (!pendingPlaylistAdd) return;
    executeAddToPlaylist(pendingPlaylistAdd.id, { allowDuplicate: true });
    setPendingPlaylistAdd(null);
    setShowDuplicatePlaylistDialog(false);
  }

  function handleAddToPlaylistClick(playlistId: string, playlistName: string, isDuplicate: boolean) {
    const activeSelection = useSelectionStore.getState().selectedIds;
    const isMultiSelect = activeSelection.size > 1 && activeSelection.has(track.id);

    if (isMultiSelect) {
      const allPlaylists = usePlaylistStore.getState().playlists;
      const playlist = allPlaylists.find((p) => p.id === playlistId);
      const existingIds = new Set(playlist?.trackIds ?? []);
      const selectedIds = Array.from(activeSelection);
      const duplicateIds = selectedIds.filter((id) => existingIds.has(id));
      const newIds = selectedIds.filter((id) => !existingIds.has(id));

      for (const id of newIds) {
        if (onAddToPlaylist) {
          onAddToPlaylist(id, playlistId);
        } else {
          addTrackToPlaylist(playlistId, id);
        }
      }

      if (duplicateIds.length > 0) {
        setAlreadyInPlaylistInfo({ playlistId, playlistName, duplicateIds, addedCount: newIds.length });
        setShowAlreadyInPlaylistDialog(true);
      } else {
        clearSelection();
      }
      return;
    }

    if (isDuplicate) {
      setPendingPlaylistAdd({ id: playlistId, name: playlistName });
      setShowDuplicatePlaylistDialog(true);
      return;
    }
    executeAddToPlaylist(playlistId);
  }

  function confirmAlreadyInPlaylistAdd() {
    if (!alreadyInPlaylistInfo) return;
    for (const id of alreadyInPlaylistInfo.duplicateIds) {
      if (onAddToPlaylist) {
        onAddToPlaylist(id, alreadyInPlaylistInfo.playlistId, { allowDuplicate: true });
      } else {
        addTrackToPlaylist(alreadyInPlaylistInfo.playlistId, id, { allowDuplicate: true });
      }
    }
    setAlreadyInPlaylistInfo(null);
    setShowAlreadyInPlaylistDialog(false);
    clearSelection();
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

  function handleAddToSong(songId: string) {
    moveTrackToWorkspace(songId, track.id);
    setShowAddToSongDialog(false);
  }

  function handleCreateSongAndAdd(name: string, workspaceId: string) {
    void createWorkspaceFolderAndAssign(workspaceId, name, track.id);
    setShowAddToSongDialog(false);
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

  return {
    // state
    downloading, deleting, confirmDelete, setConfirmDelete,
    pendingDeleteIds, coverOverrideUrl,
    currentRating, ratingLoading,
    currentVotedAt, voteLoading,
    isRegeneratingCover,
    showCreatePlaylistDialog, setShowCreatePlaylistDialog,
    showPlaylistPickerDialog, setShowPlaylistPickerDialog,
    showDuplicatePlaylistDialog, setShowDuplicatePlaylistDialog,
    pendingPlaylistAdd, setPendingPlaylistAdd,
    showAlreadyInPlaylistDialog, setShowAlreadyInPlaylistDialog,
    alreadyInPlaylistInfo,
    showMergeWorkspaceDialog, setShowMergeWorkspaceDialog,
    pendingWorkspaceMerge, setPendingWorkspaceMerge,
    workspaceMenuOpen, setWorkspaceMenuOpen,
    showAddToSongDialog, setShowAddToSongDialog,
    // handlers
    handleAddToSong, handleCreateSongAndAdd,
    executeDelete, handleDelete,
    handleRegenerateCover,
    handleRating,
    handleVote,
    handleDownload,
    handleCreatePlaylist,
    confirmDuplicatePlaylistAdd,
    handleAddToPlaylistClick,
    confirmAlreadyInPlaylistAdd,
    handleRemoveFromPlaylistClick,
    handleMoveToWorkspace,
    confirmWorkspaceMerge,
    handleMergeWorkspaceTrigger,
    handleCreateWorkspace,
  };
}
