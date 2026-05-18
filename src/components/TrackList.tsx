"use client";

import { useState } from "react";
import { usePlayerStore } from "@/lib/store";

interface TrackItem {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
}

export default function TrackList({
  tracks,
  isGenerating,
  onSelect,
  onDelete,
}: {
  tracks: TrackItem[];
  isGenerating?: boolean;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
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
      lyrics: track.lyrics,
      createdAt: track.createdAt,
      error: track.error,
    });
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg className="w-12 h-12 text-white/10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p className="text-white/30 text-sm">No tracks yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {isGenerating && <GeneratingRow />}
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} onPlay={handlePlay} onSelect={onSelect} onDelete={onDelete} />
      ))}
    </div>
  );
}

function GeneratingRow() {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 shimmer border border-white/10">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-600/20">
        <div className="w-3 h-3 rounded-full bg-white/80 animate-pulse" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">Composing your track</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
            Creating
          </span>
        </div>
        <p className="text-xs text-white/30 truncate mt-0.5">
          Adding it to your songs list now...
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-white/20 mr-1">now</span>
      </div>
    </div>
  );
}

function TrackCard({
  track,
  onPlay,
  onSelect,
  onDelete,
}: {
  track: TrackItem;
  onPlay: (track: TrackItem) => void;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this track?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete?.(track.id);
      } else {
        alert("Failed to delete track");
      }
    } catch {
      alert("Failed to delete track");
    }
    setDeleting(false);
  }

  function handleDownload(url: string, hd = false) {
    setDownloading(true);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${track.title || "track"}${hd ? "_hd" : ""}.mp3`;
    a.click();
    setTimeout(() => setDownloading(false), 1000);
  }

  const statusConfig = {
    pending: { color: "bg-yellow-500/20 text-yellow-300", label: "Queued" },
    generating: { color: "bg-blue-500/20 text-blue-300", label: "Creating" },
    done: { color: "bg-green-500/20 text-green-300", label: "Ready" },
    failed: { color: "bg-red-500/20 text-red-300", label: "Failed" },
  };
  const status = statusConfig[track.status];

  const timeAgo = getTimeAgo(new Date(track.createdAt));
  const title = track.title || track.prompt.substring(0, 50);
  const styleDesc = track.prompt.length > 80 ? track.prompt.substring(0, 80) + "..." : track.prompt;

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
        track.status === "generating" ? "shimmer" : "hover:bg-white/5"
      }`}
      onClick={() => onSelect(track)}
    >
      {/* Play button / artwork placeholder */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (track.status === "done") onPlay(track);
        }}
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          track.status === "done"
            ? "bg-primary-600/80 hover:bg-primary-600"
            : track.status === "failed"
            ? "bg-red-500/10"
            : "bg-white/5"
        }`}
      >
        {track.status === "done" ? (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : track.status === "failed" ? (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="w-3 h-3 rounded-full bg-white/20 animate-pulse" />
        )}
      </button>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">{title}</h3>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.color}`}>
            {status.label}
          </span>
        </div>
        <p className="text-xs text-white/30 truncate mt-0.5">
          {styleDesc}
        </p>
        {track.error && (
          <p className="text-xs text-red-400 mt-0.5">{track.error}</p>
        )}
      </div>

      {/* Time + actions */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-white/20 mr-1">{timeAgo}</span>
        {track.status === "done" && track.audioUrl && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(track.audioUrl!);
              }}
              disabled={downloading}
              className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
              title="Download MP3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {track.s3KeyHd && track.audioUrlHd && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(track.audioUrlHd!, true);
                }}
                disabled={downloading}
                className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                title="Download HD"
              >
                HD
              </button>
            )}
          </>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title={deleting ? "Deleting..." : "Delete track"}
        >
          {deleting ? (
            <div className="w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
