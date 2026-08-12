import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debouncedStorage";

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
  audioElement: HTMLAudioElement | null;
  playContext: Track[] | null;
  isFullscreen: boolean;
  setCurrentTrack: (track: Track | null) => void;
  enqueueTrack: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  setQueue: (queue: Track[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  setIsPlaying: (playing: boolean) => void;
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
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setPlayHighestQuality: (enabled: boolean) => void;
  setVisualizerEnabled: (enabled: boolean) => void;
  setVisualizerMode: (mode: number) => void;
  setVisualizerGradient: (gradient: string) => void;
  setShuffleEnabled: (enabled: boolean) => void;
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
      audioElement: null,
      playContext: null,
      isFullscreen: false,
      playHighestQuality: false,
      visualizerEnabled: false,
      visualizerMode: 2,
      visualizerGradient: "prism",
      shuffleEnabled: false,
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
                .filter((t) => t.status === "done" && !t.archivedAt);
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
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setAudioElement: (audioElement) => set({ audioElement }),
      playTrackFromGesture: (track) => {
        get().setCurrentTrack(track);

        const audioElement = get().audioElement;
        if (!audioElement) return;

        // Kies juiste url: absolute (http/https), of fallback naar /api/tracks/[id]/stream
        let url = track.audioUrl || undefined;
        if (url && /^https?:\/\//i.test(url)) {
          // Externe URL, gebruik direct
        } else if (url && url.startsWith("/")) {
          // Relatief pad, gebruik direct
        } else {
          // Fallback naar MelodIQ API
          const wantsHd = (track.audioUrl || "").includes("hd=true");
          const base = track.publicSource ? `/api/discover/${track.id}` : `/api/tracks/${track.id}`;
          url = `${base}/stream${wantsHd ? "?hd=true" : ""}`;
        }

        // Debug logging
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.log("[Player] playTrackFromGesture:", { track, url });
        }

        const isSameTrackAlreadyLoaded =
          audioElement.dataset.gestureTrackId === track.id &&
          !!audioElement.src &&
          !audioElement.error &&
          audioElement.readyState >= 1;

        if (!isSameTrackAlreadyLoaded) {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement.src = url || "";
          audioElement.volume = get().volume;
          audioElement.dataset.gestureTrackId = track.id;
          audioElement.load();
        }

        const playPromise = audioElement.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch((error) => {
            if (error instanceof DOMException && error.name === "NotAllowedError") {
              set({ isPlaying: false });
            }
          });
        }
      },
      setPlayContext: (tracks) => set({ playContext: tracks }),
      hydrateQueueFromContext: () => {
        const current = get().currentTrack;
        const context = get().playContext;
        if (!current || !context || context.length === 0) return;
        const index = context.findIndex((t) => t.id === current.id);
        if (index < 0) return;
        set({ queue: context.slice(index + 1).filter((t) => t.status === "done" && !t.archivedAt) });
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
      setProgress: (progress) => set({ progress }),
      setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
      setPlayHighestQuality: (enabled) => set({ playHighestQuality: enabled }),
      setVisualizerEnabled: (enabled) => set({ visualizerEnabled: enabled }),
      setVisualizerMode: (mode) => set({ visualizerMode: mode }),
      setVisualizerGradient: (gradient) => set({ visualizerGradient: gradient }),
      setShuffleEnabled: (enabled) => set({ shuffleEnabled: enabled }),
    }),
    {
      name: "melodiq-player",
      storage: createDebouncedStorage(300),
      partialize: (state) => {
        // Scrub bulky fields (lyrics/timings) from tracks before persisting to avoid localStorage quota limits
        const scrubTrack = (track: any) => {
          if (!track) return null;
          const { lyrics, lyricsTimestamps, ...rest } = track;
          return rest;
        };

        return {
          volume: state.volume,
          queue: state.queue.map(scrubTrack).filter(Boolean),
          currentTrack: scrubTrack(state.currentTrack),
          autoPlayNext: state.autoPlayNext,
          showTrackDetailsPanel: state.showTrackDetailsPanel,
          rightPanelWidth: state.rightPanelWidth,
          isFullscreen: state.isFullscreen,
          progress: state.progress,
          playHighestQuality: state.playHighestQuality,
          visualizerEnabled: state.visualizerEnabled,
          visualizerMode: state.visualizerMode,
          visualizerGradient: state.visualizerGradient,
          shuffleEnabled: state.shuffleEnabled,
        };
      },
    }
  )
);
