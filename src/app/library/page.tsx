"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Player from "@/components/Player";
import TrackList from "@/components/TrackList";
import Link from "next/link";

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

export default function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
          <div className="text-center py-16">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Library</h1>
          <p className="text-white/50">
            Your finished tracks — play, download, and archive
          </p>
        </div>

        <TrackList tracks={tracks} />
      </main>
      <Player />
    </div>
  );
}
