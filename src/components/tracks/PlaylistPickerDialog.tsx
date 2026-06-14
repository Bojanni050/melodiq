"use client";

import { useState } from "react";
import { usePlaylistStore } from "@/lib/store";
import { useSelectionStore } from "@/lib/store";
import type { TrackItem } from "./types";

interface PlaylistPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem;
  onAddToPlaylist: (playlistId: string, playlistName: string, isDuplicate: boolean) => void;
  onCreatePlaylistClick: () => void;
}

export default function PlaylistPickerDialog({
  isOpen,
  onClose,
  track,
  onAddToPlaylist,
  onCreatePlaylistClick,
}: PlaylistPickerDialogProps) {
  const allPlaylists = usePlaylistStore((state) => state.playlists);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const activeSelection = useSelectionStore.getState().selectedIds;
  const isMultiSelect = activeSelection.size > 1 && activeSelection.has(track.id);

  function alreadyInPlaylist(playlistId: string) {
    const playlist = allPlaylists.find((p) => p.id === playlistId);
    if (!playlist) return false;
    if (isMultiSelect) {
      return Array.from(activeSelection).every((id) => playlist.trackIds.includes(id));
    }
    return playlist.trackIds.includes(track.id);
  }

  function partiallyInPlaylist(playlistId: string) {
    if (!isMultiSelect) return false;
    const playlist = allPlaylists.find((p) => p.id === playlistId);
    if (!playlist) return false;
    return Array.from(activeSelection).some((id) => playlist.trackIds.includes(id));
  }

  function togglePlaylist(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    for (const id of selected) {
      const playlist = allPlaylists.find((p) => p.id === id);
      if (!playlist) continue;
      const isDuplicate = alreadyInPlaylist(id) || partiallyInPlaylist(id);
      onAddToPlaylist(id, playlist.name, isDuplicate);
    }
    setSelected(new Set());
    onClose();
  }

  function handleCreatePlaylist() {
    setSelected(new Set());
    onClose();
    onCreatePlaylistClick();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl w-[400px] max-w-[90vw] flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Add to playlist</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Create new */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={handleCreatePlaylist}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-primary-300 hover:bg-primary-500/10 transition-colors"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full border border-primary-400/50 text-primary-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            Create new playlist
          </button>
        </div>

        {/* Playlist list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-0.5">
          {allPlaylists.length === 0 ? (
            <p className="text-xs text-white/40 italic px-3 py-4 text-center">No playlists yet</p>
          ) : (
            allPlaylists.map((playlist) => {
              const fully = alreadyInPlaylist(playlist.id);
              const partial = !fully && partiallyInPlaylist(playlist.id);
              const isChecked = selected.has(playlist.id);

              return (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => togglePlaylist(playlist.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  {/* Checkbox */}
                  <span
                    className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-primary-500 border-primary-500"
                        : "border-white/20 group-hover:border-white/40"
                    }`}
                  >
                    {isChecked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>

                  {/* Name + track count */}
                  <span className="flex-1 text-left text-sm text-white/80 truncate">{playlist.name}</span>
                  <span className="text-xs text-white/30 flex-shrink-0">{playlist.trackIds.length}</span>

                  {/* Already-in indicator */}
                  {fully && (
                    <span className="flex-shrink-0 flex items-center gap-1 text-xs text-primary-400/80">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                  {partial && (
                    <span className="flex-shrink-0 flex items-center text-xs text-white/30" title="Some tracks already in playlist">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-white/60 hover:text-white/85 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="rounded-lg bg-primary-500/80 px-4 py-1.5 text-sm text-white hover:bg-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add{selected.size > 0 ? ` to ${selected.size} playlist${selected.size > 1 ? "s" : ""}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
