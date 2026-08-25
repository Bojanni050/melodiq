import { useEffect, useRef, type RefObject } from "react";
import type { Track } from "@/lib/store";
import { usePlayerStore } from "@/lib/store";

export function useMediaSession(
  currentTrack: Track | null,
  audioRef: RefObject<HTMLAudioElement | null>
) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Update MediaSession metadata when currentTrack changes
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      const artwork: MediaImage[] = [];
      const coverSrc =
        currentTrack.coverUrl ||
        (currentTrack.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);
      if (coverSrc) {
        artwork.push({ src: coverSrc, sizes: "512x512", type: "image/jpeg" });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title:
          currentTrack.title?.replace(/\s*\(2\)\s*$/, "") ||
          currentTrack.prompt.substring(0, 60),
        artist: "",
        artwork,
      });
    }
  }, [currentTrack]);

  // Sync MediaSession playbackState with actual play/pause state
  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  // Wake Lock — prevent screen from sleeping while music plays
  useEffect(() => {
    let cancelled = false;

    async function requestWakeLock() {
      if (!("wakeLock" in navigator)) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        });
      } catch {
        // Wake Lock not supported or denied — silently ignore
      }
    }

    async function releaseWakeLock() {
      if (wakeLockRef.current) {
        try { await wakeLockRef.current.release(); } catch { /* ignore */ }
        wakeLockRef.current = null;
      }
    }

    if (isPlaying) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }

    // Re-acquire wake lock when page becomes visible again (screen unlock)
    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        usePlayerStore.getState().isPlaying &&
        !wakeLockRef.current
      ) {
        void requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void releaseWakeLock();
    };
  }, [isPlaying]);

  // Register MediaSession playback action handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      void audioRef.current?.play();
      usePlayerStore.getState().setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
      usePlayerStore.getState().setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      usePlayerStore.getState().playPrevious();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      usePlayerStore.getState().playNext();
    });

    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      }
    };
  }, [audioRef]);
}
