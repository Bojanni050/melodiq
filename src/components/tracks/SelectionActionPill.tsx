"use client";

import { memo } from "react";
import type { TrackItem } from "@/components/tracks/types";
import { useSelectionStore } from "@/lib/store";

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
        className="ml-auto text-sm text-white/40 hover:text-white/70 transition-colors"
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

export default SelectionActionPill;
