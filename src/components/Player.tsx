"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlayerStore, useUserStore, usePlaylistStore } from "@/lib/store";
import type { Track } from "@/lib/store";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { parseLyrics } from "@/lib/parse-lyrics";
import FullscreenPlayer from "@/components/player/FullscreenPlayer";
import ChromecastButton from "@/components/ChromecastButton";
import { useChromecast } from "@/hooks/useChromecast";

export type AudioSource = "cache" | "s3" | "unknown";
export type AudioSourceState = "hit" | "miss" | "fallback" | "unknown";

export function resolveStreamSuffix(track: Track, playHighestQuality: boolean): string {
  if (!playHighestQuality) return "";

  // Prefer FLAC, then WAV — check HD slot first, then primary slot
  for (const fmt of ["flac", "wav"] as const) {
    if (track.formatHd === fmt && track.s3KeyHd) return "?hd=true";
    if (track.format === fmt && track.s3Key) return "";
  }
  return "";
}

export function AudioSourceBadge({ source }: { source: AudioSource; state: AudioSourceState }) {
  // Only show a badge when streaming (not from cache)
  if (source !== "s3") return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-sky-200"
      title="Streaming from server"
    >
      <span className="text-[11px] leading-none">☁</span>
      Stream
    </span>
  );
}

declare global {
  interface Window {
    __melodiqSharedAudioElement?: HTMLAudioElement;
  }
}

function getSharedAudioElement() {
  if (typeof window === "undefined") return null;
  if (!window.__melodiqSharedAudioElement) {
    window.__melodiqSharedAudioElement = new Audio();
  }
  return window.__melodiqSharedAudioElement;
}

export function formatProviderLabel(provider: string) {
  const normalized = (provider || "").toLowerCase();
  if (normalized === "poyo") return "PoYo";
  if (normalized === "tempolor") return "Tempolor";
  if (normalized === "musicgpt") return "MusicGPT";
  if (normalized === "lyria") return "Lyria";
  if (normalized === "minimax") return "MiniMax";
  if (normalized === "heartmula") return "HeartMuLa";
  if (!provider) return "";
  return provider[0].toUpperCase() + provider.slice(1);
}

export type ActionTimestampRef = { current: number };

export function allowWithDelay(ref: ActionTimestampRef, delayMs: number) {
  const now = Date.now();
  if (now - ref.current < delayMs) return false;
  ref.current = now;
  return true;
}

export default function Player() {
  const {
    currentTrack,
    queue,
    history,
    isPlaying,
    volume,
    autoPlayNext,
    showTrackDetailsPanel,
    isFullscreen,
    playHighestQuality,
    playNext,
    playPrevious,
    setAutoPlayNext,
    setShowTrackDetailsPanel,
    setIsFullscreen,
    setVolume,
    shuffleEnabled,
    setShuffleEnabled,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      queue: s.queue,
      history: s.history,
      isPlaying: s.isPlaying,
      volume: s.volume,
      autoPlayNext: s.autoPlayNext,
      showTrackDetailsPanel: s.showTrackDetailsPanel,
      isFullscreen: s.isFullscreen,
      playHighestQuality: s.playHighestQuality,
      playNext: s.playNext,
      playPrevious: s.playPrevious,
      setAutoPlayNext: s.setAutoPlayNext,
      setShowTrackDetailsPanel: s.setShowTrackDetailsPanel,
      setIsFullscreen: s.setIsFullscreen,
      setVolume: s.setVolume,
      shuffleEnabled: s.shuffleEnabled,
      setShuffleEnabled: s.setShuffleEnabled,
    }))
  );
  const router = useRouter();
  const pathname = usePathname();
  const { user, loadUser } = useUserStore();
  const { castState, isRemotePaused, togglePlayCast, loadCastMedia, seekCast } = useChromecast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playToggleCooldownRef = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const playCountedTrackIdRef = useRef<string | null>(null);
  const playCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverAutoGenerateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverAutoRequestedTrackIdsRef = useRef<Set<string>>(new Set());
  const languageDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageDetectRequestedTrackIdsRef = useRef<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const lastLoadedTrackIdRef = useRef<string | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioSource>("unknown");
  const [audioSourceState, setAudioSourceState] = useState<AudioSourceState>("unknown");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const playlists = usePlaylistStore((state) => state.playlists);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const artistLabel = (currentTrack?.artistName || "").trim() || (user?.artistAlias || "").trim() || (user?.name || "").trim() || "";
  const composerLabel = (currentTrack?.composerName || "").trim() || (user?.composerAlias || "").trim() || "";
  const cleanTitle = currentTrack?.title ? currentTrack.title.replace(/\s*\(2\)\s*$/, "") : "";

  const detectAudioSource = useCallback(async (streamUrl: string): Promise<{ source: AudioSource; state: AudioSourceState }> => {
    try {
      const response = await fetch(streamUrl, {
        headers: {
          Range: "bytes=0-0",
        },
      });

      if (!response.ok) return { source: "unknown", state: "unknown" };

      const cacheStateHeader = (response.headers.get("x-melodiq-audio-cache-state") || "").toLowerCase();
      const sourceHeader = (response.headers.get("x-melodiq-audio-source") || "").toLowerCase();
      if (sourceHeader === "cache") {
        return { source: "cache", state: cacheStateHeader === "miss" ? "miss" : "hit" };
      }
      if (sourceHeader === "s3") {
        return { source: "s3", state: cacheStateHeader === "fallback" ? "fallback" : "unknown" };
      }
      if (cacheStateHeader === "miss") return { source: "cache", state: "miss" };
      if (cacheStateHeader === "fallback") return { source: "s3", state: "fallback" };
      return { source: "unknown", state: "unknown" };
    } catch {
      return { source: "unknown", state: "unknown" };
    }
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setShowTrackDetailsPanel(false);
    }
  }, [setShowTrackDetailsPanel]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;

    // Keep MediaSession metadata in sync so the OS lock screen shows the
    // correct track info and artwork while playing in the background.
    if ("mediaSession" in navigator && currentTrack) {
      const artwork: MediaImage[] = [];
      const coverSrc = currentTrack.coverUrl || (currentTrack.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);
      if (coverSrc) {
        artwork.push({ src: coverSrc, sizes: "512x512", type: "image/jpeg" });
      }
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title?.replace(/\s*\(2\)\s*$/, "") || currentTrack.prompt.substring(0, 60),
        artist: "",
        artwork,
      });
    }
  }, [currentTrack]);

  const tryPlay = useCallback(async () => {
    if (!audioRef.current) return;
    for (let i = 0; i < 3; i += 1) {
      try {
        await audioRef.current.play();
        return;
      } catch (error) {
        if (!(error instanceof DOMException)) {
          continue;
        }

        if (error.name === "NotAllowedError") {
          usePlayerStore.getState().setIsPlaying(false);
          return;
        }

        if (error.name !== "AbortError") {
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }
  }, []);

  useEffect(() => {
    const sharedAudioElement = getSharedAudioElement();
    if (!sharedAudioElement) return;

    audioRef.current = sharedAudioElement;
    audioRef.current.volume = volume;
    usePlayerStore.getState().setAudioElement(audioRef.current);

    const clearPlayTimer = () => {
      if (playCountTimerRef.current) {
        clearTimeout(playCountTimerRef.current);
        playCountTimerRef.current = null;
      }
    };

    const clearCoverAutoGenerateTimer = () => {
      if (coverAutoGenerateTimerRef.current) {
        clearTimeout(coverAutoGenerateTimerRef.current);
        coverAutoGenerateTimerRef.current = null;
      }
    };

    const clearLanguageDetectTimer = () => {
      if (languageDetectTimerRef.current) {
        clearTimeout(languageDetectTimerRef.current);
        languageDetectTimerRef.current = null;
      }
    };

    const trackHasCover = (track: Track | null | undefined) => {
      if (!track) return false;
      return Boolean(track.coverUrl || track.s3KeyCover || track.s3KeyCoverThumb);
    };

    const scheduleAutoCoverGenerationIfNeeded = () => {
      const track = currentTrackRef.current;
      if (!track || track.status !== "done") return;
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

            const refreshedTrack = await response.json().catch(() => null) as Partial<Track> | null;
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
    };

    const scheduleLanguageDetectionIfNeeded = () => {
      const track = currentTrackRef.current;
      if (!track || track.status !== "done") return;
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

            const refreshedTrack = await response.json().catch(() => null) as Partial<Track> | null;
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
    };

    const countPlayIfNeeded = () => {
      const trackId = currentTrackRef.current?.id;
      if (!trackId) return;
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
            const res = await fetch(`/api/tracks/${trackId}/play`, { method: "POST" });
            if (!res.ok) return;
            const data: unknown = await res.json().catch(() => null);
            const playCount =
              data && typeof data === "object" && "playCount" in data && typeof (data as { playCount?: unknown }).playCount === "number"
                ? (data as { playCount: number }).playCount
                : null;

            if (typeof playCount === "number") {
              usePlayerStore.setState((state) =>
                state.currentTrack?.id === trackId
                  ? { currentTrack: { ...state.currentTrack, playCount } }
                  : {}
              );
            }

            window.dispatchEvent(
              new CustomEvent("melodiq:track-played", {
                detail: { trackId, ...(typeof playCount === "number" ? { playCount } : {}) },
              })
            );
          } catch (error) {
            console.error("Failed to record play:", error);
          }
        })();
      }, 30_000);
    };

    const handleTimeUpdate = () => {
      const time = audioRef.current?.currentTime || 0;
      setCurrentTime(time);
      usePlayerStore.getState().setProgress(time);
    };

    const handleLoadedMetadata = () => {
      const secs = audioRef.current?.duration || 0;
      setDuration(secs);
      // Backfill duration in the DB if it's missing
      const track = usePlayerStore.getState().currentTrack;
      if (track && !track.duration && secs > 0) {
        fetch(`/api/tracks/${track.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration: Math.round(secs) }),
        }).catch(() => {});
      }
    };

    const handleEnded = () => {
      clearPlayTimer();
      clearCoverAutoGenerateTimer();
      clearLanguageDetectTimer();
      const { autoPlayNext, queue, playNext, setIsPlaying, setProgress } = usePlayerStore.getState();
      if (autoPlayNext && queue.length > 0) {
        playNext();
        return;
      }

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      setProgress(0);
      setIsPlaying(false);
    };

    // On Android, audio focus interruptions (calls, notifications, screen-off)
    // pause the audio element directly without updating our isPlaying state.
    // When focus returns the browser does not auto-resume, so we do it here.
    // We do NOT call tryPlay() here because its NotAllowedError handler would
    // set isPlaying=false if Android hasn't restored focus yet — killing playback
    // permanently. Instead we attempt play() silently and let visibilitychange
    // handle the foreground-return case.
    let unexpectedPauseTimer: ReturnType<typeof setTimeout> | null = null;

    const resumeIfNeeded = () => {
      if (!audioRef.current || !usePlayerStore.getState().isPlaying) return;
      if (!audioRef.current.paused) return;
      audioRef.current.play().catch(() => {
        // Audio focus not yet restored — visibilitychange will retry on return
      });
    };

    const handleUnexpectedPause = () => {
      if (!usePlayerStore.getState().isPlaying) return;
      if (unexpectedPauseTimer) clearTimeout(unexpectedPauseTimer);
      unexpectedPauseTimer = setTimeout(() => {
        unexpectedPauseTimer = null;
        resumeIfNeeded();
      }, 1500);
    };

    // When the user brings the app back to the foreground (screen-on, app switch),
    // the page becomes visible again — use this as a reliable resume trigger.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resumeIfNeeded();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Auto-reconnect when the audio stream drops (e.g. mobile network switch or
    // long-lived connection timeout). Saves the current position, reloads the
    // src, and resumes from where it left off.
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const doReconnect = async (audioEl: HTMLAudioElement, track: { id: string }, resumeAt: number) => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const delay = Math.min(1500 * 2 ** reconnectAttempts, 30000);
      reconnectAttempts++;
      console.warn(`[Player] Stream stall/error — reconnecting at ${resumeAt.toFixed(1)}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, delay ${delay}ms)`);

      reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        if (!audioRef.current || currentTrackRef.current?.id !== track.id) return;
        const el = audioRef.current;
        el.pause();
        const currentSrc = el.src;
        el.removeEventListener("error", handleAudioError);
        el.src = "";
        el.load();
        el.src = currentSrc;
        el.load();
        el.addEventListener("error", handleAudioError);
        try {
          await new Promise<void>((resolve, reject) => {
            const onReady = () => { cleanup(); resolve(); };
            const onErr = () => { cleanup(); reject(new Error("stream error")); };
            const cleanup = () => {
              el.removeEventListener("canplay", onReady);
              el.removeEventListener("error", onErr);
            };
            el.addEventListener("canplay", onReady, { once: true });
            el.addEventListener("error", onErr, { once: true });
          });
          el.currentTime = resumeAt;
          await el.play();
          reconnectAttempts = 0;
        } catch {
          // next error/stall event will trigger another attempt
        }
      }, delay);
    };

    const handleAudioError = () => {
      const audioEl = audioRef.current;
      const track = currentTrackRef.current;
      if (!audioEl || !track) return;
      if (!usePlayerStore.getState().isPlaying) return;

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`[Player] Audio error — giving up after ${MAX_RECONNECT_ATTEMPTS} attempts`);
        usePlayerStore.getState().setIsPlaying(false);
        return;
      }

      void doReconnect(audioEl, track, audioEl.currentTime || 0);
    };

    // On Android, the browser can fire `stalled`/`waiting` when the stream
    // buffer runs dry (e.g. background throttling, network hiccup) without
    // ever firing `error`. We wait 5 s then force a reload if still stuck.
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const clearStallTimer = () => {
      if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    };

    const handleStalled = () => {
      if (!usePlayerStore.getState().isPlaying) return;
      if (stallTimer) return; // already waiting
      stallTimer = setTimeout(() => {
        stallTimer = null;
        const audioEl = audioRef.current;
        const track = currentTrackRef.current;
        if (!audioEl || !track || !usePlayerStore.getState().isPlaying) return;
        if (!audioEl.paused && audioEl.readyState >= 3) return; // recovered on its own
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          usePlayerStore.getState().setIsPlaying(false);
          return;
        }
        void doReconnect(audioEl, track, audioEl.currentTime || 0);
      }, 5000);
    };

    // Register MediaSession so iOS/Android treat this as active media and
    // don't suspend the network connection after extended background use.
    if ("mediaSession" in navigator) {
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
    }

    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current.addEventListener("ended", handleEnded);
    audioRef.current.addEventListener("playing", countPlayIfNeeded);
    audioRef.current.addEventListener("playing", scheduleAutoCoverGenerationIfNeeded);
    audioRef.current.addEventListener("playing", scheduleLanguageDetectionIfNeeded);
    audioRef.current.addEventListener("playing", clearStallTimer);
    audioRef.current.addEventListener("pause", clearPlayTimer);
    audioRef.current.addEventListener("pause", clearCoverAutoGenerateTimer);
    audioRef.current.addEventListener("pause", clearLanguageDetectTimer);
    audioRef.current.addEventListener("pause", clearStallTimer);
    audioRef.current.addEventListener("pause", handleUnexpectedPause);
    audioRef.current.addEventListener("stalled", handleStalled);
    audioRef.current.addEventListener("waiting", handleStalled);
    audioRef.current.addEventListener("error", handleAudioError);

    setCurrentTime(audioRef.current.currentTime || 0);
    setDuration(audioRef.current.duration || 0);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      }
      if (audioRef.current) {
        audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audioRef.current.removeEventListener("ended", handleEnded);
        audioRef.current.removeEventListener("playing", countPlayIfNeeded);
        audioRef.current.removeEventListener("playing", scheduleAutoCoverGenerationIfNeeded);
        audioRef.current.removeEventListener("playing", scheduleLanguageDetectionIfNeeded);
        audioRef.current.removeEventListener("playing", clearStallTimer);
        audioRef.current.removeEventListener("pause", clearPlayTimer);
        audioRef.current.removeEventListener("pause", clearCoverAutoGenerateTimer);
        audioRef.current.removeEventListener("pause", clearLanguageDetectTimer);
        audioRef.current.removeEventListener("pause", clearStallTimer);
        audioRef.current.removeEventListener("pause", handleUnexpectedPause);
        audioRef.current.removeEventListener("stalled", handleStalled);
        audioRef.current.removeEventListener("waiting", handleStalled);
        audioRef.current.removeEventListener("error", handleAudioError);
      }
      if (unexpectedPauseTimer) clearTimeout(unexpectedPauseTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearPlayTimer();
      clearCoverAutoGenerateTimer();
      clearLanguageDetectTimer();
      clearStallTimer();
    };
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack?.id) return;
    const trackSnapshot = currentTrack;

    let cancelled = false;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    async function resolveAndLoad() {
      const trackId = trackSnapshot.id;
      const suffix = resolveStreamSuffix(trackSnapshot, usePlayerStore.getState().playHighestQuality);

      const audioEl = audioRef.current;
      if (!audioEl) return;

      const streamUrl = `/api/tracks/${trackId}/stream${suffix}`;
      let resolvedUrl = streamUrl;

      setResolvingUrl(true);
      setAudioSource("unknown");
      setAudioSourceState("unknown");

      try {
        const response = await fetch(streamUrl, {
          headers: {
            Range: "bytes=0-0",
          },
        });

        if (response.ok) {
          const cacheStateHeader = (response.headers.get("x-melodiq-audio-cache-state") || "").toLowerCase();
          const sourceHeader = (response.headers.get("x-melodiq-audio-source") || "").toLowerCase();
          const source: AudioSource =
            sourceHeader === "cache" ? "cache" : sourceHeader === "s3" ? "s3" : "unknown";
          const state: AudioSourceState =
            cacheStateHeader === "miss"
              ? "miss"
              : cacheStateHeader === "fallback"
                ? "fallback"
                : cacheStateHeader === "hit"
                  ? "hit"
                  : sourceHeader === "cache"
                    ? "hit"
                    : "unknown";

          if (!cancelled && requestId === requestIdRef.current) {
            setAudioSource(source);
            setAudioSourceState(state);
          }
        } else {
          const hdFallback = suffix ? trackSnapshot.audioUrlHd : null;
          const fallback = hdFallback || trackSnapshot.audioUrl;
          if (typeof fallback === "string" && /^https?:\/\//i.test(fallback)) {
            resolvedUrl = fallback;
          }
        }
      } catch {
        const hdFallback = suffix ? trackSnapshot.audioUrlHd : null;
        const fallback = hdFallback || trackSnapshot.audioUrl;
        if (typeof fallback === "string" && /^https?:\/\//i.test(fallback)) {
          resolvedUrl = fallback;
        }
      }

      const normalizedTargetUrl = new URL(resolvedUrl, window.location.href).toString();

      const isInitialLoad = lastLoadedTrackIdRef.current === null;
      const shouldResumeTime = lastLoadedTrackIdRef.current === trackId;
      const storedProgress = usePlayerStore.getState().progress;
      const resumeTime = shouldResumeTime
        ? (audioEl.currentTime || 0)
        : (isInitialLoad && storedProgress > 0 ? storedProgress : 0);
      const shouldResume = usePlayerStore.getState().isPlaying && !audioEl.paused;

      // Check if we're already playing this exact blob or stream URL
      const alreadyPlayingThisTrack = lastLoadedTrackIdRef.current === trackId &&
        audioEl.src && audioEl.src !== "" && !audioEl.error;

      if (alreadyPlayingThisTrack) {
        lastLoadedTrackIdRef.current = trackId;
        setResolvingUrl(false);
        if (usePlayerStore.getState().isPlaying || shouldResume) {
          void tryPlay();
        }
        return;
      }

      // Download the full audio file as a Blob so playback is network-independent.
      // This prevents mid-song stops on flaky mobile connections.
      let playUrl = normalizedTargetUrl;
      try {
        const blobResponse = await fetch(normalizedTargetUrl);
        if (blobResponse.ok && !cancelled && requestId === requestIdRef.current) {
          const blob = await blobResponse.blob();
          if (!cancelled && requestId === requestIdRef.current) {
            // Revoke previous blob URL to free memory
            if (activeBlobUrlRef.current) {
              URL.revokeObjectURL(activeBlobUrlRef.current);
            }
            const blobUrl = URL.createObjectURL(blob);
            activeBlobUrlRef.current = blobUrl;
            playUrl = blobUrl;
          }
        }
      } catch {
        // Network failed — fall back to streaming URL
      }

      if (cancelled || requestId !== requestIdRef.current || audioRef.current !== audioEl) {
        return;
      }

      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl.src = playUrl;
      audioEl.load();

      await new Promise<void>((resolve) => {
        if (audioRef.current !== audioEl) {
          resolve();
          return;
        }
        const done = () => resolve();
        audioEl.addEventListener("loadedmetadata", done, { once: true });
        audioEl.addEventListener("canplay", done, { once: true });
      });

      setResolvingUrl(false);

      if (cancelled || requestId !== requestIdRef.current || audioRef.current !== audioEl) {
        return;
      }

      lastLoadedTrackIdRef.current = trackId;

      if (resumeTime > 0) {
        try {
          audioEl.currentTime = resumeTime;
        } catch {}
      }

      if (usePlayerStore.getState().isPlaying || shouldResume) {
        void tryPlay();
      }
    }

    resolveAndLoad();

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack?.id,
    currentTrack?.audioUrl,
    currentTrack?.audioUrlHd,
    currentTrack?.format,
    currentTrack?.formatHd,
    currentTrack?.s3Key,
    currentTrack?.s3KeyHd,
    playHighestQuality,
    detectAudioSource,
    tryPlay,
  ]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && castState !== "connected") {
        void tryPlay();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, tryPlay, castState]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!currentTrack) {
      setCurrentTime(0);
      setDuration(0);
      lastLoadedTrackIdRef.current = null;
      // Auto-play eerste uit queue als die bestaat
      if (queue.length > 0) {
        usePlayerStore.getState().playNext();
      }
    }
  }, [currentTrack, queue.length]);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionsMenuOpen]);

  const togglePlay = useCallback(() => {
    if (!allowWithDelay(playToggleCooldownRef, 350)) return;
    if (castState === "connected") {
      togglePlayCast();
      return;
    }
    if (!currentTrack && queue.length > 0) {
      usePlayerStore.getState().playNext();
      return;
    }
    if (!currentTrack) return;
    const nextPlaying = !isPlaying;
    usePlayerStore.getState().setIsPlaying(nextPlaying);
    if (nextPlaying && audioRef.current) {
      void tryPlay();
    }
  }, [currentTrack, isPlaying, queue.length, castState, togglePlayCast]);

  const handlePrevious = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    playPrevious();
  }, [playPrevious]);

  const handleNext = useCallback(() => {
    playNext();
  }, [playNext]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (castState === "connected") {
        seekCast(time);
        setCurrentTime(time);
      } else if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    [castState, seekCast]
  );

  const handleVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value);
      setVolume(vol);
    },
    [setVolume]
  );

  const handleJumpToNowPlaying = useCallback(() => {
    if (!currentTrack) return;
    sessionStorage.setItem("melodiq-jump-to-track", currentTrack.id);
    if (pathname === "/library") {
      window.dispatchEvent(new CustomEvent("melodiq:jump-to-now-playing"));
    } else {
      router.push("/library");
    }
  }, [currentTrack, pathname, router]);

  function getStatusString() {
    if (resolvingUrl) return "Loading audio...";
    if (!currentTrack) return "";

    const displayTitle = cleanTitle || currentTrack.prompt.substring(0, 50);
    const suffix = displayTitle ? ` • ${displayTitle}` : "";
    return `MelodIQ Player${suffix}`;
  }

  const isNowPlaying = currentTrack !== null;
  const nowPlayingQueue = currentTrack ? [currentTrack, ...queue] : queue;
  const playerCoverUrl = currentTrack?.coverUrl || (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);

  // Whether to request the HD file when casting
  const castHd = currentTrack
    ? resolveStreamSuffix(currentTrack, playHighestQuality) === "?hd=true"
    : false;

  // When casting and the track changes (next/prev), auto-load the new track on the cast device
  useEffect(() => {
    if (castState !== "connected" || !currentTrack) return;
    let cancelled = false;
    const fetchAndLoad = async () => {
      try {
        const res = await fetch(`/api/tracks/${currentTrack.id}/cast-url${castHd ? "?hd=true" : ""}`);
        if (!res.ok || cancelled) return;
        const data = await res.json() as { url: string; contentType: string };
        if (cancelled) return;
        await loadCastMedia({
          streamUrl: data.url,
          contentType: data.contentType,
          title: currentTrack.title || currentTrack.prompt.substring(0, 80) || undefined,
          coverUrl: playerCoverUrl ?? undefined,
          currentTime: 0,
        });
      } catch (err) {
        console.error("[Cast] auto-load on track change error:", err);
      }
    };
    void fetchAndLoad();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, castState]);

  // Metadata passed to ChromecastButton (URL is fetched server-side via /cast-url)
  const castMeta = useMemo(() => {
    if (!currentTrack) return null;
    return {
      title: currentTrack.title || currentTrack.prompt.substring(0, 80) || undefined,
      coverUrl: playerCoverUrl ?? undefined,
      currentTime,
      duration,
    };
  }, [currentTrack, playerCoverUrl, currentTime, duration]);

  return (
    <>
      {/* Screen reader live region */}
      <div aria-live="polite" className="sr-only">
        {getStatusString()}
      </div>

      {isFullscreen && currentTrack && (
        <FullscreenPlayer audioSource={audioSource} audioSourceState={audioSourceState} />
      )}

      <div className="fixed bottom-0 left-0 right-0 h-20 bg-[#161621] border-t border-white/5 z-[60]">
        {playerCoverUrl ? (
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
            <img
              src={playerCoverUrl}
              alt=""
              className="h-full w-full object-cover scale-125 blur-2xl opacity-45"
              draggable={false}
              onError={e => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = "/fallback-cover.svg";
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_45%),linear-gradient(135deg,rgba(22,22,33,0.65)_0%,rgba(22,22,33,0.92)_70%,rgba(22,22,33,0.98)_100%)]" />
          </div>
        ) : null}

        <div className="relative max-w-screen-2xl mx-auto h-full px-4 flex items-center gap-3">
          {/* Now Playing Info */}
          {currentTrack ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:w-[240px]">
              <button
                onClick={() => setIsFullscreen(true)}
                className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-white/5"
                title="Go fullscreen"
              >
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={e => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = "/fallback-cover.svg";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </button>
              <div className="min-w-0 overflow-hidden">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="block min-w-0 flex-1 text-sm font-medium text-white/90 text-left hover:underline overflow-hidden"
                    title={cleanTitle || currentTrack.prompt}
                    style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 4%, black 85%, transparent 100%)" }}
                  >
                    <span className="inline-block whitespace-nowrap animate-[marquee_12s_linear_infinite] hover:[animation-play-state:paused]">
                      {cleanTitle || currentTrack.prompt.substring(0, 50)}
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                      {cleanTitle || currentTrack.prompt.substring(0, 50)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToNowPlaying}
                    className="shrink-0 p-1 rounded-full text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
                    title="Jump to now playing in track list"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="7" strokeWidth={2} />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                      <path strokeLinecap="round" strokeWidth={2} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-white/40 truncate">
                  {artistLabel ? `${artistLabel} — ` : ""}{composerLabel ? `composer: ${composerLabel} — ` : ""}{formatProviderLabel(currentTrack.provider)}
                  {currentTrack.duration ? ` • ${Math.floor(currentTrack.duration / 60)}:${String(Math.floor(currentTrack.duration % 60)).padStart(2, "0")}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:w-[240px]">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <span className="text-sm text-white/30">No track selected</span>
            </div>
          )}

          {/* Center Controls */}
          <div className="flex items-center justify-center gap-2 sm:flex-1">
            <button
              onClick={() => setShuffleEnabled(!shuffleEnabled)}
              className={`hidden sm:block p-2 rounded-full transition-colors ${shuffleEnabled ? "text-white" : "text-white/30 hover:text-white/60"}`}
              title={shuffleEnabled ? "Shuffle on" : "Shuffle off"}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
              </svg>
            </button>
            <button
              onClick={handlePrevious}
              disabled={!currentTrack}
              className="p-2 rounded-full text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
              title="Previous"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h2v14H6zM9 12l10 7V5z" />
              </svg>
            </button>

            <button
              onClick={togglePlay}
              disabled={!currentTrack}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all active:scale-95"
              title={castState === "connected" ? (isRemotePaused ? "Play" : "Pause") : (isPlaying ? "Pause" : "Play")}
            >
              {resolvingUrl ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
              ) : (castState === "connected" ? !isRemotePaused : isPlaying) ? (
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
              onClick={handleNext}
              disabled={queue.length === 0}
              className="p-2 rounded-full text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
              title="Next"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 5h2v14h-2zM6 19l10-7L6 5z" />
              </svg>
            </button>

            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-2 ml-2 min-w-0 max-w-72 flex-1">
              <span className="text-xs text-white/40 w-8 text-right tabular-nums">
                {duration > 0 ? `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, "0")}` : "0:00"}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                disabled={!currentTrack}
                aria-label="Seek position"
                className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary-500 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
              />
              <span className="text-xs text-white/40 w-8 tabular-nums">
                {duration > 0 ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}` : "0:00"}
              </span>
              {currentTrack && (
                <>
                  <AudioSourceBadge source={audioSource} state={audioSourceState} />
                  <span className="inline-flex items-center rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/40">
                    {(playHighestQuality && currentTrack.formatHd ? currentTrack.formatHd : currentTrack.format) ?? "mp3"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0 sm:w-[240px]">
            {/* Queue info */}
            {queue.length > 0 && (
              <div className="hidden md:flex items-center gap-1 text-xs text-white/40 px-2 py-1 rounded-full bg-white/5" title={`${queue.length} tracks in queue`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
                </svg>
                {queue.length}
              </div>
            )}

            {/* Autoplay toggle */}
            <button
              type="button"
              onClick={() => setAutoPlayNext(!autoPlayNext)}
              className={`p-2 rounded-full transition-colors ${autoPlayNext ? "text-primary-400 hover:text-primary-300" : "text-white/30 hover:text-white/60"}`}
              title={autoPlayNext ? "Autoplay on" : "Autoplay off"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5l4 4-4 4" opacity="0.5" />
              </svg>
            </button>

            {/* Song details panel toggle */}
            <button
              type="button"
              onClick={() => setShowTrackDetailsPanel(!showTrackDetailsPanel)}
              className={`p-2 rounded-full transition-colors ${showTrackDetailsPanel ? "text-primary-400 hover:text-primary-300" : "text-white/30 hover:text-white/60"}`}
              title={showTrackDetailsPanel ? "Hide song details" : "Show song details"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3v18" />
              </svg>
            </button>

            <ChromecastButton
              trackId={currentTrack?.id ?? null}
              hd={castHd}
              meta={castMeta}
              disabled={!currentTrack}
              onCastConnected={() => usePlayerStore.getState().setIsPlaying(false)}
            />

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              disabled={!currentTrack}
              className="p-2 rounded-full text-white/40 hover:text-white/80 disabled:opacity-20 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            {/* Track actions menu */}
            {currentTrack && (
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen((o) => !o)}
                  className={`p-2 rounded-full transition-colors ${actionsMenuOpen ? "text-primary-400 bg-white/10" : "text-white/30 hover:text-white/70 hover:bg-white/5"}`}
                  title="Track actions"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                  </svg>
                </button>

                {actionsMenuOpen && (
                  <div className="absolute bottom-10 right-0 z-[70] min-w-52 rounded-xl border border-white/10 bg-[#12121a] shadow-2xl p-1.5">
                    <p className="px-2.5 pb-1 pt-0.5 text-[11px] uppercase tracking-wide text-white/35">Add to playlist</p>
                    {playlists.length === 0 ? (
                      <p className="px-2.5 py-1.5 text-xs text-white/40 italic">No playlists yet</p>
                    ) : (
                      playlists.map((playlist) => {
                        const alreadyIn = playlist.trackIds.includes(currentTrack.id);
                        return (
                          <button
                            key={playlist.id}
                            type="button"
                            onClick={() => {
                              addTrackToPlaylist(playlist.id, currentTrack.id, { allowDuplicate: false });
                              setActionsMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-white/80 hover:bg-white/5 flex items-center justify-between gap-2"
                          >
                            <span>{playlist.name}</span>
                            {alreadyIn && (
                              <svg className="w-3.5 h-3.5 text-primary-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Volume */}
            <div className="hidden lg:flex items-center gap-2 ml-1">
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 12a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolume}
                aria-label="Volume"
                className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary-500"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
