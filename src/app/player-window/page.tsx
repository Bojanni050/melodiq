"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/store";
import { formatProviderLabel, type AudioSource, type AudioSourceState, AudioSourceBadge } from "@/components/player/playerUtils";
import { parseLyrics } from "@/lib/parse-lyrics";
import {
  PLAYER_POPUP_CHANNEL,
  type PlayerPopupMessage,
  type PlayerPopupControlMessage,
  type PlayerPopupRequestStateMessage,
} from "@/lib/playerPopupSync";

export default function PlayerWindowPage() {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioSource, setAudioSource] = useState<AudioSource>("unknown");
  const [audioSourceState, setAudioSourceState] = useState<AudioSourceState>("unknown");
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lyricsVisible, setLyricsVisible] = useState(true);
  const [bgZoom, setBgZoom] = useState(() => {
    try { return localStorage.getItem("melodiq-fs-bgzoom") !== "off"; } catch { return true; }
  });
  const [visualizerEnabled, setVisualizerEnabled] = useState(() => {
    try { return localStorage.getItem("melodiq-popup-visualizer") === "on"; } catch { return false; }
  });
  const channelRef = useRef<BroadcastChannel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vizDataRef = useRef<Uint8Array | null>(null);
  const vizFrameRef = useRef<number | null>(null);

  // Crossfade on track switch: snapshot the outgoing track's visual and let it
  // fade out on top of the (already fully rendered) incoming track.
  type TrackVisual = { coverUrl: string | null; title: string; artist: string; publishDate?: string; writerName?: string; composerName?: string };
  const [outgoingVisual, setOutgoingVisual] = useState<TrackVisual | null>(null);
  const [outgoingFading, setOutgoingFading] = useState(false);
  const lastTrackIdRef = useRef<string | null>(null);
  const lastVisualRef = useRef<TrackVisual | null>(null);
  const outgoingTimersRef = useRef<{ raf: number | null; timeout: ReturnType<typeof setTimeout> | null }>({ raf: null, timeout: null });

  function toggleBgZoom() {
    setBgZoom((v) => {
      const next = !v;
      try { localStorage.setItem("melodiq-fs-bgzoom", next ? "on" : "off"); } catch {}
      return next;
    });
  }

  function toggleVisualizer() {
    setVisualizerEnabled((v) => {
      const next = !v;
      try { localStorage.setItem("melodiq-popup-visualizer", next ? "on" : "off"); } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(PLAYER_POPUP_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<PlayerPopupMessage>) => {
      const data = event.data;
      if (!data) return;
      if (data.type === "viz") {
        vizDataRef.current = data.payload.data;
        return;
      }
      if (data.type !== "state") return;
      setConnected(true);
      setTrack(data.payload.track);
      setIsPlaying(data.payload.isPlaying);
      setCurrentTime(data.payload.currentTime);
      setDuration(data.payload.duration);
      setAudioSource(data.payload.audioSource);
      setAudioSourceState(data.payload.audioSourceState);
      setHasNext(data.payload.hasNext);
      setHasPrevious(data.payload.hasPrevious);
    };

    const request: PlayerPopupRequestStateMessage = { type: "request-state" };
    channel.postMessage(request);
    const retry = setInterval(() => channel.postMessage(request), 1500);

    return () => {
      clearInterval(retry);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // Ask the main window to start/stop streaming frequency data whenever the
  // visualizer toggle changes (and re-subscribe if the channel reconnects).
  useEffect(() => {
    if (!visualizerEnabled) return;
    sendControl({ action: "viz-subscribe" });
    return () => sendControl({ action: "viz-unsubscribe" });
  }, [visualizerEnabled, connected]);

  // Canvas bar renderer driven by whatever frequency data last arrived.
  useEffect(() => {
    if (!visualizerEnabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const { width, height } = canvas!.getBoundingClientRect();
      if (canvas!.width !== width || canvas!.height !== height) {
        canvas!.width = width;
        canvas!.height = height;
      }
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const data = vizDataRef.current;
      if (data && data.length) {
        // Raw FFT bins are linearly spaced, so most of a song's energy sits in
        // the first third of them — rendering one bar per bin leaves the
        // right side of the canvas visually empty. Group bins on a log scale
        // instead, so each visual bar gets a frequency range like a real EQ.
        const bins = data.length;
        const barCount = 48;
        const barWidth = canvas!.width / barCount;
        for (let i = 0; i < barCount; i++) {
          const from = Math.min(bins - 1, Math.floor(Math.pow(bins, i / barCount)));
          const to = Math.max(from + 1, Math.min(bins, Math.floor(Math.pow(bins, (i + 1) / barCount))));
          let sum = 0;
          for (let b = from; b < to; b++) sum += data[b];
          const value = sum / (to - from) / 255;
          const barHeight = value * canvas!.height;
          const gradient = ctx!.createLinearGradient(0, canvas!.height - barHeight, 0, canvas!.height);
          gradient.addColorStop(0, "rgba(255,133,80,0.95)");
          gradient.addColorStop(1, "rgba(255,83,12,0.4)");
          ctx!.fillStyle = gradient;
          ctx!.fillRect(i * barWidth, canvas!.height - barHeight, barWidth * 0.8, barHeight);
        }
      }
      vizFrameRef.current = requestAnimationFrame(draw);
    }
    vizFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (vizFrameRef.current) cancelAnimationFrame(vizFrameRef.current);
      vizFrameRef.current = null;
    };
  }, [visualizerEnabled]);

  useEffect(() => {
    if (connected) return;
    // Stop retrying the initial handshake once we've heard back at least once.
  }, [connected]);

  function sendControl(message: Omit<PlayerPopupControlMessage, "type">) {
    channelRef.current?.postMessage({ type: "control", ...message } satisfies PlayerPopupControlMessage);
  }

  const handleLineClick = (startTime: number) => {
    if (startTime >= 0) sendControl({ action: "seek", value: startTime });
  };

  const cleanTitle = track?.title ? track.title.replace(/\s*\(2\)\s*$/, "") : "";
  const artistLabel = (track?.artistName || "").trim();
  const composerLabel = (track?.composerName || "").trim();
  const writerLabel = (track?.writerName || "").trim();
  const creditsLabel = [
    writerLabel ? `Lyrics: ${writerLabel}` : "",
    composerLabel ? `Composed by ${composerLabel}` : "",
  ].filter(Boolean).join(" / ");
  const coverUrl = track?.coverUrl || (track?.s3KeyCover ? `/api/tracks/${track.id}/cover` : null);

  useEffect(() => {
    const trackId = track?.id ?? null;
    const visual: TrackVisual = { 
      coverUrl, 
      title: cleanTitle || track?.prompt.substring(0, 50) || "", 
      artist: artistLabel,
      publishDate: track?.publishDate ?? undefined,
      writerName: track?.writerName ?? undefined,
      composerName: track?.composerName ?? undefined
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
  }, [track?.id, coverUrl, cleanTitle, artistLabel]);

  useEffect(() => {
    return () => {
      if (outgoingTimersRef.current.raf) cancelAnimationFrame(outgoingTimersRef.current.raf);
      if (outgoingTimersRef.current.timeout) clearTimeout(outgoingTimersRef.current.timeout);
    };
  }, []);

  const parsedLyrics = useMemo(() => parseLyrics(track?.lyrics ?? null, track?.lyricsTimestamps), [track]);
  const hasTimings = useMemo(() => parsedLyrics.some((line) => line.startTime >= 0), [parsedLyrics]);

  const activeLineIndex = useMemo(() => {
    if (!hasTimings) return -1;
    let activeIndex = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].startTime <= currentTime) activeIndex = i;
      else break;
    }
    return activeIndex;
  }, [parsedLyrics, currentTime, hasTimings]);

  useEffect(() => {
    if (containerRef.current && activeLineRef.current) {
      const container = containerRef.current;
      const activeEl = activeLineRef.current;
      const targetScrollTop = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  }, [activeLineIndex]);

  const lyrics = track?.lyrics || "";
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
    return lyricsLines.slice(start, start + linesPerColumn);
  });

  function formatTime(secs: number) {
    if (!Number.isFinite(secs) || secs < 0) return "0:00";
    return `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 z-0 bg-black text-white overflow-hidden">
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
          className={`absolute inset-0 bg-cover bg-center blur-[90px] opacity-45 saturate-150 transition-opacity duration-700 ease-out ${outgoingFading ? "opacity-0" : "opacity-100"}`}
          style={{ backgroundImage: `url(${outgoingVisual.coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,133,80,0.35),transparent_42%),radial-gradient(circle_at_82%_26%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_50%_78%,rgba(255,83,12,0.3),transparent_45%)] blur-3xl opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />

      <div className="relative h-full flex flex-col">
        {!connected && (
          <div className="px-6 py-3 text-sm text-white/40">
            Waiting for the MelodIQ tab to connect…
          </div>
        )}

        {!track ? (
          <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
            Nothing playing yet
          </div>
        ) : (
          <>
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={toggleBgZoom}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${bgZoom ? "bg-white/20 text-white" : "bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70"}`}
                  title={bgZoom ? "Disable background zoom" : "Enable background zoom"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                  </svg>
                </button>
                <button
                  onClick={() => setLyricsVisible((v) => !v)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${lyricsVisible ? "bg-white/20 text-white" : "bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70"}`}
                  title={lyricsVisible ? "Hide lyrics" : "Show lyrics"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h6M7 8h10M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                  </svg>
                </button>
                <button
                  onClick={toggleVisualizer}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${visualizerEnabled ? "bg-white/20 text-white" : "bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/70"}`}
                  title={visualizerEnabled ? "Disable visualizer" : "Enable visualizer"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l2 3 2-6 2 8 2-4 2 6" />
                  </svg>
                </button>
              </div>
              <h2 className="text-lg font-semibold">{cleanTitle || track.prompt.substring(0, 50)}</h2>
              {artistLabel && <p className="text-sm text-white/60">{artistLabel}</p>}
              {creditsLabel && <p className="text-xs text-white/45">{creditsLabel}</p>}
              <p className="text-xs text-white/40 capitalize">{formatProviderLabel(track.provider)}</p>
              <div className="mt-2">
                <AudioSourceBadge source={audioSource} state={audioSourceState} />
              </div>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 overflow-y-auto lg:overflow-hidden gap-6">
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
              {(!showLyrics || !lyricsVisible) && (
                <div className="shrink-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-72 h-72 sm:w-96 sm:h-96 md:w-[26rem] md:h-[26rem] lg:w-[30rem] lg:h-[30rem] relative">
                    {coverUrl ? (
                      <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50 [-webkit-box-reflect:below_2px_linear-gradient(to_bottom,transparent,transparent_60%,rgba(0,0,0,0.4))]" />
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10" />
                    )}
                  </div>
                  <div className="text-center mt-4">
                    <h3 className={`font-semibold text-white/90 leading-snug ${showLyrics && lyricsVisible ? "text-base sm:text-lg lg:text-xl" : "text-xl sm:text-2xl md:text-3xl"}`}>
                      {cleanTitle || track.prompt.substring(0, 50)}
                    </h3>
                    {artistLabel && <p className="mt-1 text-sm sm:text-base text-white/50">{artistLabel}</p>}
                    {track.publishDate && (
                      <p className="mt-1 text-xs text-white/40">
                        {new Date(track.publishDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </p>
                    )}
                    {writerLabel && <p className="mt-1 text-xs text-white/40">Written by {writerLabel}</p>}
                    {composerLabel && <p className="mt-0.5 text-xs text-white/40">Composed by {composerLabel}</p>}
                  </div>
                </div>
              )}

              {showLyrics && lyricsVisible && (
                <div className="flex-1 w-full flex items-stretch justify-center min-h-0 h-full">
                  {hasTimings ? (
                    /* Timed: cover art + meta on left, lyrics scrolling on right */
                    <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-6 lg:gap-16 w-full h-full max-w-[1600px] px-4 py-8">
                      <div className="shrink-0 flex flex-col items-center justify-center gap-4 min-h-0">
                        <div className="w-56 h-56 sm:w-64 sm:h-64 lg:w-96 lg:h-96 xl:w-[26rem] xl:h-[26rem] relative">
                          {coverUrl ? (
                            <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50 [-webkit-box-reflect:below_2px_linear-gradient(to_bottom,transparent,transparent_60%,rgba(0,0,0,0.4))]" />
                          ) : (
                            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10" />
                          )}
                        </div>
                        <div className="text-center max-w-sm">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white/90 leading-snug">
                            {cleanTitle || track.prompt.substring(0, 50)}
                          </h3>
                          {artistLabel && <p className="mt-1 text-sm lg:text-base text-white/50">{artistLabel}</p>}
                          {track.publishDate && (
                            <p className="mt-1 text-xs text-white/40">
                              {new Date(track.publishDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                            </p>
                          )}
                          {writerLabel && <p className="mt-1 text-xs text-white/40">Written by {writerLabel}</p>}
                          {composerLabel && <p className="mt-0.5 text-xs text-white/40">Composed by {composerLabel}</p>}
                        </div>
                      </div>
                      <div
                        ref={containerRef}
                        className="flex-1 w-full min-w-0 min-h-0 max-w-2xl lg:max-w-3xl overflow-y-auto px-4 py-12 space-y-6 md:space-y-8 scroll-smooth flex flex-col items-center text-center relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)]"
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
                      <div className="shrink-0 flex flex-col items-center gap-3 py-6 self-start lg:self-center">
                        <div className="w-72 h-72 sm:w-96 sm:h-96 lg:w-[26rem] lg:h-[26rem] xl:w-[30rem] xl:h-[30rem] relative">
                          {coverUrl ? (
                            <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50 [-webkit-box-reflect:below_2px_linear-gradient(to_bottom,transparent,transparent_60%,rgba(0,0,0,0.4))]" />
                          ) : (
                            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10" />
                          )}
                        </div>
                        <div className="text-center mt-4">
                          <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white/90 leading-snug">
                            {cleanTitle || track.prompt.substring(0, 50)}
                          </h3>
                          {artistLabel && <p className="mt-1 text-sm lg:text-base text-white/50">{artistLabel}</p>}
                          {track.publishDate && (
                            <p className="mt-1 text-xs text-white/40">
                              {new Date(track.publishDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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

            {visualizerEnabled && (
              <canvas
                ref={canvasRef}
                className="absolute bottom-24 left-0 right-0 w-full h-36 pointer-events-none opacity-55 z-10"
              />
            )}

            <div className="absolute bottom-6 right-6 z-30 pointer-events-none">
              <span className="font-mono text-sm tracking-widest text-white/50 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
