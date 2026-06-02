"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { usePlayerStore, useUserStore } from "@/lib/store";
import type { Track } from "@/lib/store";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { parseLyrics } from "@/lib/parse-lyrics";
import FullscreenPlayer from "@/components/player/FullscreenPlayer";

export type AudioSource = "cache" | "s3" | "unknown";
export type AudioSourceState = "hit" | "miss" | "fallback" | "unknown";

export function AudioSourceBadge({ source }: { source: AudioSource; state: AudioSourceState }) {
  if (source === "unknown") return null;

  if (source === "cache") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-200"
        title="Playing from disk cache"
      >
        <span className="text-[11px] leading-none">⚡</span>
        Cached
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-200"
      title="Streaming from S3"
    >
      <span className="text-[11px] leading-none">☁</span>
      S3
    </span>
  );
}

declare global {
  interface Window {
    __melodiqSharedAudioElement?: HTMLAudioElement;
  }
}

function getSharedAudioElement() {
  if (typeof window === "undefined") return null;
  if (!window.__melodiqSharedAudioElement) {
    window.__melodiqSharedAudioElement = new Audio();
  }
  return window.__melodiqSharedAudioElement;
}

export function formatProviderLabel(provider: string) {
  const normalized = (provider || "").toLowerCase();
  if (normalized === "poyo") return "PoYo";
  if (normalized === "tempolor") return "Tempolor";
  if (normalized === "musicgpt") return "MusicGPT";
  if (normalized === "lyria") return "Lyria";
  if (normalized === "minimax") return "MiniMax";
  if (!provider) return "";
  return provider[0].toUpperCase() + provider.slice(1);
}

export type ActionTimestampRef = { current: number };

export function allowWithDelay(ref: ActionTimestampRef, delayMs: number) {
  const now = Date.now();
  if (now - ref.current < delayMs) return false;
  ref.current = now;
  return true;
}

export default function Player() {
  const {
    currentTrack,
    queue,
    history,
    isPlaying,
    volume,
    autoPlayNext,
    showTrackDetailsPanel,
    isFullscreen,
    playNext,
    playPrevious,
    setAutoPlayNext,
    setShowTrackDetailsPanel,
    setIsFullscreen,
    setVolume,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      queue: s.queue,
      history: s.history,
      isPlaying: s.isPlaying,
      volume: s.volume,
      autoPlayNext: s.autoPlayNext,
      showTrackDetailsPanel: s.showTrackDetailsPanel,
      isFullscreen: s.isFullscreen,
      playNext: s.playNext,
      playPrevious: s.playPrevious,
      setAutoPlayNext: s.setAutoPlayNext,
      setShowTrackDetailsPanel: s.setShowTrackDetailsPanel,
      setIsFullscreen: s.setIsFullscreen,
      setVolume: s.setVolume,
    }))
  );
  const { user, loadUser } = useUserStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playToggleCooldownRef = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const playCountedTrackIdRef = useRef<string | null>(null);
  const playCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const lastLoadedTrackIdRef = useRef<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioSource>("unknown");
  const [audioSourceState, setAudioSourceState] = useState<AudioSourceState>("unknown");
  const artistLabel = (user?.artistAlias || "").trim() || (user?.name || "").trim() || "";
  const cleanTitle = currentTrack?.title ? currentTrack.title.replace(/\s*\(2\)\s*$/, "") : "";

  const detectAudioSource = useCallback(async (streamUrl: string): Promise<{ source: AudioSource; state: AudioSourceState }> => {
    try {
      const response = await fetch(streamUrl, {
        headers: {
          Range: "bytes=0-0",
        },
      });

      if (!response.ok) return { source: "unknown", state: "unknown" };

      const cacheStateHeader = (response.headers.get("x-melodiq-audio-cache-state") || "").toLowerCase();
      const sourceHeader = (response.headers.get("x-melodiq-audio-source") || "").toLowerCase();
      if (sourceHeader === "cache") {
        return { source: "cache", state: cacheStateHeader === "miss" ? "miss" : "hit" };
      }
      if (sourceHeader === "s3") {
        return { source: "s3", state: cacheStateHeader === "fallback" ? "fallback" : "unknown" };
      }
      if (cacheStateHeader === "miss") return { source: "cache", state: "miss" };
      if (cacheStateHeader === "fallback") return { source: "s3", state: "fallback" };
      return { source: "unknown", state: "unknown" };
    } catch {
      return { source: "unknown", state: "unknown" };
    }
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setShowTrackDetailsPanel(false);
    }
  }, [setShowTrackDetailsPanel]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const tryPlay = useCallback(async () => {
    if (!audioRef.current) return;
    for (let i = 0; i < 3; i += 1) {
      try {
        await audioRef.current.play();
        return;
      } catch (error) {
        if (!(error instanceof DOMException)) {
          continue;
        }

        if (error.name === "NotAllowedError") {
          usePlayerStore.getState().setIsPlaying(false);
          return;
        }

        if (error.name !== "AbortError") {
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }
  }, []);

  useEffect(() => {
    const sharedAudioElement = getSharedAudioElement();
    if (!sharedAudioElement) return;

    audioRef.current = sharedAudioElement;
    audioRef.current.volume = volume;
    usePlayerStore.getState().setAudioElement(audioRef.current);

    const clearPlayTimer = () => {
      if (playCountTimerRef.current) {
        clearTimeout(playCountTimerRef.current);
        playCountTimerRef.current = null;
      }
    };

    const countPlayIfNeeded = () => {
      const trackId = currentTrackRef.current?.id;
      if (!trackId) return;
      if (playCountedTrackIdRef.current === trackId) return;
      if (playCountTimerRef.current) return;

      playCountTimerRef.current = setTimeout(() => {
        playCountTimerRef.current = null;
        
        const currentId = currentTrackRef.current?.id;
        if (!currentId || currentId !== trackId) return;
        if (playCountedTrackIdRef.current === trackId) return;
        
        playCountedTrackIdRef.current = trackId;

        void (async () => {
          try {
            const res = await fetch(`/api/tracks/${trackId}/play`, { method: "POST" });
            if (!res.ok) return;
            const data: unknown = await res.json().catch(() => null);
            const playCount =
              data && typeof data === "object" && "playCount" in data && typeof (data as { playCount?: unknown }).playCount === "number"
                ? (data as { playCount: number }).playCount
                : null;

            if (typeof playCount === "number") {
              usePlayerStore.setState((state) =>
                state.currentTrack?.id === trackId
                  ? { currentTrack: { ...state.currentTrack, playCount } }
                  : {}
              );
            }

            window.dispatchEvent(
              new CustomEvent("melodiq:track-played", {
                detail: { trackId, ...(typeof playCount === "number" ? { playCount } : {}) },
              })
            );
          } catch (error) {
            console.error("Failed to record play:", error);
          }
        })();
      }, 30_000);
    };

    const handleTimeUpdate = () => {
      const time = audioRef.current?.currentTime || 0;
      setCurrentTime(time);
      usePlayerStore.getState().setProgress(time);
    };

    const handleLoadedMetadata = () => {
      setDuration(audioRef.current?.duration || 0);
    };

    const handleEnded = () => {
      clearPlayTimer();
      const { autoPlayNext, queue, playNext, setIsPlaying, setProgress } = usePlayerStore.getState();
      if (autoPlayNext && queue.length > 0) {
        playNext();
        return;
      }

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      setProgress(0);
      setIsPlaying(false);
    };

    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current.addEventListener("ended", handleEnded);
    audioRef.current.addEventListener("playing", countPlayIfNeeded);
    audioRef.current.addEventListener("pause", clearPlayTimer);

    setCurrentTime(audioRef.current.currentTime || 0);
    setDuration(audioRef.current.duration || 0);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audioRef.current.removeEventListener("ended", handleEnded);
        audioRef.current.removeEventListener("playing", countPlayIfNeeded);
        audioRef.current.removeEventListener("pause", clearPlayTimer);
      }
      clearPlayTimer();
    };
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.id) return;
    const trackSnapshot = currentTrack;

    let cancelled = false;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    async function resolveAndLoad() {
      const trackId = trackSnapshot.id;
      const wantsHd = (trackSnapshot.audioUrl || "").includes("hd=true");

      const audioEl = audioRef.current;
      if (!audioEl) return;

      const streamUrl = `/api/tracks/${trackId}/stream${wantsHd ? "?hd=true" : ""}`;
      let resolvedUrl = streamUrl;

      setResolvingUrl(true);
      setAudioSource("unknown");
      setAudioSourceState("unknown");

      try {
        const response = await fetch(streamUrl, {
          headers: {
            Range: "bytes=0-0",
          },
        });

        if (response.ok) {
          const cacheStateHeader = (response.headers.get("x-melodiq-audio-cache-state") || "").toLowerCase();
          const sourceHeader = (response.headers.get("x-melodiq-audio-source") || "").toLowerCase();
          const source: AudioSource =
            sourceHeader === "cache" ? "cache" : sourceHeader === "s3" ? "s3" : "unknown";
          const state: AudioSourceState =
            cacheStateHeader === "miss"
              ? "miss"
              : cacheStateHeader === "fallback"
                ? "fallback"
                : cacheStateHeader === "hit"
                  ? "hit"
                  : sourceHeader === "cache"
                    ? "hit"
                    : "unknown";

          if (!cancelled && requestId === requestIdRef.current) {
            setAudioSource(source);
            setAudioSourceState(state);
          }
        } else {
          const hdFallback = wantsHd ? trackSnapshot.audioUrlHd : null;
          const fallback = hdFallback || trackSnapshot.audioUrl;
          if (typeof fallback === "string" && /^https?:\/\//i.test(fallback)) {
            resolvedUrl = fallback;
          }
        }
      } catch {
        const hdFallback = wantsHd ? trackSnapshot.audioUrlHd : null;
        const fallback = hdFallback || trackSnapshot.audioUrl;
        if (typeof fallback === "string" && /^https?:\/\//i.test(fallback)) {
          resolvedUrl = fallback;
        }
      }

      const normalizedTargetUrl = new URL(resolvedUrl, window.location.href).toString();
      const alreadyPlayingThisStream = typeof audioEl.src === "string" && audioEl.src === normalizedTargetUrl;

      const isInitialLoad = lastLoadedTrackIdRef.current === null;
      const shouldResumeTime = lastLoadedTrackIdRef.current === trackId;
      const storedProgress = usePlayerStore.getState().progress;
      const resumeTime = shouldResumeTime
        ? (audioEl.currentTime || 0)
        : (isInitialLoad && storedProgress > 0 ? storedProgress : 0);
      const shouldResume = usePlayerStore.getState().isPlaying && !audioEl.paused;

      if (alreadyPlayingThisStream) {
        lastLoadedTrackIdRef.current = trackId;
        setResolvingUrl(false);
        if (usePlayerStore.getState().isPlaying || shouldResume) {
          void tryPlay();
        }
        return;
      }

      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl.src = normalizedTargetUrl;
      audioEl.load();

      await new Promise<void>((resolve) => {
        if (audioRef.current !== audioEl) {
          resolve();
          return;
        }

        const done = () => resolve();
        audioEl.addEventListener("loadedmetadata", done, { once: true });
        audioEl.addEventListener("canplay", done, { once: true });
      });

      setResolvingUrl(false);

      if (cancelled || requestId !== requestIdRef.current || audioRef.current !== audioEl) {
        return;
      }

      lastLoadedTrackIdRef.current = trackId;

      if (resumeTime > 0) {
        try {
          audioEl.currentTime = resumeTime;
        } catch {}
      }

      if (usePlayerStore.getState().isPlaying || shouldResume) {
        void tryPlay();
      }
    }

    resolveAndLoad();

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack?.id,
    currentTrack?.audioUrl,
    currentTrack?.audioUrlHd,
    tryPlay,
  ]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        void tryPlay();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, tryPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!currentTrack) {
      setCurrentTime(0);
      setDuration(0);
      lastLoadedTrackIdRef.current = null;
      // Auto-play eerste uit queue als die bestaat
      if (queue.length > 0) {
        usePlayerStore.getState().playNext();
      }
    }
  }, [currentTrack, queue.length]);

  const togglePlay = useCallback(() => {
    if (!allowWithDelay(playToggleCooldownRef, 350)) return;
    if (!currentTrack && queue.length > 0) {
      usePlayerStore.getState().playNext();
      return;
    }

    if (!currentTrack) return;
    const nextPlaying = !isPlaying;
    usePlayerStore.getState().setIsPlaying(nextPlaying);
    if (nextPlaying && audioRef.current) {
      void tryPlay();
    }
  }, [currentTrack, isPlaying, queue.length]);

  const handlePrevious = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    playPrevious();
  }, [playPrevious]);

  const handleNext = useCallback(() => {
    playNext();
  }, [playNext]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    [audioRef]
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
    },
    [setVolume]
  );

  function getStatusString() {
    if (resolvingUrl) return "Loading audio...";
    if (!currentTrack) return "";

    const displayTitle = cleanTitle || currentTrack.prompt.substring(0, 50);
    const suffix = displayTitle ? ` • ${displayTitle}` : "";
    return `MelodIQ Player${suffix}`;
  }

  if (isFullscreen && currentTrack) {
    return <FullscreenPlayer audioSource={audioSource} audioSourceState={audioSourceState} />;
  }

  const isNowPlaying = currentTrack !== null;
  const nowPlayingQueue = currentTrack ? [currentTrack, ...queue] : queue;
  const playerCoverUrl = currentTrack?.coverUrl || (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);

  return (
    <>
      {/* Screen reader live region */}
      <div aria-live="polite" className="sr-only">
        {getStatusString()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#161621] border-t border-white/5 z-40 overflow-hidden">
        {playerCoverUrl ? (
          <div aria-hidden="true" className="absolute inset-0">
            <img
              src={playerCoverUrl}
              alt=""
              className="h-full w-full object-cover scale-125 blur-2xl opacity-45"
              draggable={false}
              onError={e => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = "/fallback-cover.svg";
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_45%),linear-gradient(135deg,rgba(22,22,33,0.65)_0%,rgba(22,22,33,0.92)_70%,rgba(22,22,33,0.98)_100%)]" />
          </div>
        ) : null}

        <div className="relative max-w-screen-2xl mx-auto h-full px-4 flex items-center gap-3">
          {/* Now Playing Info */}
          {currentTrack ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0" style={{ width: "240px" }}>
              <button
                onClick={() => setIsFullscreen(true)}
                className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-white/5"
                title="Go fullscreen"
              >
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={e => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = "/fallback-cover.svg";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </button>
              <div className="min-w-0">
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="block text-sm font-medium text-white/90 truncate w-full text-left hover:underline"
                  title={cleanTitle || currentTrack.prompt}
                >
                  {cleanTitle || currentTrack.prompt.substring(0, 50)}
                </button>
                <p className="text-xs text-white/40 truncate">
                  {artistLabel ? `${artistLabel} - ` : ""}{formatProviderLabel(currentTrack.provider)}
                  {currentTrack.duration ? ` • ${Math.floor(currentTrack.duration / 60)}:${String(Math.floor(currentTrack.duration % 60)).padStart(2, "0")}` : ""}
                </p>
                <div className="mt-0.5 -translate-y-0.5">
                  <AudioSourceBadge source={audioSource} state={audioSourceState} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0" style={{ width: "240px" }}>
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <span className="text-sm text-white/30">No track selected</span>
            </div>
          )}

          {/* Center Controls */}
          <div className="flex-1 flex items-center justify-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={!currentTrack}
              className="p-2 rounded-full text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
              title="Previous"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h2v14H6zM9 12l10 7V5z" />
              </svg>
            </button>

            <button
              onClick={togglePlay}
              disabled={!currentTrack}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all active:scale-95"
              title={isPlaying ? "Pause" : "Play"}
            >
              {resolvingUrl ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
              ) : isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleNext}
              disabled={queue.length === 0}
              className="p-2 rounded-full text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
              title="Next"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 5h2v14h-2zM6 19l10-7L6 5z" />
              </svg>
            </button>

            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-2 ml-2 min-w-0 max-w-72 flex-1">
              <span className="text-xs text-white/40 w-8 text-right tabular-nums">
                {duration > 0 ? `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, "0")}` : "0:00"}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                disabled={!currentTrack}
                aria-label="Seek position"
                className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary-500 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
              />
              <span className="text-xs text-white/40 w-8 tabular-nums">
                {duration > 0 ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}` : "0:00"}
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 flex-shrink-0" style={{ width: "240px" }}>
            {/* Queue info */}
            {queue.length > 0 && (
              <div className="hidden md:flex items-center gap-1 text-xs text-white/40 px-2 py-1 rounded-full bg-white/5" title={`${queue.length} tracks in queue`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
                </svg>
                {queue.length}
              </div>
            )}

            {/* Autoplay toggle */}
            <button
              type="button"
              onClick={() => setAutoPlayNext(!autoPlayNext)}
              className={`p-2 rounded-full transition-colors ${autoPlayNext ? "text-primary-400 hover:text-primary-300" : "text-white/30 hover:text-white/60"}`}
              title={autoPlayNext ? "Autoplay on" : "Autoplay off"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5l4 4-4 4" opacity="0.5" />
              </svg>
            </button>

            {/* Song details panel toggle */}
            <button
              type="button"
              onClick={() => setShowTrackDetailsPanel(!showTrackDetailsPanel)}
              className={`p-2 rounded-full transition-colors ${showTrackDetailsPanel ? "text-primary-400 hover:text-primary-300" : "text-white/30 hover:text-white/60"}`}
              title={showTrackDetailsPanel ? "Hide song details" : "Show song details"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3v18" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              disabled={!currentTrack}
              className="p-2 rounded-full text-white/40 hover:text-white/80 disabled:opacity-20 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            {/* Volume */}
            <div className="hidden lg:flex items-center gap-2 ml-1">
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 12a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolume}
                aria-label="Volume"
                className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary-500"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
