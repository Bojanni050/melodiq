"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { WORKSPACE_FOLDER_GRADIENTS, useWorkspaceStore } from "@/lib/store";

type Track = {
  id: string;
  title: string | null;
  provider: string;
  prompt: string;
  status: "pending" | "generating" | "done" | "failed";
  coverUrl?: string | null;
  createdAt: string;
};

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickRandomItems<T>(items: T[], seed: string, limit: number) {
  const next = [...items];
  next.sort((left, right) => {
    const leftScore = hashString(`${seed}:${String(left)}`);
    const rightScore = hashString(`${seed}:${String(right)}`);
    return leftScore - rightScore;
  });
  return next.slice(0, limit);
}

function getCoverCollage(workspaceId: string, tracks: Track[]) {
  const coverUrls = tracks
    .filter((track) => !!track.coverUrl)
    .map((track) => track.coverUrl as string);

  return pickRandomItems(coverUrls, workspaceId, 4);
}

function getGradient(workspaceId: string, gradient?: string) {
  if (gradient) return gradient;
  return WORKSPACE_FOLDER_GRADIENTS[hashString(workspaceId) % WORKSPACE_FOLDER_GRADIENTS.length];
}

export default function WorkspacesPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((state) => state.deleteWorkspace);
  const selectedWorkspaceId = useWorkspaceStore((state) => state.selectedWorkspaceId);
  const setSelectedWorkspaceId = useWorkspaceStore((state) => state.setSelectedWorkspaceId);

  useEffect(() => {
    async function fetchTracks() {
      const res = await fetch("/api/tracks");
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
      }
      setLoading(false);
    }

    fetchTracks();
  }, []);

  const selectedWorkspace = useMemo(() => {
    if (!selectedWorkspaceId) return null;
    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || null;
  }, [selectedWorkspaceId, workspaces]);

  const selectedWorkspaceTracks = useMemo(() => {
    if (!selectedWorkspace) return [] as Track[];
    return tracks.filter((track) => selectedWorkspace.trackIds.includes(track.id));
  }, [selectedWorkspace, tracks]);

  function handleCreateWorkspace() {
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;
    const id = createWorkspace(trimmed);
    if (id) {
      setSelectedWorkspaceId(id);
      setNewWorkspaceName("");
      setShowCreateWorkspace(false);
    }
  }

  function handleCreateWorkspaceKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateWorkspace();
    } else if (event.key === "Escape") {
      setShowCreateWorkspace(false);
      setNewWorkspaceName("");
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a0f] overflow-hidden">
        <Sidebar credits={null} />
        <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={null} />
      <div className="h-[calc(100vh-var(--player-height))] overflow-y-auto lg:ml-60">
        <div className="sticky top-0 z-20 border-b border-white/5 bg-[#0a0a0f]/95 backdrop-blur-sm">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold">Workspaces</h1>
              <p className="text-xs text-white/40 mt-0.5">Folders where songs can be grouped and moved from track actions</p>
            </div>
            <Link
              href="/library"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              Open Library
            </Link>
          </div>
        </div>

        <main className="p-4 space-y-5 max-w-[1600px]">
          <section className="section-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Workspace folders</h2>
                <p className="text-xs text-white/40">Each folder gets its own gradient and shows a cover collage from the songs inside.</p>
              </div>
              {showCreateWorkspace ? (
                <div className="flex items-center gap-1">
                  <input
                    value={newWorkspaceName}
                    onChange={(event) => setNewWorkspaceName(event.target.value)}
                    onKeyDown={handleCreateWorkspaceKeyDown}
                    placeholder="Workspace name"
                    className="h-8 rounded-md border border-white/15 bg-white/5 px-2.5 text-xs text-white placeholder:text-white/30"
                    aria-label="Workspace name"
                  />
                  <button
                    onClick={handleCreateWorkspace}
                    className="h-8 rounded-md bg-primary-500/80 px-3 text-xs text-white hover:bg-primary-500"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateWorkspace(false);
                      setNewWorkspaceName("");
                    }}
                    className="h-8 rounded-md bg-white/5 px-3 text-xs text-white/60 hover:text-white/80"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateWorkspace(true)}
                  className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white/90"
                >
                  + Create Workspace
                </button>
              )}
            </div>
          </section>

          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {workspaces.map((workspace) => {
                const workspaceTracks = tracks.filter((track) => workspace.trackIds.includes(track.id));
                const coverUrls = getCoverCollage(workspace.id, workspaceTracks);
                const gradient = getGradient(workspace.id, workspace.folderGradient);

                return (
                  <button
                    key={workspace.id}
                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                    className={`group rounded-3xl border border-white/10 text-left transition-transform hover:-translate-y-0.5 ${
                      selectedWorkspaceId === workspace.id ? "ring-2 ring-primary-500/40" : ""
                    }`}
                  >
                    <div className="relative aspect-[4/4.2] overflow-hidden rounded-3xl" style={{ backgroundImage: gradient }}>
                      <div className="absolute inset-0 bg-black/10" />
                      {coverUrls.length > 0 ? (
                        <div className="absolute inset-3 grid grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-inner">
                          {coverUrls.map((cover, index) => (
                            <img
                              key={`${workspace.id}-${index}`}
                              src={cover}
                              alt={workspace.name}
                              className="h-full w-full object-cover"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                            <svg className="h-12 w-12 text-white/85" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                            </svg>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-sm">
                          <p className="text-sm font-semibold text-white truncate">{workspace.name}</p>
                          <p className="text-xs text-white/65">{workspaceTracks.length} songs</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {workspaces.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-white/40 sm:col-span-2 xl:col-span-3">
                  No workspaces yet. Create one and move songs into it from Track Actions.
                </div>
              )}
            </div>
          </section>

          {selectedWorkspace && (
            <section className="section-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{selectedWorkspace.name}</h2>
                  <p className="text-xs text-white/40">{selectedWorkspaceTracks.length} songs inside this workspace</p>
                </div>
                <button
                  onClick={() => deleteWorkspace(selectedWorkspace.id)}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65 hover:bg-red-500/10 hover:text-red-200"
                >
                  Delete workspace
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {selectedWorkspaceTracks.map((track) => (
                  <div key={track.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title || "Cover art"} className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white/40">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{track.title || track.prompt.slice(0, 40)}</p>
                      <p className="truncate text-xs text-white/35">{track.provider} · {track.status}</p>
                    </div>
                  </div>
                ))}
                {selectedWorkspaceTracks.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-white/40 sm:col-span-2 xl:col-span-3">
                    This workspace has no songs yet. Use Track Actions → Move To Workspace to add songs.
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
