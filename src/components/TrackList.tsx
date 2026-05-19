"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/lib/store";

const WAVE_DELAYS = ["[animation-delay:0ms]", "[animation-delay:55ms]", "[animation-delay:110ms]", "[animation-delay:165ms]", "[animation-delay:220ms]"];
const WAVE_DURATIONS = ["[animation-duration:700ms]", "[animation-duration:790ms]", "[animation-duration:880ms]", "[animation-duration:970ms]", "[animation-duration:1060ms]"];

// Staggered delays for organic waveform feel
function WaveformBars({ count = 5, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 overflow-hidden ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`h-full w-0.5 animate-wave-bar bg-current rounded-[1px] shrink-0 ${i % 3 === 0 ? "opacity-100" : i % 3 === 1 ? "opacity-80" : "opacity-60"} ${WAVE_DELAYS[i % WAVE_DELAYS.length]} ${WAVE_DURATIONS[i % WAVE_DURATIONS.length]}`}
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
  format: string | null;
  formatHd: string | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
}

interface PlaylistOption {
  id: string;
  name: string;
}

export default function TrackList({
  tracks,
  isGenerating,
  onSelect,
  onDelete,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  playlists,
}: {
  tracks: TrackItem[];
  isGenerating?: boolean;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
  onReusePrompt?: (track: TrackItem) => void;
  onAddToQueue?: (track: TrackItem) => void;
  onAddToPlaylist?: (trackId: string, playlistId: string) => void;
  playlists?: PlaylistOption[];
}) {
  const { setCurrentTrack, setIsPlaying } = usePlayerStore();
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
      format: track.format,
      formatHd: track.formatHd,
      s3Key: null,
      s3KeyHd: track.s3KeyHd,
      duration: null,
      lyrics: track.lyrics,
      createdAt: track.createdAt,
      error: track.error,
    });
    setIsPlaying(true);
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
          onReusePrompt={onReusePrompt}
          onAddToQueue={onAddToQueue}
          onAddToPlaylist={onAddToPlaylist}
          playlists={playlists}
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
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-600/5 border border-primary-600/20 animate-[pulse_3s_ease-in-out_infinite]">
      {/* Empty selection dot — generating tracks can't be selected */}
      <div className="w-5 h-5 shrink-0" />

      {/* Waveform in play button area */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary-600/20 text-primary-400">
        <WaveformBars count={5} className="h-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium truncate">Composing your track</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 animate-[pulse_2s_ease-in-out_infinite]">
            Creating
          </span>
        </div>
        {/* Full-width waveform in description row */}
        <div className="mt-1.5 text-primary-500/40 w-full">
          <WaveformBars count={32} className="h-2.5 w-full" />
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
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  playlists,
  isSelected,
  onToggleSelect,
}: {
  track: TrackItem;
  onPlay: (track: TrackItem) => void;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
  onReusePrompt?: (track: TrackItem) => void;
  onAddToQueue?: (track: TrackItem) => void;
  onAddToPlaylist?: (trackId: string, playlistId: string) => void;
  playlists?: PlaylistOption[];
  isSelected?: boolean;
  onToggleSelect?: (trackId: string) => void;
}) {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const isCurrentlyPlaying = currentTrack?.id === track.id;
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    const fmt = hd ? (track.formatHd ?? track.format ?? "mp3") : (track.format ?? "mp3");
    a.download = `${track.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
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
  const statusAnimationClass = track.status === "generating" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : "";

  const createdAt = formatTrackDateTime(new Date(track.createdAt));
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
          isCurrentlyPlaying
            ? "bg-primary-500/15 border-l-2 border-l-primary-400 pl-2"
            : track.status === "generating" || track.status === "pending"
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
          if (track.status !== "done") return;
          if (isCurrentlyPlaying) {
            setIsPlaying(!isPlaying);
          } else {
            onPlay(track);
          }
        }}
        className="relative w-10 h-10 rounded-lg shrink-0 overflow-hidden transition-colors group/play"
        aria-label={isCurrentlyPlaying && isPlaying ? "Pause" : "Play"}
      >
        {track.coverUrl ? (
          <>
            <img
              src={track.coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Currently playing overlay: waveform + stop/play on hover */}
            {isCurrentlyPlaying ? (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                {/* Waveform shown when playing; paused bars when paused */}
                <div className={`absolute inset-0 flex items-center justify-center text-primary-400 transition-opacity ${isPlaying ? "opacity-100 group-hover/play:opacity-0" : "opacity-60 group-hover/play:opacity-0"}`}>
                  {isPlaying ? (
                    <WaveformBars count={4} className="h-3.5" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  )}
                </div>
                {/* On hover: show stop or play */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity">
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
          <div className={`w-full h-full flex items-center justify-center relative ${
            isCurrentlyPlaying ? "bg-primary-600" : "bg-primary-600/80 hover:bg-primary-600"
          }`}>
            {isCurrentlyPlaying ? (
              <>
                {/* Waveform bars when playing; paused icon when paused */}
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                  isPlaying ? "opacity-100 group-hover/play:opacity-0" : "opacity-70 group-hover/play:opacity-0"
                }`}>
                  {isPlaying ? (
                    <WaveformBars count={4} className="h-3.5" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  )}
                </div>
                {/* Hover: show pause or play icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity">
                  {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </>
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

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-medium truncate ${isCurrentlyPlaying ? "text-primary-300" : ""}`}>{title}</h3>
          {isCurrentlyPlaying && (
            <div className="shrink-0 text-primary-400 h-3.5 w-6">
              {isPlaying ? (
                <WaveformBars count={4} className="h-3.5" />
              ) : (
                <svg className="w-3 h-3 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              )}
            </div>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.color} ${statusAnimationClass}`}>
            {status.label}
          </span>
        </div>
        {(track.status === "generating" || track.status === "pending") ? (
          <div className="mt-1.5 text-primary-500/40 w-full">
            <WaveformBars count={32} className="h-2 w-full" />
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
        <div className="mr-1 text-right leading-tight">
          <p className="text-[11px] text-white/30 whitespace-nowrap">{createdAt.date}</p>
          <p className="text-[10px] text-white/20 whitespace-nowrap">{createdAt.time}</p>
        </div>
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
        {track.status === "done" && (
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
                    onReusePrompt?.(track);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                >
                  Reuse Prompt
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onAddToQueue?.(track);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                >
                  Add to queue
                </button>
                <div className="my-1 h-px bg-white/10" />
                <p className="px-2.5 pb-1 text-[11px] uppercase tracking-wide text-white/35">Add to playlist</p>
                {playlists && playlists.length > 0 ? (
                  playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onAddToPlaylist?.(track.id, playlist.id);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-sm text-white/80 hover:bg-white/5"
                    >
                      {playlist.name}
                    </button>
                  ))
                ) : (
                  <p className="px-2.5 py-1.5 text-xs text-white/40">Create a playlist in Library first</p>
                )}
              </div>
            )}
          </div>
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

function formatTrackDateTime(date: Date): { date: string; time: string } {
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return { date: dateLabel, time: timeLabel };
}
