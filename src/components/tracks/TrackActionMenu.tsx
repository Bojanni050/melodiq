"use client";

import { useEffect, useRef, useState } from "react";
import { usePlaylistStore } from "@/lib/store";
import type { PlaylistOption, TrackItem } from "./types";

interface TrackActionMenuProps {
  track: TrackItem;
  playlists?: PlaylistOption[];
  onReusePrompt?: (track: TrackItem) => void;
  onRegenerateCover: () => void;
  isRegeneratingCover: boolean;
  onMoveToWorkspaceClick: () => void;
  onAddToQueue?: (track: TrackItem) => void;
  onCreatePlaylistClick: () => void;
  onAddToPlaylistClick: (playlistId: string, playlistName: string, isDuplicate: boolean) => void;
  onRemoveFromPlaylistClick: (playlistId: string, playlistName: string) => void;
  onEditDetails?: () => void;
}

export default function TrackActionMenu({
  track,
  playlists,
  onReusePrompt,
  onRegenerateCover,
  isRegeneratingCover,
  onMoveToWorkspaceClick,
  onAddToQueue,
  onCreatePlaylistClick,
  onAddToPlaylistClick,
  onRemoveFromPlaylistClick,
  onEditDetails,
}: TrackActionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const allPlaylists = usePlaylistStore((state) => state.playlists);
  const playlistsContainingTrack = allPlaylists.filter((playlist) => playlist.trackIds.includes(track.id));

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

  return (
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
              onEditDetails?.();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
          >
            Edit Track Details
          </button>
          <div className="my-1 h-px bg-white/10" />
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
              onRegenerateCover();
              setMenuOpen(false);
            }}
            disabled={isRegeneratingCover}
            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegeneratingCover ? "Regenerating cover..." : "Regenerate Cover Art"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveToWorkspaceClick();
              setMenuOpen(false);
            }}
            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 flex items-center justify-between gap-2"
          >
            <span>Move To Workspace</span>
            <span className="text-white/30">›</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToQueue?.(track);
              setMenuOpen(false);
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
              onCreatePlaylistClick();
              setMenuOpen(false);
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
                    onAddToPlaylistClick(playlist.id, playlist.name, isDuplicate);
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

          {playlistsContainingTrack.length > 0 && (
            <>
              <div className="my-1 h-px bg-white/10" />
              <p className="px-2.5 pb-1 text-[11px] uppercase tracking-wide text-white/35">Remove from playlist</p>
              {playlistsContainingTrack.map((playlist) => (
                <button
                  key={`remove-${playlist.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRemoveFromPlaylistClick(playlist.id, playlist.name);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
                >
                  {playlist.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
