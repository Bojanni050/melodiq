import { useEffect, type RefObject } from "react";
import type { Track } from "@/lib/store";
import { usePlayerStore } from "@/lib/store";

export function useMediaSession(
  currentTrack: Track | null,
  audioRef: RefObject<HTMLAudioElement | null>
) {
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
