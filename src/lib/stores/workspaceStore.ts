import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDebouncedStorage } from "./debouncedStorage";

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

interface WorkspaceState {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  createWorkspace: (name: string) => string;
  createWorkspaceFolder: (parentWorkspaceId: string, name: string) => string;
  createWorkspaceFolderAndAssign: (parentWorkspaceId: string, name: string, trackId: string) => Promise<string>;
  moveTrackToWorkspace: (workspaceId: string, trackId: string) => void;
  moveTracksToWorkspace: (workspaceId: string, trackIds: string[]) => void;
  removeTrackFromWorkspace: (workspaceId: string, trackId: string) => void;
  deleteWorkspace: (workspaceId: string, options?: { deleteTracks?: boolean }) => void;
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
}): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
    .then(() => undefined)
    .catch((error) => console.error("[store] persistWorkspaceCreate failed", error));
}

function persistWorkspaceDelete(workspaceId: string, options?: { deleteTracks?: boolean }) {
  if (typeof window === "undefined") return;

  const query = options?.deleteTracks ? "?deleteTracks=true" : "";
  void fetch(`/api/workspaces/${workspaceId}${query}`, {
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

        void persistWorkspaceCreate({ id, name: trimmed, parentWorkspaceId, folderGradient });

        return id;
      },
      // Same as createWorkspaceFolder, but for "create a new subfolder and
      // move this track into it in one step" flows (upload panel's per-file
      // picker). Awaits the subfolder actually existing server-side before
      // assigning the track — createWorkspaceFolder fires its POST
      // /api/workspaces fire-and-forget, so calling moveTrackToWorkspace
      // right after it is a race: the track's PATCH { workspaceId } can
      // reach the server (and 404 "Workspace not found") before the
      // subfolder's own POST has committed.
      createWorkspaceFolderAndAssign: async (parentWorkspaceId, name, trackId) => {
        const trimmed = name.trim();
        if (!trimmed) return "";

        const existing = findWorkspaceByName(get().workspaces, trimmed);
        if (existing) {
          get().moveTrackToWorkspace(existing.id, trackId);
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

        await persistWorkspaceCreate({ id, name: trimmed, parentWorkspaceId, folderGradient });
        get().moveTrackToWorkspace(id, trackId);

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
      deleteWorkspace: (workspaceId, options) => {
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

        persistWorkspaceDelete(workspaceId, { deleteTracks: options?.deleteTracks });
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
