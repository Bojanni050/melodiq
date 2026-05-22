"use client";

import { useRef, useEffect, useCallback } from "react";
import { usePlayerStore } from "@/lib/store";
import { useState } from "react";

let sharedAudioElement: HTMLAudioElement | null = null;

function FullscreenPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    setIsFullscreen,
    setVolume,
  } = usePlayerStore();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioElement = usePlayerStore((state) => state.audioElement);

  useEffect(() => {
    if (!audioElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime || 0);
      setDuration(audioElement.duration || 0);
    };

    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("loadedmetadata", handleTimeUpdate);

    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("loadedmetadata", handleTimeUpdate);
    };
  }, [audioElement]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioElement) {
        audioElement.currentTime = time;
        setCurrentTime(time);
      }
    },
    [audioElement]
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
    },
    [setVolume]
  );

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    const nextPlaying = !isPlaying;
    usePlayerStore.getState().setIsPlaying(nextPlaying);
  }, [currentTrack, isPlaying]);

  const handlePrevious = useCallback(() => {
    if (audioElement && audioElement.currentTime > 3) {
      audioElement.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    usePlayerStore.getState().playPrevious();
  }, [audioElement]);

  const handleNext = useCallback(() => {
    usePlayerStore.getState().playNext();
  }, []);

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const coverUrl = currentTrack?.coverUrl || (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);
  const lyrics = currentTrack?.lyrics || "";
  const lyricsLines = lyrics.split("\n").filter((line) => line.trim());
  
  // Verdeel lyrics in kolommen
  const getColumnCount = () => {
    if (lyricsLines.length <= 20) return 1;
    if (lyricsLines.length <= 40) return 2;
    return 3;
  };

  const columnCount = getColumnCount();
  const linesPerColumn = Math.ceil(lyricsLines.length / columnCount);

  const columns = Array.from({ length: columnCount }, (_, i) => {
    const start = i * linesPerColumn;
    const end = start + linesPerColumn;
    return lyricsLines.slice(start, end);
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden">
      {/* Diffuse background met ingezoomde album art */}
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-115 blur-[90px] opacity-45 saturate-150"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}

      {/* Fuzzy ambience layer */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,133,80,0.35),transparent_42%),radial-gradient(circle_at_82%_26%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_50%_78%,rgba(255,83,12,0.3),transparent_45%)] blur-3xl opacity-70" />
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />

      {/* Content */}
      <div className="relative h-full flex flex-col">
        {/* Header met close button */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFullscreen(false)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              title="Exit fullscreen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-semibold">
                {currentTrack?.title || currentTrack?.prompt.substring(0, 50) || "No track"}
              </h2>
              <p className="text-sm text-white/60 capitalize">
                {currentTrack ? `${currentTrack.provider} • ${currentTrack.providerModel}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center gap-12 px-12 pb-32 overflow-hidden">
          {/* Lyrics section - links */}
          <div className="flex-1 flex items-center justify-center">
            {lyrics ? (
              <div className={`grid gap-12 max-w-6xl w-full ${columnCount === 1 ? "grid-cols-1" : columnCount === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {columns.map((column, colIndex) => (
                  <div key={colIndex} className="space-y-2">
                    {column.map((line, lineIndex) => (
                      <p
                        key={lineIndex}
                        className="text-white/80 text-sm md:text-base leading-relaxed"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-lg">No lyrics available</p>
            )}
          </div>

          {/* Album art - rechts */}
          <div className="w-96 shrink-0">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Album art"
                className="w-full aspect-square rounded-2xl shadow-2xl shadow-black/50 object-cover"
              />
            ) : (
              <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10">
                <svg className="w-32 h-32 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Player controls onderaan */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-xl border-t border-white/10">
          <div className="px-8 py-6">
            {/* Progress bar */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm text-white/60 w-12 text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                disabled={!currentTrack}
                aria-label="Seek position"
                className="flex-1 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary-500 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
              />
              <span className="text-sm text-white/60 w-12">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={handlePrevious}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all"
                title="Previous"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 5h2v14H6zM9 12l10 7V5z" />
                </svg>
              </button>
              
              <button
                onClick={togglePlay}
                disabled={!currentTrack}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 hover:shadow-2xl hover:shadow-primary-500/50 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={handleNext}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all"
                title="Next"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 5h2v14h-2zM6 19l10-7L6 5z" />
                </svg>
              </button>

              {/* Volume control */}
              <div className="flex items-center gap-3 ml-8">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-24 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const requestIdRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvingUrl, setResolvingUrl] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setShowTrackDetailsPanel(false);
    }
  }, [setShowTrackDetailsPanel]);

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
    if (!sharedAudioElement) {
      sharedAudioElement = new Audio();
    }

    audioRef.current = sharedAudioElement;
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

    setCurrentTime(audioRef.current.currentTime || 0);
    setDuration(audioRef.current.duration || 0);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audioRef.current.removeEventListener("ended", handleEnded);
      }
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

  // Show fullscreen player when active
  if (isFullscreen && currentTrack) {
    return <FullscreenPlayer />;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80">
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
              onClick={() => setIsFullscreen(true)}
              disabled={!currentTrack}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Open fullscreen player"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
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
