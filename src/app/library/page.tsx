"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import {
  DEFAULT_WORKSPACE_ID,
  WORKSPACE_FOLDER_GRADIENTS,
  usePlayerStore,
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
  rating?: string | null;
}

type LibraryView = "songs" | "workspaces";
type WorkspaceDisplayMode = "grid" | "list";
const WORKSPACE_GRID_SIZE_STORAGE_KEY = "sonara.workspace-grid-size";

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickSeededItems<T>(items: T[], seed: string, limit: number) {
  return [...items]
    .sort((a, b) => hashString(`${seed}:${String(a)}`) - hashString(`${seed}:${String(b)}`))
    .slice(0, limit);
}

function getWorkspaceTracks(
  workspaceId: string,
  tracks: LibraryTrack[],
  workspaces: ReturnType<typeof useWorkspaceStore.getState>["workspaces"],
) {
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return [] as LibraryTrack[];
  return tracks.filter((t) => workspace.trackIds.includes(t.id));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readApiPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.toLowerCase().includes("application/json")) {
    return response.json().catch(() => null);
  }

  const rawText = await response.text().catch(() => "");
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return { __rawText: rawText };
  }
}

export default function LibraryPage() {
  const { playlists } = usePlaylistStore();
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    createWorkspace,
    deleteWorkspace,
    moveTrackToWorkspace,
    ensureDefaultWorkspace,
    hydrateWorkspacesFromServer,
  } = useWorkspaceStore();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<LibraryView>("songs");
  const [workspaceDisplayMode, setWorkspaceDisplayMode] = useState<WorkspaceDisplayMode>("grid");
  const [workspaceGridSize, setWorkspaceGridSize] = useState<4 | 8 | 12 | 16>(8);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<LibraryTrack | null>(null);
  const [uploadWorkspaceId, setUploadWorkspaceId] = useState<string>(DEFAULT_WORKSPACE_ID);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const fetchTracks = useCallback(async (activeCheck?: () => boolean) => {
    const res = await fetch("/api/tracks?status=done");
    if (activeCheck && !activeCheck()) return;
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks);
      if (Array.isArray(data.workspaces)) {
        hydrateWorkspacesFromServer(data.workspaces);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchTracks(() => active);
    return () => {
      active = false;
    };
  }, [fetchTracks]);

  useEffect(() => {
    useWorkspaceStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (useWorkspaceStore.persist.hasHydrated()) {
      ensureDefaultWorkspace();
      return;
    }

    const unsubscribe = useWorkspaceStore.persist.onFinishHydration(() => {
      ensureDefaultWorkspace();
    });

    return () => {
      unsubscribe();
    };
  }, [ensureDefaultWorkspace]);

  useEffect(() => {
    if (selectedWorkspaceId && workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setUploadWorkspaceId((current) => {
        if (current && workspaces.some((workspace) => workspace.id === current)) return current;
        return selectedWorkspaceId;
      });
      return;
    }

    setUploadWorkspaceId((current) => {
      if (current && workspaces.some((workspace) => workspace.id === current)) return current;
      return DEFAULT_WORKSPACE_ID;
    });
  }, [selectedWorkspaceId, workspaces]);

  useEffect(() => {
    if (!showTrackDetailsPanel || !currentTrack) return;

    const matchedTrack = tracks.find((track) => track.id === currentTrack.id);
    if (matchedTrack) {
      setSelectedTrack(matchedTrack);
      return;
    }

    setSelectedTrack({
      id: currentTrack.id,
      title: currentTrack.title,
      provider: currentTrack.provider,
      providerModel: currentTrack.providerModel,
      prompt: currentTrack.prompt,
      lyrics: currentTrack.lyrics,
      status: currentTrack.status,
      audioUrl: currentTrack.audioUrl,
      audioUrlHd: currentTrack.audioUrlHd,
      format: currentTrack.format ?? null,
      formatHd: currentTrack.formatHd ?? null,
      duration: currentTrack.duration ?? null,
      createdAt: currentTrack.createdAt,
      error: currentTrack.error,
      s3KeyHd: currentTrack.s3KeyHd,
      coverUrl: currentTrack.coverUrl ?? null,
      s3KeyCover: currentTrack.s3KeyCover ?? null,
      rating: currentTrack.rating ?? null,
    });
  }, [showTrackDetailsPanel, currentTrack, tracks]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

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

  const selectedWorkspace = useMemo(
    () => (selectedWorkspaceId ? workspaces.find((w) => w.id === selectedWorkspaceId) ?? null : null),
    [selectedWorkspaceId, workspaces],
  );

  const visibleTracks = useMemo(
    () => (selectedWorkspace ? tracks.filter((t) => selectedWorkspace.trackIds.includes(t.id)) : tracks),
    [selectedWorkspace, tracks],
  );

  const parentWorkspaceNameById = useMemo(
    () =>
      workspaces.reduce<Record<string, string>>((acc, workspace) => {
        acc[workspace.id] = workspace.name;
        return acc;
      }, {}),
    [workspaces],
  );

  const uploadWorkspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        id: workspace.id,
        label: workspace.parentWorkspaceId
          ? `${parentWorkspaceNameById[workspace.parentWorkspaceId] || "Workspace"} / ${workspace.name}`
          : workspace.name,
      })),
    [parentWorkspaceNameById, workspaces],
  );

  function openWorkspace(id: string) {
    setSelectedWorkspaceId(id);
    setView("songs");
  }

  function backToWorkspaces() {
    setSelectedWorkspaceId(null);
    setView("workspaces");
  }

  function handleCreateWorkspace() {
    const id = createWorkspace(newWorkspaceName);
    if (!id) return;
    setSelectedWorkspaceId(id);
    setNewWorkspaceName("");
    setShowCreateWorkspace(false);
    setView("workspaces");
  }

  function handleCloseTrackDetails() {
    setSelectedTrack(null);
    setShowTrackDetailsPanel(false);
  }

  async function handleUploadSelection(files: FileList | null) {
    if (!files || files.length === 0) return;

    const targetWorkspaceId = workspaces.some((workspace) => workspace.id === uploadWorkspaceId)
      ? uploadWorkspaceId
      : DEFAULT_WORKSPACE_ID;

    setUploading(true);
    setUploadError(null);
    setUploadNotice(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });
      formData.append("workspaceId", targetWorkspaceId);

      const response = await fetch("/api/tracks", {
        method: "POST",
        body: formData,
      });

      const payload = await readApiPayload(response);

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Upload is too large. Try fewer files or smaller files.");
        }

        const apiError = isObjectRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : null;

        if (apiError) {
          throw new Error(apiError);
        }

        throw new Error(`Upload failed (HTTP ${response.status}).`);
      }

      if (!isObjectRecord(payload)) {
        throw new Error("Upload failed: invalid server response.");
      }

      const uploadedTracks: LibraryTrack[] = (Array.isArray(payload.tracks) ? payload.tracks : []).filter(
        (track: LibraryTrack) => track.status === "done",
      );

      if (uploadedTracks.length > 0) {
        setTracks((current) => {
          const byId = new Map(current.map((track) => [track.id, track]));
          uploadedTracks.forEach((track) => byId.set(track.id, track));
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });

      }

      const rejectedCount = Array.isArray(payload.rejected) ? payload.rejected.length : 0;
      setUploadNotice(
        rejectedCount > 0
          ? `Uploaded ${uploadedTracks.length} file(s), ${rejectedCount} skipped.`
          : `Uploaded ${uploadedTracks.length} file(s) successfully.`,
      );

      await fetchTracks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setUploadError(message);
    } finally {
      setUploading(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;

    const player = usePlayerStore.getState();
    const playContext = visibleTracks
      .filter((track) => track.status === "done")
      .map((track) => ({
        id: track.id,
        title: track.title,
        provider: track.provider,
        providerModel: track.providerModel,
        prompt: track.prompt,
        status: track.status,
        audioUrl: track.audioUrl,
        audioUrlHd: track.audioUrlHd,
        format: track.format,
        formatHd: track.formatHd,
        s3Key: null,
        s3KeyHd: track.s3KeyHd,
        duration: track.duration,
        lyrics: track.lyrics,
        createdAt: track.createdAt,
        error: track.error,
        coverUrl: track.coverUrl,
        s3KeyCover: track.s3KeyCover,
      }));

    player.setPlayContext(playContext);

    if (player.autoPlayNext) {
      const index = playContext.findIndex((track) => track.id === selectedTrack.id);
      if (index >= 0) {
        player.setQueue(playContext.slice(index + 1));
      }
    }

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
      createdAt: selectedTrack.createdAt,
      error: selectedTrack.error,
      coverUrl: selectedTrack.coverUrl,
      s3KeyCover: selectedTrack.s3KeyCover,
      rating: selectedTrack.rating ?? null,
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

  function getWorkspaceCoverImages(workspaceId: string) {
    const wTracks = getWorkspaceTracks(workspaceId, tracks, workspaces);
    const covers = wTracks.map((t) => t.coverUrl).filter((c): c is string => !!c);
    if (covers.length === 0) return [] as string[];
    return pickSeededItems(covers, workspaceId, Math.min(4, covers.length));
  }

  function getWorkspaceGradient(workspaceId: string, folderGradient?: string | null) {
    return (
      folderGradient ||
      WORKSPACE_FOLDER_GRADIENTS[hashString(workspaceId) % WORKSPACE_FOLDER_GRADIENTS.length] ||
      "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))"
    );
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

  const workspaceGridClass =
    workspaceGridSize === 4
      ? "grid-cols-[repeat(4,minmax(0,1fr))]"
      : workspaceGridSize === 8
        ? "grid-cols-[repeat(8,minmax(0,1fr))]"
        : workspaceGridSize === 12
          ? "grid-cols-[repeat(12,minmax(0,1fr))]"
          : "grid-cols-[repeat(16,minmax(0,1fr))]";

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="lg:ml-60 h-[calc(100vh-var(--player-height))] flex">
        <main className="min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24">
          <div className="max-w-[1600px] mx-auto space-y-6">

            {/* Header */}
            <section className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(135deg,#11111a_0%,#0b0b11_100%)] p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/35">Library</p>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Songs</h1>
                  <p className="max-w-2xl text-sm sm:text-base text-white/60">
                    Browse finished tracks, then move them into folders that keep their own gradient and cover collage.
                  </p>
                </div>
              </div>
            </section>

            {/* Songs view */}
            {view === "songs" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">Upload MP3/WAV to Library</p>
                      <p className="text-xs text-white/55">You can upload multiple files at once and send them directly to a workspace. Max 20 files per upload; oversized uploads show a clear error.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="text-xs text-white/60" htmlFor="upload-workspace-select">Workspace</label>
                      <select
                        id="upload-workspace-select"
                        value={uploadWorkspaceId}
                        onChange={(event) => setUploadWorkspaceId(event.target.value)}
                        className="h-10 min-w-[220px] rounded-full border border-white/12 bg-[#11121a] px-4 text-sm text-white outline-none focus:border-white/25"
                        disabled={uploading}
                      >
                        {uploadWorkspaceOptions.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.label}
                          </option>
                        ))}
                      </select>

                      <input
                        ref={uploadInputRef}
                        type="file"
                        multiple
                        accept=".mp3,.wav,audio/mpeg,audio/wav"
                        aria-label="Upload MP3 or WAV files"
                        title="Upload MP3 or WAV files"
                        className="hidden"
                        onChange={(event) => handleUploadSelection(event.target.files)}
                      />

                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => uploadInputRef.current?.click()}
                        className="h-10 rounded-full border border-white/10 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        {uploading ? "Uploading..." : "Select MP3/WAV Files"}
                      </button>
                    </div>
                  </div>

                  {uploadError && <p className="mt-3 text-sm text-red-300">{uploadError}</p>}
                  {uploadNotice && <p className="mt-3 text-sm text-emerald-300">{uploadNotice}</p>}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    {selectedWorkspace ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWorkspaceId(null);
                              setView("songs");
                            }}
                            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            All songs
                          </button>
                        </div>
                        <h2 className="text-lg font-semibold truncate">{selectedWorkspace.name}</h2>
                        <p className="text-sm text-white/55">{visibleTracks.length} songs in this workspace.</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold">All Songs</h2>
                        <p className="text-sm text-white/55">Use track actions to move songs into workspaces or playlists.</p>
                      </>
                    )}
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
                    onSelect={(track) => {
                      setSelectedTrack({
                        ...track,
                        coverUrl: track.coverUrl ?? null,
                        s3KeyCover: track.s3KeyCover ?? null,
                        rating: track.rating ?? null,
                      });
                      setShowTrackDetailsPanel(true);
                    }}
                    onAddToPlaylist={() => undefined}
                    playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                    onTitleUpdate={(trackId, newTitle) =>
                      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)))
                    }
                  />
                )}
              </section>
            )}

            {/* Workspaces view */}
            {view === "workspaces" && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Workspaces</h2>
                    <p className="text-sm text-white/55">Each workspace keeps its own folder gradient and a seeded collage of covers.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Grid / list toggle */}
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

                    {/* Create workspace */}
                    {showCreateWorkspace ? (
                      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                        <input
                          value={newWorkspaceName}
                          onChange={(e) => setNewWorkspaceName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleCreateWorkspace(); if (e.key === "Escape") { setShowCreateWorkspace(false); setNewWorkspaceName(""); } }}
                          placeholder="Workspace name"
                          className="h-9 w-48 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                          autoFocus
                        />
                        <button type="button" onClick={handleCreateWorkspace} className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90">
                          Add
                        </button>
                        <button type="button" onClick={() => { setShowCreateWorkspace(false); setNewWorkspaceName(""); }} className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white">
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

                {workspaces.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                    No workspaces yet. Create one to start grouping tracks.
                  </div>
                ) : workspaceDisplayMode === "grid" ? (
                  <div className={`grid gap-4 ${workspaceGridClass}`}>
                    {workspaces.map((workspace) => {
                      const wTracks = getWorkspaceTracks(workspace.id, tracks, workspaces);
                      const coverImages = getWorkspaceCoverImages(workspace.id);
                      const gradient = getWorkspaceGradient(workspace.id, workspace.folderGradient);

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
                            {/* dynamic gradient — inline style required */}
                            <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundImage: gradient }}>
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,0.38))]" />
                              {coverImages.length > 0 ? (
                                <div className="absolute inset-4 grid grid-cols-2 grid-rows-2 gap-2">
                                  {coverImages.slice(0, 4).map((coverUrl, i) => (
                                    <img key={`${workspace.id}-${i}`} src={coverUrl} alt={workspace.name} loading="lazy" className="h-full w-full rounded-2xl object-cover shadow-lg ring-1 ring-white/10" />
                                  ))}
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-3xl text-white/80 backdrop-blur-sm">+</div>
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 p-4">
                                <h3 className="truncate text-lg font-semibold text-white">{workspace.name}</h3>
                                <p className="text-sm text-white/70">{wTracks.length} songs</p>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center justify-between gap-2 px-4 py-3">
                            <button type="button" onClick={() => openWorkspace(workspace.id)} className="text-sm text-white/60 transition-colors hover:text-white">
                              Open workspace
                            </button>
                            {workspace.id === DEFAULT_WORKSPACE_ID ? (
                              <span className="text-sm text-white/35">Default</span>
                            ) : (
                              <button type="button" onClick={() => deleteWorkspace(workspace.id)} className="text-sm text-white/35 transition-colors hover:text-red-400">
                                Delete
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  /* List view */
                  <div className="space-y-1.5">
                    {workspaces.map((workspace) => {
                      const wTracks = getWorkspaceTracks(workspace.id, tracks, workspaces);
                      const coverImages = getWorkspaceCoverImages(workspace.id);

                      return (
                        <div key={workspace.id} className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-[#0f1017] px-4 py-3 transition-colors hover:bg-white/4">
                          {/* Solid color swatch — avoids inline style for dynamic gradient */}
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

                          {/* Name + count */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{workspace.name}</p>
                            <p className="text-xs text-white/45">{wTracks.length} {wTracks.length === 1 ? "song" : "songs"}</p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-3 shrink-0">
                            <button type="button" onClick={() => openWorkspace(workspace.id)} className="text-xs text-white/50 transition-colors hover:text-white">
                              Open
                            </button>
                            {workspace.id !== DEFAULT_WORKSPACE_ID && (
                              <button type="button" onClick={() => deleteWorkspace(workspace.id)} className="text-xs text-white/30 transition-colors hover:text-red-400">
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
            )}

          </div>
        </main>

        <ResizablePanel show={showTrackDetailsPanel} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="sticky top-0 h-[calc(100vh-var(--player-height))] overflow-y-auto">
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
                <p className="text-sm mt-3">Select a track to show song info and lyrics.</p>
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
