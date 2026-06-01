"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useUserStore, usePlayerStore } from "@/lib/store";
import { parseLyrics } from "@/lib/parse-lyrics";

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
  };
  onClose: () => void;
  onPlay: (url: string) => void;
  onDownload: (url: string, hd: boolean) => void;
  mode?: "overlay" | "sidebar";
}

export default function TrackDetail({ track, onClose, onPlay, onDownload, mode = "overlay" }: TrackDetailProps) {
  const [downloading, setDownloading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [currentRating, setCurrentRating] = useState<string | null>(track.rating ?? null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const { user, loadUser } = useUserStore();
  const { currentTrack, audioElement } = usePlayerStore();
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

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

  const title = (track.title || track.prompt.substring(0, 60)).replace(/\s*\(2\)\s*$/, "");
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
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0d0d12]/95 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60">Track Details</h3>
        <button onClick={onClose} className="text-white/50 hover:text-white" title="Close details">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Artwork */}
      <div className="aspect-square relative bg-linear-to-br from-primary-500/20 to-[#ff530c]/20 overflow-hidden">
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
      </div>

      {/* Info */}
      <div className="px-6 py-4 space-y-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-white/40 mt-1">
            {artistLabel ? `${artistLabel} - ` : ""}{providerLabel} • {providerModelLabel}
            {track.duration && (
              <span className="ml-2 text-white/30">• {formatDuration(track.duration)}</span>
            )}
          </p>
          {isUploadedTrack && (
            <span className="mt-2 inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
              Uploaded file
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {track.status === "done" && track.audioUrl && (
            <>
              <button
                onClick={() => onPlay(track.audioUrl!)}
                className="flex-1 btn-primary py-2.5 text-sm"
              >
                Play
              </button>
              <button
                onClick={() => handleDownload(track.audioUrl!)}
                disabled={downloading}
                className="btn-secondary text-sm px-3 py-2.5"
              >
                {mp3Label}
              </button>
              {track.s3KeyHd && track.audioUrlHd && (
                <button
                  onClick={() => handleDownload(track.audioUrlHd!, true)}
                  disabled={downloading}
                  className="btn-secondary text-sm px-3 py-2.5"
                >
                  {wavLabel}
                </button>
              )}
            </>
          )}
        </div>

        {/* Rating */}
        {track.status === "done" && (
          <div className="flex items-center justify-center gap-3 py-2">
            <button
              onClick={() => handleRating("up")}
              disabled={ratingLoading}
              className={`group relative p-3 rounded-xl transition-all duration-200 ${
                currentRating === "up"
                  ? "text-green-400"
                  : "text-white/40 hover:text-green-300"
              }`}
              style={{
                boxShadow: currentRating === "up"
                  ? "inset -2px -2px 6px rgba(74, 222, 128, 0.1), inset 2px 2px 6px rgba(0, 0, 0, 0.4)"
                  : "-2px -2px 6px rgba(255, 255, 255, 0.05), 2px 2px 6px rgba(0, 0, 0, 0.3)",
              }}
              title="Thumbs up"
              aria-label="Rate track positive"
            >
              <svg className="w-5 h-5" fill={currentRating === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>
            <button
              onClick={() => handleRating("down")}
              disabled={ratingLoading}
              className={`group relative p-3 rounded-xl transition-all duration-200 ${
                currentRating === "down"
                  ? "text-red-400"
                  : "text-white/40 hover:text-red-300"
              }`}
              style={{
                boxShadow: currentRating === "down"
                  ? "inset -2px -2px 6px rgba(248, 113, 113, 0.1), inset 2px 2px 6px rgba(0, 0, 0, 0.4)"
                  : "-2px -2px 6px rgba(255, 255, 255, 0.05), 2px 2px 6px rgba(0, 0, 0, 0.3)",
              }}
              title="Thumbs down"
              aria-label="Rate track negative"
            >
              <svg className="w-5 h-5" fill={currentRating === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </div>
        )}

        {/* Prompt */}
        <div>
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
            <p className="text-sm text-white/35 leading-relaxed line-clamp-2">
              Prompttext ingeklapt. Klik op Prompt om de volledige tekst te zien.
            </p>
          )}
        </div>

        {/* Lyrics */}
        {track.lyrics && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Lyrics {hasTimings && <span className="text-[10px] text-blue-400 font-medium px-1.5 py-0.5 rounded border border-blue-400/20 bg-blue-400/5 normal-case ml-1.5">TCL synced</span>}
              </h4>
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
            </div>
            {hasTimings ? (
              <div
                ref={containerRef}
                className="max-h-[350px] overflow-y-auto pr-1 py-12 scroll-smooth space-y-4 relative [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full"
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
            ) : (
              <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-mono">{track.lyrics}</pre>
            )}
          </div>
        )}

        {/* Error */}
        {track.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{track.error}</p>
          </div>
        )}
      </div>
    </>
  );

  if (mode === "sidebar") {
    return (
      <div className="h-full w-full bg-[#0d0d12] overflow-y-auto">
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
