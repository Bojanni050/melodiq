"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { usePlayerStore, useUserStore } from "@/lib/store";
import { parseLyrics, isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import { useSWRConfig } from "swr";
import dynamic from "next/dynamic";
import {
  AudioSource,
  AudioSourceState,
  allowWithDelay,
  formatProviderLabel,
  AudioSourceBadge,
} from "./playerUtils";

const AudioVisualizer = dynamic(() => import("./AudioVisualizer"), { ssr: false });

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
    visualizerEnabled,
    visualizerMode,
    visualizerGradient,
    setVisualizerEnabled,
    setVisualizerMode,
    setVisualizerGradient,
  } = usePlayerStore();
  const { user, loadUser } = useUserStore();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgZoom, setBgZoom] = useState(() => {
    try { return localStorage.getItem("melodiq-fs-bgzoom") !== "off"; } catch { return true; }
  });
  const [controlsVisible, setControlsVisible] = useState(true);
  const [lyricsVisible, setLyricsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElement = usePlayerStore((state) => state.audioElement);

  // Crossfade on track switch: snapshot the outgoing track's visual and let it
  // fade out on top of the (already fully rendered) incoming track, instead of
  // blanking out and fading the new content back in.
  type TrackVisual = { coverUrl: string | null; title: string; artist: string; publishDate?: string; writerName?: string; composerName?: string };
  const [outgoingVisual, setOutgoingVisual] = useState<TrackVisual | null>(null);
  const [outgoingFading, setOutgoingFading] = useState(false);
  const lastTrackIdRef = useRef<string | null>(null);
  const lastVisualRef = useRef<TrackVisual | null>(null);
  const outgoingTimersRef = useRef<{ raf: number | null; timeout: ReturnType<typeof setTimeout> | null }>({ raf: null, timeout: null });

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 10000);
  }, []);

  useEffect(() => {
    showControls();
    window.addEventListener("mousemove", showControls);
    window.addEventListener("keydown", showControls);
    return () => {
      window.removeEventListener("mousemove", showControls);
      window.removeEventListener("keydown", showControls);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showControls]);
  const playToggleCooldownRef = useRef(0);
  const artistLabel = (currentTrack?.artistName || "").trim() || (user?.artistAlias || "").trim() || (user?.name || "").trim() || "";
  const composerLabel = (currentTrack?.composerName || "").trim() || (user?.composerAlias || "").trim() || "";
  const writerLabel = (currentTrack?.writerName || "").trim() || (user?.writerAlias || "").trim() || "";
  const creditsLabel = [
    writerLabel ? `Lyrics: ${writerLabel}` : "",
    composerLabel ? `Composed by ${composerLabel}` : "",
  ].filter(Boolean).join(" / ");
  const cleanTitle = currentTrack?.title ? currentTrack.title.replace(/\s*\(2\)\s*$/, "") : "";

  const { mutate } = useSWRConfig();

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // central self-healing polling loop inside FullscreenPlayer
  useEffect(() => {
    if (!currentTrack || currentTrack.status !== "done" || (currentTrack.provider !== "poyo" && currentTrack.provider !== "apimart") || currentTrack.instrumental) return;

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

  useEffect(() => {
    const trackId = currentTrack?.id ?? null;
    const visual: TrackVisual = { 
      coverUrl, 
      title: cleanTitle || currentTrack?.prompt.substring(0, 50) || "", 
      artist: artistLabel,
      publishDate: currentTrack?.publishDate ?? undefined,
      writerName: currentTrack?.writerName ?? undefined,
      composerName: currentTrack?.composerName ?? undefined
    };
    if (lastTrackIdRef.current && trackId && lastTrackIdRef.current !== trackId && lastVisualRef.current) {
      if (outgoingTimersRef.current.raf) cancelAnimationFrame(outgoingTimersRef.current.raf);
      if (outgoingTimersRef.current.timeout) clearTimeout(outgoingTimersRef.current.timeout);
      setOutgoingVisual(lastVisualRef.current);
      setOutgoingFading(false);
      outgoingTimersRef.current.raf = requestAnimationFrame(() => setOutgoingFading(true));
      outgoingTimersRef.current.timeout = setTimeout(() => setOutgoingVisual(null), 700);
    }
    lastTrackIdRef.current = trackId;
    lastVisualRef.current = visual;
  }, [currentTrack?.id, coverUrl, cleanTitle, artistLabel]);

  useEffect(() => {
    return () => {
      if (outgoingTimersRef.current.raf) cancelAnimationFrame(outgoingTimersRef.current.raf);
      if (outgoingTimersRef.current.timeout) clearTimeout(outgoingTimersRef.current.timeout);
    };
  }, []);

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

  const VIZ_MODES = [
    { value: 0,  label: "Discrete" },
    { value: 2,  label: "Bars" },
    { value: 6,  label: "Wide Bars" },
    { value: 10, label: "Line" },
  ];
  const VIZ_GRADIENTS = [
    { value: "prism",     label: "Prism" },
    { value: "classic",   label: "Classic" },
    { value: "rainbow",   label: "Rainbow" },
    { value: "orangered", label: "Orange Red" },
    { value: "steelblue", label: "Steel Blue" },
    { value: "cover",     label: "Cover Art" },
  ];

  const cycleMode = (dir: 1 | -1) => {
    const idx = VIZ_MODES.findIndex((m) => m.value === visualizerMode);
    const next = VIZ_MODES[(idx + dir + VIZ_MODES.length) % VIZ_MODES.length];
    setVisualizerMode(next.value);
  };
  const cycleGradient = (dir: 1 | -1) => {
    const idx = VIZ_GRADIENTS.findIndex((g) => g.value === visualizerGradient);
    const next = VIZ_GRADIENTS[(idx + dir + VIZ_GRADIENTS.length) % VIZ_GRADIENTS.length];
    setVisualizerGradient(next.value);
  };
  const currentModeLabel = VIZ_MODES.find((m) => m.value === visualizerMode)?.label ?? "Bars";
  const currentGradientLabel = VIZ_GRADIENTS.find((g) => g.value === visualizerGradient)?.label ?? "Prism";

  const toggleBgZoom = () => {
    setBgZoom((v) => {
      const next = !v;
      try { localStorage.setItem("melodiq-fs-bgzoom", next ? "on" : "off"); } catch {}
      return next;
    });
  };

  const swipeTouchStartX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
    swipeTouchStartX.current = null;
    if (Math.abs(dx) < 60) return; // minimum swipe distance
    if (dx < 0) {
      usePlayerStore.getState().playNext();
    } else {
      usePlayerStore.getState().playPrevious();
    }
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 bottom-16 z-[50] bg-black overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @keyframes fsZoom {
          0%, 100% { transform: scale(1.15); }
          50% { transform: scale(1.32); }
        }
      `}</style>
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-[120px] opacity-60 saturate-[2.5]"
          style={{
            backgroundImage: `url(${coverUrl})`,
            transform: bgZoom ? undefined : "scale(1.25)",
            animation: bgZoom ? "fsZoom 22s ease-in-out infinite" : undefined,
          }}
        />
      )}
      {outgoingVisual?.coverUrl && (
        <div
          className={`absolute inset-0 bg-cover bg-center blur-[120px] opacity-60 saturate-[2.5] transition-opacity duration-700 ease-out ${outgoingFading ? "opacity-0" : "opacity-100"}`}
          style={{ backgroundImage: `url(${outgoingVisual.coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,133,80,0.35),transparent_42%),radial-gradient(circle_at_82%_26%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_50%_78%,rgba(255,83,12,0.3),transparent_45%)] blur-3xl opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />
      <div className="relative h-full flex flex-col">
        <div className={`flex items-center justify-between px-6 py-4 transition-opacity duration-700 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
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
            <button
              onClick={toggleBgZoom}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${bgZoom ? "bg-white/20 text-white" : "bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70"}`}
              title={bgZoom ? "Disable background zoom" : "Enable background zoom"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
              </svg>
            </button>
            <button
              onClick={() => setVisualizerEnabled(!visualizerEnabled)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${visualizerEnabled ? "bg-white/20 text-white" : "bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70"}`}
              title={visualizerEnabled ? "Disable visualizer" : "Enable visualizer"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l2 3 2-6 2 8 2-4 2 6" />
              </svg>
            </button>
            <button
              onClick={() => setLyricsVisible((v) => !v)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${lyricsVisible ? "bg-white/20 text-white" : "bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70"}`}
              title={lyricsVisible ? "Hide lyrics" : "Show lyrics"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h6M7 8h10M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-semibold">
                {cleanTitle || currentTrack?.prompt.substring(0, 50) || "No track"}
              </h2>
              {artistLabel && <p className="text-sm text-white/60">{artistLabel}</p>}
              {creditsLabel && <p className="text-xs text-white/45">{creditsLabel}</p>}
              {currentTrack && <p className="text-xs text-white/40 capitalize">{formatProviderLabel(currentTrack.provider)} • {currentTrack.providerModel}</p>}
              <div className="mt-2">
                <AudioSourceBadge source={audioSource} state={audioSourceState} />
              </div>
            </div>
          </div>
        </div>
        <div className={`relative flex-1 min-h-0 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 overflow-y-auto lg:overflow-hidden gap-6 ${visualizerEnabled ? "pb-36" : ""}`}>

          {/* Outgoing track snapshot, fading out on top of the (already visible) new content */}
          {outgoingVisual && (
            <div
              className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-xl pointer-events-none transition-opacity duration-700 ease-out ${outgoingFading ? "opacity-0" : "opacity-100"}`}
            >
              <div className="w-72 h-72 sm:w-96 sm:h-96 md:w-[26rem] md:h-[26rem] lg:w-[30rem] lg:h-[30rem] relative">
                {outgoingVisual.coverUrl ? (
                  <img src={outgoingVisual.coverUrl} alt="" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50 [-webkit-box-reflect:below_2px_linear-gradient(to_bottom,transparent,transparent_60%,rgba(0,0,0,0.4))]" />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 border border-white/10" />
                )}
              </div>
              <div className="text-center mt-4">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white/90 leading-snug">{outgoingVisual.title}</h3>
                {outgoingVisual.artist && <p className="mt-1 text-sm sm:text-base text-white/50">{outgoingVisual.artist}</p>}
                {outgoingVisual.publishDate && (
                  <p className="mt-1 text-xs text-white/40">
                    {new Date(outgoingVisual.publishDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                )}
                {outgoingVisual.writerName && <p className="mt-1 text-xs text-white/40">Written by {outgoingVisual.writerName}</p>}
                {outgoingVisual.composerName && <p className="mt-0.5 text-xs text-white/40">Composed by {outgoingVisual.composerName}</p>}
              </div>
            </div>
          )}

          {/* Cover art when no lyrics or lyrics hidden */}
          {(!showLyrics || !lyricsVisible) && (
            <div className="shrink-0 flex flex-col items-center justify-center gap-4 transition-all duration-500">
              <div className="w-72 h-72 sm:w-96 sm:h-96 md:w-[26rem] md:h-[26rem] lg:w-[30rem] lg:h-[30rem] relative transition-all duration-500">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Album art"
                    className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50 [-webkit-box-reflect:below_2px_linear-gradient(to_bottom,transparent,transparent_60%,rgba(0,0,0,0.4))]"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10">
                    <svg className="w-16 h-16 lg:w-24 lg:h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="text-center mt-4">
                <h3 className={`font-semibold text-white/90 leading-snug transition-all duration-500 ${showLyrics && lyricsVisible ? "text-base sm:text-lg lg:text-xl" : "text-xl sm:text-2xl md:text-3xl"}`}>
                  {cleanTitle || currentTrack?.prompt.substring(0, 50) || "No track"}
                </h3>
                {artistLabel && <p className={`mt-1 text-white/50 transition-all duration-500 ${showLyrics && lyricsVisible ? "text-sm" : "text-sm sm:text-base"}`}>{artistLabel}</p>}
                {currentTrack?.publishDate && (
                  <p className="mt-1 text-xs text-white/40">
                    {new Date(currentTrack.publishDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                )}
                {writerLabel && <p className="mt-1 text-xs text-white/40">Written by {writerLabel}</p>}
                {composerLabel && <p className="mt-0.5 text-xs text-white/40">Composed by {composerLabel}</p>}
              </div>
            </div>
          )}

          {/* Lyrics */}
          {showLyrics && lyricsVisible && (
            <div className="flex-1 w-full flex items-stretch justify-center min-h-0 h-full">
              {hasTimings ? (
                /* Timed: cover art on left, lyrics scrolling on right */
                <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-6 lg:gap-16 w-full h-full max-w-[1600px] px-4 py-8">
                  <div className="shrink-0 flex flex-col items-center justify-center gap-4 min-h-0">
                    <div className="w-56 h-56 sm:w-64 sm:h-64 lg:w-[420px] lg:h-[420px] xl:w-[480px] xl:h-[480px] relative transition-all duration-500">
                      {coverUrl ? (
                        <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50 [-webkit-box-reflect:below_2px_linear-gradient(to_bottom,transparent,transparent_60%,rgba(0,0,0,0.4))]" />
                      ) : (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10">
                          <svg className="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-center max-w-sm mt-4">
                      <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white/90 leading-snug">
                        {cleanTitle || currentTrack?.prompt.substring(0, 50) || "No track"}
                      </h3>
                      {artistLabel && <p className="mt-1 text-base lg:text-lg text-white/50">{artistLabel}</p>}
                      {currentTrack?.publishDate && (
                        <p className="mt-1 text-xs lg:text-sm text-white/40">
                          {new Date(currentTrack.publishDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                      )}
                      {writerLabel && <p className="mt-1 text-xs lg:text-sm text-white/40">Written by {writerLabel}</p>}
                      {composerLabel && <p className="mt-0.5 text-xs lg:text-sm text-white/40">Composed by {composerLabel}</p>}
                      {currentTrack?.providerModel && (
                        <p className="mt-1 text-xs lg:text-sm text-white/35 font-mono">{currentTrack.providerModel}</p>
                      )}
                    </div>
                  </div>
                  <div
                    ref={containerRef}
                    className="flex-1 w-full min-w-0 min-h-0 max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl overflow-y-auto px-4 py-12 space-y-6 md:space-y-8 scroll-smooth flex flex-col items-center text-center relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)]"
                  >
                    {parsedLyrics.map((line, index) => {
                      const isActive = index === activeLineIndex;
                      const isPlayed = index < activeLineIndex;

                      return (
                        <div
                          key={index}
                          ref={isActive ? activeLineRef : null}
                          onClick={() => handleLineClick(line.startTime)}
                          className={`cursor-pointer transition-all duration-500 origin-center py-2 text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl tracking-tight leading-tight ${
                            isActive
                              ? "text-[#ec4899] font-extrabold scale-[1.02] filter drop-shadow-[0_0_15px_rgba(236,72,153,0.5)] opacity-100"
                              : isPlayed
                              ? "text-white/30 font-bold hover:text-white/70"
                              : "text-white/15 font-bold hover:text-white/50"
                          }`}
                        >
                          {line.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Static: lyrics left (scrollable) + cover art right (fixed), centered as a unit */
                <div className="flex flex-col lg:flex-row items-start justify-center gap-10 w-full h-full px-4">
                  {/* Lyrics columns — scrollable, fills available height */}
                  <div className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto py-6 [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <div className={`grid gap-4 lg:gap-8 w-fit mx-auto ${columnCount === 1 ? "grid-cols-1" : columnCount === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}>
                      {columns.map((column, colIndex) => (
                        <div key={colIndex} className="space-y-3 text-center w-52 sm:w-64 lg:w-72">
                          {column.map((line, lineIndex) => (
                            <p key={lineIndex} className="text-white/80 text-base md:text-lg font-medium leading-relaxed">
                              {line}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Cover art to the right — stays put while lyrics scroll */}
                  <div className="shrink-0 flex flex-col items-center gap-3 py-6 self-start lg:self-center">
                    <div className="w-72 h-72 sm:w-96 sm:h-96 lg:w-[26rem] lg:h-[26rem] xl:w-[30rem] xl:h-[30rem] relative">
                      {coverUrl ? (
                        <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50 [-webkit-box-reflect:below_2px_linear-gradient(to_bottom,transparent,transparent_60%,rgba(0,0,0,0.4))]" />
                      ) : (
                        <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10">
                          <svg className="w-20 h-20 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-4">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white/90 leading-snug">
                        {cleanTitle || currentTrack?.prompt.substring(0, 50) || "No track"}
                      </h3>
                      {artistLabel && <p className="mt-1 text-sm lg:text-base text-white/50">{artistLabel}</p>}
                      {currentTrack?.publishDate && (
                        <p className="mt-1 text-xs text-white/40">
                          {new Date(currentTrack.publishDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                      )}
                      {writerLabel && <p className="mt-1 text-xs text-white/40">Written by {writerLabel}</p>}
                      {composerLabel && <p className="mt-0.5 text-xs text-white/40">Composed by {composerLabel}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {visualizerEnabled && (
        <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 pb-3 pointer-events-none z-10 transition-opacity duration-700 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 pointer-events-auto">
            <button onClick={() => cycleMode(-1)} className="text-white/50 hover:text-white transition-colors p-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-[11px] text-white/70 font-medium w-16 text-center select-none">{currentModeLabel}</span>
            <button onClick={() => cycleMode(1)} className="text-white/50 hover:text-white transition-colors p-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <span className="w-px h-4 bg-white/15" />
            <button onClick={() => cycleGradient(-1)} className="text-white/50 hover:text-white transition-colors p-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-[11px] text-white/70 font-medium w-16 text-center select-none">{currentGradientLabel}</span>
            <button onClick={() => cycleGradient(1)} className="text-white/50 hover:text-white transition-colors p-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <span className="w-px h-4 bg-white/15" />
            <button onClick={() => setVisualizerEnabled(false)} className="text-white/35 hover:text-white/70 transition-colors p-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
      <AudioVisualizer
        audioElement={audioElement}
        mode={visualizerMode}
        gradient={visualizerGradient}
        enabled={visualizerEnabled}
        coverUrl={coverUrl}
      />
    </div>
  );
}
