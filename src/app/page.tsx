"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Player from "@/components/Player";
import StudioForm from "@/components/StudioForm";
import TrackList from "@/components/TrackList";
import { useStudioStore } from "@/lib/store";

interface Track {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
}

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [generating, setGenerating] = useState(false);
  const [credits, setCredits] = useState({ lyria: "Pay-per-use", poyo: null as number | null, tempolor: null as number | null });
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    fetchTracks();
    fetchCredits();
    const interval = setInterval(() => {
      const hasGenerating = tracks.some((t) => t.status === "generating");
      if (hasGenerating) fetchTracks();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
    const { songIdea, provider } = useStudioStore.getState();
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "optimize",
        idea: songIdea,
        provider,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      useStudioStore.getState().setSongIdea(data.result);
    }
  }

  async function handleGenerateLyrics() {
    const { songIdea, language, instrumental } = useStudioStore.getState();
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lyrics",
        idea: songIdea,
        language,
        instrumental,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      useStudioStore.getState().setLyrics(data.result);
    }
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
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: songIdea,
          lyrics,
          title,
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
    } catch (error) {
      alert("Failed to generate track");
    } finally {
      setGenerating(false);
      setShowOverlay(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Studio</h1>
          <p className="text-white/50">
            Describe your song idea and let AI create the perfect track
          </p>
        </div>

        <div className="card mb-8">
          <StudioForm
            credits={credits}
            onGenerate={handleGenerate}
            onOptimize={handleOptimize}
            onGenerateLyrics={handleGenerateLyrics}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Tracks</h2>
          <TrackList tracks={tracks} />
        </div>
      </main>

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
                  }}
                />
              ))}
            </div>
            <h2 className="text-2xl font-bold mb-2">Composing your track</h2>
            <p className="text-white/60">This may take a moment...</p>
          </div>
        </div>
      )}

      <Player />
    </div>
  );
}
