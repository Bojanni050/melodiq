"use client";

import { useEffect, useRef, useState } from "react";

interface CreatePlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export default function CreatePlaylistDialog({
  isOpen,
  onClose,
  onCreate,
}: CreatePlaylistDialogProps) {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const playlistInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && playlistInputRef.current) {
      playlistInputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSubmit() {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewPlaylistName("");
  }

  function handlePlaylistKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      onClose();
      setNewPlaylistName("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          onClose();
          setNewPlaylistName("");
        }}
      />
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
              onClose();
              setNewPlaylistName("");
            }}
            className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!newPlaylistName.trim()}
            className="px-4 py-1.5 rounded-lg text-sm bg-primary-500/80 hover:bg-primary-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create & Add
          </button>
        </div>
      </div>
    </div>
  );
}
