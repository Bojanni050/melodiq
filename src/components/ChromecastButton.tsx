"use client";

import { useCallback } from "react";
import { useChromecast, type CastTrackInfo } from "@/hooks/useChromecast";

interface Props {
  track: CastTrackInfo | null;
  disabled?: boolean;
}

export default function ChromecastButton({ track, disabled }: Props) {
  const { castState, startCasting, stopCasting } = useChromecast();

  const handleClick = useCallback(async () => {
    if (!track) return;
    if (castState === "connected") {
      stopCasting();
    } else {
      await startCasting(track);
    }
  }, [castState, track, startCasting, stopCasting]);

  // Only show when Cast API found a device or already connecting/connected
  if (castState === "unavailable") return null;

  const isActive = castState === "connected" || castState === "connecting";
  const label =
    castState === "connected"
      ? "Stop casting"
      : castState === "connecting"
        ? "Connecting to Chromecast…"
        : "Cast to Chromecast";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || castState === "connecting"}
      title={label}
      aria-label={label}
      className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
        isActive
          ? "text-sky-400 hover:text-sky-300"
          : "text-white/30 hover:text-white/60"
      }`}
    >
      {/* Chromecast icon */}
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Monitor frame */}
        <rect x="2" y="3" width="20" height="14" rx="2" />
        {/* Cast arc small */}
        <path d="M2 17a5 5 0 0 1 5 5" />
        {/* Cast arc medium */}
        <path d="M2 13a9 9 0 0 1 9 9" opacity="0.6" />
        {/* Cast dot */}
        <circle cx="2" cy="21" r="1" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
