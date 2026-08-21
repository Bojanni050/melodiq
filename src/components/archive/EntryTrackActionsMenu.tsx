"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReleaseStore } from "@/lib/store";
import type { ArchiveEntry } from "./types";

// Compact ⋯ menu for the track linked to a Master Tracks entry — kept
// separate from the full library TrackActionMenu since this context only
// needs a handful of track-scoped actions, not playlist/workspace plumbing.
export default function EntryTrackActionsMenu({
  entry,
  onEdit,
  onPlay,
  onDetails,
  onAnalyze,
  analyzing,
  onUnlink,
  isPublished,
  onTogglePublish,
  togglingPublish,
  onOpenReleasePicker,
  onRemoveFromReleaseClick,
}: {
  entry: ArchiveEntry;
  onEdit: () => void;
  onPlay: () => void;
  onDetails: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onUnlink: () => void;
  isPublished?: boolean;
  onTogglePublish?: () => void;
  togglingPublish?: boolean;
  onOpenReleasePicker?: () => void;
  onRemoveFromReleaseClick?: (releaseId: string, releaseTitle: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const allReleases = useReleaseStore((state) => state.releases);
  const releasesContainingTrack = entry.trackId
    ? allReleases.filter((release) => release.tracks.some((t) => t.trackId === entry.trackId))
    : [];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const downloadUrl = entry.trackAudioUrlHd || entry.trackAudioUrl;

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
        title="Track actions"
        aria-label="Track actions"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-20 min-w-48 rounded-lg border border-white/10 bg-[#12121a] shadow-xl p-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
          >
            Edit entry
          </button>
          {entry.trackId && (
            <>
              <div className="my-1 h-px bg-white/10" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPlay();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
              >
                Play
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDetails();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
              >
                Track Details
              </button>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  onClick={() => setOpen(false)}
                  className="block w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                >
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAnalyze();
                }}
                disabled={analyzing}
                className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? "Analyzing composition…" : "Analyze Composition"}
              </button>
              <Link
                href="/library"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
              >
                Open in Library
              </Link>
              {onTogglePublish && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
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
              {onOpenReleasePicker && (
                <>
                  <div className="my-1 h-px bg-white/10" />
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
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
                          type="button"
                          onClick={() => {
                            setOpen(false);
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
              <div className="my-1 h-px bg-white/10" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onUnlink();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-sm text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
              >
                Unlink track
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
