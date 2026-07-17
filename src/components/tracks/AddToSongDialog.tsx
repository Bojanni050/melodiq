"use client";

import { useEffect, useRef, useState } from "react";
import type { Workspace } from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";

interface AddToSongDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem;
  songOptions: Workspace[];
  workspaceDisplayNameById: Map<string, string>;
  workspaceCoverById: Map<string, string | null>;
  defaultWorkspaceId: string;
  onAddToSong: (songId: string) => void;
  onCreateSong: (name: string, workspaceId: string) => void;
}

export default function AddToSongDialog({
  isOpen,
  onClose,
  track,
  songOptions,
  workspaceDisplayNameById,
  workspaceCoverById,
  defaultWorkspaceId,
  onAddToSong,
  onCreateSong,
}: AddToSongDialogProps) {
  const [newSongName, setNewSongName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const suggestedName = (track.title || track.prompt || "").trim().replace(/\s*\(2\)\s*$/, "");
      if (suggestedName && !newSongName.trim()) {
        setNewSongName(suggestedName.slice(0, 100));
      }
    }
  }, [isOpen, track, newSongName]);

  if (!isOpen) return null;

  const songSwatches = [
    "bg-gradient-to-br from-orange-400 via-blue-500 to-indigo-700",
    "bg-gradient-to-br from-rose-300 via-red-500 to-purple-700",
    "bg-gradient-to-br from-emerald-300 via-lime-400 to-yellow-500",
    "bg-gradient-to-br from-sky-400 via-cyan-500 to-teal-700",
    "bg-gradient-to-br from-fuchsia-300 via-violet-500 to-blue-700",
  ];

  function handleCreate() {
    const trimmed = newSongName.trim();
    if (!trimmed) return;
    onCreateSong(trimmed, track.workspaceId || defaultWorkspaceId);
    setNewSongName("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#181822] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-xl leading-none font-medium text-white/90">Add to Song</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close add to song menu"
          >
            <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto px-3 pb-2">
          {songOptions.length === 0 ? (
            <p className="px-3 py-4 text-sm text-white/45">No songs yet — create one below.</p>
          ) : (
            <div className="space-y-1">
              {songOptions.map((song, index) => (
                <button
                  key={song.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToSong(song.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10"
                >
                  <div className={`h-11 w-11 shrink-0 overflow-hidden rounded-md ${songSwatches[index % songSwatches.length]}`}>
                    {workspaceCoverById.get(song.id) ? (
                      <img
                        src={workspaceCoverById.get(song.id) || ""}
                        alt={song.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-base font-medium leading-tight">
                    {workspaceDisplayNameById.get(song.id) ?? song.name}
                  </span>
                  <span className="shrink-0 text-xs text-white/60">{song.trackIds.length} versions</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-5 pb-4 pt-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={newSongName}
                onChange={(e) => setNewSongName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Song name"
                className="h-12 w-full rounded-lg border border-white/70 bg-transparent px-3 pr-16 text-sm font-medium text-white placeholder:text-white/45 focus:outline-none focus:border-white"
                maxLength={100}
                aria-label="Song name"
              />
              <span className="pointer-events-none absolute bottom-2 right-2 text-xs text-white/45">{newSongName.length}/100</span>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newSongName.trim()}
              className="h-12 rounded-lg bg-white/8 px-5 text-sm font-medium text-white/90 transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create Song
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
