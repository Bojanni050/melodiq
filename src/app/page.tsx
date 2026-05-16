"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import StudioForm from "@/components/StudioForm";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import { useStudioStore, usePlayerStore, useUIStore } from "@/lib/store";

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
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
}

type TabType = "create" | "library";

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [generating, setGenerating] = useState(false);
  const [credits, setCredits] = useState({ lyria: "Pay-per-use" as string | number, poyo: null as number | null, tempolor: null as number | null });
  const [showOverlay, setShowOverlay] = useState(false);
  const activeTab = useUIStore((state) => state.activeTab);
  const setActiveTab = useUIStore((state) => state.setActiveTab);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  useEffect(() => {
    fetchTracks();
    fetchCredits();
    useStudioStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const hasGenerating = tracks.some((t) => t.status === "generating");
      if (hasGenerating) fetchTracks();
    }, 30000);
    return () => clearInterval(interval);
  }, [tracks]);

  async function fetchTracks() {
    const res = await fetch("/api/tracks");
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks);
    }
  }

  async function fetchCredits() {
    const res = await fetch("/api/credits");
    if (res.ok) {
      setCredits(await res.json());
    }
  }

  async function handleOptimize() {
    const { songIdea, provider, language, lyricsContext, structure, customStructure, vocalGender } = useStudioStore.getState();
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "optimize",
        idea: songIdea,
        provider,
        language,
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
    const { songIdea, lyricsContext, language, instrumental, structure, customStructure, vocalGender } = useStudioStore.getState();
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lyrics",
        idea: songIdea,
        context: lyricsContext,
        language,
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
      language,
      instrumental,
    } = useStudioStore.getState();

    setGenerating(true);
    setShowOverlay(true);

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
          language,
          instrumental,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Generation failed");
      } else {
        fetchTracks();
        useStudioStore.getState().reset();
      }
    } catch {
      alert("Failed to generate track");
    } finally {
      setGenerating(false);
      setShowOverlay(false);
    }
  }

  function handlePlayTrack(url: string) {
    if (selectedTrack) {
      usePlayerStore.getState().setCurrentTrack({
        id: selectedTrack.id,
        title: selectedTrack.title,
        provider: selectedTrack.provider,
        providerModel: selectedTrack.providerModel,
        prompt: selectedTrack.prompt,
        status: selectedTrack.status,
        audioUrl: url,
        audioUrlHd: selectedTrack.audioUrlHd,
        s3Key: null,
        s3KeyHd: selectedTrack.s3KeyHd,
        duration: null,
        lyrics: selectedTrack.lyrics,
        createdAt: selectedTrack.createdAt,
        error: selectedTrack.error,
      });
    }
  }

  function handleDownloadTrack(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.mp3`;
    a.click();
  }

  const creditValue = typeof credits.poyo === "number" ? credits.poyo : typeof credits.tempolor === "number" ? credits.tempolor : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar credits={creditValue} />

      {/* Main content area */}
      <div className="lg:ml-[240px]">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("create")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "create" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                }`}
              >
                Create
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "library" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                }`}
              >
                Library
              </button>
            </div>

            <select className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/50">
              <option>v1</option>
            </select>
          </div>
        </div>

        <main className="p-4 pb-32">
          {activeTab === "create" ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Form column */}
              <div className="xl:col-span-1 max-w-xl">
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
                <TrackList tracks={tracks} onSelect={(t) => setSelectedTrack(t)} />
              </div>
            </div>
          ) : (
            <div className="max-w-4xl">
              <h2 className="text-lg font-semibold mb-4">Library</h2>
              <TrackList tracks={tracks} onSelect={(t) => setSelectedTrack(t)} />
            </div>
          )}
        </main>
      </div>

      {/* Generation overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 aurora flex items-center justify-center">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-white/80 rounded-full"
                  style={{
                    animation: `soundwave 1.2s ease-in-out ${i * 0.15}s infinite`,
                    height: 16,
                  }}
                />
              ))}
            </div>
            <h2 className="text-xl font-bold mb-2">Composing your track</h2>
            <p className="text-white/50 text-sm">This may take a moment...</p>
          </div>
        </div>
      )}

      {/* Track detail panel */}
      {selectedTrack && (
        <TrackDetail
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onPlay={handlePlayTrack}
          onDownload={handleDownloadTrack}
        />
      )}

      <Player />
    </div>
  );
}