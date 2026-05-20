"use client";

import { useRef, useEffect, useCallback } from "react";
import { usePlayerStore } from "@/lib/store";
import { useState } from "react";

export default function Player() {
  const {
    currentTrack,
    queue,
    history,
    isPlaying,
    volume,
    autoPlayNext,
    showTrackDetailsPanel,
    playNext,
    playPrevious,
    setAutoPlayNext,
    setShowTrackDetailsPanel,
  } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const requestIdRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvingUrl, setResolvingUrl] = useState(false);

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
          // Browser autoplay policies can block play() calls without a recent user gesture.
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

  const getAudioUrl = useCallback(async (trackId: string, hd = false): Promise<string> => {
    const cacheKey = hd ? `${trackId}:hd` : trackId;
    const cached = urlCacheRef.current.get(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(`/api/tracks/${trackId}/stream${hd ? "?hd=true" : ""}`);
      if (!res.ok) {
        return `/api/tracks/${trackId}/download${hd ? "?hd=true" : ""}`;
      }

      const data = await res.json();
      const url = data?.url;
      if (!url || typeof url !== "string") {
        return `/api/tracks/${trackId}/download${hd ? "?hd=true" : ""}`;
      }

      urlCacheRef.current.set(cacheKey, url);
      setTimeout(() => {
        urlCacheRef.current.delete(cacheKey);
      }, 240_000);

      return url;
    } catch {
      return `/api/tracks/${trackId}/download${hd ? "?hd=true" : ""}`;
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      usePlayerStore.getState().setAudioElement(audioRef.current);

      const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };

      const handleLoadedMetadata = () => {
        setDuration(audioRef.current?.duration || 0);
      };

      const handleEnded = () => {
        const { autoPlayNext, queue, playNext, setIsPlaying } = usePlayerStore.getState();
        if (autoPlayNext && queue.length > 0) {
          playNext();
          return;
        }

        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
        setCurrentTime(0);
        setIsPlaying(false);
      };

      audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
      audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
      audioRef.current.addEventListener("ended", handleEnded);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
          audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
          audioRef.current.removeEventListener("ended", handleEnded);
        }
        usePlayerStore.getState().setAudioElement(null);
      };
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.id) return;
    const trackSnapshot = currentTrack;

    let cancelled = false;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    async function resolveAndLoad() {
      const trackId = trackSnapshot.id;
      const trackUrl = trackSnapshot.audioUrl || "";
      const wantsHd = trackUrl.includes("hd=true");

      const audioEl = audioRef.current;
      if (!audioEl) return;

      const fallbackUrl = trackUrl || `/api/tracks/${trackId}/download${wantsHd ? "?hd=true" : ""}`;
      const fallbackAbs = new URL(fallbackUrl, window.location.href).href;

      if (audioEl.src !== fallbackAbs) {
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.src = fallbackUrl;
        audioEl.load();
      }

      if (usePlayerStore.getState().isPlaying) {
        void tryPlay();
      }

      const shouldResolve =
        fallbackUrl.startsWith("/api/") || fallbackUrl.includes("/download");
      if (!shouldResolve) {
        setResolvingUrl(false);
        return;
      }

      setResolvingUrl(true);
      const resolvedUrl = await getAudioUrl(trackId, wantsHd);
      if (cancelled || requestId !== requestIdRef.current || audioRef.current !== audioEl) {
        return;
      }

      setResolvingUrl(false);

      const resolvedAbs = new URL(resolvedUrl, window.location.href).href;
      if (audioEl.src === resolvedAbs) return;

      const resumeTime = audioEl.currentTime || 0;
      const shouldResume = usePlayerStore.getState().isPlaying && !audioEl.paused;

      audioEl.src = resolvedUrl;
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

      if (cancelled || requestId !== requestIdRef.current || audioRef.current !== audioEl) {
        return;
      }

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
  }, [currentTrack?.id, currentTrack?.audioUrl, getAudioUrl, tryPlay]);

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
    }
  }, [currentTrack]);

  const togglePlay = useCallback(() => {
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
    []
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      usePlayerStore.getState().setVolume(vol);
    },
    []
  );

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={handlePrevious}
              disabled={history.length === 0 && currentTime <= 3}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous track"
              aria-label="Previous track"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h2v14H6zM9 12l10 7V5z" />
              </svg>
            </button>
            <button
              onClick={togglePlay}
              disabled={resolvingUrl || (!currentTrack && queue.length === 0)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 hover:shadow-lg hover:shadow-primary-500/50 active:scale-90 flex items-center justify-center transition-all shrink-0"
            >
              {resolvingUrl ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleNext}
              disabled={queue.length === 0}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next track"
              aria-label="Next track"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 5h2v14h-2zM6 19l10-7L6 5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowTrackDetailsPanel(!showTrackDetailsPanel)}
              className={`sm:hidden w-8 h-8 rounded-full border transition-colors flex items-center justify-center shrink-0 ${
                showTrackDetailsPanel
                  ? "bg-primary-500/15 border-primary-500/40 text-primary-200"
                  : "bg-white/5 border-white/10 text-white/45"
              }`}
              title="Show or hide track details"
              aria-label="Toggle track details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {currentTrack
                  ? currentTrack.title || currentTrack.prompt.substring(0, 40)
                  : queue.length > 0
                    ? "Ready to play queue"
                    : "Nothing playing"}
              </p>
              <p className="text-xs text-white/50 capitalize">
                {currentTrack
                  ? `${currentTrack.provider} • ${currentTrack.providerModel}`
                  : queue.length > 0
                    ? `${queue.length} track${queue.length === 1 ? "" : "s"} queued`
                    : "Choose a track from your library"}
              </p>
              {queue.length > 0 && (
                <p className="text-[11px] text-primary-300/90 truncate">
                  Up next: {queue[0].title || queue[0].prompt.substring(0, 28)} (+{queue.length - 1})
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 max-w-md flex items-center gap-2">
            <span className="text-xs text-white/40 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={!currentTrack}
              title="Seek"
              aria-label="Seek playback"
              className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary-500"
            />
            <span className="text-xs text-white/40 w-10">
              {formatTime(duration)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoPlayNext(!autoPlayNext)}
              className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                autoPlayNext
                  ? "bg-primary-500/15 border-primary-500/40 text-primary-200"
                  : "bg-white/5 border-white/10 text-white/45 hover:text-white/65"
              }`}
              title="Auto play next track"
            >
              Autoplay {autoPlayNext ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={() => setShowTrackDetailsPanel(!showTrackDetailsPanel)}
              className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                showTrackDetailsPanel
                  ? "bg-primary-500/15 border-primary-500/40 text-primary-200"
                  : "bg-white/5 border-white/10 text-white/45 hover:text-white/65"
              }`}
              title="Show or hide the right track details panel"
              aria-label="Toggle right track details panel"
            >
              Details {showTrackDetailsPanel ? "On" : "Off"}
            </button>
            <span className="hidden md:inline text-[10px] text-white/35">
              Auto-opens right panel for current song
            </span>
            <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 12a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolume}
              title="Volume"
              aria-label="Volume"
              className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
