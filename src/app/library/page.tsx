"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Player from "@/components/Player";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import { usePlayerStore } from "@/lib/store";

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

export default function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  useEffect(() => {
    fetchTracks();
  }, []);

  async function fetchTracks() {
    const res = await fetch("/api/tracks");
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks.filter((t: Track) => t.status === "done"));
    }
    setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Sidebar credits={null} />
        <div className="lg:ml-[240px] flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Sidebar credits={null} />
      <div className="lg:ml-[240px]">
        <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-white/5">
          <div className="px-4 py-3">
            <h1 className="text-lg font-bold">Library</h1>
            <p className="text-xs text-white/40 mt-0.5">{tracks.length} tracks</p>
          </div>
        </div>
        <main className="p-4 pb-32">
          <TrackList tracks={tracks} onSelect={(t) => setSelectedTrack(t)} />
        </main>
      </div>
      <Player />
      {selectedTrack && (
        <TrackDetail
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onPlay={handlePlayTrack}
          onDownload={handleDownloadTrack}
        />
      )}
    </div>
  );
}
