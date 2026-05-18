"use client";

import { useState } from "react";
import { usePlayerStore } from "@/lib/store";

// Staggered delays for organic waveform feel
const WAVE_DELAYS = [0, 80, 160, 40, 200, 120, 280, 60, 220, 100, 340, 20, 180, 260, 80, 300, 140, 60, 240, 180, 320, 40, 200, 100];

function WaveformBars({ count = 5, height = 14, className = "" }: { count?: number; height?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-[2px] overflow-hidden ${className}`} style={{ height }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-wave-bar bg-current rounded-[1px] shrink-0"
          style={{ width: 2, animationDelay: `${WAVE_DELAYS[i % WAVE_DELAYS.length]}ms` }}
        />
      ))}
    </div>
  );
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-sm bg-red-500/80 hover:bg-red-500 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmMassDelete, setConfirmMassDelete] = useState(false);

  function toggleSelection(trackId: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelectedIds(newSelected);
  }

  function toggleSelectAll() {
    if (selectedIds.size === tracks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tracks.map((t) => t.id)));
    }
  }

  const allSelected = tracks.length > 0 && selectedIds.size === tracks.length;

  async function handleMassDelete() {
    if (selectedIds.size === 0) return;
    setConfirmMassDelete(true);
  }

  async function executeMassDelete() {
    setConfirmMassDelete(false);
    setDeleting(true);
    try {
      for (const id of selectedIds) {
        const res = await fetch(`/api/tracks/${id}`, { method: "DELETE" });
        if (res.ok) onDelete?.(id);
      }
      setSelectedIds(new Set());
    } catch {
      // silently fail — individual track errors are handled at the API level
    } finally {
      setDeleting(false);
    }
  }

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
    <>
      {confirmMassDelete && (
        <ConfirmDialog
          message={`Delete ${selectedIds.size} track${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`}
          onConfirm={executeMassDelete}
          onCancel={() => setConfirmMassDelete(false)}
        />
      )}
      <div className="space-y-1">
      {/* Selection controls */}
      <div className="flex items-center gap-3 px-3 py-1.5">
        <button
          onClick={toggleSelectAll}
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
          title={allSelected ? "Deselect all" : "Select all"}
        >
          {allSelected ? (
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : selectedIds.size > 0 ? (
            <div className="w-4 h-4 rounded-full bg-blue-500/50 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 hover:border-white/40 transition-colors" />
          )}
        </button>
        <span className="text-xs text-white/30">{selectedIds.size > 0 ? `${selectedIds.size} of ${tracks.length}` : `${tracks.length} tracks`}</span>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-1">
          <span className="text-sm text-blue-300">{selectedIds.size} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleMassDelete}
            disabled={deleting}
            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
            title="Delete selected"
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
      )}
      {isGenerating && <GeneratingRow />}
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          onPlay={handlePlay}
          onSelect={onSelect}
          onDelete={onDelete}
          isSelected={selectedIds.has(track.id)}
          onToggleSelect={toggleSelection}
        />
      ))}
    </div>
    </>
  );
}

function GeneratingRow() {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-600/5 border border-primary-600/20">
      {/* Empty selection dot — generating tracks can't be selected */}
      <div className="w-5 h-5 shrink-0" />

      {/* Waveform in play button area */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-600/20 text-primary-400">
        <WaveformBars count={5} height={14} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">Composing your track</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300">
            Creating
          </span>
        </div>
        {/* Full-width waveform in description row */}
        <div className="mt-1.5 text-primary-500/40 w-full">
          <WaveformBars count={32} height={10} className="w-full" />
        </div>
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
  isSelected,
  onToggleSelect,
}: {
  track: TrackItem;
  onPlay: (track: TrackItem) => void;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (trackId: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function executeDelete() {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete?.(track.id);
      }
    } catch {
      // silently fail
    }
    setDeleting(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmDelete(true);
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
    <>
      {confirmDelete && (
        <ConfirmDialog
          message="Delete this track? This cannot be undone."
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
          track.status === "generating" || track.status === "pending"
            ? "bg-primary-600/5 border border-primary-600/20"
            : "hover:bg-white/5"
        }`}
        onClick={() => onSelect(track)}
      >
      {/* Selection dot */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.(track.id);
        }}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
        title="Select track"
      >
        {isSelected ? (
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-white/20 group-hover:border-white/40 transition-colors" />
        )}
      </button>

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
          <div className="text-primary-400/60">
            <WaveformBars count={4} height={12} />
          </div>
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
        {(track.status === "generating" || track.status === "pending") ? (
          <div className="mt-1.5 text-primary-500/40 w-full">
            <WaveformBars count={32} height={8} className="w-full" />
          </div>
        ) : (
          <p className="text-xs text-white/30 truncate mt-0.5">{styleDesc}</p>
        )}
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
    </>
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
