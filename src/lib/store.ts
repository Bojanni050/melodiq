import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

function createDebouncedStorage<T>(delayMs: number): PersistStorage<T> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    getItem: (name) => {
      if (typeof window === "undefined") return null;
      try {
        const str = localStorage.getItem(name);
        if (!str) return null;
        return JSON.parse(str) as StorageValue<T>;
      } catch (e) {
        console.warn(`[PersistStorage] Failed to read ${name} from localStorage:`, e);
        return null;
      }
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") return;
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            console.error(`[PersistStorage] Failed to save ${name} to localStorage:`, e);
          }
          timers.delete(name);
        }, delayMs)
      );
    },
    removeItem: (name) => {
      if (typeof window === "undefined") return;
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.delete(name);
      try {
        localStorage.removeItem(name);
      } catch (e) {
        console.warn(`[PersistStorage] Failed to remove ${name} from localStorage:`, e);
      }
    },
  };
}

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
  format?: string | null;
  formatHd?: string | null;
  duration: number | null;
  lyrics: string | null;
  createdAt: string;
  error: string | null;
  rating?: string | null;
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  s3KeyCoverThumb?: string | null;
  playCount?: number | null;
  lyricsTimestamps?: string | null;
  instrumental?: boolean | null;
  artistName?: string | null;
  composerName?: string | null;
  deletedAt?: string | null;
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
      rightPanelWidth: 380,
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
                .filter((t) => t.status === "done");
            }
          }

          if (track.lyrics && track.lyrics.trim()) {
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
          url = `/api/tracks/${track.id}/stream${wantsHd ? "?hd=true" : ""}`;
        }

        // Debug logging
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.log("[Player] playTrackFromGesture:", { track, url });
        }

        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.src = url || "";
        audioElement.volume = get().volume;
        audioElement.load();

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
        set({ queue: context.slice(index + 1).filter((t) => t.status === "done") });
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

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  artistAlias: string | null;
  composerAlias: string | null;
  createdAt: string;
}

interface UserState {
  user: UserProfile | null;
  loading: boolean;
  setUser: (user: UserProfile | null) => void;
  loadUser: () => Promise<UserProfile | null>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  setUser: (user) => set({ user }),
  loadUser: async () => {
    if (get().loading) return get().user;
    if (get().user) return get().user;
    set({ loading: true });
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        set({ user: null, loading: false });
        return null;
      }
      const data = (await res.json()) as { user?: UserProfile };
      const user = data.user ?? null;
      set({ user, loading: false });
      return user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },
}));

export interface Playlist {
  id: string;
  name: string;
  description?: string | null;
  trackIds: string[];
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  folderGradient?: string;
  isDefault?: boolean;
  parentWorkspaceId?: string | null;
}

export const DEFAULT_WORKSPACE_ID = "workspace-default";
export const DEFAULT_WORKSPACE_NAME = "Default Workspace";

export const WORKSPACE_FOLDER_GRADIENTS = [
  "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)",
  "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #6366f1 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
  "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #f97316 100%)",
  "linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)",
] as const;

interface PlaylistState {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  playlistsHydrated: boolean;
  hydratePlaylistsFromServer: (playlists: Playlist[]) => void;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => string;
  addTrackToPlaylist: (
    playlistId: string,
    trackId: string,
    options?: { allowDuplicate?: boolean }
  ) => void;
  reorderPlaylistTracks: (playlistId: string, trackIds: string[]) => void;
  movePlaylistTrack: (playlistId: string, trackId: string, toIndex: number) => void;
  localMovePlaylistTrack: (playlistId: string, trackId: string, toIndex: number) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  deletePlaylist: (playlistId: string) => void;
  setSelectedPlaylistId: (playlistId: string | null) => void;
  updatePlaylistDescription: (playlistId: string, description: string) => void;
}

function persistPlaylistCreate(input: { id: string; name: string }) {
  if (typeof window === "undefined") return;

  void fetch("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch((error) => console.error("[store] persistPlaylistCreate failed", error));
}

function persistPlaylistDelete(playlistId: string) {
  if (typeof window === "undefined") return;

  void fetch(`/api/playlists/${playlistId}`, {
    method: "DELETE",
  }).catch((error) => console.error("[store] persistPlaylistDelete failed", error));
}

function persistAddTrackToPlaylist(input: {
  playlistId: string;
  trackId: string;
  allowDuplicate?: boolean;
}) {
  if (typeof window === "undefined") return;

  void fetch(`/api/playlists/${input.playlistId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add-track",
      trackId: input.trackId,
      allowDuplicate: input.allowDuplicate === true,
    }),
  }).catch((error) => console.error("[store] persistAddTrackToPlaylist failed", error));
}

function persistRemoveTrackFromPlaylist(input: { playlistId: string; trackId: string }) {
  if (typeof window === "undefined") return;

  void fetch(`/api/playlists/${input.playlistId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remove-track", trackId: input.trackId }),
  }).catch((error) => console.error("[store] persistRemoveTrackFromPlaylist failed", error));
}

function persistMovePlaylistTrack(input: { playlistId: string; trackId: string; toIndex: number }) {
  if (typeof window === "undefined") return;

  void fetch(`/api/playlists/${input.playlistId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "move-track", trackId: input.trackId, toIndex: input.toIndex }),
  })
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const playlist = data?.playlist;
      if (playlist) {
        usePlaylistStore.getState().hydratePlaylistsFromServer(
          usePlaylistStore.getState().playlists.map((p) => (p.id === playlist.id ? playlist : p))
        );
      }
    })
    .catch((error) => console.error("[store] persistMovePlaylistTrack failed", error));
}

function persistReorderPlaylistTracks(input: { playlistId: string; trackIds: string[] }) {
  if (typeof window === "undefined") return;

  void fetch(`/api/playlists/${input.playlistId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reorder-tracks", trackIds: input.trackIds }),
  })
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const playlist = data?.playlist;
      if (playlist) {
        usePlaylistStore.getState().hydratePlaylistsFromServer(
          usePlaylistStore.getState().playlists.map((p) => (p.id === playlist.id ? playlist : p))
        );
      }
    })
    .catch((error) => console.error("[store] persistReorderPlaylistTracks failed", error));
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlists: [],
      selectedPlaylistId: null,
      playlistsHydrated: false,
      hydratePlaylistsFromServer: (incomingPlaylists) =>
        set((state) => ({
          playlists: incomingPlaylists,
          playlistsHydrated: true,
          selectedPlaylistId:
            state.selectedPlaylistId && incomingPlaylists.some((playlist) => playlist.id === state.selectedPlaylistId)
              ? state.selectedPlaylistId
              : null,
        })),
      loadPlaylists: async () => {
        try {
          const response = await fetch("/api/playlists", { cache: "no-store" });
          if (!response.ok) {
            set({ playlistsHydrated: true });
            return;
          }

          const payload = await response.json().catch(() => null);
          const incomingPlaylists =
            payload && typeof payload === "object" && Array.isArray((payload as { playlists?: unknown[] }).playlists)
              ? ((payload as { playlists: Playlist[] }).playlists as Playlist[])
              : [];

          get().hydratePlaylistsFromServer(incomingPlaylists);
        } catch {
          set({ playlistsHydrated: true });
        }
      },
      createPlaylist: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return "";

        const existing = get().playlists.find(
          (playlist) => playlist.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) return existing.id;

        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          playlists: [
            ...state.playlists,
            { id, name: trimmed, trackIds: [], createdAt: new Date().toISOString() },
          ],
        }));

        persistPlaylistCreate({ id, name: trimmed });
        return id;
      },
      addTrackToPlaylist: (playlistId, trackId, options) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            if (playlist.trackIds.includes(trackId) && !options?.allowDuplicate) return playlist;
            return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
          }),
        }));

        persistAddTrackToPlaylist({ playlistId, trackId, allowDuplicate: options?.allowDuplicate });
      },
      reorderPlaylistTracks: (playlistId, trackIds) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;

            // Keep only the track IDs that currently exist in this playlist.
            const existing = [...playlist.trackIds];
            const next: string[] = [];

            trackIds.forEach((trackId) => {
              const index = existing.indexOf(trackId);
              if (index < 0) return;
              next.push(existing[index]);
              existing.splice(index, 1);
            });

            next.push(...existing);
            return { ...playlist, trackIds: next };
          }),
        }));

        persistReorderPlaylistTracks({ playlistId, trackIds });
      },
      movePlaylistTrack: (playlistId, trackId, toIndex) => {
        // Optimistic local update
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            const ids = [...playlist.trackIds];
            const fromIndex = ids.indexOf(trackId);
            if (fromIndex === -1) return playlist;
            ids.splice(fromIndex, 1);
            ids.splice(Math.min(toIndex, ids.length), 0, trackId);
            return { ...playlist, trackIds: ids };
          }),
        }));
        // Send delta to server — server applies to its own current state
        persistMovePlaylistTrack({ playlistId, trackId, toIndex });
      },
      localMovePlaylistTrack: (playlistId, trackId, toIndex) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            const ids = [...playlist.trackIds];
            const fromIndex = ids.indexOf(trackId);
            if (fromIndex === -1) return playlist;
            ids.splice(fromIndex, 1);
            ids.splice(Math.min(toIndex, ids.length), 0, trackId);
            return { ...playlist, trackIds: ids };
          }),
        }));
      },
      removeTrackFromPlaylist: (playlistId, trackId) => {
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            return {
              ...playlist,
              trackIds: playlist.trackIds.filter((id) => id !== trackId),
            };
          }),
        }));

        persistRemoveTrackFromPlaylist({ playlistId, trackId });
      },
      deletePlaylist: (playlistId) => {
        set((state) => ({
          playlists: state.playlists.filter((playlist) => playlist.id !== playlistId),
          selectedPlaylistId:
            state.selectedPlaylistId === playlistId ? null : state.selectedPlaylistId,
        }));

        persistPlaylistDelete(playlistId);
      },
      setSelectedPlaylistId: (playlistId) => set({ selectedPlaylistId: playlistId }),
      updatePlaylistDescription: (playlistId, description) => {
        const trimmed = description.trim().slice(0, 500);
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId ? { ...playlist, description: trimmed } : playlist
          ),
        }));
        if (typeof window === "undefined") return;
        void fetch(`/api/playlists/${playlistId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-description", description: trimmed }),
        }).catch((error) => console.error("[store] updatePlaylistDescription failed", error));
      },
    }),
    {
      name: "melodiq-playlists",
      storage: createDebouncedStorage(400),
      partialize: (state) => ({
        selectedPlaylistId: state.selectedPlaylistId,
        playlistsHydrated: state.playlistsHydrated,
        // Track IDs are server-authoritative and hydrated from /api/playlists.
        playlists: state.playlists.map(({ trackIds: _trackIds, ...rest }) => ({ ...rest, trackIds: [] as string[] })),
      }),
      merge: (persistedState, currentState) => {
        const typedPersisted = (persistedState as Partial<PlaylistState>) || {};
        return {
          ...currentState,
          ...typedPersisted,
          playlists: currentState.playlists,
        } as PlaylistState;
      },
    }
  )
);

interface WorkspaceState {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  createWorkspace: (name: string) => string;
  createWorkspaceFolder: (parentWorkspaceId: string, name: string) => string;
  moveTrackToWorkspace: (workspaceId: string, trackId: string) => void;
  moveTracksToWorkspace: (workspaceId: string, trackIds: string[]) => void;
  removeTrackFromWorkspace: (workspaceId: string, trackId: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  ensureDefaultWorkspace: () => string;
  syncTracksToDefaultWorkspace: (trackIds: string[]) => void;
  hydrateWorkspacesFromServer: (workspaces: Workspace[]) => void;
}

function persistWorkspaceCreate(input: {
  id: string;
  name: string;
  parentWorkspaceId: string | null;
  folderGradient?: string;
}) {
  if (typeof window === "undefined") return;

  void fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch((error) => console.error("[store] persistWorkspaceCreate failed", error));
}

function persistWorkspaceDelete(workspaceId: string) {
  if (typeof window === "undefined") return;

  void fetch(`/api/workspaces/${workspaceId}`, {
    method: "DELETE",
  }).catch((error) => console.error("[store] persistWorkspaceDelete failed", error));
}

function persistTrackWorkspaceAssignment(trackId: string, workspaceId: string | null) {
  if (typeof window === "undefined") return;

  void fetch(`/api/tracks/${trackId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  }).catch((error) => console.error("[store] persistTrackWorkspaceAssignment failed", error));
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPersistedWorkspaceId(workspaceId: string, workspaces: Workspace[]): string | null {
  if (workspaceId === DEFAULT_WORKSPACE_ID) {
    const defaultWorkspace =
      workspaces.find((workspace) => workspace.isDefault) ||
      workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID);

    if (defaultWorkspace?.id && UUID_REGEX.test(defaultWorkspace.id)) {
      return defaultWorkspace.id;
    }

    return null;
  }

  return UUID_REGEX.test(workspaceId) ? workspaceId : null;
}

function createDefaultWorkspace(): Workspace {
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
    trackIds: [],
    createdAt: new Date().toISOString(),
    folderGradient: WORKSPACE_FOLDER_GRADIENTS[0],
    isDefault: true,
    parentWorkspaceId: null,
  };
}

function normalizeWorkspaceName(name: string): string {
  return name.trim().toLowerCase();
}

function findWorkspaceByName(workspaces: Workspace[], name: string): Workspace | null {
  const normalized = normalizeWorkspaceName(name);
  if (!normalized) return null;

  return (
    workspaces.find((workspace) => normalizeWorkspaceName(workspace.name) === normalized) ||
    null
  );
}

function withDefaultWorkspace(workspaces: Workspace[]) {
  const defaultWorkspace =
    workspaces.find((workspace) => workspace.isDefault) ||
    workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID);
  const normalizedDefault = {
    ...(defaultWorkspace || createDefaultWorkspace()),
    id: defaultWorkspace?.id || DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
    isDefault: true,
    folderGradient: defaultWorkspace?.folderGradient || WORKSPACE_FOLDER_GRADIENTS[0],
    parentWorkspaceId: null,
  };

  const parentWorkspaceById = new Map<string, Workspace>();
  workspaces.forEach((workspace) => {
    parentWorkspaceById.set(workspace.id, workspace);
  });

  const otherWorkspaces = workspaces
    .filter((workspace) => workspace.id !== normalizedDefault.id && workspace.id !== DEFAULT_WORKSPACE_ID)
    .map((workspace) => {
      const parentWorkspaceId = workspace.parentWorkspaceId || null;
      const parentWorkspace = parentWorkspaceId ? parentWorkspaceById.get(parentWorkspaceId) : null;

      // Enforce a single folder depth: root workspace -> folder.
      const normalizedParentId = parentWorkspace && !parentWorkspace.parentWorkspaceId ? parentWorkspaceId : null;

      return {
        ...workspace,
        isDefault: false,
        parentWorkspaceId: normalizedParentId,
      };
    })
    .filter((workspace) => {
      if (!workspace.parentWorkspaceId) return true;
      return workspaces.some((candidate) => candidate.id === workspace.parentWorkspaceId);
    });

  return [normalizedDefault, ...otherWorkspaces];
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [createDefaultWorkspace()],
      selectedWorkspaceId: null,
      createWorkspace: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return "";

        const existing = findWorkspaceByName(get().workspaces, trimmed);
        if (existing) {
          return existing.id;
        }

        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const folderGradient =
          WORKSPACE_FOLDER_GRADIENTS[Math.floor(Math.random() * WORKSPACE_FOLDER_GRADIENTS.length)];
        set((state) => ({
          workspaces: [
            ...state.workspaces,
            {
              id,
              name: trimmed,
              trackIds: [],
              createdAt: new Date().toISOString(),
              folderGradient,
              isDefault: false,
              parentWorkspaceId: null,
            },
          ],
        }));

        persistWorkspaceCreate({ id, name: trimmed, parentWorkspaceId: null, folderGradient });
        return id;
      },
      createWorkspaceFolder: (parentWorkspaceId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return "";

        const existing = findWorkspaceByName(get().workspaces, trimmed);
        if (existing) {
          return existing.id;
        }

        const parent = get().workspaces.find((workspace) => workspace.id === parentWorkspaceId);
        if (!parent) return "";

        // Keep hierarchy one-level deep: only root workspaces can have child folders.
        if (parent.parentWorkspaceId) return "";

        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const folderGradient =
          WORKSPACE_FOLDER_GRADIENTS[Math.floor(Math.random() * WORKSPACE_FOLDER_GRADIENTS.length)];

        set((state) => ({
          workspaces: [
            ...state.workspaces,
            {
              id,
              name: trimmed,
              trackIds: [],
              createdAt: new Date().toISOString(),
              folderGradient,
              isDefault: false,
              parentWorkspaceId,
            },
          ],
        }));

        persistWorkspaceCreate({ id, name: trimmed, parentWorkspaceId, folderGradient });

        return id;
      },
      moveTrackToWorkspace: (workspaceId, trackId) => {
        const persistedWorkspaceId = toPersistedWorkspaceId(workspaceId, get().workspaces);
        persistTrackWorkspaceAssignment(trackId, persistedWorkspaceId);
        set((state) => {
          const targetWorkspace = state.workspaces.find((workspace) => workspace.id === workspaceId);
          if (!targetWorkspace) return state;

          // Silently skip when the track is already part of the requested workspace.
          if (targetWorkspace.trackIds.includes(trackId)) return state;

          return {
            workspaces: state.workspaces.map((workspace) => {
              if (workspace.id === workspaceId) {
                return {
                  ...workspace,
                  trackIds: [...workspace.trackIds.filter((id) => id !== trackId), trackId],
                };
              }

              return {
                ...workspace,
                trackIds: workspace.trackIds.filter((id) => id !== trackId),
              };
            }),
          };
        });
      },
      moveTracksToWorkspace: (workspaceId, trackIds) => {
        const persistedWorkspaceId = toPersistedWorkspaceId(workspaceId, get().workspaces);
        trackIds.forEach((trackId) => {
          persistTrackWorkspaceAssignment(trackId, persistedWorkspaceId);
        });
        set((state) => {
          const targetWorkspace = state.workspaces.find((w) => w.id === workspaceId);
          if (!targetWorkspace) return state;
          const trackIdSet = new Set(trackIds);
          return {
            workspaces: state.workspaces.map((workspace) => {
              if (workspace.id === workspaceId) {
                const existing = new Set(workspace.trackIds);
                const toAdd = trackIds.filter((id) => !existing.has(id));
                return { ...workspace, trackIds: [...workspace.trackIds, ...toAdd] };
              }
              return { ...workspace, trackIds: workspace.trackIds.filter((id) => !trackIdSet.has(id)) };
            }),
          };
        });
      },
      removeTrackFromWorkspace: (workspaceId, trackId) =>
        set((state) => ({
          workspaces: state.workspaces.map((workspace) => {
            if (workspace.id !== workspaceId) return workspace;
            return {
              ...workspace,
              trackIds: workspace.trackIds.filter((id) => id !== trackId),
            };
          }),
        })),
      deleteWorkspace: (workspaceId) => {
        const target = get().workspaces.find((workspace) => workspace.id === workspaceId);
        if (!target || target.isDefault) return;
        const directChildren = get().workspaces
          .filter((workspace) => workspace.parentWorkspaceId === workspaceId)
          .map((workspace) => workspace.id);
        const idsToDelete = new Set([workspaceId, ...directChildren]);

        set((state) => ({
          workspaces: state.workspaces.filter((workspace) => !idsToDelete.has(workspace.id)),
          selectedWorkspaceId:
            state.selectedWorkspaceId && idsToDelete.has(state.selectedWorkspaceId)
              ? null
              : state.selectedWorkspaceId,
        }));

        persistWorkspaceDelete(workspaceId);
      },
      setSelectedWorkspaceId: (workspaceId) => set({ selectedWorkspaceId: workspaceId }),
      ensureDefaultWorkspace: () => {
        let defaultId = DEFAULT_WORKSPACE_ID;
        set((state) => ({ workspaces: withDefaultWorkspace(state.workspaces) }));
        const existing = get().workspaces.find((workspace) => workspace.isDefault);
        if (existing) defaultId = existing.id;
        return defaultId;
      },
      syncTracksToDefaultWorkspace: (trackIds) =>
        set((state) => {
          const normalizedWorkspaces = withDefaultWorkspace(state.workspaces);
          const knownTrackIds = new Set(trackIds);

          const cleaned = normalizedWorkspaces.map((workspace) => ({
            ...workspace,
            trackIds: workspace.trackIds.filter((trackId) => knownTrackIds.has(trackId)),
          }));

          const defaultWorkspace = cleaned.find((w) => w.isDefault) || cleaned[0];
          const defaultWorkspaceId = defaultWorkspace?.id || DEFAULT_WORKSPACE_ID;

          const assignedOutsideDefault = new Set(
            cleaned
              .filter((workspace) => workspace.id !== defaultWorkspaceId)
              .flatMap((workspace) => workspace.trackIds)
          );

          const defaultTrackIds = trackIds.filter((trackId) => !assignedOutsideDefault.has(trackId));

          return {
            workspaces: cleaned.map((workspace) =>
              workspace.id === defaultWorkspaceId
                ? { ...workspace, trackIds: defaultTrackIds }
                : workspace
            ),
          };
        }),
      hydrateWorkspacesFromServer: (incomingWorkspaces) =>
        set((state) => {
          const normalizedIncoming = withDefaultWorkspace(incomingWorkspaces || []);
          const incomingDefault = normalizedIncoming.find((w) => w.isDefault);
          
          let selectedWorkspaceId = state.selectedWorkspaceId;
          
          if (
            selectedWorkspaceId === DEFAULT_WORKSPACE_ID ||
            (selectedWorkspaceId && !normalizedIncoming.some((workspace) => workspace.id === selectedWorkspaceId))
          ) {
            selectedWorkspaceId = incomingDefault ? incomingDefault.id : null;
          }

          return {
            workspaces: normalizedIncoming,
            selectedWorkspaceId,
          };
        }),
    }),
    {
      name: "melodiq-workspaces",
      storage: createDebouncedStorage(800),
      partialize: (state) => ({
        selectedWorkspaceId: state.selectedWorkspaceId,
        // Persist workspaces without trackIds — those are always hydrated from the server
        workspaces: state.workspaces.map(({ trackIds: _trackIds, ...rest }) => ({ ...rest, trackIds: [] as string[] })),
      }),
      merge: (persistedState, currentState) => {
        const typedPersisted = (persistedState as Partial<WorkspaceState>) || {};
        const merged = {
          ...currentState,
          ...typedPersisted,
        } as WorkspaceState;

        return {
          ...merged,
          workspaces: withDefaultWorkspace(merged.workspaces || []),
        };
      },
    }
  )
);

// Persisting track workspace assignments is handled directly in moveTrackToWorkspace / moveTracksToWorkspace actions

export interface SavedLyric {
  id: string;
  title: string;
  lyrics: string;
  savedAt: string;
}

interface StudioState {
  songIdea: string;
  lyrics: string;
  lyricsContext: string;
  title: string;
  autoCreateWorkspaceFromGeneratedTitle: boolean;
  selectedProviders: Record<string, string>;
  language: string;
  customLanguage: string;
  instrumental: boolean;
  vocalGender: "female" | "male" | "auto";
  structure: string;
  customStructure: string;
  weirdness: number;
  styleInfluence: number;
  savedLyrics: SavedLyric[];
  savedLyricsLoaded: boolean;
  setSongIdea: (idea: string) => void;
  setLyrics: (lyrics: string) => void;
  setLyricsContext: (context: string) => void;
  setTitle: (title: string) => void;
  setAutoCreateWorkspaceFromGeneratedTitle: (enabled: boolean) => void;
  setProvider: (key: string, model: string) => void;
  toggleProvider: (key: string, defaultModel: string) => void;
  setProviderModel: (key: string, model: string) => void;
  setLanguage: (lang: string) => void;
  setCustomLanguage: (lang: string) => void;
  setInstrumental: (val: boolean) => void;
  setVocalGender: (val: "female" | "male" | "auto") => void;
  setStructure: (val: string) => void;
  setCustomStructure: (val: string) => void;
  setWeirdness: (val: number) => void;
  setStyleInfluence: (val: number) => void;
  fetchSavedLyrics: () => Promise<void>;
  saveLyric: () => Promise<SavedLyric | null>;
  loadSavedLyric: (id: string) => void;
  deleteSavedLyric: (id: string) => Promise<void>;
  reset: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      songIdea: "",
      lyrics: "",
      lyricsContext: "",
      title: "",
      autoCreateWorkspaceFromGeneratedTitle: false,
      selectedProviders: { poyo: "v5.5" },
      language: "English",
      customLanguage: "",
      instrumental: false,
      vocalGender: "auto",
      structure: "pop-default",
      customStructure: "",
      weirdness: 50,
      styleInfluence: 50,
      savedLyrics: [],
      savedLyricsLoaded: false,
      setSongIdea: (idea) => set({ songIdea: idea }),
      setLyrics: (lyrics) => set({ lyrics }),
      setLyricsContext: (context) => set({ lyricsContext: context }),
      setTitle: (title) => set({ title }),
      setAutoCreateWorkspaceFromGeneratedTitle: (enabled) =>
        set({ autoCreateWorkspaceFromGeneratedTitle: enabled }),
      setProvider: (key, model) => set({ selectedProviders: { [key]: model } }),
      toggleProvider: (key, defaultModel) =>
        set((state) => {
          const next = { ...state.selectedProviders };
          if (next[key]) {
            delete next[key];
          } else {
            next[key] = defaultModel;
          }
          return { selectedProviders: next };
        }),
      setProviderModel: (key, model) =>
        set((state) => ({
          selectedProviders: { ...state.selectedProviders, [key]: model },
        })),
      setLanguage: (lang) => set({ language: lang }),
      setCustomLanguage: (lang) => set({ customLanguage: lang }),
      setInstrumental: (val) => set({ instrumental: val }),
      setVocalGender: (val) => set({ vocalGender: val }),
      setStructure: (val) => set({ structure: val }),
      setCustomStructure: (val) => set({ customStructure: val }),
      setWeirdness: (val) => set({ weirdness: val }),
      setStyleInfluence: (val) => set({ styleInfluence: val }),
      fetchSavedLyrics: async () => {
        if (typeof window === "undefined") return;
        try {
          const res = await fetch("/api/saved-lyrics");
          if (!res.ok) return;
          const data = await res.json();
          set({ savedLyrics: data.savedLyrics ?? [], savedLyricsLoaded: true });
        } catch {}
      },
      saveLyric: async () => {
        const state = get();
        const title = state.title.trim() || state.lyrics.trim().split("\n")[0].slice(0, 60) || "Untitled";
        try {
          const res = await fetch("/api/saved-lyrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, lyrics: state.lyrics }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          const entry: SavedLyric = data.savedLyric;
          set((s) => ({ savedLyrics: [entry, ...s.savedLyrics] }));
          return entry;
        } catch {
          return null;
        }
      },
      loadSavedLyric: (id) =>
        set((state) => {
          const entry = state.savedLyrics.find((s) => s.id === id);
          if (!entry) return state;
          return { lyrics: entry.lyrics, title: entry.title };
        }),
      deleteSavedLyric: async (id) => {
        set((state) => ({ savedLyrics: state.savedLyrics.filter((s) => s.id !== id) }));
        try {
          await fetch(`/api/saved-lyrics/${id}`, { method: "DELETE" });
        } catch {}
      },
      reset: () =>
        set({
          songIdea: "",
          lyrics: "",
          lyricsContext: "",
          title: "",
          autoCreateWorkspaceFromGeneratedTitle: false,
          selectedProviders: { poyo: "v5.5" },
          language: "English",
          customLanguage: "",
          instrumental: false,
          vocalGender: "auto",
          structure: "pop-default",
          customStructure: "",
          weirdness: 50,
          styleInfluence: 50,
        }),
    }),
    {
      name: "melodiq-studio",
      storage: createDebouncedStorage(500),
      skipHydration: true,
      partialize: (state) => {
        const { savedLyrics: _sl, savedLyricsLoaded: _sll, ...rest } = state as any;
        return rest;
      },
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...persistedState };
        if (!merged.selectedProviders) {
          merged.selectedProviders = merged.provider
            ? { [merged.provider]: merged.providerModel || "v5.5" }
            : { poyo: "v5.5" };
        }
        return merged;
      },
    }
  )
);

interface UIState {
  activeTab: "create" | "library";
  selectedTrackId: string | null;
  setActiveTab: (tab: "create" | "library") => void;
  setSelectedTrackId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: "create",
      selectedTrackId: null,
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSelectedTrackId: (id) => set({ selectedTrackId: id }),
    }),
    {
      name: "melodiq-ui",
      partialize: (state) => ({ activeTab: state.activeTab }),
    }
  )
);

// High-Performance Track Selection Store (O(1) Localized Updates)
interface SelectionState {
  selectedIds: Set<string>;
  selectionAnchorId: string | null;
  toggleSelection: (trackId: string, displayedIds: string[], options?: { mode?: "toggle" | "range" }) => void;
  toggleSelectAll: (displayedIds: string[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set<string>(),
  selectionAnchorId: null,
  toggleSelection: (trackId, displayedIds, options) => {
    set((state) => {
      const mode = options?.mode ?? "toggle";
      const next = new Set(state.selectedIds);
      let anchorId = state.selectionAnchorId;

      if (mode === "range") {
        const anchorIndex = anchorId ? displayedIds.indexOf(anchorId) : -1;
        const targetIndex = displayedIds.indexOf(trackId);

        if (targetIndex >= 0) {
          if (anchorIndex < 0) {
            next.add(trackId);
          } else {
            const start = Math.min(anchorIndex, targetIndex);
            const end = Math.max(anchorIndex, targetIndex);
            displayedIds.slice(start, end + 1).forEach((id) => next.add(id));
          }
        }
        anchorId = trackId;
      } else {
        if (next.has(trackId)) {
          next.delete(trackId);
        } else {
          next.add(trackId);
        }
        anchorId = trackId;
      }

      return { selectedIds: next, selectionAnchorId: anchorId };
    });
  },
  toggleSelectAll: (displayedIds) => {
    set((state) => {
      const hasAllVisible = displayedIds.length > 0 && displayedIds.every((id) => state.selectedIds.has(id));
      const next = new Set(state.selectedIds);
      if (hasAllVisible) {
        displayedIds.forEach((id) => next.delete(id));
      } else {
        displayedIds.forEach((id) => next.add(id));
      }
      return { selectedIds: next };
    });
  },
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: new Set<string>(), selectionAnchorId: null }),
}));

// Saved Style & Prompt Presets Store
export interface SavedPreset {
  id: string;
  name: string;
  prompt: string;
  notes: string;
  createdAt: string;
}

interface PresetsState {
  presets: SavedPreset[];
  presetsLoaded: boolean;
  fetchPresets: () => Promise<void>;
  addPreset: (name: string, prompt: string, notes: string) => Promise<SavedPreset | null>;
  deletePreset: (id: string) => Promise<void>;
}

export const usePresetsStore = create<PresetsState>()((set) => ({
  presets: [],
  presetsLoaded: false,
  fetchPresets: async () => {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/style-presets");
      if (!res.ok) return;
      const data = await res.json();
      set({ presets: data.presets ?? [], presetsLoaded: true });
    } catch {}
  },
  addPreset: async (name, prompt, notes) => {
    try {
      const res = await fetch("/api/style-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, notes }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const preset: SavedPreset = data.preset;
      set((state) => ({ presets: [...state.presets, preset] }));
      return preset;
    } catch {
      return null;
    }
  },
  deletePreset: async (id) => {
    set((state) => ({ presets: state.presets.filter((p) => p.id !== id) }));
    try {
      await fetch(`/api/style-presets/${id}`, { method: "DELETE" });
    } catch {}
  },
}));

