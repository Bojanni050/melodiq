"use client";

import { useCallback, useState } from "react";
import { useChromecast, type CastTrackInfo } from "@/hooks/useChromecast";

interface Props {
  /** trackId is used to fetch a presigned S3 URL (Chromecast can't use cookie-authed stream) */
  trackId: string | null;
  /** hd=true when quality toggle is on and an HD file is available */
  hd?: boolean;
  /** Fallback metadata to pass alongside the URL */
  meta: Pick<CastTrackInfo, "title" | "coverUrl" | "currentTime" | "duration"> | null;
  disabled?: boolean;
}

export default function ChromecastButton({ trackId, hd, meta, disabled }: Props) {
  const { castState, startCasting, stopCasting } = useChromecast();
  const [resolving, setResolving] = useState(false);

  const handleClick = useCallback(async () => {
    if (!trackId || !meta) return;

    if (castState === "connected") {
      stopCasting();
      return;
    }

    setResolving(true);
    try {
      // Fetch a presigned S3 URL — Chromecast makes the request directly,
      // bypassing our cookie-based auth.
      const res = await fetch(`/api/tracks/${trackId}/cast-url${hd ? "?hd=true" : ""}`);
      if (!res.ok) {
        console.error("Failed to get cast URL", await res.text());
        return;
      }
      const data = await res.json() as { url: string; contentType: string };
      await startCasting({
        streamUrl: data.url,
        contentType: data.contentType,
        ...meta,
      });
    } finally {
      setResolving(false);
    }
  }, [castState, trackId, hd, meta, startCasting, stopCasting]);

  // Only show when Cast API found a device (or is already active)
  if (castState === "unavailable") return null;

  const isActive = castState === "connected" || castState === "connecting";
  const isBusy = resolving || castState === "connecting";

  const label =
    castState === "connected"
      ? "Stop casting"
      : isBusy
        ? "Connecting to Chromecast…"
        : "Cast to Chromecast";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isBusy}
      title={label}
      aria-label={label}
      className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
        isActive
          ? "text-sky-400 hover:text-sky-300"
          : "text-white/30 hover:text-white/60"
      }`}
    >
      {isBusy ? (
        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        /* Chromecast icon */
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M2 17a5 5 0 0 1 5 5" />
          <path d="M2 13a9 9 0 0 1 9 9" opacity="0.6" />
          <circle cx="2" cy="21" r="1" fill="currentColor" stroke="none" />
        </svg>
      )}
    </button>
  );
}
