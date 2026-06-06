"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail, { type TrackDetailTrack } from "@/components/TrackDetail";
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
  lyricsTimestamps?: string | null;
}

type LibraryView = "songs" | "workspaces";
type WorkspaceDisplayMode = "grid" | "list";
const WORKSPACE_GRID_SIZE_STORAGE_KEY = "melodiq.workspace-grid-size";
const MAX_UPLOAD_QUEUE = 10;
const WORKSPACE_FOLDER_BG_CLASSES = [
  "bg-linear-135 from-violet-600 to-pink-500",
  "bg-linear-135 from-sky-500 to-green-500",
  "bg-linear-135 from-orange-500 to-red-500",
  "bg-linear-135 from-teal-500 to-indigo-500",
  "bg-linear-135 from-amber-500 to-pink-500",
  "bg-linear-135 from-green-500 to-cyan-500",
  "bg-linear-135 from-violet-500 to-orange-500",
  "bg-linear-135 from-blue-600 to-teal-500",
] as const;

type QueuedUploadItem = {
  id: string;
  file: File;
  title: string;
  metadataFile: File | null;
};

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

function isSupportedAudioFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type.includes("mpeg") || type.includes("mp3") || type.includes("wav") || type.includes("wave") || name.endsWith(".mp3") || name.endsWith(".wav");
}

function titleFromUploadFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "").trim();
  return withoutExtension || "Untitled Upload";
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    moveTracksToWorkspace,
    ensureDefaultWorkspace,
    hydrateWorkspacesFromServer,
  } = useWorkspaceStore();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadMetadataInputRef = useRef<HTMLInputElement | null>(null);
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
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ filename: string; reason: string }>>([]);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
  const [queuedUploads, setQueuedUploads] = useState<QueuedUploadItem[]>([]);
  const [pendingMetadataTargetId, setPendingMetadataTargetId] = useState<string | null>(null);
  const [uploadPromptDraft, setUploadPromptDraft] = useState("");
  const [uploadLyricsDraft, setUploadLyricsDraft] = useState("");

  const workspacesSentinelRef = useRef<HTMLDivElement | null>(null);
  const [isWorkspacesTopInView, setIsWorkspacesTopInView] = useState(true);

  useEffect(() => {
    const sentinel = workspacesSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsWorkspacesTopInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => {
      observer.unobserve(sentinel);
    };
  }, [view]);

  const fetchTracks = useCallback(async (activeCheck?: () => boolean) => {
    const res = await fetch("/api/tracks?status=done");
    if (activeCheck && !activeCheck()) return;
    if (res.ok) {
      const data = await res.json();
      const cleanedTracks = (data.tracks || []).map((t: any) => ({
        ...t,
        title: t.title ? t.title.replace(/\s*\(2\)\s*$/, "") : t.title,
      }));
      setTracks(cleanedTracks);
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
    if (!showTrackDetailsPanel) return;

    setSelectedTrack((prev) => {
      if (prev) {
        const matched = tracks.find((t) => t.id === prev.id);
        if (matched) return matched;
        return prev;
      }
      if (currentTrack) {
        const matchedTrack = tracks.find((track) => track.id === currentTrack.id);
        if (matchedTrack) return matchedTrack;
        
        return {
          id: currentTrack.id,
          title: currentTrack.title,
          provider: currentTrack.provider,
          providerModel: currentTrack.providerModel,
          prompt: currentTrack.prompt,
          lyrics: currentTrack.lyrics,
          lyricsTimestamps: currentTrack.lyricsTimestamps,
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
          instrumental: currentTrack.instrumental ?? null,
        };
      }
      return null;
    });
  }, [showTrackDetailsPanel, currentTrack, tracks]);

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
        return matched || (currentTrack as unknown as LibraryTrack);
      });
    }
  }, [isPlaying, currentTrack, showTrackDetailsPanel, tracks]);

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

  const handleTrackUpdated = useCallback((updatedTrack: TrackDetailTrack) => {
    const normalizedTrack: LibraryTrack = {
      ...updatedTrack,
      coverUrl: updatedTrack.coverUrl ?? null,
      s3KeyCover: updatedTrack.s3KeyCover ?? null,
    };

    setTracks((current) =>
      current.map((track) =>
        track.id === normalizedTrack.id
          ? { ...track, ...normalizedTrack }
          : track
      )
    );

    setSelectedTrack((current) =>
      current && current.id === normalizedTrack.id
        ? { ...current, ...normalizedTrack }
        : current
    );
  }, []);

  function handleQueueAudioSelection(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;

    const incoming = Array.from(files);
    const invalid = incoming.filter((file) => !isSupportedAudioFile(file));
    const valid = incoming.filter((file) => isSupportedAudioFile(file));

    if (invalid.length > 0) {
      setRejectedFiles((current) => [
        ...current,
        ...invalid.map((file) => ({ filename: file.name, reason: "Only MP3 and WAV files are supported." })),
      ]);
    }

    setQueuedUploads((current) => {
      const room = Math.max(0, MAX_UPLOAD_QUEUE - current.length);
      const accepted = valid.slice(0, room).map((file) => ({
        id: typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        title: titleFromUploadFilename(file.name),
        metadataFile: null,
      }));

      if (valid.length > room) {
        setUploadError(`Queue limit reached. Maximum ${MAX_UPLOAD_QUEUE} files per upload batch.`);
      }

      return [...current, ...accepted];
    });

    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }

  function handleMetadataAttachSelection(files: FileList | null) {
    if (!pendingMetadataTargetId || !files || files.length === 0) return;
    const file = files[0];

    const normalizedName = file.name.toLowerCase();
    if (!normalizedName.endsWith(".txt") && !normalizedName.endsWith(".lrc")) {
      setUploadError("Metadata file must be a .txt or .lrc file.");
      return;
    }

    setQueuedUploads((current) =>
      current.map((item) =>
        item.id === pendingMetadataTargetId
          ? { ...item, metadataFile: file }
          : item
      )
    );
    setPendingMetadataTargetId(null);

    if (uploadMetadataInputRef.current) {
      uploadMetadataInputRef.current.value = "";
    }
  }

  async function handleStartUpload() {
    if (queuedUploads.length === 0 || uploading) return;

    const targetWorkspaceId = workspaces.some((workspace) => workspace.id === uploadWorkspaceId)
      ? uploadWorkspaceId
      : DEFAULT_WORKSPACE_ID;

    setUploading(true);
    setUploadError(null);
    setUploadNotice(null);
    setRejectedFiles([]);

    try {
      const formData = new FormData();
      queuedUploads.forEach((item, index) => {
        formData.append("files", item.file);
        if (item.metadataFile) {
          formData.append(`metadataFile:${index}`, item.metadataFile);
        }
      });

      formData.append(
        "uploadItems",
        JSON.stringify(
          queuedUploads.map((item) => ({
            title: item.title.trim() || null,
          }))
        )
      );

      const trimmedPrompt = uploadPromptDraft.trim();
      if (trimmedPrompt) {
        formData.append("uploadPrompt", trimmedPrompt);
      }

      const trimmedLyrics = uploadLyricsDraft.trim();
      if (trimmedLyrics) {
        formData.append("uploadLyrics", trimmedLyrics);
      }

      formData.append("workspaceId", targetWorkspaceId);

      const response = await fetch("/api/tracks", {
        method: "POST",
        body: formData,
      });

      const payload = await readApiPayload(response);

      const payloadRejected = isObjectRecord(payload) && Array.isArray(payload.rejected)
        ? (payload.rejected as Array<{ filename: string; reason: string }>)
        : [];

      if (payloadRejected.length > 0) {
        setRejectedFiles(payloadRejected);
      }

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Upload is too large. Try fewer files or smaller files.");
        }

        const apiError = isObjectRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : null;
        const apiDetails = isObjectRecord(payload) && typeof payload.details === "string"
          ? payload.details
          : null;

        if (apiError) {
          throw new Error(apiDetails ? `${apiError} (${apiDetails})` : apiError);
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
        const uploadedTrackIds = uploadedTracks.map((track) => track.id);
        moveTracksToWorkspace(targetWorkspaceId, uploadedTrackIds);

        setTracks((current) => {
          const byId = new Map(current.map((track) => [track.id, track]));
          uploadedTracks.forEach((track) => byId.set(track.id, track));
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("melodiq:tracks-uploaded", {
              detail: { trackIds: uploadedTrackIds, workspaceId: targetWorkspaceId },
            })
          );
        }

        setQueuedUploads([]);
      }

      const rejectedCount = payloadRejected.length;
      if (uploadedTracks.length > 0) {
        setUploadNotice(
          rejectedCount > 0
            ? `Uploaded ${uploadedTracks.length} file(s) successfully, but ${rejectedCount} file(s) were skipped.`
            : `Uploaded ${uploadedTracks.length} file(s) successfully.`
        );
      } else {
        setUploadError("No files were uploaded successfully.");
      }

      await fetchTracks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setUploadError(message);
    } finally {
      setUploading(false);
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
        lyricsTimestamps: track.lyricsTimestamps,
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
      lyricsTimestamps: selectedTrack.lyricsTimestamps,
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

  function getWorkspaceGradientClass(workspaceId: string, folderGradient?: string | null) {
    if (folderGradient) {
      const index = WORKSPACE_FOLDER_GRADIENTS.findIndex((value) => value === folderGradient);
      if (index >= 0) {
        return WORKSPACE_FOLDER_BG_CLASSES[index % WORKSPACE_FOLDER_BG_CLASSES.length];
      }
    }

    return WORKSPACE_FOLDER_BG_CLASSES[hashString(workspaceId) % WORKSPACE_FOLDER_BG_CLASSES.length];
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
        <main className="min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">

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
                <div>
                  <button
                    type="button"
                    onClick={() => setIsUploadPanelOpen(true)}
                    className="h-10 rounded-full border border-white/10 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
                  >
                    Upload Files
                  </button>
                </div>
              </div>
            </section>

            {/* Songs view */}
            {view === "songs" && (
              <section className="space-y-4">
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
                <div ref={workspacesSentinelRef} className="h-0 w-full" />
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
                  <div className="rounded-3xl border border-dashed border-white/12 bg-white/3 p-8 text-sm text-white/55">
                    No workspaces yet. Create one to start grouping tracks.
                  </div>
                ) : workspaceDisplayMode === "grid" ? (
                  <div className={`grid gap-4 ${workspaceGridClass}`}>
                    {workspaces.map((workspace) => {
                      const wTracks = getWorkspaceTracks(workspace.id, tracks, workspaces);
                      const coverImages = getWorkspaceCoverImages(workspace.id);
                      const gradientClass = getWorkspaceGradientClass(workspace.id, workspace.folderGradient);

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
                            <div className={`relative aspect-4/3 overflow-hidden ${gradientClass}`}>
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

                {!isWorkspacesTopInView && (
                  <div className="sticky bottom-6 mr-2 z-40 flex justify-end pointer-events-none">
                    <button
                      type="button"
                      onClick={() => workspacesSentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
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
            )}

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
                allowLyricsEdit
                onTrackUpdated={handleTrackUpdated}
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

      {isUploadPanelOpen && (
        <div className="fixed inset-0 z-70">
          <button
            type="button"
            aria-label="Close upload panel"
            onClick={() => setIsUploadPanelOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
          />

          <aside className="absolute right-0 top-0 h-[calc(100vh-var(--player-height))] w-full max-w-140 border-l border-white/10 bg-[#0d0e15] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold">Upload Files</h3>
                  <p className="text-xs text-white/55">Queue up to {MAX_UPLOAD_QUEUE} files, edit titles, add metadata, then upload.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadPanelOpen(false)}
                  title="Close upload panel"
                  aria-label="Close upload panel"
                  className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-2">
                  <label className="text-xs text-white/60" htmlFor="upload-panel-workspace-select">Workspace</label>
                  <select
                    id="upload-panel-workspace-select"
                    value={uploadWorkspaceId}
                    onChange={(event) => setUploadWorkspaceId(event.target.value)}
                    className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                    disabled={uploading}
                  >
                    {uploadWorkspaceOptions.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="upload-panel-prompt" className="text-xs text-white/60">Optional prompt (global)</label>
                    <textarea
                      id="upload-panel-prompt"
                      value={uploadPromptDraft}
                      onChange={(event) => setUploadPromptDraft(event.target.value)}
                      rows={3}
                      disabled={uploading}
                      placeholder="Style / mood / context"
                      className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="upload-panel-lyrics" className="text-xs text-white/60">Optional lyrics (global)</label>
                    <textarea
                      id="upload-panel-lyrics"
                      value={uploadLyricsDraft}
                      onChange={(event) => setUploadLyricsDraft(event.target.value)}
                      rows={3}
                      disabled={uploading}
                      placeholder="Paste lyrics"
                      className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <input
                    ref={uploadInputRef}
                    type="file"
                    multiple
                    accept=".mp3,.wav,audio/mpeg,audio/wav"
                    aria-label="Queue MP3/WAV files"
                    title="Queue MP3/WAV files"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) => handleQueueAudioSelection(event.target.files)}
                  />
                  <input
                    ref={uploadMetadataInputRef}
                    type="file"
                    accept=".txt,.lrc,text/plain"
                    aria-label="Attach metadata TXT or LRC file"
                    title="Attach metadata TXT or LRC file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) => handleMetadataAttachSelection(event.target.files)}
                  />

                  <button
                    type="button"
                    disabled={uploading || queuedUploads.length >= MAX_UPLOAD_QUEUE}
                    onClick={() => uploadInputRef.current?.click()}
                    className="h-10 rounded-full border border-white/10 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    Add MP3/WAV Files
                  </button>

                  <span className="text-xs text-white/55">{queuedUploads.length}/{MAX_UPLOAD_QUEUE} queued</span>
                </div>

                {queuedUploads.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/3 p-4 text-sm text-white/55">
                    No files queued yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queuedUploads.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/3 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{item.file.name}</p>
                            <p className="text-xs text-white/45">{formatFileSize(item.file.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQueuedUploads((current) => current.filter((upload) => upload.id !== item.id))}
                            className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            title="Remove from queue"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <div className="mt-2 space-y-2">
                          <label htmlFor={`upload-item-title-${item.id}`} className="text-xs text-white/60">Title</label>
                          <input
                            id={`upload-item-title-${item.id}`}
                            type="text"
                            value={item.title}
                            onChange={(event) => {
                              const nextTitle = event.target.value;
                              setQueuedUploads((current) =>
                                current.map((upload) =>
                                  upload.id === item.id ? { ...upload, title: nextTitle } : upload
                                )
                              );
                            }}
                            disabled={uploading}
                            className="h-9 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25"
                          />

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={uploading}
                              onClick={() => {
                                setPendingMetadataTargetId(item.id);
                                uploadMetadataInputRef.current?.click();
                              }}
                              className="h-8 rounded-full border border-white/12 bg-[#11121a] px-3 text-xs font-medium text-white/80 transition-colors hover:border-white/25 hover:text-white"
                            >
                              {item.metadataFile ? "Replace metadata TXT/LRC" : "Attach metadata TXT/LRC"}
                            </button>
                            {item.metadataFile && (
                              <>
                                <span className="truncate text-xs text-white/55">{item.metadataFile.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQueuedUploads((current) =>
                                      current.map((upload) =>
                                        upload.id === item.id ? { ...upload, metadataFile: null } : upload
                                      )
                                    );
                                  }}
                                  className="text-xs text-red-300/85 hover:text-red-200"
                                >
                                  Remove metadata
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {uploadError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                    <span className="font-semibold">Error:</span> {uploadError}
                  </div>
                )}

                {uploadNotice && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400">
                    <span className="font-semibold">Success:</span> {uploadNotice}
                  </div>
                )}

                {rejectedFiles.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-sm font-semibold text-amber-300">Rejected files</p>
                    <ul className="mt-2 space-y-1 text-xs text-amber-200/80">
                      {rejectedFiles.map((file, idx) => (
                        <li key={idx}>
                          <span className="font-medium">{file.filename}</span>: {file.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  disabled={uploading || queuedUploads.length === 0}
                  onClick={handleStartUpload}
                  className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {uploading ? "Uploading..." : `Upload ${queuedUploads.length} file(s)`}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {showTrackDetailsPanel && selectedTrack && (
        <div className="lg:hidden">
          <TrackDetail
            track={selectedTrack}
            onClose={handleCloseTrackDetails}
            onPlay={handlePlayTrack}
            onDownload={handleDownloadTrack}
            mode="overlay"
            allowLyricsEdit
            onTrackUpdated={handleTrackUpdated}
          />
        </div>
      )}
    </div>
  );
}
