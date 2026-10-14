import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debouncedStorage";
import { shouldResumePlayback } from "@/lib/playerResume";
import { withCdn } from "@/lib/cdn-client";

// Playback repeat behaviour:
// - "off"   → stop after the queue drains (default)
// - "all"   → loop the whole play context ("album"/playlist) back to the top
// - "track" → replay the current track forever
export type RepeatMode = "off" | "all" | "track";

export interface Track {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  s3Key: string | null;
  s3KeyHd: string | null;
  s3KeyMp3?: string | null;
  s3KeyOgg?: string | null;
  format?: string | null;
  formatHd?: string | null;
  duration: number | null;
  lyrics: string | null;
  language?: string | null;
  translatedLyrics?: string | null;
  translatedLanguage?: string | null;
  createdAt: string;
  error: string | null;
  rating?: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  s3KeyCoverThumb?: string | null;
  playCount?: number | null;
  othersPlayCount?: number | null;
  votedAt?: string | null;
  lyricsTimestamps?: string | null;
  instrumental?: boolean | null;
  artistName?: string | null;
  composerName?: string | null;
  writerName?: string | null;
  deletedAt?: string | null;
  archivedAt?: string | null;
  hiddenAt?: string | null;
  releaseStatus?: string | null;
  publishDate?: string | null;
  trackDna?: string | null;
  audioDna?: string | null;
  // True for tracks loaded from the public Discover surface, which the
  // viewer may not own — media/side-effects route through the public
  // /api/discover/{id}/* endpoints instead of the private /api/tracks/{id}/*
  // ones. See Player.tsx's mediaBase() helper.
  publicSource?: boolean;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  history: Track[];
  isPlaying: boolean;
  autoPlayNext: boolean;
  showTrackDetailsPanel: boolean;
  rightPanelWidth: number;
  volume: number;
  progress: number;
  // Last moment playback was known to be alive; written by setIsPlaying and
  // setProgress and persisted, so a reload right after the page died can be
  // told apart from opening the app hours later (see lib/playerResume.ts).
  lastActiveAt: number;
  // True when the browser refused a play() with NotAllowedError. A freshly
  // loaded document has no user activation yet, so a resume-over-reload can be
  // blocked; Player.tsx then retries once on the first real input.
  resumeBlocked: boolean;
  audioElement: HTMLAudioElement | null;
  playContext: Track[] | null;
  isFullscreen: boolean;
  setCurrentTrack: (track: Track | null) => void;
  enqueueTrack: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  setQueue: (queue: Track[]) => void;
  playNext: () => void;
  playQueueItem: (trackId: string) => void;
  reorderQueueItem: (trackId: string, insertAtIndex: number) => void;
  playPrevious: () => void;
  setIsPlaying: (playing: boolean) => void;
  setResumeBlocked: (blocked: boolean) => void;
  setAudioElement: (audioElement: HTMLAudioElement | null) => void;
  playTrackFromGesture: (track: Track) => void;
  setPlayContext: (tracks: Track[] | null) => void;
  hydrateQueueFromContext: () => void;
  syncTrackSnapshots: (tracks: Track[]) => void;
  setAutoPlayNext: (enabled: boolean) => void;
  setShowTrackDetailsPanel: (enabled: boolean) => void;
  setRightPanelWidth: (width: number) => void;
  playHighestQuality: boolean;
  visualizerEnabled: boolean;
  visualizerMode: number;
  visualizerGradient: string;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  pauseBetweenTracks: boolean;
  normalizeVolume: boolean;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setPlayHighestQuality: (enabled: boolean) => void;
  setVisualizerEnabled: (enabled: boolean) => void;
  setVisualizerMode: (mode: number) => void;
  setVisualizerGradient: (gradient: string) => void;
  setShuffleEnabled: (enabled: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  setPauseBetweenTracks: (enabled: boolean) => void;
  setNormalizeVolume: (enabled: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      history: [],
      isPlaying: false,
      autoPlayNext: true,
      showTrackDetailsPanel: true,
      rightPanelWidth: 500,
      volume: 0.8,
      progress: 0,
      lastActiveAt: 0,
      resumeBlocked: false,
      audioElement: null,
      playContext: null,
      isFullscreen: false,
      playHighestQuality: false,
      visualizerEnabled: false,
      visualizerMode: 2,
      visualizerGradient: "prism",
      shuffleEnabled: false,
      repeatMode: "off",
      pauseBetweenTracks: true,
      normalizeVolume: false,
      setCurrentTrack: (track) => {
        if (!track) {
          set({
            currentTrack: null,
            isPlaying: false,
          });
          return;
        }

        set((state) => {
          const shouldPushHistory =
            !!state.currentTrack && state.currentTrack.id !== track.id;

          const nextState: Partial<PlayerState> = {
            currentTrack: track,
            isPlaying: true,
            history: shouldPushHistory
              ? [...state.history, state.currentTrack!].slice(-50)
              : state.history,
          };

          if (state.autoPlayNext && state.playContext && state.playContext.length > 0) {
            const index = state.playContext.findIndex((t) => t.id === track.id);
            if (index >= 0) {
              nextState.queue = state.playContext
                .slice(index + 1)
                .filter((t) => t.status === "done" && !t.archivedAt && !t.hiddenAt);
            }
          }

          if (track.lyrics && track.lyrics.trim()) {
            nextState.showTrackDetailsPanel = true;
          } else if (track.publicSource) {
            // For public/discover tracks (e.g. in the library for listeners),
            // always open the right sidebar so they can see track details,
            // add to playlist, etc. — even without lyrics.
            nextState.showTrackDetailsPanel = true;
          }

          return nextState as PlayerState;
        });
      },
      enqueueTrack: (track) =>
        set((state) => {
          const exists = state.queue.some((item) => item.id === track.id);
          if (exists) return state;
          return { queue: [...state.queue, track] };
        }),
      removeFromQueue: (trackId) =>
        set((state) => ({ queue: state.queue.filter((track) => track.id !== trackId) })),
      clearQueue: () => set({ queue: [] }),
      setQueue: (queue) => set({ queue }),
      playNext: () =>
        set((state) => {
          if (state.queue.length === 0) {
            return { currentTrack: null, isPlaying: false };
          }
          let nextTrack: Track;
          let rest: Track[];
          if (state.shuffleEnabled && state.queue.length > 1) {
            const randomIndex = Math.floor(Math.random() * state.queue.length);
            nextTrack = state.queue[randomIndex];
            rest = state.queue.filter((_, i) => i !== randomIndex);
          } else {
            [nextTrack, ...rest] = state.queue;
          }
          return {
            currentTrack: nextTrack,
            queue: rest,
            isPlaying: true,
            history: state.currentTrack
              ? [...state.history, state.currentTrack].slice(-50)
              : state.history,
            showTrackDetailsPanel: (nextTrack.lyrics && nextTrack.lyrics.trim()) ? true : state.showTrackDetailsPanel,
          };
        }),
      playQueueItem: (trackId) =>
        // Jump straight to a queued track. Anything queued before it is
        // skipped (standard queue UX); the current track moves to history so
        // "previous" still returns to it. The Player's track-change effect
        // picks this up exactly like playNext and starts the audio.
        set((state) => {
          const index = state.queue.findIndex((t) => t.id === trackId);
          if (index < 0) return state;
          const [nextTrack, ...rest] = state.queue.slice(index);
          return {
            currentTrack: nextTrack,
            queue: rest,
            isPlaying: true,
            history: state.currentTrack
              ? [...state.history, state.currentTrack].slice(-50)
              : state.history,
          };
        }),
      // Drag-drop reorder from the queue panel. insertAtIndex is a gap index
      // into the array AS IT IS NOW (0 = before the first entry). Removing the
      // dragged entry first shifts every later position down by one, so the
      // insertion point is corrected below; dropping it back where it came
      // from (gap before or after itself) is a no-op.
      reorderQueueItem: (trackId, insertAtIndex) =>
        set((state) => {
          const from = state.queue.findIndex((t) => t.id === trackId);
          if (from < 0) return state;
          const insert = Math.max(0, Math.min(state.queue.length, insertAtIndex));
          if (insert === from || insert === from + 1) return state;
          const next = [...state.queue];
          const [moved] = next.splice(from, 1);
          next.splice(insert > from ? insert - 1 : insert, 0, moved);
          return { queue: next };
        }),
      playPrevious: () =>
        set((state) => {
          if (state.history.length === 0) {
            return state;
          }

          const previousTrack = state.history[state.history.length - 1];
          const nextHistory = state.history.slice(0, -1);

          return {
            currentTrack: previousTrack,
            isPlaying: true,
            history: nextHistory,
            queue: state.currentTrack
              ? [state.currentTrack, ...state.queue]
              : state.queue,
            showTrackDetailsPanel: (previousTrack.lyrics && previousTrack.lyrics.trim()) ? true : state.showTrackDetailsPanel,
          };
        }),
      setIsPlaying: (playing) =>
        set(playing ? { isPlaying: true, lastActiveAt: Date.now() } : { isPlaying: false }),
      setResumeBlocked: (blocked) => set({ resumeBlocked: blocked }),
      setAudioElement: (audioElement) => set({ audioElement }),
      playTrackFromGesture: (track) => {
        get().setCurrentTrack(track);

        const audioElement = get().audioElement;
        if (!audioElement) return;

        // Marked synchronously, before the rAF-deferred load below runs.
        // Player.tsx's currentTrack-change effect fires on this same commit
        // (ahead of the next animation frame) and checks this marker to
        // avoid kicking off its own competing .src/.load() for the same
        // track — without it, both this store and that effect would each
        // load the stream once, and the second .load() call aborts/restarts
        // whatever buffering the first one had already started.
        audioElement.dataset.gesturePendingTrackId = track.id;

        // Kies juiste url: absolute (http/https), of streaming endpoint /api/tracks/[id]/stream
        let url: string;
        if (track.audioUrl && /^https?:\/\//i.test(track.audioUrl)) {
          // Externe URL, gebruik direct
          url = track.audioUrl;
        } else {
          // Streaming API endpoint via MelodIQ
          const wantsHd = Boolean(
            (track.audioUrl || "").includes("hd=true") ||
            (get().playHighestQuality && (track.s3KeyHd || track.formatHd === "flac" || track.formatHd === "wav"))
          );
          const base = track.publicSource ? withCdn(`/api/discover/${track.id}`) : `/api/tracks/${track.id}`;
          url = `${base}/stream${wantsHd ? "?hd=true" : ""}`;
        }

        // Debug logging
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.log("[Player] playTrackFromGesture:", { track, url });
        }

        // The "now playing" highlight above is driven by currentTrack, set
        // synchronously already — but on slower (tablet) hardware the
        // .load() call below can occupy the main thread for a noticeable
        // moment, and the browser won't paint the highlight until this whole
        // synchronous handler returns. Deferring the actual audio element
        // work one frame lets the highlight paint first, so selecting a
        // track feels instant even while the stream is still loading.
        // Still fires within the same transient user-activation window as
        // the click, so autoplay isn't blocked.
        const runAudioSetup = () => {
          // The marker alone isn't proof: non-gesture loads (autoplay
          // playNext, previous, queue advance) swap .src without touching
          // the dataset markers, leaving a stale gestureTrackId behind.
          // Clicking that stale track again must reload — so also verify
          // the loaded src is actually this track's URL. (Bonus: this also
          // reloads when the URL gained a new ?v= version token after an
          // in-place audio change, instead of replaying stale bytes.)
          const expectedSrc =
            typeof window !== "undefined"
              ? new URL(url, window.location.href).toString()
              : url;
          const actualSrc = audioElement.currentSrc || audioElement.src;
          const isSameTrackAlreadyLoaded =
            audioElement.dataset.gestureTrackId === track.id &&
            !!audioElement.src &&
            !audioElement.error &&
            audioElement.readyState >= 1 &&
            actualSrc === expectedSrc;

          if (!isSameTrackAlreadyLoaded) {
            audioElement.pause();
            audioElement.currentTime = 0;
            audioElement.src = url || "";
            audioElement.volume = get().volume;
            audioElement.dataset.gestureTrackId = track.id;
            audioElement.load();
          }
          delete audioElement.dataset.gesturePendingTrackId;

          const playPromise = audioElement.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch((error) => {
              if (error instanceof DOMException && error.name === "NotAllowedError") {
                set({ isPlaying: false });
              }
            });
          }
        };

        if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
          window.requestAnimationFrame(runAudioSetup);
        } else {
          runAudioSetup();
        }
      },
      setPlayContext: (tracks) => set({ playContext: tracks }),
      hydrateQueueFromContext: () => {
        const current = get().currentTrack;
        const context = get().playContext;
        if (!current || !context || context.length === 0) return;
        const index = context.findIndex((t) => t.id === current.id);
        if (index < 0) return;
        set({ queue: context.slice(index + 1).filter((t) => t.status === "done" && !t.archivedAt && !t.hiddenAt) });
      },
      syncTrackSnapshots: (tracks) =>
        set((state) => {
          if (!tracks || tracks.length === 0) return state;
          const byId = new Map(tracks.map((track) => [track.id, track]));

          const patch = (track: Track) => {
            const refreshed = byId.get(track.id);
            return refreshed ? { ...track, ...refreshed } : track;
          };

          const nextCurrentTrack = state.currentTrack ? patch(state.currentTrack) : null;
          const nextQueue = state.queue.map(patch);
          const nextHistory = state.history.map(patch);
          const nextPlayContext = state.playContext ? state.playContext.map(patch) : null;

          const hasChanges =
            (state.currentTrack?.id ?? null) !== (nextCurrentTrack?.id ?? null) ||
            (state.currentTrack?.title ?? null) !== (nextCurrentTrack?.title ?? null) ||
            (state.currentTrack?.prompt ?? null) !== (nextCurrentTrack?.prompt ?? null) ||
            (state.currentTrack?.status ?? null) !== (nextCurrentTrack?.status ?? null) ||
            (state.currentTrack?.audioUrl ?? null) !== (nextCurrentTrack?.audioUrl ?? null) ||
            (state.currentTrack?.audioUrlHd ?? null) !== (nextCurrentTrack?.audioUrlHd ?? null) ||
            (state.currentTrack?.lyrics ?? null) !== (nextCurrentTrack?.lyrics ?? null) ||
            (state.currentTrack?.lyricsTimestamps ?? null) !== (nextCurrentTrack?.lyricsTimestamps ?? null) ||
            (state.currentTrack?.coverUrl ?? null) !== (nextCurrentTrack?.coverUrl ?? null) ||
            (state.currentTrack?.rating ?? null) !== (nextCurrentTrack?.rating ?? null) ||
            (state.currentTrack?.artistName ?? null) !== (nextCurrentTrack?.artistName ?? null) ||
            state.queue.some((track, index) => track !== nextQueue[index]) ||
            state.history.some((track, index) => track !== nextHistory[index]) ||
            (state.playContext ? state.playContext.some((track, index) => track !== nextPlayContext?.[index]) : false);

          if (!hasChanges) return state;

          return {
            ...state,
            currentTrack: nextCurrentTrack,
            queue: nextQueue,
            history: nextHistory,
            playContext: nextPlayContext,
          };
        }),
      setAutoPlayNext: (enabled) => {
        set({ autoPlayNext: enabled });
        if (enabled) {
          get().hydrateQueueFromContext();
        }
      },
      setShowTrackDetailsPanel: (enabled) => set({ showTrackDetailsPanel: enabled }),
      setRightPanelWidth: (width) =>
        set({ rightPanelWidth: Math.max(320, Math.min(560, Math.round(width))) }),
      setVolume: (volume) => set({ volume }),
      setProgress: (progress) => set({ progress, lastActiveAt: Date.now() }),
      setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
      setPlayHighestQuality: (enabled) => set({ playHighestQuality: enabled }),
      setVisualizerEnabled: (enabled) => set({ visualizerEnabled: enabled }),
      setVisualizerMode: (mode) => set({ visualizerMode: mode }),
      setVisualizerGradient: (gradient) => set({ visualizerGradient: gradient }),
      setShuffleEnabled: (enabled) => set({ shuffleEnabled: enabled }),
      setRepeatMode: (mode) => set({ repeatMode: mode }),
      cycleRepeatMode: () =>
        set((state) => ({
          repeatMode:
            state.repeatMode === "off"
              ? "all"
              : state.repeatMode === "all"
                ? "track"
                : "off",
        })),
      setPauseBetweenTracks: (enabled) => set({ pauseBetweenTracks: enabled }),
      setNormalizeVolume: (enabled) => set({ normalizeVolume: enabled }),
    }),
    {
      name: "melodiq-player",
      storage: createDebouncedStorage(300),
      // Resume-over-reload gate: the persisted isPlaying flag only counts when
      // playback was alive moments before the reload. Opening the app hours
      // later must not start playing by itself.
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<PlayerState> | undefined),
        } as PlayerState;
        // The popped-out player window shares this localStorage entry, but must
        // never start its own playback on open — the main window is already
        // playing that audio. Only the main document resumes.
        const isPopupWindow =
          typeof window !== "undefined" && window.location.pathname === "/player-window";
        if (isPopupWindow || !shouldResumePlayback(merged.isPlaying, merged.lastActiveAt)) {
          merged.isPlaying = false;
        }
        return merged;
      },
      partialize: (state) => {
        // Scrub bulky fields (lyrics/timings) from tracks before persisting to avoid localStorage quota limits
        const scrubTrack = (track: any) => {
          if (!track) return null;
          const { lyrics, lyricsTimestamps, ...rest } = track;
          return rest;
        };

        // Every progress tick (roughly once per second while playing, see
        // Player.tsx's timeupdate handler) re-serializes this entire
        // partialized state to localStorage. Pages that queue up a whole
        // library in one go (e.g. clicking any track on Master Tracks
        // enqueues the rest of the list) can put hundreds of full track
        // objects in `queue`, so that per-second JSON.stringify became
        // expensive enough on mobile to stall the main thread and produce
        // audible crackling in sync with the writes. The queue only needs
        // to survive a reload far enough to resume "what's coming up next",
        // so cap what's persisted regardless of how large it gets in memory.
        const PERSISTED_QUEUE_LIMIT = 50;

        return {
          volume: state.volume,
          queue: state.queue.slice(0, PERSISTED_QUEUE_LIMIT).map(scrubTrack).filter(Boolean),
          currentTrack: scrubTrack(state.currentTrack),
          autoPlayNext: state.autoPlayNext,
          showTrackDetailsPanel: state.showTrackDetailsPanel,
          rightPanelWidth: state.rightPanelWidth,
          isFullscreen: state.isFullscreen,
          progress: state.progress,
          isPlaying: state.isPlaying,
          lastActiveAt: state.lastActiveAt,
          playHighestQuality: state.playHighestQuality,
          visualizerEnabled: state.visualizerEnabled,
          visualizerMode: state.visualizerMode,
          visualizerGradient: state.visualizerGradient,
          shuffleEnabled: state.shuffleEnabled,
          repeatMode: state.repeatMode,
          pauseBetweenTracks: state.pauseBetweenTracks,
          normalizeVolume: state.normalizeVolume,
        };
      },
    }
  )
);
