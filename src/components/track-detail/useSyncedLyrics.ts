"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayerStore } from "@/lib/store";
import { parseLyrics } from "@/lib/parse-lyrics";
import type { TrackDetailTrack } from "./types";

// Tracks playback position against the track's parsed (possibly time-coded)
// lyrics, and keeps the sidebar auto-scrolled to the active line.
export function useSyncedLyrics(track: TrackDetailTrack) {
  const { currentTrack, audioElement } = usePlayerStore();
  const [currentTime, setCurrentTime] = useState(0);

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

  return {
    parsedLyrics,
    hasTimings,
    activeLineIndex,
    containerRef,
    sidebarActiveLineRef,
    handleLineClick,
  };
}
