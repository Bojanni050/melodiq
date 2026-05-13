"use client";

import { useRef, useEffect, useCallback } from "react";
import { usePlayerStore, Track } from "@/lib/store";
import { useState } from "react";

export default function Player() {
  const { currentTrack, isPlaying, volume, setProgress } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;

      audioRef.current.addEventListener("timeupdate", () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });

      audioRef.current.addEventListener("loadedmetadata", () => {
        setDuration(audioRef.current?.duration || 0);
      });

      audioRef.current.addEventListener("ended", () => {
        usePlayerStore.getState().setIsPlaying(false);
      });
    }
  }, []);

  useEffect(() => {
    if (audioRef.current && currentTrack?.audioUrl) {
      audioRef.current.src = currentTrack.audioUrl;
      audioRef.current.play().catch(() => {});
      usePlayerStore.getState().setIsPlaying(true);
    }
  }, [currentTrack?.audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = useCallback(() => {
    usePlayerStore.getState().setIsPlaying(!isPlaying);
  }, [isPlaying]);

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

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition-colors flex-shrink-0"
            >
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
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {currentTrack.title || currentTrack.prompt.substring(0, 40)}
              </p>
              <p className="text-xs text-white/50 capitalize">
                {currentTrack.provider} • {currentTrack.providerModel}
              </p>
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
              className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary-500"
            />
            <span className="text-xs text-white/40 w-10">
              {formatTime(duration)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
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
              className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
