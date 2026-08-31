"use client";

import { memo } from "react";
import type { TrackItem } from "@/components/tracks/types";
import { useSelectionStore } from "@/lib/store";
import type { SortOrder } from "./trackListOrder";

// Isolated header component with localized high-performance selection selectors
const TrackListHeader = memo(function TrackListHeader({
  displayedTracks,
  sortOrder,
  setSortOrder,
  searchQuery,
  setSearchQuery,
  searchLyrics,
  setSearchLyrics,
  enableDragReorder,
  hideSortOptions,
  showJumpToCurrent,
  onJumpToCurrent,
}: {
  displayedTracks: TrackItem[];
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchLyrics: boolean;
  setSearchLyrics: (value: boolean) => void;
  enableDragReorder: boolean;
  hideSortOptions?: boolean;
  showJumpToCurrent?: boolean;
  onJumpToCurrent?: () => void;
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
    <div className="sticky top-0 z-10 flex items-center gap-3 px-3 py-1.5 bg-white/[0.04] backdrop-blur-md border-b border-white/8 mb-1">
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
      {enableDragReorder && (
        <span className="text-[11px] text-white/25">Drag to reorder play order</span>
      )}
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search tracks"
            className="h-7 w-full rounded-[20px] border border-white/10 bg-white/5 pl-2.5 pr-7 text-sm text-white/80 placeholder:text-white/35 outline-none transition-colors focus:border-white/25"
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
        <button
          type="button"
          onClick={() => setSearchLyrics(!searchLyrics)}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            searchLyrics
              ? "border-primary-400/40 bg-primary-500/15 text-primary-300"
              : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
          }`}
          title={searchLyrics ? "Also searching lyrics — click to search titles only" : "Also search lyrics text"}
          aria-pressed={searchLyrics}
        >
          Lyrics
        </button>
        {!hideSortOptions && (<>
        <label htmlFor="track-sort" className="text-[11px] text-white/35">Sort</label>
        <select
          id="track-sort"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white/75 outline-none hover:border-white/20"
          aria-label="Sort tracks"
        >
          <option value="newest" className="bg-[#161621]">New to old</option>
          <option value="oldest" className="bg-[#161621]">Old to new</option>
          <option value="title-asc" className="bg-[#161621]">A to Z</option>
          <option value="title-desc" className="bg-[#161621]">Z to A</option>
        </select>
        </>)}
        <span className="shrink-0 text-xs text-white/30">
          {hasSelection ? `${visibleSelectedCount} of ${displayedTracks.length}` : `${displayedTracks.length} tracks`}
        </span>
        {showJumpToCurrent && onJumpToCurrent && (
          <button
            type="button"
            onClick={onJumpToCurrent}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium border border-white/12 hover:bg-white hover:text-black hover:border-white transition-all"
            title="Spring naar huidige track"
          >
            <span>Huidige track</span>
          </button>
        )}
      </div>
    </div>
  );
});

export default TrackListHeader;
