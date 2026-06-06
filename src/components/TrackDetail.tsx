"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useUserStore, usePlayerStore } from "@/lib/store";
import { parseLyrics, isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import { useSWRConfig } from "swr";

interface TrackDetailProps {
  track: {
    id: string;
    title: string | null;
    provider: string;
    providerModel: string;
    prompt: string;
    lyrics: string | null;
    lyricsTimestamps?: string | null;
    status: string;
    audioUrl: string | null;
    audioUrlHd: string | null;
    format: string | null;
    formatHd: string | null;
    duration: number | null;
    createdAt: string;
    error: string | null;
    s3KeyHd: string | null;
    coverUrl?: string | null;
    s3KeyCover?: string | null;
    rating?: string | null;
    instrumental?: boolean | null;
  };
  onClose: () => void;
  onPlay: (url: string) => void;
  onDownload: (url: string, hd: boolean) => void;
  mode?: "overlay" | "sidebar";
  allowLyricsEdit?: boolean;
}

export default function TrackDetail({ track: initialTrack, onClose, onPlay, onDownload, mode = "overlay", allowLyricsEdit = false }: TrackDetailProps) {
  const [downloading, setDownloading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentRating, setCurrentRating] = useState<string | null>(initialTrack.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState(initialTrack.lyrics ?? "");
  const [lyricsEditing, setLyricsEditing] = useState(false);
  const [lyricsSaving, setLyricsSaving] = useState(false);
  const { user, loadUser } = useUserStore();
  const { currentTrack, audioElement } = usePlayerStore();
  const [currentTime, setCurrentTime] = useState(0);
  const { mutate } = useSWRConfig();

  // central track state to support instant self-healing updates
  const [localTrack, setLocalTrack] = useState(initialTrack);

  useEffect(() => {
    setLocalTrack(initialTrack);
    setCurrentRating(initialTrack.rating ?? null);
    setLyricsDraft(initialTrack.lyrics ?? "");
    setLyricsEditing(false);
  }, [initialTrack]);

  // central self-healing polling loop
  useEffect(() => {
    if (localTrack.status !== "done" || localTrack.provider !== "poyo" || localTrack.instrumental) return;

    const hasTimings = localTrack.lyricsTimestamps && !isLyricsTaskSubmission(localTrack.lyricsTimestamps)
      ? parseLyrics(localTrack.lyrics, localTrack.lyricsTimestamps).some((line) => line.startTime >= 0)
      : false;

    // We only poll if it has NO timings, OR if it's currently a task submission receipt
    const needsPolling = !hasTimings || isLyricsTaskSubmission(localTrack.lyricsTimestamps);
    if (!needsPolling) return;

    console.log(`[TCL-Sync] central TrackDetail started polling for track ${localTrack.id}`);
    
    let pollCount = 0;
    const maxPolls = 15; // 15 polls * 5 seconds = 75 seconds max
    let active = true;
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/tracks/${localTrack.id}`);
        if (!res.ok) return;
        const updatedTrack = await res.json();

        if (!active) return;

        if (updatedTrack && updatedTrack.lyricsTimestamps !== localTrack.lyricsTimestamps) {
          const updatedHasTimings = updatedTrack.lyricsTimestamps && !isLyricsTaskSubmission(updatedTrack.lyricsTimestamps)
            ? parseLyrics(updatedTrack.lyrics, updatedTrack.lyricsTimestamps).some((line) => line.startTime >= 0)
            : false;

          console.log(`[TCL-Sync] central TrackDetail fetched update. Has Timings: ${updatedHasTimings}`);

          // Update local state instantly so user sees it right away
          setLocalTrack(updatedTrack);

          // Update player store instantly so playing track keeps tracking lyrics
          usePlayerStore.getState().syncTrackSnapshots([updatedTrack]);

          // Update SWR global list so other lists are reactively aware
          void mutate("/api/tracks");

          // If we finally got real timings, stop polling
          if (updatedHasTimings) {
            console.log(`[TCL-Sync] central TrackDetail polling finished successfully for track ${localTrack.id}`);
            return;
          }
        }
      } catch (err: any) {
        console.error(`[TCL-Sync] central TrackDetail polling error:`, err?.message ?? err);
      }

      pollCount++;
      if (pollCount < maxPolls && active) {
        timerId = setTimeout(poll, 5000);
      } else if (pollCount >= maxPolls) {
        console.log(`[TCL-Sync] central TrackDetail stopped polling: hit max retries for track ${localTrack.id}`);
      }
    };

    timerId = setTimeout(poll, 2000); // start first poll after 2 seconds

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [localTrack.id, localTrack.lyricsTimestamps, mutate]);

  // Shadow initialTrack with the active stateful localTrack
  const track = localTrack;

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    setCurrentTime(0);
  }, [track.id]);

  useEffect(() => {
    if (!audioElement || currentTrack?.id !== track.id) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime || 0);
    };

    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    // Initial sync
    setCurrentTime(audioElement.currentTime || 0);

    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [audioElement, currentTrack, track.id]);

  const parsedLyrics = useMemo(() => {
    return parseLyrics(track.lyrics, track.lyricsTimestamps);
  }, [track.lyrics, track.lyricsTimestamps]);

  const hasTimings = useMemo(() => {
    return parsedLyrics.some((line) => line.startTime >= 0);
  }, [parsedLyrics]);

  const activeLineIndex = useMemo(() => {
    if (!hasTimings) return -1;
    let activeIndex = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].startTime <= currentTime) {
        activeIndex = i;
      } else {
        break;
      }
    }
    return activeIndex;
  }, [parsedLyrics, currentTime, hasTimings]);

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarActiveLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && sidebarActiveLineRef.current) {
      const container = containerRef.current;
      const activeEl = sidebarActiveLineRef.current;
      
      const containerHeight = container.clientHeight;
      const elemTop = activeEl.offsetTop;
      const elemHeight = activeEl.clientHeight;
      
      // Center the active element exactly in the middle of the container
      const targetScrollTop = elemTop - (containerHeight / 2) + (elemHeight / 2);
      
      container.scrollTo({
        top: targetScrollTop,
        behavior: "smooth"
      });
    }
  }, [activeLineIndex]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [track.id]);

  const handleLineClick = useCallback((startTime: number) => {
    if (startTime >= 0 && audioElement && currentTrack?.id === track.id) {
      audioElement.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [audioElement, currentTrack, track.id]);

  function handleDownload(url: string, hd = false) {
    setDownloading(true);
    onDownload(url, hd);
    setTimeout(() => setDownloading(false), 1000);
  }

  async function handleRating(newRating: "up" | "down") {
    // Toggle: if same rating clicked, set to null
    const rating = currentRating === newRating ? null : newRating;
    
    setRatingLoading(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}/rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });

      if (res.ok) {
        setCurrentRating(rating);
      }
    } catch (error) {
      console.error("Failed to update rating:", error);
    } finally {
      setRatingLoading(false);
    }
  }

  async function handleCopy(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  async function handleSaveLyrics() {
    setLyricsSaving(true);
    try {
      const trimmedLyrics = lyricsDraft.trim();
      const res = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: trimmedLyrics ? trimmedLyrics : null }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload && typeof payload.error === "string" ? payload.error : "Failed to update lyrics";
        throw new Error(message);
      }

      const updatedTrack = await res.json();
      setLocalTrack(updatedTrack);
      usePlayerStore.getState().syncTrackSnapshots([updatedTrack]);
      void mutate("/api/tracks");
      setLyricsEditing(false);
      setLyricsDraft(updatedTrack.lyrics ?? "");
    } catch (error) {
      console.error("Failed to update lyrics:", error);
    } finally {
      setLyricsSaving(false);
    }
  }

  const title = (track.title || track.prompt.substring(0, 60)).replace(/\s*\(2\)\s*$/, "");
  const promptFirstLine = track.prompt
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
  const mp3Label = (track.format ?? "mp3").toUpperCase();
  const wavLabel = track.formatHd === "wav" ? "WAV" : "HD";
  const isUploadedTrack = track.provider === "upload";
  const artistLabel = (user?.artistAlias || "").trim() || (user?.name || "").trim() || "";
  const providerLabelBase = isUploadedTrack ? "Upload" : track.provider;
  const providerLabel = (() => {
    const normalized = providerLabelBase.toLowerCase();
    if (normalized === "poyo") return "PoYo";
    if (normalized === "tempolor") return "Tempolor";
    if (normalized === "musicgpt") return "MusicGPT";
    if (normalized === "lyria") return "Lyria";
    if (normalized === "minimax") return "MiniMax";
    if (!providerLabelBase) return "";
    return providerLabelBase[0].toUpperCase() + providerLabelBase.slice(1);
  })();
  const providerModelLabel = isUploadedTrack ? "Local file" : track.providerModel;

  function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0d0d12]/95 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60">Track Details</h3>
        <button onClick={onClose} className="text-white/50 hover:text-white" title="Close details">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Artwork with Overlay */}
      <div className="shrink-0 aspect-square relative bg-linear-to-br from-primary-500/20 to-[#ff530c]/20 overflow-hidden">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={title || "Cover art"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* Gradient Overlay for Text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        {/* Rating Overlay (Top Right) */}
        {track.status === "done" && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              onClick={() => handleRating("up")}
              disabled={ratingLoading}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                currentRating === "up"
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-black/40 text-white/70 border border-white/10 hover:bg-black/60 hover:text-white"
              }`}
              title="Thumbs up"
              aria-label="Rate track positive"
            >
              <svg className="w-4 h-4" fill={currentRating === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>
            <button
              onClick={() => handleRating("down")}
              disabled={ratingLoading}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                currentRating === "down"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-black/40 text-white/70 border border-white/10 hover:bg-black/60 hover:text-white"
              }`}
              title="Thumbs down"
              aria-label="Rate track negative"
            >
              <svg className="w-4 h-4" fill={currentRating === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </div>
        )}

        {/* Info Overlay (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col justify-end z-10">
          <h2 className="text-xl font-bold text-white drop-shadow-md leading-tight">{title}</h2>
          <p className="text-xs text-white/80 mt-1.5 drop-shadow-sm font-medium">
            {artistLabel ? `${artistLabel} - ` : ""}{providerLabel} • {providerModelLabel}
            {track.duration && (
              <span className="ml-1.5 text-white/60">• {formatDuration(track.duration)}</span>
            )}
          </p>
          {mode === "overlay" && promptFirstLine && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">Prompt</span>
                <button
                  type="button"
                  onClick={() => handleCopy(track.prompt, "prompt-overlay")}
                  className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
                  title="Copy prompt"
                >
                  {copiedField === "prompt-overlay" ? (
                    <svg className="h-3.5 w-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="truncate text-xs leading-relaxed text-white/75">{promptFirstLine}</p>
            </div>
          )}
          {isUploadedTrack && (
            <div className="mt-2.5">
              <span className="inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-400/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-emerald-100 uppercase tracking-wider">
                Uploaded file
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Container */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 py-5 space-y-6">

        {/* Prompt */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setPromptExpanded((value) => !value)}
              className="flex items-center gap-2 text-xs font-medium text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
              title={promptExpanded ? "Collapse prompt" : "Expand prompt"}
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${promptExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Prompt
            </button>
            <button
              onClick={() => handleCopy(track.prompt, "prompt")}
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              title="Copy prompt"
            >
              {copiedField === "prompt" ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          {promptExpanded ? (
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{track.prompt}</p>
          ) : (
            <p className="text-sm text-white/40 leading-relaxed line-clamp-2">
              {track.prompt}
            </p>
          )}
        </div>

        {/* Lyrics */}
        {(track.lyrics || allowLyricsEdit) && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Lyrics {hasTimings && <span className="text-[10px] text-blue-400 font-medium px-1.5 py-0.5 rounded border border-blue-400/20 bg-blue-400/5 normal-case ml-1.5">TCL synced</span>}
              </h4>
              <div className="flex items-center gap-1">
                {allowLyricsEdit && !lyricsEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setLyricsDraft(track.lyrics ?? "");
                      setLyricsEditing(true);
                    }}
                    className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
                    title={track.lyrics ? "Edit lyrics" : "Add lyrics"}
                  >
                    {track.lyrics ? "Edit" : "Add"}
                  </button>
                )}
                {allowLyricsEdit && lyricsEditing && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLyricsDraft(track.lyrics ?? "");
                        setLyricsEditing(false);
                      }}
                      className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
                      disabled={lyricsSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLyrics}
                      className="rounded px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors disabled:opacity-60"
                      disabled={lyricsSaving}
                    >
                      {lyricsSaving ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
                {track.lyrics && !lyricsEditing && (
                  <button
                    onClick={() => handleCopy(track.lyrics!, "lyrics")}
                    className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                    title="Copy lyrics"
                  >
                    {copiedField === "lyrics" ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
            {lyricsEditing ? (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <textarea
                  value={lyricsDraft}
                  onChange={(event) => setLyricsDraft(event.target.value)}
                  placeholder="Add or edit lyrics here"
                  className="h-full w-full resize-none rounded-lg border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white/80 outline-none focus:border-white/30"
                  maxLength={20000}
                  disabled={lyricsSaving}
                />
              </div>
            ) : track.lyrics ? hasTimings ? (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div
                  ref={containerRef}
                  className="h-full overflow-y-auto px-3 pt-3 pb-16 scroll-smooth space-y-4 relative [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full"
                >
                  {parsedLyrics.map((line, index) => {
                    const isActive = index === activeLineIndex;
                    const isPlayed = index < activeLineIndex;
                    const isTrackPlaying = currentTrack?.id === track.id;

                    return (
                      <div
                        key={index}
                        ref={isActive ? sidebarActiveLineRef : null}
                        onClick={() => handleLineClick(line.startTime)}
                        className={`transition-all duration-300 leading-relaxed py-0.5 ${
                          isTrackPlaying ? "cursor-pointer" : ""
                        } ${
                          isActive
                            ? "text-primary-400 font-bold scale-[1.02] filter drop-shadow-[0_0_8px_rgba(255,133,80,0.45)] opacity-100"
                            : isPlayed
                            ? "text-white/50 font-medium"
                            : "text-white/25 font-medium hover:text-white/50"
                        }`}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/95 to-transparent" />
              </div>
            ) : (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <pre className="h-full overflow-y-auto text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-mono px-1 py-2 pb-16 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">{track.lyrics}</pre>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/95 to-transparent" />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/12 bg-white/2 px-3 py-3 text-sm text-white/45">
                No lyrics yet.
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {track.error && (
          <div className="shrink-0 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{track.error}</p>
          </div>
        )}
      </div>
    </div>
  );

  if (mode === "sidebar") {
    return (
      <div className="h-full w-full bg-[#0d0d12] overflow-hidden">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-[#0d0d12] border-l border-white/5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    </div>
  );
}
