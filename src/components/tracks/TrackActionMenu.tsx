"use client";

import { useEffect, useRef, useState } from "react";
import { usePlaylistStore, useReleaseStore } from "@/lib/store";
import type { PlaylistOption, TrackItem } from "./types";

interface TrackActionMenuProps {
  track: TrackItem;
  playlists?: PlaylistOption[];
  onReusePrompt?: (track: TrackItem) => void;
  onRegenerateCover: () => void;
  isRegeneratingCover: boolean;
  onRegenerateTitle?: () => void;
  isRegeneratingTitle?: boolean;
  onMoveToWorkspaceClick: () => void;
  onAddToQueue?: (track: TrackItem) => void;
  onCreatePlaylistClick: () => void;
  onAddToPlaylistClick: (playlistId: string, playlistName: string, isDuplicate: boolean) => void;
  onRemoveFromPlaylistClick: (playlistId: string, playlistName: string) => void;
  onOpenPlaylistPicker: () => void;
  onOpenReleasePicker?: () => void;
  onRemoveFromReleaseClick?: (releaseId: string, releaseTitle: string) => void;
  onEditDetails?: () => void;
  onArchiveClick?: () => void;
  archiveDisabled?: boolean;
  archiveDisabledReason?: string;
  onLinkToArchiveClick?: () => void;
  onAnalyzeCompositionClick?: () => void;
  analyzingComposition?: boolean;
  onAdvancedDnaClick?: () => void;
  advancedDnaRunning?: boolean;
  onRetryWavClick?: () => void;
  retryingWav?: boolean;
  retryWavResult?: "success" | "error" | null;
  /** Stem / Mastering / Section-edit — only shown when canExtractStems is true */
  canExtractStems?: boolean;
  onStemsClick?: () => void;
  onMasteringClick?: () => void;
  onEditSectionClick?: () => void;
  isPublished?: boolean;
  onTogglePublish?: () => void;
  togglingPublish?: boolean;
  onGenerateTclClick?: () => void;
  generatingTcl?: boolean;
  /** Listeners get a stripped-down menu: only queue/playlist/artist actions. */
  isListener?: boolean;
  onGoToArtist?: () => void;
}

export default function TrackActionMenu({
  track,
  onReusePrompt,
  onRegenerateCover,
  isRegeneratingCover,
  onRegenerateTitle,
  isRegeneratingTitle,
  onMoveToWorkspaceClick,
  onAddToQueue,
  onRemoveFromPlaylistClick,
  onOpenPlaylistPicker,
  onOpenReleasePicker,
  onRemoveFromReleaseClick,
  onEditDetails,
  onArchiveClick,
  archiveDisabled,
  archiveDisabledReason,
  onLinkToArchiveClick,
  onAnalyzeCompositionClick,
  analyzingComposition,
  onAdvancedDnaClick,
  advancedDnaRunning,
  onRetryWavClick,
  retryingWav,
  retryWavResult,
  canExtractStems,
  onStemsClick,
  onMasteringClick,
  onEditSectionClick,
  isPublished,
  onTogglePublish,
  togglingPublish,
  onGenerateTclClick,
  generatingTcl,
  isListener,
  onGoToArtist,
}: TrackActionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const allPlaylists = usePlaylistStore((state) => state.playlists);
  // System playlists (e.g. Master Tracks) are auto-managed — tracks can't be
  // manually removed from them, so they never show up in this list.
  const playlistsContainingTrack = allPlaylists.filter((playlist) => !playlist.isSystem && playlist.trackIds.includes(track.id));
  const allReleases = useReleaseStore((state) => state.releases);
  const releasesContainingTrack = allReleases.filter((release) => release.tracks.some((t) => t.trackId === track.id));

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
          {isListener ? (
            <>
              {onGoToArtist && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onGoToArtist();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                >
                  Go to Artist
                </button>
              )}
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onOpenPlaylistPicker();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 flex items-center justify-between gap-2"
              >
                <span>Add to playlist</span>
                <span className="text-white/30">›</span>
              </button>
            </>
          ) : (
          <>
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
          {onTogglePublish && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onTogglePublish();
              }}
              disabled={togglingPublish}
              className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {togglingPublish
                ? isPublished
                  ? "Unpublishing..."
                  : "Publishing..."
                : isPublished
                  ? "Unpublish"
                  : "Publish"}
            </button>
          )}
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
          {onRegenerateTitle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerateTitle();
                setMenuOpen(false);
              }}
              disabled={isRegeneratingTitle}
              className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegeneratingTitle ? "Regenerating title..." : "Regenerate Title"}
            </button>
          )}
          {onLinkToArchiveClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          onLinkToArchiveClick();
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                      >
                        Link to Master Tracks
                      </button>
                    )}
                    {(onAnalyzeCompositionClick || onAdvancedDnaClick) && (
                      <>
                        <div className="my-1 h-px bg-white/10" />
                        <p className="px-2.5 pb-1 text-[11px] uppercase tracking-wide text-white/35">Track DNA</p>
                        {onAnalyzeCompositionClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAnalyzeCompositionClick();
                              setMenuOpen(false);
                            }}
                            disabled={analyzingComposition}
                            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {analyzingComposition ? "Analyzing composition..." : "Analyze Composition"}
                          </button>
                        )}
                        {onAdvancedDnaClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvancedDnaClick();
                              setMenuOpen(false);
                            }}
                            disabled={advancedDnaRunning}
                            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {advancedDnaRunning ? "Running advanced analysis..." : "Advanced Track DNA"}
                          </button>
                        )}
                      </>
                    )}
                    {onGenerateTclClick && (
                      <>
                        <div className="my-1 h-px bg-white/10" />
                        <p className="px-2.5 pb-1 text-[11px] uppercase tracking-wide text-white/35">Lyrics</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onGenerateTclClick();
                            setMenuOpen(false);
                          }}
                          disabled={generatingTcl}
                          className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generatingTcl ? "Generating Time-Coded Lyrics..." : "Generate Time-Coded Lyrics"}
                        </button>
                      </>
                    )}
                    {canExtractStems && (onStemsClick || onMasteringClick || onEditSectionClick) && (
                      <>
                        <div className="my-1 h-px bg-white/10" />
                        <p className="px-2.5 pb-1 text-[11px] uppercase tracking-wide text-white/35">Production</p>
                        {onStemsClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStemsClick();
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                          >
                            Stems
                          </button>
                        )}
                        {onMasteringClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMasteringClick();
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                          >
                            Mastering
                          </button>
                        )}
                        {onEditSectionClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSectionClick();
                              setMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                          >
                            Edit
                          </button>
                        )}
                      </>
                    )}
                        {onRetryWavClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Deliberately doesn't close the menu — the request is async and the
                // loading/result text below would never be seen otherwise.
                onRetryWavClick();
              }}
              disabled={retryingWav}
              className={`w-full text-left px-2.5 py-1.5 rounded text-sm hover:bg-white/5 disabled:cursor-not-allowed ${
                retryWavResult === "error" ? "text-red-300" : retryWavResult === "success" ? "text-emerald-300" : "text-white/80"
              } disabled:opacity-50`}
            >
              {retryingWav
                ? "Converting to WAV..."
                : retryWavResult === "success"
                  ? "WAV conversie aangevraagd ✓"
                  : retryWavResult === "error"
                    ? "Mislukt — probeer opnieuw"
                    : "Convert to WAV"}
            </button>
          )}
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              onOpenPlaylistPicker();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 flex items-center justify-between gap-2"
          >
            <span>Add to playlist</span>
            <span className="text-white/30">›</span>
          </button>

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

          {onOpenReleasePicker && (
            <>
              <div className="my-1 h-px bg-white/10" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onOpenReleasePicker();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 flex items-center justify-between gap-2"
              >
                <span>Add to release</span>
                <span className="text-white/30">›</span>
              </button>

              {onRemoveFromReleaseClick && releasesContainingTrack.length > 0 && (
                <>
                  <div className="my-1 h-px bg-white/10" />
                  <p className="px-2.5 pb-1 text-[11px] uppercase tracking-wide text-white/35">Remove from release</p>
                  {releasesContainingTrack.map((release) => (
                    <button
                      key={`remove-release-${release.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onRemoveFromReleaseClick(release.id, release.title);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-sm text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
                    >
                      {release.title}
                    </button>
                  ))}
                </>
              )}
            </>
          )}
           </>
           )}
           {onArchiveClick && (
            <>
              <div className="my-1 h-px bg-white/10" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (archiveDisabled) return;
                  onArchiveClick();
                  setMenuOpen(false);
                }}
                disabled={archiveDisabled}
                title={archiveDisabled ? archiveDisabledReason : undefined}
                className="w-full text-left px-2.5 py-1.5 rounded text-sm text-amber-300/85 hover:bg-amber-500/10 hover:text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Archiveren
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
