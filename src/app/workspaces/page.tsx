"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { getWorkspaceCoverCollage, getWorkspaceGradient } from "@/lib/track-utils";
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore, usePlayerStore } from "@/lib/store";

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
  rating?: string | null;
  playCount?: number | null;
  lyricsTimestamps?: string | null;
};

type WorkspaceDisplayMode = "grid" | "list";
const WORKSPACE_GRID_SIZE_STORAGE_KEY = "melodiq.workspace-grid-size";

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
    hydrateWorkspacesFromServer,
  } = useWorkspaceStore();

  const [tracks, setTracks] = useState<Track[]>([]);

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  useEffect(() => {
    setSelectedWorkspaceId(null);
  }, [setSelectedWorkspaceId]);

  useEffect(() => {
    if (!showTrackDetailsPanel) return;

    setSelectedTrack((prev) => {
      if (prev) {
        const found = tracks.find((t) => t.id === prev.id);
        if (found) return found as Track;
        return prev;
      }
      if (currentTrack) {
        const found = tracks.find((t) => t.id === currentTrack.id);
        if (found) return found as Track;
        return currentTrack as Track;
      }
      return null;
    });
  }, [showTrackDetailsPanel, tracks, currentTrack]);

  const prevIsPlaying = useRef(isPlaying);
  const prevCurrentTrackId = useRef(currentTrack?.id);

  useEffect(() => {
    const playResumed = isPlaying && !prevIsPlaying.current;
    const trackChanged = currentTrack?.id !== prevCurrentTrackId.current;
    
    prevIsPlaying.current = isPlaying;
    prevCurrentTrackId.current = currentTrack?.id;

    if (showTrackDetailsPanel && currentTrack && (playResumed || trackChanged)) {
      setSelectedTrack((prev) => {
        if (prev?.id === currentTrack.id) return prev;
        const matched = tracks.find((t) => t.id === currentTrack.id);
        return matched || (currentTrack as unknown as Track);
      });
    }
  }, [isPlaying, currentTrack, showTrackDetailsPanel, tracks]);

  function handleCloseTrackDetails() {
    setShowTrackDetailsPanel(false);
  }

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;

    const player = usePlayerStore.getState();
    player.playTrackFromGesture({
      id: selectedTrack.id,
      title: selectedTrack.title,
      provider: selectedTrack.provider,
      providerModel: selectedTrack.providerModel,
      prompt: selectedTrack.prompt,
      status: selectedTrack.status,
      audioUrl: url,
      audioUrlHd: selectedTrack.audioUrlHd,
      format: selectedTrack.format,
      formatHd: selectedTrack.formatHd,
      s3Key: null,
      s3KeyHd: selectedTrack.s3KeyHd,
      duration: selectedTrack.duration,
      lyrics: selectedTrack.lyrics,
      lyricsTimestamps: selectedTrack.lyricsTimestamps,
      createdAt: selectedTrack.createdAt,
      error: selectedTrack.error,
      coverUrl: selectedTrack.coverUrl ?? null,
      s3KeyCover: selectedTrack.s3KeyCover ?? null,
    });
  }

  function handleDownloadTrack(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd
      ? (selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3")
      : (selectedTrack?.format ?? "mp3");
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }
  const [loading, setLoading] = useState(true);
  const [workspaceDisplayMode, setWorkspaceDisplayMode] = useState<WorkspaceDisplayMode>("grid");
  const [workspaceGridSize, setWorkspaceGridSize] = useState<4 | 8 | 12 | 16>(8);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isTopInView, setIsTopInView] = useState(true);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTopInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => {
      observer.unobserve(sentinel);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const res = await fetch("/api/tracks");
      if (!active) return;

      if (res.ok) {
        const data = await res.json();
        const cleanedTracks = (data.tracks || [])
          .filter((track: Track) => track.status === "done")
          .map((t: Track) => ({
            ...t,
            title: t.title ? t.title.replace(/\s*\(2\)\s*$/, "") : t.title,
          }));
        setTracks(cleanedTracks);
        if (Array.isArray(data.workspaces)) {
          hydrateWorkspacesFromServer(data.workspaces);
        }
      }

      setLoading(false);
    }

    fetchTracks();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(WORKSPACE_GRID_SIZE_STORAGE_KEY);
    if (saved === "4" || saved === "8" || saved === "12" || saved === "16") {
      setWorkspaceGridSize(Number(saved) as 4 | 8 | 12 | 16);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WORKSPACE_GRID_SIZE_STORAGE_KEY, String(workspaceGridSize));
  }, [workspaceGridSize]);

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

  const workspaceGridClass =
    workspaceGridSize === 4
      ? "grid-cols-[repeat(4,minmax(0,1fr))]"
      : workspaceGridSize === 8
        ? "grid-cols-[repeat(8,minmax(0,1fr))]"
        : workspaceGridSize === 12
          ? "grid-cols-[repeat(12,minmax(0,1fr))]"
          : "grid-cols-[repeat(16,minmax(0,1fr))]";

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

      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex">
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-[73px] lg:pt-5">
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
              <div ref={sentinelRef} className="h-0 w-full" />
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

                  {workspaceDisplayMode === "grid" && (
                    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                      {[4, 8, 12, 16].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setWorkspaceGridSize(size as 4 | 8 | 12 | 16)}
                          className={`rounded-full px-2.5 py-1 text-xs transition ${workspaceGridSize === size ? "bg-primary-500 text-white" : "text-white/65 hover:text-white hover:bg-white/10"}`}
                          title={`Show ${size} workspace cards per row`}
                          aria-label={`Show ${size} workspace cards per row`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  )}

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
                <div className={`grid gap-4 ${workspaceGridClass}`}>
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
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                              <div className="rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-md">
                                <h3 className="whitespace-normal wrap-break-word text-base font-semibold leading-snug text-white sm:text-sm">
                                  {workspace.name}
                                </h3>
                                <p className="text-xs text-white/70">
                                  {workspaceTracks.length} songs{childCount > 0 ? ` • ${childCount} folders` : ""}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>

                        {workspace.id === DEFAULT_WORKSPACE_ID ? (
                          <div className="px-4 py-3">
                            <span className="text-sm text-white/35">Default</span>
                          </div>
                        ) : null}
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
                            <img src={coverImages[0]} alt={workspace.name} loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="whitespace-normal wrap-break-word text-base font-medium leading-snug text-white sm:text-sm">
                            {workspace.name}
                          </p>
                          <p className="text-xs text-white/45">
                            {workspaceTracks.length} {workspaceTracks.length === 1 ? "song" : "songs"}
                            {childCount > 0 ? ` • ${childCount} folders` : ""}
                          </p>
                        </div>

                        <svg className="h-4 w-4 shrink-0 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isTopInView && (
                <div className="sticky bottom-6 mr-2 z-40 flex justify-end pointer-events-none">
                  <button
                    type="button"
                    onClick={() => sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-[#11121a]/90 text-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all hover:bg-white hover:text-black hover:scale-105 active:scale-95 hover:border-white hover:shadow-[0_12px_40px_rgba(255,255,255,0.15)]"
                    title="Scroll to top"
                    aria-label="Scroll to top"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm text-white/60">
              Click a folder to open its own page with track listing.
            </section>
          </div>
        </main>

        <ResizablePanel show={showTrackDetailsPanel} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="h-full overflow-y-auto">
            {selectedTrack ? (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={handleCloseTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Select a track or press play to show song info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {showTrackDetailsPanel && selectedTrack && (
        <div className="lg:hidden">
          <TrackDetail
            track={selectedTrack}
            onClose={handleCloseTrackDetails}
            onPlay={handlePlayTrack}
            onDownload={handleDownloadTrack}
            mode="overlay"
          />
        </div>
      )}
    </div>
  );
}
