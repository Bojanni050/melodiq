"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/store";
import { formatProviderLabel, type AudioSource, type AudioSourceState, AudioSourceBadge } from "@/components/Player";
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
  const channelRef = useRef<BroadcastChannel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(PLAYER_POPUP_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<PlayerPopupMessage>) => {
      const data = event.data;
      if (!data || data.type !== "state") return;
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

  useEffect(() => {
    if (connected) return;
    // Stop retrying the initial handshake once we've heard back at least once.
  }, [connected]);

  function sendControl(message: Omit<PlayerPopupControlMessage, "type">) {
    channelRef.current?.postMessage({ type: "control", ...message } satisfies PlayerPopupControlMessage);
  }

  const cleanTitle = track?.title ? track.title.replace(/\s*\(2\)\s*$/, "") : "";
  const artistLabel = (track?.artistName || "").trim();
  const composerLabel = (track?.composerName || "").trim();
  const coverUrl = track?.coverUrl || (track?.s3KeyCover ? `/api/tracks/${track.id}/cover` : null);

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
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-[90px] opacity-45 saturate-150"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,133,80,0.35),transparent_42%),radial-gradient(circle_at_82%_26%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_50%_78%,rgba(255,83,12,0.3),transparent_45%)] blur-3xl opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />

      <div className="relative h-full flex flex-col">
        {!connected && (
          <div className="px-6 py-3 text-xs text-white/40">
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
              <h2 className="text-lg font-semibold">{cleanTitle || track.prompt.substring(0, 50)}</h2>
              <p className="text-sm text-white/60">
                {artistLabel ? `${artistLabel} — ` : ""}
                {composerLabel ? `composer: ${composerLabel} — ` : ""}
                {formatProviderLabel(track.provider)}
              </p>
              <div className="mt-2">
                <AudioSourceBadge source={audioSource} state={audioSourceState} />
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 overflow-y-auto lg:overflow-hidden gap-6">
              {(!showLyrics) && (
                <div className="shrink-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-96 lg:h-96">
                    {coverUrl ? (
                      <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50" />
                    ) : (
                      <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10" />
                    )}
                  </div>
                </div>
              )}

              {showLyrics && (
                <div className="flex-1 w-full flex items-center justify-center min-h-0 h-full">
                  {hasTimings ? (
                    <div className="flex flex-col items-center gap-4 w-full h-full">
                      <div className="shrink-0 flex flex-col items-center gap-3 pt-2">
                        <div className="w-44 h-44 sm:w-52 sm:h-52 lg:w-60 lg:h-60">
                          {coverUrl ? (
                            <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50" />
                          ) : (
                            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10" />
                          )}
                        </div>
                      </div>
                      <div
                        ref={containerRef}
                        className="flex-1 w-full max-w-2xl overflow-y-auto px-4 py-12 space-y-6 md:space-y-8 scroll-smooth flex flex-col items-center text-center relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                      >
                        {parsedLyrics.map((line, index) => {
                          const isActive = index === activeLineIndex;
                          const isPlayed = index < activeLineIndex;
                          return (
                            <div
                              key={index}
                              ref={isActive ? activeLineRef : null}
                              className={`transition-all duration-500 origin-center py-1 text-sm sm:text-lg md:text-xl lg:text-2xl leading-relaxed ${
                                isActive
                                  ? "text-primary-400 font-bold scale-105 filter drop-shadow-[0_0_12px_rgba(255,133,80,0.45)] opacity-100"
                                  : isPlayed
                                  ? "text-white/45 font-medium"
                                  : "text-white/20 font-medium"
                              }`}
                            >
                              {line.text}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col lg:flex-row items-start justify-center gap-10 w-full h-full px-4">
                      <div className="flex-1 min-w-0 h-full overflow-y-auto py-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                        <div className={`grid gap-4 lg:gap-8 w-fit mx-auto ${columnCount === 1 ? "grid-cols-1" : columnCount === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3"}`}>
                          {columns.map((column, colIndex) => (
                            <div key={colIndex} className="space-y-1.5 text-center w-44 sm:w-52 lg:w-60">
                              {column.map((line, lineIndex) => (
                                <p key={lineIndex} className="text-white/80 text-xs sm:text-sm leading-relaxed">
                                  {line}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-center gap-3 py-6 self-start lg:self-center">
                        <div className="w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80 xl:w-96 xl:h-96">
                          {coverUrl ? (
                            <img src={coverUrl} alt="Album art" className="w-full h-full object-cover rounded-2xl shadow-2xl shadow-black/50" />
                          ) : (
                            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-800/20 flex items-center justify-center border border-white/10" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/5">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <span className="text-xs text-white/40 w-9 text-right tabular-nums">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => sendControl({ action: "seek", value: parseFloat(e.target.value) })}
                  aria-label="Seek position"
                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary-500"
                />
                <span className="text-xs text-white/40 w-9 tabular-nums">{formatTime(duration)}</span>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  onClick={() => sendControl({ action: "previous" })}
                  disabled={!hasPrevious && currentTime < 3}
                  className="p-2 rounded-full text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
                  title="Previous"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 5h2v14H6zM9 12l10 7V5z" />
                  </svg>
                </button>
                <button
                  onClick={() => sendControl({ action: "toggle-play" })}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
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
                  onClick={() => sendControl({ action: "next" })}
                  disabled={!hasNext}
                  className="p-2 rounded-full text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
                  title="Next"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 5h2v14h-2zM6 19l10-7L6 5z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
