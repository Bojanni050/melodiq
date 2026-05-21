"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import StudioForm from "@/components/StudioForm";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import { useStudioStore, usePlayerStore, usePlaylistStore } from "@/lib/store";

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

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [credits, setCredits] = useState({ lyria: "Pay-per-use" as string | number, poyo: null as number | null, tempolor: null as number | null });
  const [showLyricsOverlay, setShowLyricsOverlay] = useState(false);
  const playlists = usePlaylistStore((state) => state.playlists);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  useEffect(() => {
    fetchTracks();
    fetchCredits();
    useStudioStore.persist.rehydrate();
  }, []);

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

  function startRightPanelResize(e: React.MouseEvent<HTMLDivElement>) {
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = rightPanelWidth;

    const onMouseMove = (event: MouseEvent) => {
      const delta = resizeStartXRef.current - event.clientX;
      setRightPanelWidth(resizeStartWidthRef.current + delta);
    };

    const onMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function handleCloseTrackDetails() {
    setSelectedTrack(null);
    setShowTrackDetailsPanel(false);
  }

  async function fetchTracks() {
    const res = await fetch("/api/tracks");
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks);
    }
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

  function handleAddToPlaylist(trackId: string, playlistId: string) {
    addTrackToPlaylist(playlistId, trackId);
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
    const { songIdea, provider, lyricsContext, structure, customStructure, vocalGender } = useStudioStore.getState();
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
      provider,
      providerModel,
      instrumental,
    } = useStudioStore.getState();

    setGenerating(true);

    try {
      let finalTitle = title;

      if (!instrumental && !title.trim() && lyrics.trim()) {
        finalTitle = await handleGenerateTitle(lyrics) || "";
        if (finalTitle) {
          useStudioStore.getState().setTitle(finalTitle);
        }
      }

      const res = await fetch("/api/generate", {
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
      });

      const data = await res.json();

      const generatedTrack = data.tracks?.[0] ?? data.track;

      if (!res.ok) {
        setNotice({ type: "error", message: data.error || "Generation failed" });
        return;
      }

      if (!generatedTrack && provider !== "lyria") {
        setNotice({ type: "error", message: "Generation started but no track payload returned" });
      }

      await fetchTracks();
      setNotice(null);
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

  const creditValue = typeof credits.poyo === "number" ? credits.poyo : typeof credits.tempolor === "number" ? credits.tempolor : null;

  return (
    <div className="h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar credits={creditValue} />

      {/* Main content area */}
      <div className="h-[calc(100vh-var(--player-height))] overflow-hidden lg:ml-60 lg:flex">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {notice && (
            <div className="fixed top-4 right-4 z-50 max-w-sm rounded-xl border border-red-500/30 bg-[#201215] px-4 py-3 shadow-xl">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-4 w-4 text-red-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm text-red-100">{notice.message}</p>
                </div>
                <button
                  onClick={() => setNotice(null)}
                  className="text-red-200/70 hover:text-red-100"
                  aria-label="Close notification"
                  title="Close"
                >
                  x
                </button>
              </div>
            </div>
          )}

          <main className="p-4">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Form column */}
              <div className="xl:col-span-1 max-w-xl xl:self-start xl:sticky xl:top-[var(--studio-top-offset)] xl:h-[calc(100vh-var(--studio-top-offset)-var(--player-height)-var(--studio-bottom-gap))]">
                <StudioForm
                  credits={credits}
                  onGenerate={handleGenerate}
                  onOptimize={handleOptimize}
                  onGenerateLyrics={handleGenerateLyrics}
                  onGenerateTitle={handleGenerateTitle}
                />
              </div>

              {/* Track list column */}
              <div className="xl:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white/60">Recent Tracks</h2>
                  <span className="text-xs text-white/30">{tracks.length} tracks</span>
                </div>
                <TrackList
                  tracks={tracks}
                  autoQueueAfterPlay
                  isGenerating={generating}
                  onSelect={(t) => setSelectedTrack(t)}
                  onDelete={handleDeleteTrack}
                  onReusePrompt={handleReusePrompt}
                  onAddToQueue={handleAddToQueue}
                  onAddToPlaylist={handleAddToPlaylist}
                  playlists={playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }))}
                  onTitleUpdate={handleTitleUpdate}
                />
              </div>
            </div>
          </main>
        </div>

        {showTrackDetailsPanel && (
          <div
            className="hidden lg:block w-1 cursor-col-resize bg-transparent hover:bg-white/10 transition-colors"
            onMouseDown={startRightPanelResize}
            title="Resize details panel"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize details panel"
          />
        )}

        {showTrackDetailsPanel && (
          <aside className="right-details-panel hidden lg:block shrink-0 border-l border-white/5 bg-[#0d0d12]">
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
          </aside>
        )}
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
