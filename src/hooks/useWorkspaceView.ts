"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import type { Track } from "./useTrackManager";

const WORKSPACE_VIEW_MODE_STORAGE_KEY = "melodiq-studio-workspace-view-mode";
const WORKSPACE_GRID_SIZE_STORAGE_KEY = "melodiq-studio-workspace-grid-size";

export function useWorkspaceView(tracks: Track[]) {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const selectedWorkspaceId = useWorkspaceStore((state) => state.selectedWorkspaceId);
  const setSelectedWorkspaceId = useWorkspaceStore((state) => state.setSelectedWorkspaceId);
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const createWorkspaceFolder = useWorkspaceStore((state) => state.createWorkspaceFolder);

  const [studioTab, setStudioTab] = useState<"workspaces" | "recent">("recent");
  const [workspaceViewMode, setWorkspaceViewMode] = useState<"grid" | "list">("list");
  const [workspaceGridSize, setWorkspaceGridSize] = useState<4 | 8 | 12 | 16>(8);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Restore persisted preferences
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WORKSPACE_GRID_SIZE_STORAGE_KEY);
      if (saved === "4" || saved === "8" || saved === "12" || saved === "16") {
        setWorkspaceGridSize(Number(saved) as 4 | 8 | 12 | 16);
      }
      const savedView = window.localStorage.getItem(WORKSPACE_VIEW_MODE_STORAGE_KEY);
      if (savedView === "grid" || savedView === "list") {
        setWorkspaceViewMode(savedView);
      }
    } catch {
      // ignore localStorage read failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_GRID_SIZE_STORAGE_KEY, String(workspaceGridSize));
    } catch {
      // ignore
    }
  }, [workspaceGridSize]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_VIEW_MODE_STORAGE_KEY, workspaceViewMode);
    } catch {
      // ignore
    }
  }, [workspaceViewMode]);

  // Derived workspace data
  const selectedWorkspace = selectedWorkspaceId
    ? (workspaces.find((w) => w.id === selectedWorkspaceId) ?? null)
    : null;

  const rootWorkspaces = useMemo(
    () => workspaces.filter((w) => !w.parentWorkspaceId),
    [workspaces]
  );

  const selectedWorkspaceParent = useMemo(() => {
    if (!selectedWorkspace?.parentWorkspaceId) return null;
    return workspaces.find((w) => w.id === selectedWorkspace.parentWorkspaceId) ?? null;
  }, [selectedWorkspace, workspaces]);

  const selectedWorkspaceChildren = useMemo(() => {
    if (!selectedWorkspace || selectedWorkspace.parentWorkspaceId) return [];
    return workspaces.filter((w) => w.parentWorkspaceId === selectedWorkspace.id);
  }, [selectedWorkspace, workspaces]);

  const selectedWorkspaceTracks = useMemo(() => {
    if (!selectedWorkspace) return [];
    const idSet = new Set(selectedWorkspace.trackIds);
    return tracks.filter((t) => idSet.has(t.id));
  }, [selectedWorkspace, tracks]);

  // Handlers
  const handleCreateWorkspace = useCallback(() => {
    const id = createWorkspace(newWorkspaceName);
    if (!id) return;
    setSelectedWorkspaceId(id);
    setNewWorkspaceName("");
    setShowCreateWorkspace(false);
  }, [createWorkspace, newWorkspaceName, setSelectedWorkspaceId]);

  const handleCreateWorkspaceKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCreateWorkspace();
      } else if (event.key === "Escape") {
        setShowCreateWorkspace(false);
        setNewWorkspaceName("");
      }
    },
    [handleCreateWorkspace]
  );

  const handleCreateFolder = useCallback(() => {
    if (!selectedWorkspace || selectedWorkspace.parentWorkspaceId) return;
    const id = createWorkspaceFolder(selectedWorkspace.id, newFolderName);
    if (!id) return;
    setSelectedWorkspaceId(id);
    setNewFolderName("");
    setShowCreateFolder(false);
  }, [createWorkspaceFolder, newFolderName, selectedWorkspace, setSelectedWorkspaceId]);

  const handleCreateFolderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCreateFolder();
      } else if (event.key === "Escape") {
        setShowCreateFolder(false);
        setNewFolderName("");
      }
    },
    [handleCreateFolder]
  );

  return {
    // store
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    // tabs
    studioTab,
    setStudioTab,
    // view mode
    workspaceViewMode,
    setWorkspaceViewMode,
    workspaceGridSize,
    setWorkspaceGridSize,
    // create workspace
    showCreateWorkspace,
    setShowCreateWorkspace,
    newWorkspaceName,
    setNewWorkspaceName,
    handleCreateWorkspace,
    handleCreateWorkspaceKeyDown,
    // create folder
    showCreateFolder,
    setShowCreateFolder,
    newFolderName,
    setNewFolderName,
    handleCreateFolder,
    handleCreateFolderKeyDown,
    // derived
    selectedWorkspace,
    rootWorkspaces,
    selectedWorkspaceParent,
    selectedWorkspaceChildren,
    selectedWorkspaceTracks,
  };
}
