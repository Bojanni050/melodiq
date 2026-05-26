"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StudioForm from "@/components/StudioForm";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import CreateWorkspaceDialog from "@/components/studio/CreateWorkspaceDialog";
import NoticeBar from "@/components/studio/NoticeBar";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { getWorkspaceCoverCollage, getWorkspaceGradient } from "@/lib/track-utils";
import { DEFAULT_WORKSPACE_ID, useStudioStore, usePlayerStore, usePlaylistStore, useWorkspaceStore } from "@/lib/store";

const MUSICGPT_LYRICS_MAX_CHARS = 3000;
const WORKSPACE_GRID_SIZE_STORAGE_KEY = "sonara-studio-workspace-grid-size";

interface Track {
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
  coverUrl?: string | null;
  s3KeyCover?: string | null;
  rating?: string | null;
}

function deriveWorkspaceNameFromTitle(rawTitle: string): string {
  const cleaned = rawTitle
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 100);
}

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [credits, setCredits] = useState({ lyria: "Pay-per-use" as string | number, poyo: null as number | null, tempolor: null as number | null, minimax: null as number | null });
  const [showLyricsOverlay, setShowLyricsOverlay] = useState(false);
  const playlists = usePlaylistStore((state) => state.playlists);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const selectedWorkspaceId = useWorkspaceStore((state) => state.selectedWorkspaceId);
  const setSelectedWorkspaceId = useWorkspaceStore((state) => state.setSelectedWorkspaceId);
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const moveTrackToWorkspace = useWorkspaceStore((state) => state.moveTrackToWorkspace);
  const ensureDefaultWorkspace = useWorkspaceStore((state) => state.ensureDefaultWorkspace);
  const syncTracksToDefaultWorkspace = useWorkspaceStore((state) => state.syncTracksToDefaultWorkspace);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const WORKSPACE_VIEW_MODE_STORAGE_KEY = "sonara-studio-workspace-view-mode";
  const [workspaceViewMode, setWorkspaceViewMode] = useState<"grid" | "list">("list");
  const [workspaceGridSize, setWorkspaceGridSize] = useState<4 | 8 | 12 | 16>(8);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);

  useEffect(() => {
    ensureDefaultWorkspace();
    fetchTracks();
    fetchCredits();
    useStudioStore.persist.rehydrate();
  }, [ensureDefaultWorkspace]);

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
      // ignore localStorage write failures
    }
  }, [workspaceGridSize]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_VIEW_MODE_STORAGE_KEY, workspaceViewMode);
    } catch {
      // ignore localStorage write failures
    }
  }, [workspaceViewMode]);

  useEffect(() => {
    const hasGenerating = tracks.some(
      (t) => t.status === "generating" || t.status === "pending"
    );
    const hasDoneWithoutCover = tracks.some(
      (t) => t.status === "done" && !t.coverUrl
    );
    const hasDoneWithoutHd = tracks.some(
      (t) => t.status === "done" && t.provider === "poyo" && !t.s3KeyHd
    );

    const interval = hasGenerating ? 5000 : hasDoneWithoutCover || hasDoneWithoutHd ? 8000 : 30000;

    const timer = setInterval(() => {
      fetchTracks();
    }, interval);

    return () => clearInterval(timer);
  }, [tracks]);

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
      coverUrl: null,
      s3KeyCover: null,
    });
  }, [showTrackDetailsPanel, currentTrack, tracks]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  function handleCloseTrackDetails() {
    setSelectedTrack(null);
    setShowTrackDetailsPanel(false);
  }

  function handleCreateWorkspace() {
    const id = createWorkspace(newWorkspaceName);
    if (!id) return;
    setSelectedWorkspaceId(id);
    setNewWorkspaceName("");
    setShowCreateWorkspace(false);
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

  async function fetchTracks() {
    const res = await fetch("/api/tracks");
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks);
      const knownTrackIds = (data.tracks || []).map((track: Track) => track.id);
      syncTracksToDefaultWorkspace(knownTrackIds);
      return data.tracks as Track[];
    }

    return [] as Track[];
  }

  function handleDeleteTrack(trackId: string) {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (selectedTrack?.id === trackId) setSelectedTrack(null);
  }

  function handleTitleUpdate(trackId: string, newTitle: string) {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t))
    );
    if (selectedTrack?.id === trackId) {
      setSelectedTrack((prev) => (prev ? { ...prev, title: newTitle } : null));
    }
  }

  function handleAddToQueue(track: Track) {
    usePlayerStore.getState().enqueueTrack({
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
      duration: null,
      lyrics: track.lyrics,
      createdAt: track.createdAt,
      error: track.error,
      coverUrl: track.coverUrl,
      s3KeyCover: track.s3KeyCover,
    });
  }

  function handleAddToPlaylist(
    trackId: string,
    playlistId: string,
    options?: { allowDuplicate?: boolean }
  ) {
    addTrackToPlaylist(playlistId, trackId, options);
  }

  async function fetchCredits() {
    const res = await fetch("/api/credits");
    if (res.ok) {
      setCredits(await res.json());
    }
  }

  function getEffectiveLanguage() {
    const { language, customLanguage } = useStudioStore.getState();
    return language === "Other..." ? customLanguage.trim() || language : language;
  }

  async function handleOptimize() {
    const { songIdea, selectedProviders, lyricsContext, structure, customStructure, vocalGender } = useStudioStore.getState();
    const provider = Object.keys(selectedProviders)[0] || "poyo";
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "optimize",
        idea: songIdea,
        provider,
        language: getEffectiveLanguage(),
        context: lyricsContext,
        structure,
        customStructure,
        vocalGender,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      useStudioStore.getState().setSongIdea(data.result);
    }
  }

  async function handleGenerateLyrics() {
    setShowLyricsOverlay(true);
    const { songIdea, lyricsContext, instrumental, structure, customStructure, vocalGender } = useStudioStore.getState();
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "lyrics",
          idea: songIdea,
          context: lyricsContext,
          language: getEffectiveLanguage(),
          instrumental,
          structure,
          customStructure,
          vocalGender,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        useStudioStore.getState().setLyrics(data.result);
      }
    } finally {
      setShowLyricsOverlay(false);
    }
  }

  async function handleGenerateTitle(lyrics: string): Promise<string | null> {
    try {
      const res = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.title;
      }
    } catch {}
    return null;
  }

  async function handleGenerate() {
    const {
      songIdea,
      lyrics,
      title,
      selectedProviders,
      instrumental,
      autoCreateWorkspaceFromGeneratedTitle,
    } = useStudioStore.getState();

    const providerEntries = Object.entries(selectedProviders);

    if (providerEntries.length === 0) {
      setNotice({ type: "error", message: "Selecteer minimaal één provider." });
      return;
    }

    if (selectedProviders.musicgpt && lyrics.length > MUSICGPT_LYRICS_MAX_CHARS) {
      setNotice({
        type: "error",
        message: `MusicGPT lyrics mogen maximaal ${MUSICGPT_LYRICS_MAX_CHARS} karakters zijn.`,
      });
      return;
    }

    const existingTrackIds = new Set(tracks.map((track) => track.id));
    setGenerating(true);
    const targetWorkspaceId = selectedWorkspaceId && selectedWorkspaceId !== DEFAULT_WORKSPACE_ID
      ? selectedWorkspaceId
      : ensureDefaultWorkspace();

    try {
      let finalTitle = title;

      if (!instrumental && !title.trim() && lyrics.trim()) {
        finalTitle = await handleGenerateTitle(lyrics) || "";
        if (finalTitle) {
          useStudioStore.getState().setTitle(finalTitle);
        }
      }

      const results = await Promise.allSettled(
        providerEntries.map(([provider, providerModel]) =>
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: songIdea,
              lyrics,
              title: finalTitle,
              provider,
              providerModel,
              language: getEffectiveLanguage(),
              instrumental,
            }),
          }).then(async (res) => {
            const data = await res.json();
            return { ok: res.ok, data, provider };
          })
        )
      );

      const allTrackIds: string[] = [];
      const generatedTitles: string[] = [];
      const errors: string[] = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { ok, data, provider } = result.value;
          if (ok) {
            const returnedTracks: Track[] = Array.isArray(data.tracks)
              ? data.tracks
              : data.track
                ? [data.track]
                : [];
            const ids: string[] = returnedTracks.map((t: Track) => t.id).filter(Boolean);
            const titles = returnedTracks
              .map((t: Track) => (typeof t.title === "string" ? t.title.trim() : ""))
              .filter(Boolean);

            generatedTitles.push(...titles);
            allTrackIds.push(...ids);
          } else {
            errors.push(`${provider}: ${data.error || "failed"}`);
          }
        } else {
          errors.push("Generation request failed");
        }
      }

      let finalWorkspaceId = targetWorkspaceId;
      if (autoCreateWorkspaceFromGeneratedTitle && allTrackIds.length > 0) {
        const preferredTitle = finalTitle.trim() || generatedTitles[0] || "";
        const workspaceName = deriveWorkspaceNameFromTitle(preferredTitle);
        if (workspaceName) {
          const createdWorkspaceId = createWorkspace(workspaceName);
          if (createdWorkspaceId) {
            finalWorkspaceId = createdWorkspaceId;
            setSelectedWorkspaceId(createdWorkspaceId);
          }
        }
      }

      allTrackIds.forEach((trackId) => {
        moveTrackToWorkspace(finalWorkspaceId, trackId);
      });

      const latestTracks = await fetchTracks();

      if (allTrackIds.length === 0 && finalWorkspaceId !== DEFAULT_WORKSPACE_ID) {
        const discoveredTrackIds = latestTracks
          .map((track) => track.id)
          .filter((trackId) => !existingTrackIds.has(trackId));

        discoveredTrackIds.forEach((trackId) => {
          moveTrackToWorkspace(finalWorkspaceId, trackId);
        });
      }

      if (errors.length > 0) {
        setNotice({ type: "error", message: errors.join(" |") });
        if (allTrackIds.length === 0) {
          window.alert(errors.join(" |"));
        }
      } else {
        setNotice(null);
      }
    } catch {
      setNotice({ type: "error", message: "Failed to generate track" });
    } finally {
      setGenerating(false);
    }
  }

  function handleReusePrompt(track: Track) {
    const studio = useStudioStore.getState();

    // Clear current fields first, then apply values from selected track.
    studio.setSongIdea("");
    studio.setLyrics("");
    studio.setSongIdea(track.prompt || "");
    studio.setLyrics(track.lyrics || "");
  }

  function handlePlayTrack(url: string) {
    if (selectedTrack) {
      const player = usePlayerStore.getState();
      const playContext = tracks
        .filter((t) => t.status === "done")
        .map((t) => ({
          id: t.id,
          title: t.title,
          provider: t.provider,
          providerModel: t.providerModel,
          prompt: t.prompt,
          status: t.status,
          audioUrl: t.audioUrl,
          audioUrlHd: t.audioUrlHd,
          format: t.format,
          formatHd: t.formatHd,
          s3Key: null,
          s3KeyHd: t.s3KeyHd,
          duration: null,
          lyrics: t.lyrics,
          createdAt: t.createdAt,
          error: t.error,
          coverUrl: t.coverUrl,
          s3KeyCover: t.s3KeyCover,
        }));

      player.setPlayContext(playContext);

      if (player.autoPlayNext) {
        const index = playContext.findIndex((t) => t.id === selectedTrack.id);
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
        duration: null,
        lyrics: selectedTrack.lyrics,
        createdAt: selectedTrack.createdAt,
        error: selectedTrack.error,
        coverUrl: selectedTrack.coverUrl,
        s3KeyCover: selectedTrack.s3KeyCover,
      });
    }
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

  const [studioTab, setStudioTab] = useState<"workspaces" | "recent">("workspaces");
  const creditValue = typeof credits.poyo === "number" ? credits.poyo : typeof credits.tempolor === "number" ? credits.tempolor : null;
  const selectedWorkspace = selectedWorkspaceId
    ? workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
    : null;
  const selectedWorkspaceTracks = selectedWorkspace
    ? tracks.filter((track) => selectedWorkspace.trackIds.includes(track.id))
    : [];
  const isWorkspaceFolderOpen = Boolean(selectedWorkspace);
  const workspaceGridClass =
    workspaceGridSize === 4
      ? "grid-cols-[repeat(4,minmax(0,1fr))]"
      : workspaceGridSize === 8
        ? "grid-cols-[repeat(8,minmax(0,1fr))]"
        : workspaceGridSize === 12
          ? "grid-cols-[repeat(12,minmax(0,1fr))]"
          : "grid-cols-[repeat(16,minmax(0,1fr))]";

  function handleMoveTrackToWorkspace(trackId: string, workspaceId: string) {
    moveTrackToWorkspace(workspaceId, trackId);
    setSelectedWorkspaceId(workspaceId);
  }

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={creditValue} />

      {/* Main content area */}
      <div className="h-[calc(100vh-var(--player-height))] overflow-hidden flex flex-col lg:flex-row lg:ml-60">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <NoticeBar notice={notice} onClose={() => setNotice(null)} />

          <main className="p-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Form column */}
              <div className="xl:col-span-1 max-w-xl xl:self-start xl:sticky xl:top-(--studio-top-offset) xl:h-[calc(100vh-var(--studio-top-offset)-var(--player-height)-var(--studio-bottom-gap)]">
                <StudioForm
                  credits={credits}
                  isGenerating={generating}
                  onGenerate={handleGenerate}
                  onOptimize={handleOptimize}
                  onGenerateLyrics={handleGenerateLyrics}
                  onGenerateTitle={handleGenerateTitle}
                />
              </div>

              {/* Track list column */}
              <div className="xl:col-span-2 self-start sticky top-(--studio-top-offset) h-[calc(100vh-var(--studio-top-offset)-var(--player-height)-var(--studio-bottom-gap)]">
                <div className="flex flex-col h-full min-h-0">
                  {/* Tabs */}
                  <div className="flex items-center gap-1 mb-3 rounded-lg border border-white/10 bg-white/5 p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => setStudioTab("workspaces")}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${studioTab === "workspaces" ? "bg-primary-500 text-white" : "text-white/65 hover:text-white hover:bg-white/10"}`}
                    >
                      Workspaces
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioTab("recent")}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${studioTab === "recent" ? "bg-primary-500 text-white" : "text-white/65 hover:text-white hover:bg-white/10"}`}
                    >
                      Recent Tracks
                    </button>
                  </div>

                  {studioTab === "workspaces" && (
                    <section className="section-card min-h-0 flex-1 overflow-hidden flex flex-col">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold text-white/80">Workspace folders</h2>
                          <p className="text-xs text-white/40">
                            {isWorkspaceFolderOpen ? "Folder geopend. Alleen tracks uit deze workspace worden getoond." : workspaceViewMode === "grid" ? `${workspaceGridSize} columns per row.` : `${workspaces.length} workspaces.`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!isWorkspaceFolderOpen && (
                            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                              <button
                                type="button"
                                onClick={() => setWorkspaceViewMode("list")}
                                className={`rounded-md p-1.5 transition ${workspaceViewMode === "list" ? "bg-primary-500 text-white" : "text-white/65 hover:text-white hover:bg-white/10"}`}
                                title="List view"
                                aria-label="List view"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 10h16" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => setWorkspaceViewMode("grid")}
                                className={`rounded-md p-1.5 transition ${workspaceViewMode === "grid" ? "bg-primary-500 text-white" : "text-white/65 hover:text-white hover:bg-white/10"}`}
                                title="Grid view"
                                aria-label="Grid view"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zm10 0a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z" />
                                </svg>
                              </button>
                            </div>
                          )}
                          {!isWorkspaceFolderOpen && workspaceViewMode === "grid" && (
                            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                              {[4, 8, 12, 16].map((size) => (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => setWorkspaceGridSize(size as 4 | 8 | 12 | 16)}
                                  className={`rounded-md px-2 py-1 text-[11px] transition ${workspaceGridSize === size ? "bg-primary-500 text-white" : "text-white/65 hover:text-white hover:bg-white/10"}`}
                                  title={`Show ${size} workspace cards`}
                                  aria-label={`Show ${size} workspace cards`}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          )}
                          {isWorkspaceFolderOpen && (
                            <button
                              type="button"
                              onClick={() => setSelectedWorkspaceId(null)}
                              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 hover:text-white"
                              title="Back to workspace overview"
                            >
                              ← Back to folders
                            </button>
                          )}
                          <CreateWorkspaceDialog
                            open={showCreateWorkspace}
                            value={newWorkspaceName}
                            onOpen={() => setShowCreateWorkspace(true)}
                            onChange={setNewWorkspaceName}
                            onSubmit={handleCreateWorkspace}
                            onCancel={() => {
                              setShowCreateWorkspace(false);
                              setNewWorkspaceName("");
                            }}
                            onKeyDown={handleCreateWorkspaceKeyDown}
                          />
                        </div>
                      </div>

                      {!isWorkspaceFolderOpen && (
                        <div className="mb-3 overflow-y-auto pr-1">
                          {workspaceViewMode === "grid" ? (
                            <div className={`grid gap-3 ${workspaceGridClass}`}>
                              {workspaces.map((workspace) => {
                                const workspaceTracks = tracks.filter((track) => workspace.trackIds.includes(track.id));
                                const coverUrls = getWorkspaceCoverCollage(workspace.id, workspaceTracks);
                                const gradient = getWorkspaceGradient(workspace.id, workspace.folderGradient);
                                const hasSingleCover = coverUrls.length === 1;

                                return (
                                  <button
                                    key={workspace.id}
                                    type="button"
                                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                                    className={`group cursor-pointer rounded-3xl border border-white/10 text-left transition-transform hover:-translate-y-0.5 ${selectedWorkspaceId === workspace.id ? "ring-2 ring-primary-500/40" : ""}`}
                                  >
                                    <div className="relative aspect-[4/4.2] overflow-hidden rounded-3xl" style={{ backgroundImage: gradient }}>
                                      <div className="pointer-events-none absolute inset-0 bg-black/10" />
                                      {coverUrls.length > 0 ? (
                                        <div
                                          className={`pointer-events-none absolute inset-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-inner ${hasSingleCover ? "flex items-center justify-center" : "grid grid-cols-2 grid-rows-2 gap-1.5"}`}
                                        >
                                          {coverUrls.map((cover, index) => (
                                            <img
                                              key={`${workspace.id}-${index}`}
                                              src={cover}
                                              alt={workspace.name}
                                              draggable={false}
                                              className={`${hasSingleCover ? "h-full w-full max-w-[80%] rounded-xl" : "h-full w-full"} object-cover`}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                                            <svg className="h-12 w-12 text-white/85" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                                            </svg>
                                          </div>
                                        </div>
                                      )}

                                      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-sm">
                                          <p className="text-sm font-semibold text-white truncate">{workspace.name}</p>
                                          <p className="text-xs text-white/65">{workspaceTracks.length} songs</p>
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {workspaces.map((workspace) => {
                                const workspaceTracks = tracks.filter((track) => workspace.trackIds.includes(track.id));
                                const gradient = getWorkspaceGradient(workspace.id, workspace.folderGradient);

                                return (
                                  <button
                                    key={workspace.id}
                                    type="button"
                                    onClick={() => setSelectedWorkspaceId(workspace.id)}
                                    className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-left transition hover:bg-white/5 ${selectedWorkspaceId === workspace.id ? "ring-2 ring-primary-500/40 bg-white/5" : ""}`}
                                  >
                                    <div
                                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/10"
                                      style={{ backgroundImage: gradient }}
                                    >
                                      <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">{workspace.name}</p>
                                    </div>
                                    <span className="text-xs text-white/40 flex-shrink-0">
                                      {workspaceTracks.length} {workspaceTracks.length === 1 ? "song" : "songs"}
                                    </span>
                                    <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] text-white/35 mb-1 truncate">
                            <button
                              type="button"
                              onClick={() => setSelectedWorkspaceId(null)}
                              className="text-white/60 hover:text-white/80 transition-colors"
                              title="Back to workspace overview"
                            >
                              Workspaces
                            </button>
                            <span className="mx-1 text-white/20">&gt;</span>
                            <span className="text-white/70">{selectedWorkspace?.name ?? "Overview"}</span>
                          </div>
                        </div>
                        <span className="text-xs text-white/30 shrink-0">
                          {selectedWorkspace ? `${selectedWorkspaceTracks.length} tracks` : "0 tracks"}
                        </span>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        {selectedWorkspace ? (
                          <TrackList
                            tracks={selectedWorkspaceTracks}
                            autoQueueAfterPlay
                            onSelect={(t) => setSelectedTrack(t)}
                            onDelete={handleDeleteTrack}
                            onReusePrompt={handleReusePrompt}
                            onAddToQueue={handleAddToQueue}
                            onAddToPlaylist={handleAddToPlaylist}
                            playlists={playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }))}
                            onTitleUpdate={handleTitleUpdate}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/2 p-4 text-center">
                            <p className="text-sm text-white/45">
                              Select or create a workspace above to pin its tracks here.
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {studioTab === "recent" && (
                    <section className="section-card min-h-0 flex-1 overflow-hidden flex flex-col">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-white/60">Recent Tracks</h2>
                        <span className="text-xs text-white/30">{tracks.length} tracks</span>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <TrackList
                          tracks={tracks}
                          autoQueueAfterPlay
                          isGenerating={generating}
                          onSelect={(t) => setSelectedTrack(t)}
                          onDelete={handleDeleteTrack}
                          onReusePrompt={handleReusePrompt}
                          onAddToQueue={handleAddToQueue}
                          onAddToPlaylist={handleAddToPlaylist}
                          onMoveToWorkspace={handleMoveTrackToWorkspace}
                          playlists={playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }))}
                          onTitleUpdate={handleTitleUpdate}
                        />
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

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
                <p className="text-sm mt-3">Select a track or press play to show song info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {/* Lyrics generation overlay */}
      {showLyricsOverlay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 bg-primary-400 rounded-full animate-bounce ${i === 1 ? "animation-delay-150" : i === 2 ? "animation-delay-300" : ""}`}
                />
              ))}
            </div>
            <h2 className="text-xl font-bold mb-2">Writing lyrics</h2>
            <p className="text-white/50 text-sm">Crafting your song lyrics...</p>
          </div>
        </div>
      )}

      {/* Mobile/tablet detail overlay */}
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
