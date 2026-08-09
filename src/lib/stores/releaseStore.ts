import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debouncedStorage";

export interface ReleaseTrack {
  trackId: string;
  position: number;
  side?: string | null;
}

export interface Release {
  id: string;
  title: string;
  type: string; // single | ep | album
  kind?: string | null;
  artistName?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  releaseDate?: string | null;
  isPublic?: boolean;
  publishedAt?: string | null;
  createdAt: string;
  tracks: ReleaseTrack[];
}

interface ReleaseState {
  releases: Release[];
  selectedReleaseId: string | null;
  releasesHydrated: boolean;
  hydrateReleasesFromServer: (releases: Release[]) => void;
  loadReleases: () => Promise<void>;
  createRelease: (input: { title: string; type: string; kind?: string; artistName?: string }) => Promise<string>;
  addTrackToRelease: (
    releaseId: string,
    trackId: string,
    options?: { side?: string; allowDuplicate?: boolean }
  ) => void;
  removeTrackFromRelease: (releaseId: string, trackId: string) => void;
  reorderReleaseTracks: (releaseId: string, trackIds: string[]) => void;
  setTrackSide: (releaseId: string, trackId: string, side: string | null) => void;
  deleteRelease: (releaseId: string) => void;
  setSelectedReleaseId: (releaseId: string | null) => void;
  renameRelease: (releaseId: string, title: string) => void;
  updateReleaseDetails: (
    releaseId: string,
    details: { kind?: string | null; artistName?: string | null; description?: string | null; releaseDate?: string | null }
  ) => void;
  updateReleaseType: (releaseId: string, type: string) => void;
  updateReleaseCover: (releaseId: string, coverUrl: string) => void;
}

function persistReleaseDelete(releaseId: string) {
  if (typeof window === "undefined") return;

  void fetch(`/api/releases/${releaseId}`, {
    method: "DELETE",
  }).catch((error) => console.error("[store] persistReleaseDelete failed", error));
}

function persistAddTrackToRelease(input: {
  releaseId: string;
  trackId: string;
  side?: string;
  allowDuplicate?: boolean;
}) {
  if (typeof window === "undefined") return;

  void fetch(`/api/releases/${input.releaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add-track",
      trackId: input.trackId,
      side: input.side,
      allowDuplicate: input.allowDuplicate === true,
    }),
  })
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const release = data?.release;
      if (release) {
        useReleaseStore.getState().hydrateReleasesFromServer(
          useReleaseStore.getState().releases.map((r) => (r.id === release.id ? release : r))
        );
      }
    })
    .catch((error) => console.error("[store] persistAddTrackToRelease failed", error));
}

function persistRemoveTrackFromRelease(input: { releaseId: string; trackId: string }) {
  if (typeof window === "undefined") return;

  void fetch(`/api/releases/${input.releaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remove-track", trackId: input.trackId }),
  }).catch((error) => console.error("[store] persistRemoveTrackFromRelease failed", error));
}

function persistReorderReleaseTracks(input: { releaseId: string; trackIds: string[] }) {
  if (typeof window === "undefined") return;

  void fetch(`/api/releases/${input.releaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reorder-tracks", trackIds: input.trackIds }),
  }).catch((error) => console.error("[store] persistReorderReleaseTracks failed", error));
}

export const useReleaseStore = create<ReleaseState>()(
  persist(
    (set, get) => ({
      releases: [],
      selectedReleaseId: null,
      releasesHydrated: false,
      hydrateReleasesFromServer: (incomingReleases) =>
        set((state) => ({
          releases: incomingReleases,
          releasesHydrated: true,
          selectedReleaseId:
            state.selectedReleaseId && incomingReleases.some((release) => release.id === state.selectedReleaseId)
              ? state.selectedReleaseId
              : null,
        })),
      loadReleases: async () => {
        try {
          const response = await fetch("/api/releases", { cache: "no-store" });
          if (!response.ok) {
            set({ releasesHydrated: true });
            return;
          }

          const payload = await response.json().catch(() => null);
          const incomingReleases =
            payload && typeof payload === "object" && Array.isArray((payload as { releases?: unknown[] }).releases)
              ? ((payload as { releases: Release[] }).releases as Release[])
              : [];

          get().hydrateReleasesFromServer(incomingReleases);
        } catch {
          set({ releasesHydrated: true });
        }
      },
      createRelease: async ({ title, type, kind, artistName }) => {
        const trimmed = title.trim();
        if (!trimmed) return "";

        try {
          const res = await fetch("/api/releases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: trimmed, type, kind, artistName }),
          });
          if (!res.ok) return "";
          const data = await res.json().catch(() => null);
          const release = data?.release;
          if (!release) return "";

          set((state) => ({ releases: [...state.releases, release] }));
          return release.id as string;
        } catch (error) {
          console.error("[store] createRelease failed", error);
          return "";
        }
      },
      addTrackToRelease: (releaseId, trackId, options) => {
        set((state) => ({
          releases: state.releases.map((release) => {
            if (release.id !== releaseId) return release;
            if (release.tracks.some((t) => t.trackId === trackId) && !options?.allowDuplicate) return release;
            const nextPosition = release.tracks.length;
            return {
              ...release,
              tracks: [...release.tracks, { trackId, position: nextPosition, side: options?.side ?? null }],
            };
          }),
        }));

        persistAddTrackToRelease({ releaseId, trackId, side: options?.side, allowDuplicate: options?.allowDuplicate });
      },
      removeTrackFromRelease: (releaseId, trackId) => {
        set((state) => ({
          releases: state.releases.map((release) => {
            if (release.id !== releaseId) return release;
            return { ...release, tracks: release.tracks.filter((t) => t.trackId !== trackId) };
          }),
        }));

        persistRemoveTrackFromRelease({ releaseId, trackId });
      },
      reorderReleaseTracks: (releaseId, trackIds) => {
        set((state) => ({
          releases: state.releases.map((release) => {
            if (release.id !== releaseId) return release;

            const existing = [...release.tracks];
            const next: ReleaseTrack[] = [];

            trackIds.forEach((trackId) => {
              const index = existing.findIndex((t) => t.trackId === trackId);
              if (index < 0) return;
              next.push(existing[index]);
              existing.splice(index, 1);
            });

            next.push(...existing);
            return { ...release, tracks: next.map((t, i) => ({ ...t, position: i })) };
          }),
        }));

        persistReorderReleaseTracks({ releaseId, trackIds });
      },
      setTrackSide: (releaseId, trackId, side) => {
        set((state) => ({
          releases: state.releases.map((release) => {
            if (release.id !== releaseId) return release;
            return {
              ...release,
              tracks: release.tracks.map((t) => (t.trackId === trackId ? { ...t, side } : t)),
            };
          }),
        }));

        if (typeof window === "undefined") return;
        void fetch(`/api/releases/${releaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set-side", trackId, side }),
        }).catch((error) => console.error("[store] setTrackSide failed", error));
      },
      deleteRelease: (releaseId) => {
        set((state) => ({
          releases: state.releases.filter((release) => release.id !== releaseId),
          selectedReleaseId: state.selectedReleaseId === releaseId ? null : state.selectedReleaseId,
        }));

        persistReleaseDelete(releaseId);
      },
      setSelectedReleaseId: (releaseId) => set({ selectedReleaseId: releaseId }),
      renameRelease: (releaseId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => ({
          releases: state.releases.map((release) =>
            release.id === releaseId ? { ...release, title: trimmed } : release
          ),
        }));
        if (typeof window === "undefined") return;
        void fetch(`/api/releases/${releaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", title: trimmed }),
        }).catch((error) => console.error("[store] renameRelease failed", error));
      },
      updateReleaseDetails: (releaseId, details) => {
        set((state) => ({
          releases: state.releases.map((release) =>
            release.id === releaseId ? { ...release, ...details } : release
          ),
        }));
        if (typeof window === "undefined") return;
        void fetch(`/api/releases/${releaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-details", ...details }),
        }).catch((error) => console.error("[store] updateReleaseDetails failed", error));
      },
      updateReleaseType: (releaseId, type) => {
        set((state) => ({
          releases: state.releases.map((release) =>
            release.id === releaseId ? { ...release, type } : release
          ),
        }));
        if (typeof window === "undefined") return;
        void fetch(`/api/releases/${releaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-type", type }),
        }).catch((error) => console.error("[store] updateReleaseType failed", error));
      },
      updateReleaseCover: (releaseId, coverUrl) => {
        set((state) => ({
          releases: state.releases.map((release) =>
            release.id === releaseId ? { ...release, coverUrl } : release
          ),
        }));
      },
    }),
    {
      name: "melodiq-releases",
      storage: createDebouncedStorage(400),
      partialize: (state) => ({
        selectedReleaseId: state.selectedReleaseId,
        releasesHydrated: state.releasesHydrated,
        // Track membership is server-authoritative and hydrated from /api/releases.
        releases: state.releases.map(({ tracks: _tracks, ...rest }) => ({ ...rest, tracks: [] as ReleaseTrack[] })),
      }),
      merge: (persistedState, currentState) => {
        const typedPersisted = (persistedState as Partial<ReleaseState>) || {};
        return {
          ...currentState,
          ...typedPersisted,
          releases: currentState.releases,
        } as ReleaseState;
      },
    }
  )
);
