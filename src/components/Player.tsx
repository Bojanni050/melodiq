"use client";

import { useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlayerStore, useUserStore, usePlaylistStore } from "@/lib/store";
import type { Track } from "@/lib/store";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { parseLyrics } from "@/lib/parse-lyrics";
import FullscreenPlayer from "@/components/player/FullscreenPlayer";
import {
  type AudioSource,
  type AudioSourceState,
  type ActionTimestampRef,
  mediaBase,
  resolveStreamSuffix,
  getPlayingFormat,
  AudioSourceBadge,
  getSharedAudioElement,
  formatProviderLabel,
  allowWithDelay,
  getTrackLoudness,
  loudnessToGain,
} from "@/components/player/playerUtils";
import { getSharedAudioGraph, setNormalizationGain } from "@/lib/sharedAudioGraph";
import { useMediaSession } from "@/components/player/hooks/useMediaSession";
import { usePopupPlayerSync } from "@/components/player/hooks/usePopupPlayerSync";
import { usePlayerHotkeys } from "@/components/player/hooks/usePlayerHotkeys";
import { useTrackBackgroundServices } from "@/components/player/hooks/useTrackBackgroundServices";
import { useT } from "@/hooks/useT";

export default function Player() {
  const t = useT();
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
    normalizeVolume,
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
      normalizeVolume: s.normalizeVolume,
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
  const isListener = user?.role === "listener" || user?.role == null;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playToggleCooldownRef = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const requestIdRef = useRef(0);
  const lastLoadedTrackIdRef = useRef<string | null>(null);
  const lastProgressWriteRef = useRef(0);
  const trackPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const writerLabel = (currentTrack?.writerName || "").trim() || (user?.writerAlias || "").trim() || "";
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
  }, [currentTrack]);

  useMediaSession(currentTrack, audioRef);

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

  const {
    clearPlayTimer,
    clearCoverAutoGenerateTimer,
    clearLanguageDetectTimer,
    clearNextTrackPrefetchTimer,
    scheduleAutoCoverGenerationIfNeeded,
    scheduleLanguageDetectionIfNeeded,
    scheduleNextTrackPrefetchIfNeeded,
    countPlayIfNeeded,
  } = useTrackBackgroundServices(audioRef, currentTrackRef);

  usePlayerHotkeys({ audioRef, tryPlay });

  useEffect(() => {
    const sharedAudioElement = getSharedAudioElement();
    if (!sharedAudioElement) return;

    audioRef.current = sharedAudioElement;
    audioRef.current.volume = volume;
    usePlayerStore.getState().setAudioElement(audioRef.current);

    const handleTimeUpdate = () => {
      const time = audioRef.current?.currentTime || 0;
      setCurrentTime(time);

      // `progress` is a persisted store field, and zustand runs partialize --
      // which maps every queue entry through scrubTrack -- on each set(). At
      // ~4 timeupdates/sec that was steady background work for a value whose
      // only reader is resume-on-reload, so write it about once a second. A
      // seek or an explicit reset moves `time` by more than the threshold, so
      // it still lands immediately.
      if (Math.abs(time - lastProgressWriteRef.current) >= 1) {
        lastProgressWriteRef.current = time;
        usePlayerStore.getState().setProgress(time);
      }
    };

    const handleLoadedMetadata = () => {
      const secs = audioRef.current?.duration || 0;
      setDuration(secs);
      // Backfill duration in the DB if it's missing
      const track = usePlayerStore.getState().currentTrack;
      if (track && !track.duration && secs > 0 && !track.publicSource) {
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
      const { autoPlayNext, queue, playNext, pauseBetweenTracks, setIsPlaying, setProgress } = usePlayerStore.getState();
      if (autoPlayNext && queue.length > 0) {
        if (pauseBetweenTracks) {
          if (trackPauseTimerRef.current) clearTimeout(trackPauseTimerRef.current);
          trackPauseTimerRef.current = setTimeout(() => {
            trackPauseTimerRef.current = null;
            playNext();
          }, 1000);
        } else {
          playNext();
        }
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

    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current.addEventListener("ended", handleEnded);
    audioRef.current.addEventListener("playing", countPlayIfNeeded);
    audioRef.current.addEventListener("playing", scheduleAutoCoverGenerationIfNeeded);
    audioRef.current.addEventListener("playing", scheduleLanguageDetectionIfNeeded);
    audioRef.current.addEventListener("playing", scheduleNextTrackPrefetchIfNeeded);
    audioRef.current.addEventListener("playing", clearStallTimer);
    audioRef.current.addEventListener("pause", clearPlayTimer);
    audioRef.current.addEventListener("pause", clearCoverAutoGenerateTimer);
    audioRef.current.addEventListener("pause", clearLanguageDetectTimer);
    audioRef.current.addEventListener("pause", clearNextTrackPrefetchTimer);
    audioRef.current.addEventListener("pause", clearStallTimer);
    audioRef.current.addEventListener("pause", handleUnexpectedPause);
    audioRef.current.addEventListener("stalled", handleStalled);
    audioRef.current.addEventListener("waiting", handleStalled);
    audioRef.current.addEventListener("error", handleAudioError);

    setCurrentTime(audioRef.current.currentTime || 0);
    setDuration(audioRef.current.duration || 0);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (audioRef.current) {
        audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audioRef.current.removeEventListener("ended", handleEnded);
        audioRef.current.removeEventListener("playing", countPlayIfNeeded);
        audioRef.current.removeEventListener("playing", scheduleAutoCoverGenerationIfNeeded);
        audioRef.current.removeEventListener("playing", scheduleLanguageDetectionIfNeeded);
        audioRef.current.removeEventListener("playing", scheduleNextTrackPrefetchIfNeeded);
        audioRef.current.removeEventListener("playing", clearStallTimer);
        audioRef.current.removeEventListener("pause", clearPlayTimer);
        audioRef.current.removeEventListener("pause", clearCoverAutoGenerateTimer);
        audioRef.current.removeEventListener("pause", clearLanguageDetectTimer);
        audioRef.current.removeEventListener("pause", clearNextTrackPrefetchTimer);
        audioRef.current.removeEventListener("pause", clearStallTimer);
        audioRef.current.removeEventListener("pause", handleUnexpectedPause);
        audioRef.current.removeEventListener("stalled", handleStalled);
        audioRef.current.removeEventListener("waiting", handleStalled);
        audioRef.current.removeEventListener("error", handleAudioError);
      }
      if (unexpectedPauseTimer) clearTimeout(unexpectedPauseTimer);
      if (trackPauseTimerRef.current) clearTimeout(trackPauseTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearPlayTimer();
      clearCoverAutoGenerateTimer();
      clearLanguageDetectTimer();
      clearNextTrackPrefetchTimer();
      clearStallTimer();
    };
  }, [volume, clearPlayTimer, clearCoverAutoGenerateTimer, clearLanguageDetectTimer, clearNextTrackPrefetchTimer, countPlayIfNeeded, scheduleAutoCoverGenerationIfNeeded, scheduleLanguageDetectionIfNeeded, scheduleNextTrackPrefetchIfNeeded]);

  // Loudness normalization's gain stage lives in the shared Web Audio graph
  // (see sharedAudioGraph.ts), alongside the fullscreen visualizer's
  // analyser tap. Wire it up here, unconditionally, so normal (non-
  // fullscreen) playback is routed through the gain node too — not just
  // whenever the visualizer happens to have mounted it lazily.
  useEffect(() => {
    const sharedAudioElement = getSharedAudioElement();
    if (!sharedAudioElement) return;
    getSharedAudioGraph(sharedAudioElement);
  }, []);

  // Apply per-track loudness-normalization gain. A pure gain multiplier
  // can't touch dynamics — it just rebalances level between tracks — so
  // this is safe to leave running continuously while the toggle is on.
  useEffect(() => {
    if (!normalizeVolume || !currentTrack?.id) {
      setNormalizationGain(1);
      return;
    }

    let cancelled = false;
    const trackId = currentTrack.id;
    const trackSnapshot = currentTrack;

    void getTrackLoudness(trackSnapshot).then((loudness) => {
      if (cancelled || usePlayerStore.getState().currentTrack?.id !== trackId) return;
      setNormalizationGain(loudnessToGain(loudness));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the track identity should retrigger this fetch, not every field-level update to currentTrack
  }, [currentTrack?.id, normalizeVolume]);

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

      // requestId/cancelled alone don't reliably catch every case where a
      // newer track switch supersedes this run (e.g. two rapid track
      // switches whose effects both end up in flight) — cross-check against
      // the store's live currentTrack too, since that's updated synchronously
      // by playTrackFromGesture and is the real source of truth for "which
      // track should be loaded right now".
      const isSuperseded = () =>
        cancelled ||
        requestId !== requestIdRef.current ||
        usePlayerStore.getState().currentTrack?.id !== trackId;

      const streamUrl = `${mediaBase(trackSnapshot)}/stream${suffix}`;
      const normalizedTargetUrl = new URL(streamUrl, window.location.href).toString();

      setResolvingUrl(true);
      setAudioSource("unknown");
      setAudioSourceState("unknown");

      // Cache/source-detection probe for the AudioSourceBadge only — fired
      // in parallel, never awaited, so it can't delay audioEl.src/load()
      // below. It used to be awaited before the src was set, which stalled
      // the actual start of playback on every track (worst on mobile, where
      // this extra round-trip lands on top of the network being throttled
      // once the screen turns off).
      void fetch(streamUrl, { headers: { Range: "bytes=0-0" } })
        .then((response) => {
          if (!response.ok || isSuperseded()) return;
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
          setAudioSource(source);
          setAudioSourceState(state);
        })
        .catch(() => {});

      const isInitialLoad = lastLoadedTrackIdRef.current === null;
      // playTrackFromGesture (store.ts) may have already loaded and started
      // playing this track directly on the <audio> element, ahead of this
      // effect. Recognize that via the shared dataset marker so we resume
      // from the current position instead of restarting from 0 once this
      // effect's blob fetch completes and swaps the src.
      const gestureLoadedThisTrack = audioEl.dataset.gestureTrackId === trackId &&
        !!audioEl.src && audioEl.src !== "" && !audioEl.error;
      // A gesture-driven load for this exact track is queued (rAF-deferred,
      // see playTrackFromGesture) but hasn't run yet — this effect fires
      // first, on the same commit. Defer to it entirely rather than also
      // calling audioEl.src/.load() here: two loads racing for the same
      // track aborts/restarts the first one's buffering and is what made
      // switching tracks feel delayed.
      const gestureLoadPending = audioEl.dataset.gesturePendingTrackId === trackId;
      const shouldResumeTime = lastLoadedTrackIdRef.current === trackId || gestureLoadedThisTrack;
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
        if (!isSuperseded() && (usePlayerStore.getState().isPlaying || shouldResume)) {
          void tryPlay();
        }
        return;
      }

      // If playTrackFromGesture already started (or is about to start, via
      // its queued rAF callback) this track playing from the streaming URL,
      // there's nothing left for this effect to do — loading it again here
      // would restart the track from 0 (a fresh audioEl.src assignment
      // doesn't carry over currentTime) and race the store's own load.
      if ((gestureLoadedThisTrack || gestureLoadPending) && usePlayerStore.getState().isPlaying) {
        lastLoadedTrackIdRef.current = trackId;
        setResolvingUrl(false);
        return;
      }

      // Stream via the <audio> element's native HTTP range-request support
      // instead of fetching the whole file as a Blob up front — the
      // stream endpoints already serve 206 Partial Content (see the
      // Range: bytes=0-0 probe above), and the stall/error listeners below
      // already reload+resume the src on flaky connections, so a full
      // up-front download bought no real resilience while costing the full
      // file size in data for every track, including skips.
      const playUrl = normalizedTargetUrl;

      if (isSuperseded() || audioRef.current !== audioEl) {
        return;
      }

      audioEl.pause();
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

      if (isSuperseded() || audioRef.current !== audioEl) {
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
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const shouldPlay = isPlaying;
    if (shouldPlay) {
      if (audio.paused) {
        void tryPlay();
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, tryPlay]);

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
  }, [currentTrack, isPlaying, queue.length]);

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

  const { popupOpen, handlePopOutPlayer } = usePopupPlayerSync({
    audioRef,
    audioSource,
    audioSourceState,
    togglePlay,
    handleNext,
    handlePrevious,
    setCurrentTime,
  });

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
            <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:w-[200px] lg:w-[260px]">
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
                    decoding="async"
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
                  {!currentTrack.publicSource && (
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
                  )}
                </div>
                <p className="text-sm text-white/40 truncate">
                  {artistLabel ? `${artistLabel} — ` : ""}{composerLabel ? `composer: ${composerLabel} — ` : ""}{writerLabel ? `writer: ${writerLabel} — ` : ""}{formatProviderLabel(currentTrack.provider)}
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
              title={isPlaying ? "Pause" : "Play"}
            >
              {resolvingUrl ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
              ) : isPlaying ? (
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
            <div className="hidden sm:flex items-center gap-2 ml-2 min-w-0 max-w-48 lg:max-w-72 flex-1">
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
                    {getPlayingFormat(currentTrack, playHighestQuality)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="hidden sm:flex items-center justify-end gap-1 flex-shrink-0 sm:w-[200px] lg:w-[240px]">
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

            {!isListener && (
              <button
                type="button"
                onClick={handlePopOutPlayer}
                disabled={!currentTrack}
                className={`p-2 rounded-full transition-colors disabled:opacity-20 ${popupOpen ? "text-white bg-white/10" : "text-white/40 hover:text-white/80"}`}
                title={popupOpen ? "Close pop-out player window" : "Open player in a second window (drag to another monitor)"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 3h8v8m0-8L11 13M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6" />
                </svg>
              </button>
            )}

            {/* Track actions menu */}
            {currentTrack && !currentTrack.publicSource && (
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen((o) => !o)}
                  className={`p-2 rounded-full transition-colors ${actionsMenuOpen ? "text-primary-400 bg-white/10" : "text-white/30 hover:text-white/70 hover:bg-white/5"}`}
                  title={t("discover.trackOptions") || "Track actions"}
                  aria-label={t("discover.trackOptions") || "Track actions"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                  </svg>
                </button>

                {actionsMenuOpen && (
                  <div className="absolute bottom-10 right-0 z-[70] min-w-52 rounded-xl border border-white/10 bg-[#12121a] shadow-2xl p-1.5 space-y-1">
                    {/* Go to track in library */}
                    <button
                      type="button"
                      onClick={() => {
                        handleJumpToNowPlaying();
                        setActionsMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm font-medium text-white/90 hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-white/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="7" strokeWidth={2} />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                        <path strokeLinecap="round" strokeWidth={2} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                      </svg>
                      <span>{t("discover.goToTrack") || "Go to track"}</span>
                    </button>

                    <div className="my-1 border-t border-white/10" />

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

      {/* PWA install hint — mobile only, shown once per session while playing */}
      {currentTrack && <PwaInstallHint />}
    </>
  );
}

function PwaInstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("melodiq-pwa-hint-dismissed") === "1";
  });

  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  // Check if already installed (standalone mode)
  const isStandalone =
    typeof window !== "undefined" &&
    ((window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches);

  if (dismissed || isStandalone || !canInstall) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      sessionStorage.setItem("melodiq-pwa-hint-dismissed", "1");
      setDismissed(true);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    sessionStorage.setItem("melodiq-pwa-hint-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-[var(--player-height,72px)] left-0 right-0 z-40 flex justify-center px-4 pb-2 sm:hidden pointer-events-none">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1a1b25]/95 px-3 py-2 shadow-lg backdrop-blur-md pointer-events-auto">
        <svg className="h-4 w-4 shrink-0 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-[11px] text-white/70">
          Installeer MelodIQ voor ononderbroken afspelen op je telefoon
        </p>
        <button
          type="button"
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-primary-500/80 px-2 py-1 text-[10px] font-semibold text-white hover:bg-primary-400 transition-colors"
        >
          Installeer
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-0.5 text-white/30 hover:text-white/60 transition-colors"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
