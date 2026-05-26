"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WORKSPACE_FOLDER_GRADIENTS, usePlayerStore, usePlaylistStore, useWorkspaceStore } from "@/lib/store";

const WAVE_DELAYS = ["[animation-delay:0ms]", "[animation-delay:55ms]", "[animation-delay:110ms]", "[animation-delay:165ms]", "[animation-delay:220ms]"];
const WAVE_DURATIONS = ["[animation-duration:700ms]", "[animation-duration:790ms]", "[animation-duration:880ms]", "[animation-duration:970ms]", "[animation-duration:1060ms]"];

// Staggered delays for organic waveform feel
function WaveformBars({ count = 5, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 overflow-hidden ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`h-full w-0.5 animate-wave-bar bg-current rounded-[1px] shrink-0 ${i % 3 === 0 ? "opacity-100" : i % 3 === 1 ? "opacity-80" : "opacity-60"} ${WAVE_DELAYS[i % WAVE_DELAYS.length]} ${WAVE_DURATIONS[i % WAVE_DURATIONS.length]}`}
        />
      ))}
    </div>
  );
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickRandomItems<T>(items: T[], seed: string, limit: number) {
  const next = [...items];
  next.sort((left, right) => {
    const leftScore = hashString(`${seed}:${String(left)}`);
    const rightScore = hashString(`${seed}:${String(right)}`);
    return leftScore - rightScore;
  });
  return next.slice(0, limit);
}

function getWorkspaceCoverCollage(workspaceId: string, workspaceTracks: TrackItem[]) {
  const coverUrls = workspaceTracks
    .filter((track) => !!track.coverUrl)
    .map((track) => track.coverUrl as string);

  return pickRandomItems(coverUrls, workspaceId, 4);
}

function getWorkspaceGradient(workspaceId: string, gradient?: string) {
  if (gradient) return gradient;
  return WORKSPACE_FOLDER_GRADIENTS[hashString(workspaceId) % WORKSPACE_FOLDER_GRADIENTS.length];
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-sm bg-red-500/80 hover:bg-red-500 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface TrackItem {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  rating?: string | null;
}

interface PlaylistOption {
  id: string;
  name: string;
}

type SortOrder = "manual" | "newest" | "oldest" | "title-asc" | "title-desc";

export default function TrackList({
  tracks,
  isGenerating,
  autoQueueAfterPlay,
  onSelect,
  onDelete,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  onMoveToWorkspace,
  playlists,
  onTitleUpdate,
}: {
  tracks: TrackItem[];
  isGenerating?: boolean;
  autoQueueAfterPlay?: boolean;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
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
}) {
  const { playTrackFromGesture, setQueue, setPlayContext, autoPlayNext } = usePlayerStore();
  const moveTrackToWorkspace = useWorkspaceStore((state) => state.moveTrackToWorkspace);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("after");
  const [deleting, setDeleting] = useState(false);
  const [confirmMassDelete, setConfirmMassDelete] = useState(false);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    setManualOrder((current) => {
      const trackIds = tracks.map((track) => track.id);
      const existingIds = current.filter((id) => trackIds.includes(id));
      const missingIds = trackIds.filter((id) => !existingIds.includes(id));
      return [...existingIds, ...missingIds];
    });
  }, [tracks]);

  const orderedTracks = useMemo(() => {
    const list = [...tracks];

    if (sortOrder === "manual") {
      const rankById = new Map(manualOrder.map((id, index) => [id, index]));
      list.sort((left, right) => {
        const leftRank = rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) return leftRank - rightRank;

        const leftTime = Number(new Date(left.createdAt));
        const rightTime = Number(new Date(right.createdAt));
        if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
        return rightTime - leftTime;
      });
      return list;
    }

    list.sort((left, right) => {
      if (sortOrder === "title-asc" || sortOrder === "title-desc") {
        const leftTitle = (left.title ?? left.prompt ?? "").trim();
        const rightTitle = (right.title ?? right.prompt ?? "").trim();
        const titleComparison = leftTitle.localeCompare(rightTitle, undefined, {
          sensitivity: "base",
          numeric: true,
        });

        if (titleComparison !== 0) {
          return sortOrder === "title-asc" ? titleComparison : -titleComparison;
        }

        const leftTime = Number(new Date(left.createdAt));
        const rightTime = Number(new Date(right.createdAt));
        if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
        return rightTime - leftTime;
      }

      const leftTime = Number(new Date(left.createdAt));
      const rightTime = Number(new Date(right.createdAt));

      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
      if (sortOrder === "oldest") return leftTime - rightTime;
      return rightTime - leftTime;
    });

    return list;
  }, [manualOrder, sortOrder, tracks]);

  const displayedTracks = useMemo(() => {
    const list = [...orderedTracks];

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return list;
    }

    return list.filter((track) => {
      const searchValues = [
        track.title ?? "",
        track.prompt,
        track.provider,
        track.providerModel,
        track.lyrics ?? "",
      ];

      return searchValues.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [orderedTracks, searchQuery]);

  useEffect(() => {
    const availableIds = new Set(tracks.map((track) => track.id));
    setSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [tracks]);

  function toggleSelection(trackId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      const visibleIds = displayedTracks.map((track) => track.id);
      const hasAllVisible = visibleIds.length > 0 && visibleIds.every((id) => current.has(id));

      if (hasAllVisible) {
        const next = new Set(current);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }

      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const visibleSelectedCount = useMemo(
    () => displayedTracks.reduce((count, track) => (selectedIds.has(track.id) ? count + 1 : count), 0),
    [displayedTracks, selectedIds],
  );

  const allSelected = displayedTracks.length > 0 && visibleSelectedCount === displayedTracks.length;

  async function handleMassDelete() {
    if (selectedIds.size === 0) return;
    setConfirmMassDelete(true);
  }

  async function executeMassDelete() {
    setConfirmMassDelete(false);
    setDeleting(true);
    try {
      for (const id of selectedIds) {
        const res = await fetch(`/api/tracks/${id}`, { method: "DELETE" });
        if (res.ok) onDelete?.(id);
      }
      setSelectedIds(new Set());
    } catch {
      // silently fail — individual track errors are handled at the API level
    } finally {
      setDeleting(false);
    }
  }

  function handleMoveToWorkspace(sourceTrackId: string, workspaceId: string) {
    const activeSelection = selectedIdsRef.current;
    const moveIds = activeSelection.size > 0 && activeSelection.has(sourceTrackId)
      ? Array.from(activeSelection)
      : [sourceTrackId];

    moveIds.forEach((trackId) => {
      moveTrackToWorkspace(workspaceId, trackId);
      onMoveToWorkspace?.(trackId, workspaceId);
    });

    if (moveIds.length > 1) {
      setSelectedIds(new Set());
    }
  }

  function moveTrackInManualOrder(sourceId: string, targetId: string, position: "before" | "after") {
    setManualOrder((current) => {
      const baseOrder = current.length > 0 ? [...current] : orderedTracks.map((track) => track.id);
      const sourceIndex = baseOrder.indexOf(sourceId);
      const targetIndex = baseOrder.indexOf(targetId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceId === targetId) {
        return current;
      }

      const next = [...baseOrder];
      next.splice(sourceIndex, 1);

      const adjustedTargetIndex = next.indexOf(targetId);
      const insertIndex = position === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
      next.splice(insertIndex, 0, sourceId);

      return next;
    });
  }

  const canDragReorder = searchQuery.trim().length === 0 && displayedTracks.length > 1;

  function handleTrackDragStart(trackId: string) {
    if (!canDragReorder) return;
    setDraggedTrackId(trackId);
    setSortOrder("manual");
  }

  function handleTrackDragOver(event: React.DragEvent<HTMLDivElement>, trackId: string) {
    if (!canDragReorder || !draggedTrackId || draggedTrackId === trackId) return;
    event.preventDefault();

    const bounds = event.currentTarget.getBoundingClientRect();
    const midpoint = bounds.top + bounds.height / 2;
    const position: "before" | "after" = event.clientY < midpoint ? "before" : "after";

    if (dragOverTrackId !== trackId || dragOverPosition !== position) {
      setDragOverTrackId(trackId);
      setDragOverPosition(position);
    }
  }

  function handleTrackDrop(trackId: string) {
    if (!canDragReorder || !draggedTrackId || draggedTrackId === trackId) {
      setDraggedTrackId(null);
      setDragOverTrackId(null);
      return;
    }

    moveTrackInManualOrder(draggedTrackId, trackId, dragOverPosition);
    setSortOrder("manual");
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  }

  function handleTrackDragEnd() {
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  }

  function handlePlay(track: TrackItem) {
    if (autoQueueAfterPlay) {
      const orderedPlayContext = displayedTracks
        .filter((t) => t.status === "done")
        .map((t) => ({
          id: t.id,
          title: t.title,
          provider: t.provider,
          providerModel: t.providerModel,
          prompt: t.prompt,
          status: t.status,
          audioUrl: t.audioUrl,
          audioUrlHd: t.audioUrlHd,
          format: t.format,
          formatHd: t.formatHd,
          s3Key: null,
          s3KeyHd: t.s3KeyHd,
          duration: t.duration,
          lyrics: t.lyrics,
          createdAt: t.createdAt,
          error: t.error,
          coverUrl: t.coverUrl,
          s3KeyCover: t.s3KeyCover,
        }));

      setPlayContext(orderedPlayContext);

      if (autoPlayNext) {
        const index = orderedPlayContext.findIndex((t) => t.id === track.id);
        if (index >= 0) {
          const nextQueue = orderedPlayContext
            .slice(index + 1)
          .filter((t) => t.status === "done")
          ;
          setQueue(nextQueue);
        }
      }
    }

    playTrackFromGesture({
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
      createdAt: track.createdAt,
      error: track.error,
      coverUrl: track.coverUrl,
      s3KeyCover: track.s3KeyCover,
    });
  }

  return (
    <>
      {confirmMassDelete && (
        <ConfirmDialog
          message={`Delete ${selectedIds.size} track${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`}
          onConfirm={executeMassDelete}
          onCancel={() => setConfirmMassDelete(false)}
        />
      )}
      <div className="space-y-1">
      {/* Selection controls */}
      <div className="flex items-center gap-3 px-3 py-1.5">
        <button
          onClick={toggleSelectAll}
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
          title={allSelected ? "Deselect all" : "Select all"}
        >
          {allSelected ? (
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : selectedIds.size > 0 ? (
            <div className="w-4 h-4 rounded-full bg-blue-500/50 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 hover:border-white/40 transition-colors" />
          )}
        </button>
        <span className="text-xs text-white/30">{visibleSelectedCount > 0 ? `${visibleSelectedCount} of ${displayedTracks.length}` : `${displayedTracks.length} tracks`}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tracks"
              className="h-7 w-44 rounded-md border border-white/10 bg-white/5 pl-2.5 pr-7 text-xs text-white/80 placeholder:text-white/35 outline-none transition-colors focus:border-white/25"
              aria-label="Search tracks"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 transition-colors hover:text-white/75"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <label htmlFor="track-sort" className="text-[11px] text-white/35">Sort</label>
          <select
            id="track-sort"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/75 outline-none hover:border-white/20"
            aria-label="Sort tracks"
          >
            <option value="manual" className="bg-[#161621]">Play order</option>
            <option value="newest" className="bg-[#161621]">New to old</option>
            <option value="oldest" className="bg-[#161621]">Old to new</option>
            <option value="title-asc" className="bg-[#161621]">A-Z</option>
            <option value="title-desc" className="bg-[#161621]">Z-A</option>
          </select>
        </div>
      </div>
      {visibleSelectedCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-1">
          <span className="text-sm text-blue-300">{visibleSelectedCount} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleMassDelete}
            disabled={deleting}
            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
            title="Delete selected"
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
      )}
      {sortOrder === "manual" && (
        <div className="px-3 pb-1 text-[11px] text-white/35">
          Drag tracks to change play order.
        </div>
      )}
      {isGenerating && <GeneratingRow />}
      {displayedTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-12 h-12 text-white/10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-white/30 text-sm">
            {tracks.length > 0 && searchQuery.trim().length > 0 ? "No tracks match your search" : "No tracks yet"}
          </p>
        </div>
      ) : (
        displayedTracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            allTracks={tracks}
            onPlay={handlePlay}
            onSelect={onSelect}
            onDelete={onDelete}
            onReusePrompt={onReusePrompt}
            onAddToQueue={onAddToQueue}
            onAddToPlaylist={onAddToPlaylist}
            onMoveToWorkspace={onMoveToWorkspace}
            onMoveTracksToWorkspace={handleMoveToWorkspace}
            playlists={playlists}
            isSelected={selectedIds.has(track.id)}
            onToggleSelect={toggleSelection}
            onTitleUpdate={onTitleUpdate}
            draggable={canDragReorder}
            isDragActive={draggedTrackId === track.id}
            showDropBefore={dragOverTrackId === track.id && dragOverPosition === "before"}
            showDropAfter={dragOverTrackId === track.id && dragOverPosition === "after"}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              handleTrackDragStart(track.id);
            }}
            onDragOver={(event) => handleTrackDragOver(event, track.id)}
            onDrop={() => handleTrackDrop(track.id)}
            onDragEnd={handleTrackDragEnd}
          />
        ))
      )}
    </div>
    </>
  );
}

function GeneratingRow() {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-600/5 border border-primary-600/20 animate-[pulse_3s_ease-in-out_infinite]">
      {/* Empty selection dot — generating tracks can't be selected */}
      <div className="w-5 h-5 shrink-0" />

      {/* Waveform in play button area */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-600/20 text-primary-400">
        <WaveformBars count={5} className="h-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">Composing your track</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 animate-[pulse_2s_ease-in-out_infinite]">
            Creating
          </span>
        </div>
        {/* Full-width waveform in description row */}
        <div className="mt-1.5 text-primary-500/40 w-full">
          <WaveformBars count={32} className="h-2.5 w-full" />
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-white/20 mr-1">now</span>
      </div>
    </div>
  );
}

function TrackCard({
  track,
  allTracks,
  onPlay,
  onSelect,
  onDelete,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  onMoveToWorkspace,
  onMoveTracksToWorkspace,
  playlists,
  isSelected,
  onToggleSelect,
  onTitleUpdate,
  draggable,
  isDragActive,
  showDropBefore,
  showDropAfter,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  track: TrackItem;
  allTracks: TrackItem[];
  onPlay: (track: TrackItem) => void;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
  onReusePrompt?: (track: TrackItem) => void;
  onAddToQueue?: (track: TrackItem) => void;
  onAddToPlaylist?: (
    trackId: string,
    playlistId: string,
    options?: { allowDuplicate?: boolean }
  ) => void;
  onMoveToWorkspace?: (trackId: string, workspaceId: string) => void;
  onMoveTracksToWorkspace?: (trackId: string, workspaceId: string) => void;
  playlists?: PlaylistOption[];
  isSelected?: boolean;
  onToggleSelect?: (trackId: string) => void;
  onTitleUpdate?: (trackId: string, newTitle: string) => void;
  draggable?: boolean;
  isDragActive?: boolean;
  showDropBefore?: boolean;
  showDropAfter?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const isCurrentlyPlaying = currentTrack?.id === track.id;
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMoveToWorkspaceDialog, setShowMoveToWorkspaceDialog] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(track.title || "");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [currentRating, setCurrentRating] = useState<string | null>(track.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showCreatePlaylistDialog, setShowCreatePlaylistDialog] = useState(false);
  const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
  const [showDuplicatePlaylistDialog, setShowDuplicatePlaylistDialog] = useState(false);
  const [pendingPlaylistAdd, setPendingPlaylistAdd] = useState<{ id: string; name: string } | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const playlistInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceInputRef = useRef<HTMLInputElement | null>(null);
  const createPlaylist = usePlaylistStore((state) => state.createPlaylist);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const allPlaylists = usePlaylistStore((state) => state.playlists);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const moveTrackToWorkspace = useWorkspaceStore((state) => state.moveTrackToWorkspace);
  const tracksById = useMemo(() => {
    return new Map(allTracks.map((item) => [item.id, item]));
  }, [allTracks]);
  const workspaceCoverById = useMemo(() => {
    return new Map(
      workspaces.map((workspace) => {
        const workspaceTracks = workspace.trackIds
          .map((trackId) => tracksById.get(trackId))
          .filter((item): item is TrackItem => !!item);
        return [workspace.id, getWorkspaceCoverCollage(workspace.id, workspaceTracks)];
      })
    );
  }, [tracksById, workspaces]);
  const assignedWorkspaceName = useMemo(() => {
    const assignedWorkspace = workspaces.find((workspace) => workspace.trackIds.includes(track.id));
    return assignedWorkspace?.name || null;
  }, [track.id, workspaces]);

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
    if (showCreateWorkspaceDialog && workspaceInputRef.current) {
      workspaceInputRef.current.focus();
    }
  }, [showCreateWorkspaceDialog]);

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

  async function executeDelete() {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete?.(track.id);
      }
    } catch {
      // silently fail
    }
    setDeleting(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(true);
  }

  async function saveTitle() {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle || trimmedTitle === track.title || isSavingTitle) return;

    setIsSavingTitle(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (res.ok) {
        onTitleUpdate?.(track.id, trimmedTitle);
        setIsEditingTitle(false);
      }
    } catch {
      // silently fail
    } finally {
      setIsSavingTitle(false);
    }
  }

  function cancelTitle() {
    setIsEditingTitle(false);
    setEditTitle(track.title || "");
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitle();
    }
  }

  function handleTitleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitle(track.title || track.prompt.substring(0, 50));
  }

  function handleDownload(url: string, hd = false) {
    setDownloading(true);
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd ? (track.formatHd ?? track.format ?? "mp3") : (track.format ?? "mp3");
    a.download = `${track.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
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

  function handleCreateWorkspace() {
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;

    const workspaceId = createWorkspace(trimmed);
    if (workspaceId) {
      if (onMoveTracksToWorkspace) {
        onMoveTracksToWorkspace(track.id, workspaceId);
      } else {
        moveTrackToWorkspace(workspaceId, track.id);
        onMoveToWorkspace?.(track.id, workspaceId);
      }
    }

    setNewWorkspaceName("");
    setShowCreateWorkspaceDialog(false);
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
      setShowCreateWorkspaceDialog(false);
      setNewWorkspaceName("");
    }
  }

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
  const title = track.title || track.prompt.substring(0, 50);
  const styleDesc = track.prompt.length > 80 ? track.prompt.substring(0, 80) + "..." : track.prompt;
  const mp3Label = (track.format ?? "mp3").toUpperCase();
  const hdLabel = track.formatHd === "wav" ? "WAV" : "HD";

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message="Delete this track? This cannot be undone."
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
      {showCreateWorkspaceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateWorkspaceDialog(false)} />
          <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-96 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-medium text-white mb-1">Create New Workspace</h3>
                <p className="text-sm text-white/60">Give your folder a name</p>
              </div>
            </div>
            <input
              ref={workspaceInputRef}
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={handleWorkspaceKeyDown}
              placeholder="Workspace name"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-primary-500/50"
              maxLength={100}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateWorkspaceDialog(false);
                  setNewWorkspaceName("");
                }}
                className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={!newWorkspaceName.trim()}
                className="px-4 py-1.5 rounded-lg text-sm bg-primary-500/80 hover:bg-primary-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create & Move
              </button>
            </div>
          </div>
        </div>
      )}
      {showMoveToWorkspaceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMoveToWorkspaceDialog(false)} />
          <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-[min(92vw,860px)] max-h-[84vh] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-white">Move to Workspace</h3>
              <button
                onClick={() => setShowMoveToWorkspaceDialog(false)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => {
                setShowMoveToWorkspaceDialog(false);
                setShowCreateWorkspaceDialog(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-3 rounded-lg border border-dashed border-white/15 text-sm text-primary-300 hover:bg-primary-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Workspace
            </button>
            <div className="my-1 h-px bg-white/10" />
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {workspaces.length > 0 ? (
                workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => {
                      if (onMoveTracksToWorkspace) {
                        onMoveTracksToWorkspace(track.id, workspace.id);
                      } else {
                        moveTrackToWorkspace(workspace.id, track.id);
                        onMoveToWorkspace?.(track.id, workspace.id);
                      }
                      setShowMoveToWorkspaceDialog(false);
                      setMenuOpen(false);
                    }}
                    className="group relative h-36 w-full overflow-hidden rounded-2xl border border-white/10 text-left transition-transform hover:-translate-y-0.5"
                    style={{ backgroundImage: getWorkspaceGradient(workspace.id, workspace.folderGradient) }}
                  >
                    <div className="absolute inset-0 bg-black/15" />

                    {(workspaceCoverById.get(workspace.id) || []).length > 0 ? (
                      <div className="absolute inset-2 grid grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                        {(workspaceCoverById.get(workspace.id) || []).map((cover, index) => (
                          <img
                            key={`${workspace.id}-${index}`}
                            src={cover}
                            alt={workspace.name}
                            className="h-full w-full object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                          <svg className="w-8 h-8 text-white/85" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                          </svg>
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-sm">
                        <span className="flex-1 truncate text-xs font-medium text-white">{workspace.name}</span>
                        <span className="text-[11px] text-white/70">{workspace.trackIds.length}</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-xs text-white/40 text-center italic sm:col-span-2">No workspaces yet. Create one above.</p>
              )}
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
      <div
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
          isCurrentlyPlaying
            ? "bg-primary-500/20 border border-primary-500/25 border-l-4 border-l-primary-400 shadow-[0_0_0_1px_rgba(99,102,241,0.2)] pl-2"
            : track.status === "generating" || track.status === "pending"
              ? "bg-primary-600/5 border border-primary-600/20"
              : "hover:bg-white/5"
              } ${isCurrentlyPlaying ? `now-playing ${isPlaying ? "is-playing" : "is-paused"}` : ""} ${isDragActive ? "opacity-50" : ""} ${showDropBefore ? "ring-2 ring-inset ring-primary-400" : ""} ${showDropAfter ? "ring-2 ring-inset ring-primary-300/60" : ""}`}
        data-now-playing={isCurrentlyPlaying ? "true" : undefined}
        data-playing={isCurrentlyPlaying ? (isPlaying ? "true" : "false") : undefined}
        onClick={() => onSelect(track)}
              draggable={draggable}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
      >
      {/* Selection dot */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.(track.id);
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
          if (isCurrentlyPlaying) {
            setIsPlaying(!isPlaying);
          } else {
            onPlay(track);
          }
        }}
        className={`relative w-10 h-10 rounded-lg shrink-0 overflow-hidden transition-colors group/play ${isCurrentlyPlaying ? "ring-2 ring-primary-500/40" : ""}`}
        data-now-playing={isCurrentlyPlaying ? "true" : undefined}
        aria-label={isCurrentlyPlaying && isPlaying ? "Pause" : "Play"}
      >
        {(track.status === "generating" || track.status === "pending") ? (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400/30 border-t-primary-300" />
          </div>
        ) : track.coverUrl ? (
          <>
            <img
              src={track.coverUrl}
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
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                disabled={isSavingTitle}
                className="flex-1 text-sm font-medium bg-white/10 border border-primary-500/40 rounded px-2 py-0.5 focus:outline-none focus:border-primary-500 min-w-0"
                maxLength={200}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  saveTitle();
                }}
                disabled={isSavingTitle}
                className="shrink-0 p-0.5 rounded text-green-400 hover:bg-green-400/20 transition-colors disabled:opacity-40"
                title="Save title"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelTitle();
                }}
                className="shrink-0 p-0.5 rounded text-red-400 hover:bg-red-400/20 transition-colors"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <h3
              className={`text-sm font-medium truncate cursor-text ${isCurrentlyPlaying ? "text-primary-200" : ""}`}
              onDoubleClick={handleTitleDoubleClick}
              title="Double-click to edit"
            >
              {title}
            </h3>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.color} ${statusAnimationClass}`}>
            {status.label}
          </span>
          {assignedWorkspaceName && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/65 truncate max-w-[140px]" title={assignedWorkspaceName}>
              {assignedWorkspaceName}
            </span>
          )}
        </div>
        {(track.status === "generating" || track.status === "pending") ? (
          <div className="mt-1.5 text-primary-500/40 w-full">
            <WaveformBars count={32} className="h-2 w-full" />
          </div>
        ) : (
          <p className="text-xs text-white/30 truncate mt-0.5">{styleDesc}</p>
        )}
        {track.error && (
          <p className="text-xs text-red-400 mt-0.5">{track.error}</p>
        )}
      </div>

      {/* Time + actions */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="mr-1 text-right leading-tight">
          <p className="text-[11px] text-white/30 whitespace-nowrap">{createdAt.date}</p>
          <p className="text-[10px] text-white/20 whitespace-nowrap">{createdAt.time}</p>
          {track.duration && track.status === "done" && (
            <p className="text-[10px] text-white/20 whitespace-nowrap mt-0.5">{formatDuration(track.duration)}</p>
          )}
        </div>
        {track.status === "done" && (
          <>
            {/* Rating buttons */}
            <button
              onClick={(e) => handleRating(e, "up")}
              disabled={ratingLoading}
              className={`p-1 rounded-lg transition-all duration-200 ${
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>
            <button
              onClick={(e) => handleRating(e, "down")}
              disabled={ratingLoading}
              className={`p-1 rounded-lg transition-all duration-200 ${
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
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
              className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
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
                className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setShowMoveToWorkspaceDialog(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                >
                  Move To Workspace
                </button>
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
}

function formatTrackDateTime(date: Date): { date: string; time: string } {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  let dateStr;
  if (isToday) {
    dateStr = "Today";
  } else if (isYesterday) {
    dateStr = "Yesterday";
  } else {
    dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { date: dateStr, time: timeStr };
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
