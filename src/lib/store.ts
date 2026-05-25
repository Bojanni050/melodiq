import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  setAutoPlayNext: (enabled: boolean) => void;
  setShowTrackDetailsPanel: (enabled: boolean) => void;
  setRightPanelWidth: (width: number) => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
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
          const [nextTrack, ...rest] = state.queue;
          return {
            currentTrack: nextTrack,
            queue: rest,
            isPlaying: true,
            history: state.currentTrack
              ? [...state.history, state.currentTrack].slice(-50)
              : state.history,
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
          };
        }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setAudioElement: (audioElement) => set({ audioElement }),
      playTrackFromGesture: (track) => {
        get().setCurrentTrack(track);

        const audioElement = get().audioElement;
        if (!audioElement) return;

        const url = track.audioUrl || `/api/tracks/${track.id}/download`;
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.src = url;
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
    }),
    {
      name: "sonara-player",
      partialize: (state) => ({
        volume: state.volume,
        queue: state.queue,
        currentTrack: state.currentTrack,
        autoPlayNext: state.autoPlayNext,
        showTrackDetailsPanel: state.showTrackDetailsPanel,
        rightPanelWidth: state.rightPanelWidth,
        isFullscreen: state.isFullscreen,
      }),
    }
  )
);

export interface Playlist {
  id: string;
  name: string;
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
  createPlaylist: (name: string) => string;
  addTrackToPlaylist: (
    playlistId: string,
    trackId: string,
    options?: { allowDuplicate?: boolean }
  ) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  deletePlaylist: (playlistId: string) => void;
  setSelectedPlaylistId: (playlistId: string | null) => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set) => ({
      playlists: [],
      selectedPlaylistId: null,
      createPlaylist: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return "";
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
        return id;
      },
      addTrackToPlaylist: (playlistId, trackId, options) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            if (playlist.trackIds.includes(trackId) && !options?.allowDuplicate) return playlist;
            return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
          }),
        })),
      removeTrackFromPlaylist: (playlistId, trackId) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== playlistId) return playlist;
            return {
              ...playlist,
              trackIds: playlist.trackIds.filter((id) => id !== trackId),
            };
          }),
        })),
      deletePlaylist: (playlistId) =>
        set((state) => ({
          playlists: state.playlists.filter((playlist) => playlist.id !== playlistId),
          selectedPlaylistId:
            state.selectedPlaylistId === playlistId ? null : state.selectedPlaylistId,
        })),
      setSelectedPlaylistId: (playlistId) => set({ selectedPlaylistId: playlistId }),
    }),
    {
      name: "sonara-playlists",
    }
  )
);

interface WorkspaceState {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  createWorkspace: (name: string) => string;
  moveTrackToWorkspace: (workspaceId: string, trackId: string) => void;
  removeTrackFromWorkspace: (workspaceId: string, trackId: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  ensureDefaultWorkspace: () => string;
  syncTracksToDefaultWorkspace: (trackIds: string[]) => void;
}

function createDefaultWorkspace(): Workspace {
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
    trackIds: [],
    createdAt: new Date().toISOString(),
    folderGradient: WORKSPACE_FOLDER_GRADIENTS[0],
    isDefault: true,
  };
}

function withDefaultWorkspace(workspaces: Workspace[]) {
  const defaultWorkspace = workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID);
  const normalizedDefault = {
    ...(defaultWorkspace || createDefaultWorkspace()),
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
    isDefault: true,
    folderGradient: defaultWorkspace?.folderGradient || WORKSPACE_FOLDER_GRADIENTS[0],
  };

  const otherWorkspaces = workspaces
    .filter((workspace) => workspace.id !== DEFAULT_WORKSPACE_ID)
    .map((workspace) => ({ ...workspace, isDefault: false }));

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
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const folderGradient =
          WORKSPACE_FOLDER_GRADIENTS[Math.floor(Math.random() * WORKSPACE_FOLDER_GRADIENTS.length)];
        set((state) => ({
          workspaces: [
            ...state.workspaces,
            { id, name: trimmed, trackIds: [], createdAt: new Date().toISOString(), folderGradient, isDefault: false },
          ],
        }));
        return id;
      },
      moveTrackToWorkspace: (workspaceId, trackId) =>
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
        }),
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
        if (workspaceId === DEFAULT_WORKSPACE_ID) return;
        set((state) => ({
          workspaces: state.workspaces.filter((workspace) => workspace.id !== workspaceId),
          selectedWorkspaceId:
            state.selectedWorkspaceId === workspaceId ? null : state.selectedWorkspaceId,
        }));
      },
      setSelectedWorkspaceId: (workspaceId) => set({ selectedWorkspaceId: workspaceId }),
      ensureDefaultWorkspace: () => {
        let defaultId = DEFAULT_WORKSPACE_ID;
        set((state) => ({ workspaces: withDefaultWorkspace(state.workspaces) }));
        const existing = get().workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID);
        if (!existing) {
          defaultId = DEFAULT_WORKSPACE_ID;
        }
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

          const assignedOutsideDefault = new Set(
            cleaned
              .filter((workspace) => workspace.id !== DEFAULT_WORKSPACE_ID)
              .flatMap((workspace) => workspace.trackIds)
          );

          const defaultTrackIds = trackIds.filter((trackId) => !assignedOutsideDefault.has(trackId));

          return {
            workspaces: cleaned.map((workspace) =>
              workspace.id === DEFAULT_WORKSPACE_ID
                ? { ...workspace, trackIds: defaultTrackIds }
                : workspace
            ),
          };
        }),
    }),
    {
      name: "sonara-workspaces",
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

interface StudioState {
  songIdea: string;
  lyrics: string;
  lyricsContext: string;
  title: string;
  selectedProviders: Record<string, string>;
  language: string;
  customLanguage: string;
  instrumental: boolean;
  vocalGender: "female" | "male" | "auto";
  structure: string;
  customStructure: string;
  weirdness: number;
  styleInfluence: number;
  setSongIdea: (idea: string) => void;
  setLyrics: (lyrics: string) => void;
  setLyricsContext: (context: string) => void;
  setTitle: (title: string) => void;
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
  reset: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      songIdea: "",
      lyrics: "",
      lyricsContext: "",
      title: "",
      selectedProviders: { poyo: "v5.5" },
      language: "English",
      customLanguage: "",
      instrumental: false,
      vocalGender: "auto",
      structure: "",
      customStructure: "",
      weirdness: 0,
      styleInfluence: 0,
      setSongIdea: (idea) => set({ songIdea: idea }),
      setLyrics: (lyrics) => set({ lyrics }),
      setLyricsContext: (context) => set({ lyricsContext: context }),
      setTitle: (title) => set({ title }),
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
      reset: () =>
        set({
          songIdea: "",
          lyrics: "",
          lyricsContext: "",
          title: "",
          selectedProviders: { poyo: "v5.5" },
          language: "English",
          customLanguage: "",
          instrumental: false,
          vocalGender: "auto",
          structure: "",
          customStructure: "",
          weirdness: 0,
          styleInfluence: 0,
        }),
    }),
    {
      name: "sonara-studio",
      skipHydration: true,
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
      name: "sonara-ui",
      partialize: (state) => ({ activeTab: state.activeTab }),
    }
  )
);
