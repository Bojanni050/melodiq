"use client";

import type { TrackItem } from "./types";
import WaveformBars from "./WaveformBars";

interface TrackPlayButtonProps {
  track: TrackItem;
  isCurrentlyPlaying: boolean;
  isPlaying: boolean;
  effectiveCoverUrl: string | null;
  effectiveThumbUrl: string | null;
  onPlayClick: () => void;
}

export default function TrackPlayButton({
  track,
  isCurrentlyPlaying,
  isPlaying,
  effectiveCoverUrl,
  effectiveThumbUrl,
  onPlayClick,
}: TrackPlayButtonProps) {
  const isGeneratingOrPending = track.status === "generating" || track.status === "pending";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (track.status !== "done") return;
        onPlayClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
      }}
      className={`relative w-15 h-15 rounded-lg shrink-0 overflow-hidden transition-colors group/play ${
        isCurrentlyPlaying ? "ring-2 ring-primary-500/40" : ""
      }`}
      data-now-playing={isCurrentlyPlaying ? "true" : undefined}
      aria-label={isCurrentlyPlaying && isPlaying ? "Pause" : "Play"}
    >
      {isGeneratingOrPending ? (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400/30 border-t-primary-300" />
        </div>
      ) : effectiveCoverUrl ? (
        <>
          <img
            src={effectiveThumbUrl ?? effectiveCoverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {isCurrentlyPlaying ? (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              {isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/0 group-hover/play:bg-black/40 transition-colors flex items-center justify-center">
              <svg className="w-4 h-4 ml-0.5 text-white opacity-0 group-hover/play:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </>
      ) : track.status === "done" ? (
        <div
          className={`w-full h-full flex items-center justify-center relative ${
            isCurrentlyPlaying ? "bg-primary-600" : "bg-primary-600/80 hover:bg-primary-600"
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
      ) : track.status === "failed" ? (
        <div className="w-full h-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ) : (
        <div className="w-full h-full bg-white/5 flex items-center justify-center text-primary-400/60">
          <WaveformBars count={4} className="h-3" />
        </div>
      )}
    </button>
  );
}
