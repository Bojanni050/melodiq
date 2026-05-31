"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/tracks/ConfirmDialog";
import TrackCard from "@/components/tracks/TrackCard";
import type { PlaylistOption, TrackItem } from "@/components/tracks/types";
import { usePlayerStore, useWorkspaceStore, useSelectionStore } from "@/lib/store";

type SortOrder = "newest" | "oldest" | "title-asc" | "title-desc";

// Isolated header component with localized high-performance selection selectors
const TrackListHeader = memo(function TrackListHeader({
  displayedTracks,
  sortOrder,
  setSortOrder,
  searchQuery,
  setSearchQuery,
  enableDragReorder,
}: {
  displayedTracks: TrackItem[];
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  enableDragReorder: boolean;
}) {
  const toggleSelectAll = useSelectionStore((state) => state.toggleSelectAll);

  const allSelected = useSelectionStore((state) => {
    if (displayedTracks.length === 0) return false;
    return displayedTracks.every((t) => state.selectedIds.has(t.id));
  });

  const hasSelection = useSelectionStore((state) => {
    return state.selectedIds.size > 0;
  });

  const visibleSelectedCount = useSelectionStore((state) => {
    let count = 0;
    for (let i = 0; i < displayedTracks.length; i++) {
      if (state.selectedIds.has(displayedTracks[i].id)) {
        count++;
      }
    }
    return count;
  });

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 px-3 py-1.5 bg-[#0a0a0f] border-b border-white/6 mb-1">
      <button
        onClick={() => toggleSelectAll(displayedTracks.map((t) => t.id))}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
        title={allSelected ? "Deselect all" : "Select all"}
      >
        {allSelected ? (
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : hasSelection ? (
          <div className="w-4 h-4 rounded-full bg-blue-500/50 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-white/20 hover:border-white/40 transition-colors" />
        )}
      </button>
      <span className="text-xs text-white/30">
        {hasSelection ? `${visibleSelectedCount} of ${displayedTracks.length}` : `${displayedTracks.length} tracks`}
      </span>
      {enableDragReorder && (
        <span className="text-[11px] text-white/25">Drag to reorder play order</span>
      )}
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
          <option value="newest" className="bg-[#161621]">New to old</option>
          <option value="oldest" className="bg-[#161621]">Old to new</option>
          <option value="title-asc" className="bg-[#161621]">A to Z</option>
          <option value="title-desc" className="bg-[#161621]">Z to A</option>
        </select>
      </div>
    </div>
  );
});

// Isolated selection pill component that reactively monitors selection count
const SelectionActionPill = memo(function SelectionActionPill({
  displayedTracks,
  deleting,
  onMassDelete,
}: {
  displayedTracks: TrackItem[];
  deleting: boolean;
  onMassDelete: () => void;
}) {
  const clearSelection = useSelectionStore((state) => state.clearSelection);

  const visibleSelectedCount = useSelectionStore((state) => {
    let count = 0;
    for (let i = 0; i < displayedTracks.length; i++) {
      if (state.selectedIds.has(displayedTracks[i].id)) {
        count++;
      }
    }
    return count;
  });

  if (visibleSelectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-1">
      <span className="text-sm text-blue-300">{visibleSelectedCount} selected</span>
      <button
        onClick={clearSelection}
        className="ml-auto text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        Clear
      </button>
      <button
        onClick={onMassDelete}
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
  );
});

export default memo(function TrackList({
  tracks,
  isGenerating,
  autoQueueAfterPlay,
  enableDragReorder = true,
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
  enableDragReorder?: boolean;
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
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const moveTrackToWorkspace = useWorkspaceStore((state) => state.moveTrackToWorkspace);
  const workspaces = useWorkspaceStore((state) => state.workspaces);

  const workspaceById = useMemo(
    () => new Map(workspaces.map((w) => [w.id, w])),
    [workspaces]
  );
  const orderedWorkspaceOptions = useMemo(() => {
    const roots = workspaces.filter((w) => !w.parentWorkspaceId);
    const childrenByParent = new Map<string, typeof workspaces>();
    workspaces
      .filter((w) => Boolean(w.parentWorkspaceId))
      .forEach((w) => {
        const list = childrenByParent.get(w.parentWorkspaceId!) ?? [];
        childrenByParent.set(w.parentWorkspaceId!, [...list, w]);
      });
    return roots.flatMap((root) => {
      const children = childrenByParent.get(root.id) ?? [];
      return [{ workspace: root, depth: 0 }, ...children.map((child) => ({ workspace: child, depth: 1 }))];
    });
  }, [workspaces]);
  const workspaceDisplayNameById = useMemo(() => {
    const map = new Map<string, string>();
    workspaces.forEach((w) => {
      if (!w.parentWorkspaceId) { map.set(w.id, w.name); return; }
      const parentName = workspaceById.get(w.parentWorkspaceId)?.name;
      map.set(w.id, parentName ? `${parentName} / ${w.name}` : w.name);
    });
    return map;
  }, [workspaces, workspaceById]);

  // Connect to Zustand Selection Store stable actions
  const setSelectedIds = useSelectionStore((state) => state.setSelectedIds);

  const hasScrolledToRestoredTrack = useRef(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualOrderIds, setManualOrderIds] = useState<string[] | null>(null);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmMassDelete, setConfirmMassDelete] = useState(false);

  // Sentinel and Intersection Observer for detecting when generating tracks scroll out of view
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isTopInView, setIsTopInView] = useState(true);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTopInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => {
      observer.unobserve(sentinel);
    };
  }, []);

  const hasGeneratingTracks = useMemo(() => {
    return tracks.some((t) => t.status === "generating" || t.status === "pending");
  }, [tracks]);

  const scrollToTop = useCallback(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const sortedTracks = useMemo(() => {
    const withTime = tracks.map((t) => ({ t, time: Number(new Date(t.createdAt)) }));

    withTime.sort(({ t: left, time: leftTime }, { t: right, time: rightTime }) => {
      if (sortOrder === "title-asc" || sortOrder === "title-desc") {
        const leftTitle = (left.title || left.prompt || "").trim();
        const rightTitle = (right.title || right.prompt || "").trim();
        const titleComparison = leftTitle.localeCompare(rightTitle, undefined, { sensitivity: "base" });
        if (titleComparison !== 0) return sortOrder === "title-asc" ? titleComparison : -titleComparison;
      }

      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
      if (sortOrder === "oldest") return leftTime - rightTime;
      return rightTime - leftTime;
    });

    return withTime.map(({ t }) => t);
  }, [sortOrder, tracks]);

  const orderedTracks = useMemo(() => {
    if (!enableDragReorder || !manualOrderIds) {
      return sortedTracks;
    }

    const trackMap = new Map(sortedTracks.map((track) => [track.id, track]));
    return manualOrderIds
      .map((id) => trackMap.get(id))
      .filter((track): track is TrackItem => Boolean(track));
  }, [enableDragReorder, manualOrderIds, sortedTracks]);

  useEffect(() => {
    if (!enableDragReorder) {
      setManualOrderIds(null);
      return;
    }

    const sortedIds = sortedTracks.map((track) => track.id);
    setManualOrderIds((current) => {
      if (!current) return sortedIds;

      const sortedIdSet = new Set(sortedIds);
      const retainedIds = current.filter((id) => sortedIdSet.has(id));
      const retainedIdSet = new Set(retainedIds);
      const newIds = sortedIds.filter((id) => !retainedIdSet.has(id));
      const next = [...retainedIds, ...newIds];

      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }

      return next;
    });
  }, [enableDragReorder, sortedTracks]);

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

  // Keep a ref of the displayed tracks so callbacks can read them without changing their dependency references
  const displayedTracksRef = useRef(displayedTracks);
  useEffect(() => {
    displayedTracksRef.current = displayedTracks;
  }, [displayedTracks]);

  // Pre-calculate and memoize workspace cover map in a stable manner
  const workspaceCoversKey = useMemo(() => {
    return tracks.map((t) => `${t.id}:${t.coverUrl ?? ""}`).join("|");
  }, [tracks]);

  const workspaceCoverById = useMemo(() => {
    const coverByTrackId = new Map(tracks.map((t) => [t.id, t.coverUrl ?? null]));
    const coverMap = new Map<string, string | null>();
    workspaces.forEach((workspace) => {
      const firstCover = workspace.trackIds.find((id) => coverByTrackId.get(id)) ?? null;
      coverMap.set(workspace.id, firstCover ? (coverByTrackId.get(firstCover) ?? null) : null);
    });
    return coverMap;
  }, [workspaceCoversKey, workspaces]);

  // Stable shift-click / selection callback
  const handleToggleSelection = useCallback((trackId: string, shiftKey: boolean) => {
    useSelectionStore.getState().toggleSelection(
      trackId,
      displayedTracksRef.current.map((t) => t.id),
      { mode: shiftKey ? "range" : "toggle" }
    );
  }, []);

  useEffect(() => {
    if (hasScrolledToRestoredTrack.current) return;
    if (!currentTrack) return;
    if (!tracks.some((t) => t.id === currentTrack.id)) return;

    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-track-id="${currentTrack.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        hasScrolledToRestoredTrack.current = true;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [currentTrack, tracks]);

  useEffect(() => {
    const availableIds = new Set(tracks.map((track) => track.id));
    const current = useSelectionStore.getState().selectedIds;
    const next = new Set(Array.from(current).filter((id) => availableIds.has(id)));
    if (next.size !== current.size) {
      setSelectedIds(next);
    }
  }, [tracks, setSelectedIds]);

  // Clean selection on component unmount
  useEffect(() => {
    return () => {
      useSelectionStore.getState().clearSelection();
    };
  }, []);

  const deleteTrackIds = useCallback(async (trackIds: string[]) => {
    if (trackIds.length === 0) return;
    setDeleting(true);
    try {
      for (const id of trackIds) {
        const res = await fetch(`/api/tracks/${id}`, { method: "DELETE" });
        if (res.ok) onDelete?.(id);
      }
      setSelectedIds(new Set());
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  }, [onDelete, setSelectedIds]);

  async function handleMassDelete() {
    const activeSelected = useSelectionStore.getState().selectedIds;
    if (activeSelected.size === 0) return;
    setConfirmMassDelete(true);
  }

  async function executeMassDelete() {
    setConfirmMassDelete(false);
    const activeSelected = useSelectionStore.getState().selectedIds;
    await deleteTrackIds(Array.from(activeSelected));
  }

  const handleMoveToWorkspace = useCallback((sourceTrackId: string, workspaceId: string) => {
    const activeSelection = useSelectionStore.getState().selectedIds;
    const moveIds = activeSelection.size > 0 && activeSelection.has(sourceTrackId)
      ? Array.from(activeSelection)
      : [sourceTrackId];

    moveIds.forEach((trackId) => {
      moveTrackToWorkspace(workspaceId, trackId);
    });

    // Call once for navigation / server-side workspace selection
    onMoveToWorkspace?.(sourceTrackId, workspaceId);

    if (moveIds.length > 1) {
      setSelectedIds(new Set());
    }
  }, [moveTrackToWorkspace, onMoveToWorkspace, setSelectedIds]);

  const handlePlay = useCallback((track: TrackItem) => {
    if (autoQueueAfterPlay) {
      const orderedPlayContext = displayedTracksRef.current
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
            .filter((t) => t.status === "done");
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
  }, [autoQueueAfterPlay, setPlayContext, autoPlayNext, setQueue, playTrackFromGesture]);

  function moveTrackInManualOrder(sourceId: string, targetId: string) {
    setManualOrderIds((current) => {
      const source = current ?? sortedTracks.map((track) => track.id);
      const fromIndex = source.indexOf(sourceId);
      const toIndex = source.indexOf(targetId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return current;
      }

      const next = [...source];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleTrackDragStart(event: React.DragEvent<HTMLDivElement>, trackId: string) {
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest("input") ||
      target.closest("textarea")
    ) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", trackId);
    setDraggedTrackId(trackId);
    setDragOverTrackId(trackId);
  }

  function handleTrackDragOver(event: React.DragEvent<HTMLDivElement>, trackId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverTrackId !== trackId) {
      setDragOverTrackId(trackId);
    }
  }

  function handleTrackDrop(event: React.DragEvent<HTMLDivElement>, trackId: string) {
    event.preventDefault();
    const sourceId = draggedTrackId ?? event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== trackId) {
      moveTrackInManualOrder(sourceId, trackId);
    }
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  }

  function handleTrackDragEnd() {
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  }

  const canDragReorder = enableDragReorder && searchQuery.trim().length === 0;

  return (
    <>
      {confirmMassDelete && (
        <ConfirmDialog
          message={`Delete ${useSelectionStore.getState().selectedIds.size} track${useSelectionStore.getState().selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`}
          onConfirm={executeMassDelete}
          onCancel={() => setConfirmMassDelete(false)}
        />
      )}
      <div className="space-y-1">
        <TrackListHeader
          displayedTracks={displayedTracks}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          enableDragReorder={enableDragReorder}
        />

        <div ref={sentinelRef} className="h-0 w-full" />

        {/* Floating "New tracks generating" notification */}
        {!isTopInView && hasGeneratingTracks && (
          <div className="sticky top-[42px] z-20 flex justify-center w-full pointer-events-none animate-[slideDown_0.2s_ease-out]">
            <button
              type="button"
              onClick={scrollToTop}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary-500 text-white text-xs font-semibold shadow-xl hover:bg-primary-600 transition-all hover:scale-105 active:scale-95 border border-primary-400/40"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>Nieuwe tracks in aanmaak • Klik om omhoog te scrollen</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        )}

        <SelectionActionPill
          displayedTracks={displayedTracks}
          deleting={deleting}
          onMassDelete={handleMassDelete}
        />

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
          displayedTracks.map((track) => {
            const isDragActive = canDragReorder && dragOverTrackId === track.id && draggedTrackId !== track.id;

            return (
              <div
                key={track.id}
                data-track-id={track.id}
                draggable={canDragReorder}
                onDragStart={(event) => handleTrackDragStart(event, track.id)}
                onDragOver={(event) => handleTrackDragOver(event, track.id)}
                onDrop={(event) => handleTrackDrop(event, track.id)}
                onDragEnd={handleTrackDragEnd}
                className={canDragReorder ? `rounded-xl transition-colors ${isDragActive ? "ring-1 ring-blue-400/60 bg-blue-500/5" : ""}` : undefined}
              >
                <TrackCard
                  track={track}
                  onPlay={handlePlay}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onDeleteTracks={deleteTrackIds}
                  onReusePrompt={onReusePrompt}
                  onAddToQueue={onAddToQueue}
                  onAddToPlaylist={onAddToPlaylist}
                  onMoveToWorkspace={handleMoveToWorkspace}
                  playlists={playlists}
                  onTitleUpdate={onTitleUpdate}
                  workspaceById={workspaceById}
                  orderedWorkspaceOptions={orderedWorkspaceOptions}
                  workspaceDisplayNameById={workspaceDisplayNameById}
                  workspaceCoverById={workspaceCoverById}
                  onToggleSelection={handleToggleSelection}
                />
              </div>
            );
          })
        )}
      </div>

      {!isTopInView && (
        <div className="sticky bottom-6 mr-2 z-40 flex justify-end pointer-events-none">
          <button
            type="button"
            onClick={scrollToTop}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[#11121a]/90 text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all hover:bg-white hover:text-black hover:scale-105 active:scale-95 hover:border-white hover:shadow-[0_12px_40px_rgba(255,255,255,0.15)]"
            title="Scroll to top"
            aria-label="Scroll to top"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
});
