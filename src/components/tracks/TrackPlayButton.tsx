"use client";

import { useEffect, useState } from "react";
import type { TrackItem } from "./types";
import { formatDuration } from "@/lib/track-utils";

interface TrackPlayButtonProps {
  track: TrackItem;
  isCurrentlyPlaying: boolean;
  isPlaying: boolean;
  effectiveCoverUrl: string | null;
  effectiveThumbUrl: string | null;
  onPlayClick: () => void;
  isAnalyzing?: boolean;
  className?: string;
}

export default function TrackPlayButton({
  track,
  isCurrentlyPlaying,
  isPlaying,
  effectiveCoverUrl,
  effectiveThumbUrl,
  onPlayClick,
  isAnalyzing = false,
  className = "",
}: TrackPlayButtonProps) {
  const isGeneratingOrPending = track.status === "generating" || track.status === "pending";
  const isArchived = Boolean(track.archivedAt);
  const coverSrc = effectiveThumbUrl ?? effectiveCoverUrl;
  // A stale coverUrl (e.g. optimistic ?t=... set before generation finished,
  // or an S3 object that went missing) 404s. Hide the broken <img> and fall
  // back to the placeholder instead of spamming the cover endpoint.
  const [coverFailed, setCoverFailed] = useState(false);
  useEffect(() => { setCoverFailed(false); }, [coverSrc]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (track.status !== "done" || isArchived) return;
        onPlayClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
      }}
      className={`relative w-[90px] h-[90px]  shrink-0 overflow-hidden transition-colors group/play ${isCurrentlyPlaying ? "ring-2 ring-accent/40" : ""} ${className}`}
      data-now-playing={isCurrentlyPlaying ? "true" : undefined}
      aria-label={isCurrentlyPlaying && isPlaying ? "Pause" : "Play"}
    >
      {isArchived ? (
        <div
          className="w-full h-full flex items-center justify-center bg-white/5"
          title="Gearchiveerd — alleen mp3 bewaard"
        >
          <svg className="w-5 h-5 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8v14a2 2 0 002 2h10a2 2 0 002-2V8M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2m-6 0h6" />
          </svg>
        </div>
      ) : isGeneratingOrPending ? (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        </div>
      ) : effectiveCoverUrl && !coverFailed ? (
        <>
          <img
            src={coverSrc ?? effectiveCoverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setCoverFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {isCurrentlyPlaying ? (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              {isPlaying ? (
                <svg className="w-4 h-4 max-sm:h-7 max-sm:w-7 text-ink" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5 max-sm:h-7 max-sm:w-7 text-ink" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/0 group-hover/play:bg-black/40 max-sm:bg-black/25 transition-colors flex items-center justify-center">
              <svg className="w-4 h-4 ml-0.5 max-sm:h-7 max-sm:w-7 text-ink opacity-0 group-hover/play:opacity-100 max-sm:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </>
      ) : track.status === "done" ? (
        <div
          className={`w-full h-full flex items-center justify-center relative ${
            isCurrentlyPlaying ? "bg-accent-strong" : "bg-accent-strong/80 hover:bg-accent-strong"
          }`}
        >
          {isCurrentlyPlaying ? (
            isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      {isAnalyzing && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 backdrop-blur-[1px]"
          title="Analyzing Track DNA…"
        >
          <span className="text-base leading-none animate-pulse">🧬</span>
          <span className="flex items-end gap-0.5 h-3">
            <span className="w-0.5 bg-accent rounded-full animate-wave-bar" />
            <span className="w-0.5 bg-accent rounded-full animate-wave-bar animation-delay-150" />
            <span className="w-0.5 bg-accent rounded-full animate-wave-bar animation-delay-300" />
          </span>
        </div>
      )}
      {track.status === "done" && track.duration && (
        <span className="absolute bottom-0.5 right-0.5 left-0.5 text-[11px] font-medium tabular-nums text-ink leading-none pointer-events-none text-center bg-black/40 rounded-sm px-0.5 py-px backdrop-blur-sm">
          {formatDuration(track.duration)}
        </span>
      )}
    </button>
  );
}
