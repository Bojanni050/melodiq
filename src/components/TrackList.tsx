"use client";

import { useState } from "react";
import { usePlayerStore } from "@/lib/store";

interface TrackItem {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
}

export default function TrackList({
  tracks,
}: {
  tracks: TrackItem[];
}) {
  const { setCurrentTrack } = usePlayerStore();

  function handlePlay(track: TrackItem) {
    setCurrentTrack({
      id: track.id,
      title: track.title,
      provider: track.provider,
      providerModel: track.providerModel,
      prompt: track.prompt,
      status: track.status,
      audioUrl: track.audioUrl,
      audioUrlHd: track.audioUrlHd,
      s3Key: null,
      s3KeyHd: track.s3KeyHd,
      duration: null,
      createdAt: track.createdAt,
      error: track.error,
    });
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-16">
        <svg
          className="w-16 h-16 mx-auto text-white/10 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
        <p className="text-white/40 text-lg">No tracks yet</p>
        <p className="text-white/30 text-sm mt-1">
          Generate your first track in the Studio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} onPlay={handlePlay} />
      ))}
    </div>
  );
}

function TrackCard({
  track,
  onPlay,
}: {
  track: TrackItem;
  onPlay: (track: TrackItem) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  function handleDownload(url: string, hd = false) {
    setDownloading(true);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${track.title || "track"}${hd ? "_hd" : ""}.mp3`;
    a.click();
    setTimeout(() => setDownloading(false), 1000);
  }

  const statusBadge = {
    pending: "bg-yellow-500/20 text-yellow-300",
    generating: "bg-blue-500/20 text-blue-300",
    done: "bg-green-500/20 text-green-300",
    failed: "bg-red-500/20 text-red-300",
  }[track.status];

  const statusLabel = {
    pending: "Queued",
    generating: "Creating",
    done: "Ready",
    failed: "Failed",
  }[track.status];

  return (
    <div
      className={`card group transition-all ${
        track.status === "generating" ? "shimmer" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        {track.status === "done" ? (
          <button
            onClick={() => onPlay(track)}
            className="w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
              track.status === "failed"
                ? "bg-red-500/20"
                : "bg-white/10 animate-pulse"
            }`}
          >
            {track.status === "failed" ? (
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">
              {track.title || track.prompt.substring(0, 50)}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-white/40 truncate">
            {track.provider} • {track.providerModel}
          </p>
          {track.error && (
            <p className="text-sm text-red-400 mt-1">
              {track.error}
              {track.error.includes("Optimize") && (
                <span className="ml-1 text-primary-400 cursor-pointer hover:underline">
                  Go to Studio
                </span>
              )}
            </p>
          )}
        </div>

        {track.status === "done" && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleDownload(track.audioUrl || "")}
              disabled={!track.audioUrl || downloading}
              className="btn-secondary text-sm px-3 py-1.5"
            >
              MP3
            </button>
            {track.s3KeyHd && (
              <button
                onClick={() => handleDownload(track.audioUrlHd || "", true)}
                disabled={!track.audioUrlHd || downloading}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                HD
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
