import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debouncedStorage";

export interface Playlist {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  trackIds: string[];
  isSystem?: boolean;
  isPublic?: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

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
              ? ((payload as { playlists: Playlist[] }).playlists as Playlist[] as unknown as Playlist[])
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
