import { useEffect, type RefObject } from "react";
import { usePlayerStore } from "@/lib/store";

export function usePlayerHotkeys({
  audioRef,
  tryPlay,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  tryPlay: () => Promise<void>;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (!usePlayerStore.getState().currentTrack) return;
      event.preventDefault();
      const isPlaying = usePlayerStore.getState().isPlaying;
      if (isPlaying) {
        audioRef.current?.pause();
        usePlayerStore.getState().setIsPlaying(false);
      } else {
        usePlayerStore.getState().setIsPlaying(true);
        void tryPlay();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [audioRef, tryPlay]);
}
