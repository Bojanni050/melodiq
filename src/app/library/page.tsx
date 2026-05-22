"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import {
  DEFAULT_WORKSPACE_ID,
  WORKSPACE_FOLDER_GRADIENTS,
  usePlaylistStore,
  useWorkspaceStore,
} from "@/lib/store";

interface LibraryTrack {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl: string | null;
  s3KeyCover: string | null;
}

type LibraryView = "songs" | "workspaces";

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function pickSeededItems<T>(items: T[], seed: string, limit: number) {
  return [...items]
    .sort((left, right) => hashString(`${seed}:${String(left)}`) - hashString(`${seed}:${String(right)}`))
    .slice(0, limit);
}

function getWorkspaceTracks(workspaceId: string, tracks: LibraryTrack[], workspaces: ReturnType<typeof useWorkspaceStore.getState>["workspaces"]) {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return [] as LibraryTrack[];
  return tracks.filter((track) => workspace.trackIds.includes(track.id));
}

export default function LibraryPage() {
  const { playlists } = usePlaylistStore();
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspaceStore();
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<LibraryView>("songs");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const response = await fetch("/api/tracks");
      if (!active) return;

      if (response.ok) {
        const data = await response.json();
        setTracks(data.tracks.filter((track: LibraryTrack) => track.status === "done"));
      }

      setLoading(false);
    }

    fetchTracks();

    return () => {
      active = false;
    };
  }, []);

  const selectedWorkspace = useMemo(() => {
    if (selectedWorkspaceId === null) return null;
    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId) || null;
  }, [selectedWorkspaceId, workspaces]);

  const visibleTracks = useMemo(() => {
    if (!selectedWorkspace) return tracks;
    return tracks.filter((track) => selectedWorkspace.trackIds.includes(track.id));
  }, [selectedWorkspace, tracks]);

  function handleCreateWorkspace() {
    const id = createWorkspace(newWorkspaceName);
    if (!id) return;

    setSelectedWorkspaceId(id);
    setNewWorkspaceName("");
    setShowCreateWorkspace(false);
    setView("workspaces");
  }

  function getWorkspaceCoverImages(workspaceId: string) {
    const workspaceTracks = getWorkspaceTracks(workspaceId, tracks, workspaces);
    const coverImages = workspaceTracks.map((track) => track.coverUrl).filter((cover): cover is string => !!cover);

    if (coverImages.length === 0) return [] as string[];

    return pickSeededItems(coverImages, workspaceId, Math.min(4, coverImages.length));
  }

  function getWorkspaceGradient(workspaceId: string, folderGradient?: string | null) {
    return (
      folderGradient ||
      WORKSPACE_FOLDER_GRADIENTS[hashString(workspaceId) % WORKSPACE_FOLDER_GRADIENTS.length] ||
      "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))"
    );
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex flex-col">
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <section className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(135deg,#11111a_0%,#0b0b11_100%)] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/35">Library</p>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Songs and workspace folders</h1>
                  <p className="max-w-2xl text-sm sm:text-base text-white/60">
                    Browse finished tracks, then move them into folders that keep their own gradient and cover collage.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setView("songs")}
                    className={`h-10 px-4 rounded-full text-sm transition-colors ${view === "songs" ? "bg-white text-black" : "bg-white/6 text-white/70 hover:text-white hover:bg-white/10"}`}
                  >
                    Songs
                  </button>
                  <button
                    onClick={() => setView("workspaces")}
                    className={`h-10 px-4 rounded-full text-sm transition-colors ${view === "workspaces" ? "bg-white text-black" : "bg-white/6 text-white/70 hover:text-white hover:bg-white/10"}`}
                  >
                    Workspaces
                  </button>
                </div>
              </div>
            </section>

            {view === "songs" ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Songs</h2>
                    <p className="text-sm text-white/55">Use track actions to move songs into workspaces or playlists.</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                    {visibleTracks.length} tracks
                  </div>
                </div>

                {loading ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading tracks...</div>
                ) : (
                  <TrackList
                    tracks={visibleTracks}
                    autoQueueAfterPlay
                    onSelect={() => undefined}
                    onAddToPlaylist={() => undefined}
                    playlists={playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }))}
                  />
                )}
              </section>
            ) : (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Workspaces</h2>
                    <p className="text-sm text-white/55">Each workspace keeps its own folder gradient and a seeded collage of covers.</p>
                  </div>

                  {showCreateWorkspace ? (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                      <input
                        value={newWorkspaceName}
                        onChange={(event) => setNewWorkspaceName(event.target.value)}
                        placeholder="Workspace name"
                        className="h-9 w-48 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                      />
                      <button
                        onClick={handleCreateWorkspace}
                        className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateWorkspace(false);
                          setNewWorkspaceName("");
                        }}
                        className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCreateWorkspace(true)}
                      className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      + Create workspace
                    </button>
                  )}
                </div>

                {workspaces.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                    No workspaces yet. Create one to start grouping tracks.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {workspaces.map((workspace) => {
                      const workspaceTracks = getWorkspaceTracks(workspace.id, tracks, workspaces);
                      const coverImages = getWorkspaceCoverImages(workspace.id);
                      const gradient = getWorkspaceGradient(workspace.id, workspace.folderGradient);

                      return (
                        <article
                          key={workspace.id}
                          className="group overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1017] shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
                        >
                          <button
                            onClick={() => {
                              setSelectedWorkspaceId(workspace.id);
                              setView("songs");
                            }}
                            className="block w-full text-left"
                          >
                            <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundImage: gradient }}>
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,0.38))]" />

                              {coverImages.length > 0 ? (
                                <div className="absolute inset-4 grid grid-cols-2 grid-rows-2 gap-2">
                                  {coverImages.slice(0, 4).map((coverUrl, index) => (
                                    <img
                                      key={`${workspace.id}-${coverUrl}-${index}`}
                                      src={coverUrl}
                                      alt={workspace.name}
                                      className="h-full w-full rounded-2xl object-cover shadow-lg ring-1 ring-white/10"
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-3xl text-white/80 backdrop-blur-sm">
                                    +
                                  </div>
                                </div>
                              )}

                              <div className="absolute inset-x-0 bottom-0 p-4">
                                <div className="flex items-end justify-between gap-3">
                                  <div className="min-w-0">
                                    <h3 className="truncate text-lg font-semibold text-white">{workspace.name}</h3>
                                    <p className="text-sm text-white/70">{workspaceTracks.length} songs</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center justify-between gap-2 px-4 py-3">
                            <button
                              onClick={() => {
                                setSelectedWorkspaceId(workspace.id);
                                setView("songs");
                              }}
                              className="text-sm text-white/60 transition-colors hover:text-white"
                            >
                              Open workspace
                            </button>
                            {workspace.id === DEFAULT_WORKSPACE_ID ? (
                              <span className="text-sm text-white/35">Default</span>
                            ) : (
                              <button
                                onClick={() => deleteWorkspace(workspace.id)}
                                className="text-sm text-white/35 transition-colors hover:text-red-400"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
