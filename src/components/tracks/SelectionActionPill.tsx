"use client";

import { memo } from "react";
import type { TrackItem } from "@/components/tracks/types";
import { useSelectionStore } from "@/lib/store";

// Isolated selection pill component that reactively monitors selection count
const SelectionActionPill = memo(function SelectionActionPill({
  displayedTracks,
  deleting,
  onMassDelete,
  archiving,
  onMassArchive,
  hiding,
  onMassHide,
}: {
  displayedTracks: TrackItem[];
  deleting: boolean;
  onMassDelete: () => void;
  archiving?: boolean;
  onMassArchive?: () => void;
  hiding?: boolean;
  onMassHide?: () => void;
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
      {onMassHide && (
        <button
          onClick={onMassHide}
          disabled={hiding}
          className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors"
          title="Hide selected — keeps all audio files, only hides them from your lists"
        >
          {hiding ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
          )}
        </button>
      )}
      {onMassArchive && (
        <button
          onClick={onMassArchive}
          disabled={archiving}
          className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors"
          title="Archive selected"
        >
          {archiving ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          )}
        </button>
      )}
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
