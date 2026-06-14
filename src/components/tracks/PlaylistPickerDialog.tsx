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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#181822] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-xl leading-none font-medium text-white/90">Add to Playlist</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close add to playlist menu"
          >
            <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Playlist list */}
        <div className="max-h-[380px] overflow-y-auto px-3 pb-2">
          <div className="space-y-1">
            {allPlaylists.length === 0 ? (
              <p className="text-sm text-white/40 italic px-3 py-6 text-center">No playlists yet</p>
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
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10 group"
                  >
                    {/* Thumbnail */}
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white/8 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>

                    {/* Name + track count */}
                    <span className="min-w-0 flex-1 truncate leading-tight font-medium text-base">{playlist.name}</span>
                    <span className="shrink-0 text-xs text-white/60">{playlist.trackIds.length} tracks</span>

                    {/* Already-in / partial indicator */}
                    {fully && (
                      <svg className="shrink-0 w-4 h-4 text-primary-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {partial && (
                      <svg className="shrink-0 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Some tracks already in playlist">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    )}

                    {/* Checkbox */}
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isChecked
                          ? "bg-primary-500 border-primary-500"
                          : "border-white/20 group-hover:border-white/40"
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer: create input + actions */}
        <div className="border-t border-white/10 px-5 pb-4 pt-3 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreatePlaylist}
              className="h-12 flex-1 flex items-center gap-2.5 rounded-lg border border-white/70 px-3 text-sm font-medium text-white/45 hover:border-white hover:text-white transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create new playlist
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-lg bg-white/8 px-5 text-sm font-medium text-white/60 transition-colors hover:bg-white/14 hover:text-white/90"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="h-12 rounded-lg bg-primary-500/80 px-5 text-sm font-medium text-white transition-colors hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
