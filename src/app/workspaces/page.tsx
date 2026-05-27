"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getWorkspaceCoverCollage, getWorkspaceGradient } from "@/lib/track-utils";
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore } from "@/lib/store";

type Track = {
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
};

type WorkspaceDisplayMode = "grid" | "list";

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const SWATCH_COLORS = [
  "bg-violet-600",
  "bg-sky-500",
  "bg-orange-500",
  "bg-emerald-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-teal-500",
] as const;

function getWorkspaceSwatchClass(workspaceId: string) {
  return SWATCH_COLORS[hashString(workspaceId) % SWATCH_COLORS.length];
}

export default function WorkspacesPage() {
  const router = useRouter();
  const {
    workspaces,
    setSelectedWorkspaceId,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspaceStore();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceDisplayMode, setWorkspaceDisplayMode] = useState<WorkspaceDisplayMode>("grid");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const res = await fetch("/api/tracks");
      if (!active) return;

      if (res.ok) {
        const data = await res.json();
        setTracks((data.tracks || []).filter((track: Track) => track.status === "done"));
      }

      setLoading(false);
    }

    fetchTracks();

    return () => {
      active = false;
    };
  }, []);

  const rootWorkspaces = useMemo(
    () => workspaces.filter((workspace) => !workspace.parentWorkspaceId),
    [workspaces],
  );

  const childWorkspacesByParent = useMemo(() => {
    const grouped = new Map<string, typeof workspaces>();
    workspaces
      .filter((workspace) => Boolean(workspace.parentWorkspaceId))
      .forEach((workspace) => {
        const parentId = workspace.parentWorkspaceId as string;
        const list = grouped.get(parentId) ?? [];
        grouped.set(parentId, [...list, workspace]);
      });
    return grouped;
  }, [workspaces]);

  function openWorkspace(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId);
    router.push(`/workspaces/${workspaceId}`);
  }

  function handleCreateWorkspace() {
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;

    const workspaceId = createWorkspace(trimmed);
    if (!workspaceId) return;

    setSelectedWorkspaceId(workspaceId);
    setNewWorkspaceName("");
    setShowCreateWorkspace(false);
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex flex-col">
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24">
          <div className="max-w-[1600px] mx-auto space-y-6">
            <section className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(135deg,#11111a_0%,#0b0b11_100%)] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">Workspace Manager</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Workspaces</h1>
                <p className="max-w-2xl text-sm sm:text-base text-white/60">
                  Manage folders with the same layout and behavior as the Library workspace section.
                </p>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Workspaces</h2>
                  <p className="text-sm text-white/55">Each workspace keeps its own folder gradient and a seeded collage of covers.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1">
                    <button
                      type="button"
                      onClick={() => setWorkspaceDisplayMode("grid")}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${workspaceDisplayMode === "grid" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}
                      title="Grid view"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceDisplayMode("list")}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${workspaceDisplayMode === "list" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}
                      title="List view"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </div>

                  {showCreateWorkspace ? (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                      <input
                        value={newWorkspaceName}
                        onChange={(event) => setNewWorkspaceName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleCreateWorkspace();
                          if (event.key === "Escape") {
                            setShowCreateWorkspace(false);
                            setNewWorkspaceName("");
                          }
                        }}
                        placeholder="Workspace name"
                        className="h-9 w-52 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateWorkspace}
                        className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
                      >
                        Add
                      </button>
                      <button
                        type="button"
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
                      type="button"
                      onClick={() => setShowCreateWorkspace(true)}
                      className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      + Create workspace
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading workspaces...</div>
              ) : rootWorkspaces.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                  No workspaces yet. Create one to start grouping tracks.
                </div>
              ) : workspaceDisplayMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rootWorkspaces.map((workspace) => {
                    const workspaceTracks = tracks.filter((track) => workspace.trackIds.includes(track.id));
                    const coverImages = getWorkspaceCoverCollage(workspace.id, workspaceTracks);
                    const gradient = getWorkspaceGradient(workspace.id, workspace.folderGradient);
                    const childCount = (childWorkspacesByParent.get(workspace.id) ?? []).length;

                    return (
                      <article
                        key={workspace.id}
                        className="group overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1017] shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
                      >
                        <button
                          type="button"
                          onClick={() => openWorkspace(workspace.id)}
                          className="block w-full text-left"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundImage: gradient }}>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,0.38))]" />
                            {coverImages.length > 0 ? (
                              <div className="absolute inset-4 grid grid-cols-2 grid-rows-2 gap-2">
                                {coverImages.slice(0, 4).map((coverUrl, index) => (
                                  <img
                                    key={`${workspace.id}-${index}`}
                                    src={coverUrl}
                                    alt={workspace.name}
                                    className="h-full w-full rounded-2xl object-cover shadow-lg ring-1 ring-white/10"
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-3xl text-white/80 backdrop-blur-sm">+</div>
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <h3 className="truncate text-lg font-semibold text-white">{workspace.name}</h3>
                              <p className="text-sm text-white/70">
                                {workspaceTracks.length} songs{childCount > 0 ? ` • ${childCount} folders` : ""}
                              </p>
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center justify-between gap-2 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openWorkspace(workspace.id)}
                            className="text-sm text-white/60 transition-colors hover:text-white"
                          >
                            Open workspace
                          </button>
                          {workspace.id === DEFAULT_WORKSPACE_ID ? (
                            <span className="text-sm text-white/35">Default</span>
                          ) : (
                            <button
                              type="button"
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
              ) : (
                <div className="space-y-1.5">
                  {rootWorkspaces.map((workspace) => {
                    const workspaceTracks = tracks.filter((track) => workspace.trackIds.includes(track.id));
                    const coverImages = getWorkspaceCoverCollage(workspace.id, workspaceTracks);
                    const childCount = (childWorkspacesByParent.get(workspace.id) ?? []).length;

                    return (
                      <div
                        key={workspace.id}
                        className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-[#0f1017] px-4 py-3 transition-colors hover:bg-white/4"
                      >
                        <div className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ${getWorkspaceSwatchClass(workspace.id)}`}>
                          {coverImages[0] ? (
                            <img src={coverImages[0]} alt={workspace.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{workspace.name}</p>
                          <p className="text-xs text-white/45">
                            {workspaceTracks.length} {workspaceTracks.length === 1 ? "song" : "songs"}
                            {childCount > 0 ? ` • ${childCount} folders` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            onClick={() => openWorkspace(workspace.id)}
                            className="text-xs text-white/50 transition-colors hover:text-white"
                          >
                            Open
                          </button>
                          {workspace.id !== DEFAULT_WORKSPACE_ID && (
                            <button
                              type="button"
                              onClick={() => deleteWorkspace(workspace.id)}
                              className="text-xs text-white/30 transition-colors hover:text-red-400"
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        <svg className="h-4 w-4 shrink-0 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/60">
              Click a folder to open its own page with track listing.
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
