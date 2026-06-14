"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { usePlayerStore, useUserStore } from "@/lib/store";
import { parseLyrics, isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import { useSWRConfig } from "swr";
import {
  AudioSource,
  AudioSourceState,
  allowWithDelay,
  formatProviderLabel,
  AudioSourceBadge
} from "../Player";

export default function FullscreenPlayer({
  audioSource,
  audioSourceState
}: {
  audioSource: AudioSource;
  audioSourceState: AudioSourceState;
}) {
  const {
    currentTrack,
    isPlaying,
    volume,
    setIsFullscreen,
    setVolume,
  } = usePlayerStore();
  const { user, loadUser } = useUserStore();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioElement = usePlayerStore((state) => state.audioElement);
  const playToggleCooldownRef = useRef(0);
  const artistLabel = (currentTrack?.artistName || "").trim() || (user?.artistAlias || "").trim() || (user?.name || "").trim() || "";
  const composerLabel = (currentTrack?.composerName || "").trim() || (user?.composerAlias || "").trim() || "";
  const cleanTitle = currentTrack?.title ? currentTrack.title.replace(/\s*\(2\)\s*$/, "") : "";

  const { mutate } = useSWRConfig();

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // central self-healing polling loop inside FullscreenPlayer
  useEffect(() => {
    if (!currentTrack || currentTrack.status !== "done" || currentTrack.provider !== "poyo") return;

    const hasTimings = currentTrack.lyricsTimestamps && !isLyricsTaskSubmission(currentTrack.lyricsTimestamps)
      ? parseLyrics(currentTrack.lyrics ?? null, currentTrack.lyricsTimestamps).some((line) => line.startTime >= 0)
      : false;

    // We only poll if it has NO timings, OR if it's currently a task submission receipt
    const needsPolling = !hasTimings || isLyricsTaskSubmission(currentTrack.lyricsTimestamps);
    if (!needsPolling) return;

    console.log(`[TCL-Sync] FullscreenPlayer started polling for track ${currentTrack.id}`);
    
    let pollCount = 0;
    const maxPolls = 15; // 15 polls * 5 seconds = 75 seconds max
    let active = true;
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/tracks/${currentTrack.id}`);
        if (!res.ok) return;
        const updatedTrack = await res.json();

        if (!active) return;

        if (updatedTrack && updatedTrack.lyricsTimestamps !== currentTrack.lyricsTimestamps) {
          const updatedHasTimings = updatedTrack.lyricsTimestamps && !isLyricsTaskSubmission(updatedTrack.lyricsTimestamps)
            ? parseLyrics(updatedTrack.lyrics ?? null, updatedTrack.lyricsTimestamps).some((line) => line.startTime >= 0)
            : false;

          console.log(`[TCL-Sync] FullscreenPlayer fetched update. Has Timings: ${updatedHasTimings}`);

          // Update player store instantly so fullscreen view starts tracking
          usePlayerStore.getState().syncTrackSnapshots([updatedTrack]);

          // Update SWR global list so other components/lists are reactively aware
          void mutate("/api/tracks");

          // If we finally got real timings, stop polling
          if (updatedHasTimings) {
            console.log(`[TCL-Sync] FullscreenPlayer polling finished successfully for track ${currentTrack.id}`);
            return;
          }
        }
      } catch (err: any) {
        console.error(`[TCL-Sync] FullscreenPlayer polling error:`, err?.message ?? err);
      }

      pollCount++;
      if (pollCount < maxPolls && active) {
        timerId = setTimeout(poll, 5000);
      } else if (pollCount >= maxPolls) {
        console.log(`[TCL-Sync] FullscreenPlayer stopped polling: hit max retries for track ${currentTrack.id}`);
      }
    };

    timerId = setTimeout(poll, 2000); // start first poll after 2 seconds

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [currentTrack?.id, currentTrack?.lyricsTimestamps, mutate]);

  const parsedLyrics = useMemo(() => {
    return parseLyrics(currentTrack?.lyrics ?? null, currentTrack?.lyricsTimestamps);
  }, [currentTrack]);

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
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && activeLineRef.current) {
      const container = containerRef.current;
      const activeEl = activeLineRef.current;
      
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
  }, [currentTrack?.id]);

  const handleLineClick = useCallback((startTime: number) => {
    if (startTime >= 0 && audioElement) {
      audioElement.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [audioElement]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setIsFullscreen]);

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

  const coverUrl = currentTrack?.coverUrl || (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);
  const lyrics = currentTrack?.lyrics || "";
  const lyricsLines = lyrics.split("\n").filter((line) => line.trim());
  const showLyrics = lyricsLines.length > 0;
  
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
    <div className="fixed top-0 left-0 right-0 bottom-16 z-[50] bg-black overflow-hidden">
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-115 blur-[90px] opacity-45 saturate-150"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,133,80,0.35),transparent_42%),radial-gradient(circle_at_82%_26%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_50%_78%,rgba(255,83,12,0.3),transparent_45%)] blur-3xl opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />
      <div className="relative h-full flex flex-col">
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
                {cleanTitle || currentTrack?.prompt.substring(0, 50) || "No track"}
              </h2>
              <p className="text-sm text-white/60 capitalize">
                {currentTrack
                  ? `${artistLabel ? `${artistLabel} — ` : ""}${composerLabel ? `composer: ${composerLabel} — ` : ""}${formatProviderLabel(currentTrack.provider)} • ${currentTrack.providerModel}`
                  : ""}
              </p>
              <div className="mt-2">
                <AudioSourceBadge source={audioSource} state={audioSourceState} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 px-4 sm:px-6 lg:px-12 overflow-y-auto lg:overflow-hidden">
          {showLyrics ? (
            <div className="flex flex-col lg:flex-row items-center gap-8 w-full max-w-6xl">
              {/* Cover art - rendered above lyrics on mobile, right of lyrics on desktop */}
              <div className="w-48 h-48 sm:w-64 sm:h-64 lg:w-[calc(var(--spacing)_*_150)] lg:h-[calc(var(--spacing)_*_150)] lg:shrink-0 order-1 lg:order-2 flex items-center justify-center">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Album art"
                    className="w-full aspect-square rounded-2xl shadow-2xl shadow-black/50 object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10">
                    <svg className="w-20 h-20 lg:w-32 lg:h-32 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Lyrics - rendered below cover on mobile, left of cover on desktop */}
              <div className="flex-1 w-full order-2 lg:order-1 flex items-center justify-center h-[320px] sm:h-[480px] lg:h-[580px] xl:h-[640px]">
                {hasTimings ? (
                  <div
                    ref={containerRef}
                    className="w-full h-full overflow-y-auto px-4 py-32 space-y-6 md:space-y-8 scroll-smooth flex flex-col items-center lg:items-start text-center lg:text-left relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {parsedLyrics.map((line, index) => {
                      const isActive = index === activeLineIndex;
                      const isPlayed = index < activeLineIndex;

                      return (
                        <div
                          key={index}
                          ref={isActive ? activeLineRef : null}
                          onClick={() => handleLineClick(line.startTime)}
                          className={`cursor-pointer transition-all duration-500 origin-center lg:origin-left py-1 text-sm sm:text-lg md:text-xl lg:text-2xl leading-relaxed ${
                            isActive
                              ? "text-primary-400 font-bold scale-105 filter drop-shadow-[0_0_12px_rgba(255,133,80,0.45)] opacity-100"
                              : isPlayed
                              ? "text-white/45 font-medium hover:text-white/80"
                              : "text-white/20 font-medium hover:text-white/60"
                          }`}
                        >
                          {line.text}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="w-full h-full overflow-y-auto px-4 pr-2 scroll-smooth [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [-ms-overflow-style:none]">
                    <div className={`grid gap-6 lg:gap-12 w-full ${columnCount === 1 ? "grid-cols-1" : columnCount === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}>
                      {columns.map((column, colIndex) => (
                        <div key={colIndex} className="space-y-2 text-center lg:text-left">
                          {column.map((line, lineIndex) => (
                            <p
                              key={lineIndex}
                              className="text-white/80 text-xs sm:text-sm md:text-base leading-relaxed"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Album art"
                  className="w-48 h-48 sm:w-64 sm:h-64 lg:w-[calc(var(--spacing)_*_150)] lg:h-[calc(var(--spacing)_*_150)] rounded-3xl shadow-2xl shadow-black/60 object-cover animate-[pulse_4s_ease-in-out_infinite]"
                />
              ) : (
                <div className="w-48 h-48 sm:w-64 sm:h-64 lg:w-[calc(var(--spacing)_*_150)] lg:h-[calc(var(--spacing)_*_150)] rounded-3xl bg-gradient-to-br from-primary-600/25 to-primary-800/25 flex items-center justify-center border border-white/10 animate-[pulse_4s_ease-in-out_infinite]">
                  <svg className="w-20 h-20 lg:w-32 lg:h-32 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
              <h3 className="mt-4 sm:mt-6 text-lg sm:text-2xl md:text-3xl font-semibold text-white/90 animate-[pulse_4s_ease-in-out_infinite]">
                {cleanTitle || currentTrack?.prompt.substring(0, 50) || "No track"}
              </h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
