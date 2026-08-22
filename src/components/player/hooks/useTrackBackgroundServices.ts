import { useRef, useCallback, type RefObject } from "react";
import type { Track } from "@/lib/store";
import { usePlayerStore } from "@/lib/store";
import { resolveStreamSuffix, mediaBase } from "@/components/player/playerUtils";

export function useTrackBackgroundServices(
  audioRef: RefObject<HTMLAudioElement | null>,
  currentTrackRef: RefObject<Track | null>
) {
  const playCountedTrackIdRef = useRef<string | null>(null);
  const playCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverAutoGenerateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverAutoRequestedTrackIdsRef = useRef<Set<string>>(new Set());
  const languageDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageDetectRequestedTrackIdsRef = useRef<Set<string>>(new Set());
  const nextTrackPrefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTrackPrefetchedIdsRef = useRef<Set<string>>(new Set());

  const clearPlayTimer = useCallback(() => {
    if (playCountTimerRef.current) {
      clearTimeout(playCountTimerRef.current);
      playCountTimerRef.current = null;
    }
  }, []);

  const clearCoverAutoGenerateTimer = useCallback(() => {
    if (coverAutoGenerateTimerRef.current) {
      clearTimeout(coverAutoGenerateTimerRef.current);
      coverAutoGenerateTimerRef.current = null;
    }
  }, []);

  const clearLanguageDetectTimer = useCallback(() => {
    if (languageDetectTimerRef.current) {
      clearTimeout(languageDetectTimerRef.current);
      languageDetectTimerRef.current = null;
    }
  }, []);

  const clearNextTrackPrefetchTimer = useCallback(() => {
    if (nextTrackPrefetchTimerRef.current) {
      clearTimeout(nextTrackPrefetchTimerRef.current);
      nextTrackPrefetchTimerRef.current = null;
    }
  }, []);

  const trackHasCover = (track: Track | null | undefined) => {
    if (!track) return false;
    return Boolean(track.coverUrl || track.s3KeyCover || track.s3KeyCoverThumb);
  };

  const scheduleAutoCoverGenerationIfNeeded = useCallback(() => {
    const track = currentTrackRef.current;
    if (!track || track.status !== "done") return;
    if (track.publicSource) return;
    if (trackHasCover(track)) return;
    if (coverAutoRequestedTrackIdsRef.current.has(track.id)) return;
    if (coverAutoGenerateTimerRef.current) return;

    coverAutoGenerateTimerRef.current = setTimeout(() => {
      coverAutoGenerateTimerRef.current = null;

      const latestTrack = currentTrackRef.current;
      const audioEl = audioRef.current;
      if (!latestTrack || latestTrack.id !== track.id) return;
      if (!audioEl || audioEl.paused) return;
      if (trackHasCover(latestTrack)) return;
      if (coverAutoRequestedTrackIdsRef.current.has(track.id)) return;

      coverAutoRequestedTrackIdsRef.current.add(track.id);

      void (async () => {
        try {
          const response = await fetch(`/api/tracks/${track.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ regenerateCoverArt: true }),
          });

          if (!response.ok) {
            coverAutoRequestedTrackIdsRef.current.delete(track.id);
            return;
          }

          const refreshedTrack = (await response.json().catch(() => null)) as Partial<Track> | null;
          const cacheBust = Date.now();
          const nextCoverUrl = `/api/tracks/${track.id}/cover?t=${cacheBust}`;

          usePlayerStore.setState((state) => {
            if (state.currentTrack?.id !== track.id) return {};

            return {
              currentTrack: {
                ...state.currentTrack,
                ...(refreshedTrack ? refreshedTrack : {}),
                coverUrl: nextCoverUrl,
              },
            };
          });

          window.dispatchEvent(
            new CustomEvent("melodiq:cover-regenerated", {
              detail: { trackIds: [track.id], ts: cacheBust },
            })
          );
        } catch (error) {
          console.error("Failed to auto-generate cover art:", error);
          coverAutoRequestedTrackIdsRef.current.delete(track.id);
        }
      })();
    }, 30_000);
  }, [audioRef, currentTrackRef]);

  const scheduleLanguageDetectionIfNeeded = useCallback(() => {
    const track = currentTrackRef.current;
    if (!track || track.status !== "done") return;
    if (track.publicSource) return;
    if (track.language || track.instrumental || !track.lyrics?.trim()) return;
    if (languageDetectRequestedTrackIdsRef.current.has(track.id)) return;
    if (languageDetectTimerRef.current) return;

    languageDetectTimerRef.current = setTimeout(() => {
      languageDetectTimerRef.current = null;

      const latestTrack = currentTrackRef.current;
      const audioEl = audioRef.current;
      if (!latestTrack || latestTrack.id !== track.id) return;
      if (!audioEl || audioEl.paused) return;
      if (latestTrack.language) return;
      if (languageDetectRequestedTrackIdsRef.current.has(track.id)) return;

      languageDetectRequestedTrackIdsRef.current.add(track.id);

      void (async () => {
        try {
          const response = await fetch(`/api/tracks/${track.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ detectLanguage: true }),
          });

          if (!response.ok) return;

          const refreshedTrack = (await response.json().catch(() => null)) as Partial<Track> | null;
          if (!refreshedTrack?.language) return;

          usePlayerStore.setState((state) =>
            state.currentTrack?.id === track.id
              ? { currentTrack: { ...state.currentTrack, language: refreshedTrack.language } }
              : {}
          );
        } catch (error) {
          console.error("Failed to auto-detect language:", error);
        }
      })();
    }, 15_000);
  }, [audioRef, currentTrackRef]);

  const scheduleNextTrackPrefetchIfNeeded = useCallback(() => {
    const track = currentTrackRef.current;
    if (!track) return;
    if (!usePlayerStore.getState().autoPlayNext) return;
    const nextTrack = usePlayerStore.getState().queue[0];
    if (!nextTrack || nextTrack.status !== "done") return;
    if (nextTrackPrefetchedIdsRef.current.has(nextTrack.id)) return;
    if (nextTrackPrefetchTimerRef.current) return;

    const trackId = track.id;
    const nextTrackId = nextTrack.id;

    nextTrackPrefetchTimerRef.current = setTimeout(() => {
      nextTrackPrefetchTimerRef.current = null;

      const audioEl = audioRef.current;
      if (currentTrackRef.current?.id !== trackId) return;
      if (!audioEl || audioEl.paused) return;
      if (!usePlayerStore.getState().autoPlayNext) return;

      const liveNext = usePlayerStore.getState().queue[0];
      if (!liveNext || liveNext.id !== nextTrackId) return;
      if (nextTrackPrefetchedIdsRef.current.has(nextTrackId)) return;

      nextTrackPrefetchedIdsRef.current.add(nextTrackId);

      const suffix = resolveStreamSuffix(liveNext, usePlayerStore.getState().playHighestQuality);
      const url = `${mediaBase(liveNext)}/stream${suffix}`;
      void fetch(url, {
        headers: { Range: "bytes=0-0" },
        priority: "low",
      }).catch(() => {});
    }, 10_000);
  }, [audioRef, currentTrackRef]);

  const countPlayIfNeeded = useCallback(() => {
    const track = currentTrackRef.current;
    const trackId = track?.id;
    if (!trackId || !track) return;
    if (playCountedTrackIdRef.current === trackId) return;
    if (playCountTimerRef.current) return;

    playCountTimerRef.current = setTimeout(() => {
      playCountTimerRef.current = null;

      const currentId = currentTrackRef.current?.id;
      if (!currentId || currentId !== trackId) return;
      if (playCountedTrackIdRef.current === trackId) return;

      playCountedTrackIdRef.current = trackId;

      void (async () => {
        try {
          const res = await fetch(`${mediaBase(track)}/play`, { method: "POST" });
          if (!res.ok) return;
          const data: unknown = await res.json().catch(() => null);
          const readCount = (key: "playCount" | "othersPlayCount") =>
            data &&
            typeof data === "object" &&
            key in data &&
            typeof (data as Record<string, unknown>)[key] === "number"
              ? (data as Record<string, number>)[key]
              : null;
          const playCount = readCount("playCount");
          const othersPlayCount = readCount("othersPlayCount");

          if (typeof playCount === "number") {
            usePlayerStore.setState((state) =>
              state.currentTrack?.id === trackId
                ? { currentTrack: { ...state.currentTrack, playCount } }
                : {}
            );
          }

          window.dispatchEvent(
            new CustomEvent("melodiq:track-played", {
              detail: {
                trackId,
                ...(typeof playCount === "number" ? { playCount } : {}),
                ...(typeof othersPlayCount === "number" ? { othersPlayCount } : {}),
              },
            })
          );
        } catch (error) {
          console.error("Failed to record play:", error);
        }
      })();
    }, 30_000);
  }, [currentTrackRef]);

  return {
    clearPlayTimer,
    clearCoverAutoGenerateTimer,
    clearLanguageDetectTimer,
    clearNextTrackPrefetchTimer,
    scheduleAutoCoverGenerationIfNeeded,
    scheduleLanguageDetectionIfNeeded,
    scheduleNextTrackPrefetchIfNeeded,
    countPlayIfNeeded,
  };
}
