"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { formatDuration } from "@/lib/track-utils";
import { usePlayerStore } from "@/lib/store";

interface TrackDetail {
  id: string;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean;
  publishDate: string | null;
}

interface AudioDna {
  tempo: number | null;
  key: string | null;
  energy: number | null;
  loudness: number | null;
  atmosphereTags: string[] | null;
  lyricsScore: number | null;
  lyricsNotes: string | null;
  compositionScore: number | null;
  compositionNotes: string | null;
  computedAt: string;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className="text-base font-medium text-white">{value}</div>
    </div>
  );
}

export default function TrackDnaPage() {
  const params = useParams<{ trackId: string }>();
  const trackId = params?.trackId;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [audioDna, setAudioDna] = useState<AudioDna | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const setGlobalIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);
  const isCurrentTrack = Boolean(track && currentTrack?.id === track.id);
  const isPlaying = isCurrentTrack && globalIsPlaying;

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (active) setIsLoggedIn(res.ok);
      } catch {
        if (active) setIsLoggedIn(false);
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!trackId) return;
    let active = true;
    async function fetchTrack() {
      const res = await fetch(`/api/discover/${trackId}`);
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTrack(data.track);
        setAudioDna(data.audioDna ?? null);
      }
      setLoading(false);
    }
    fetchTrack();
    return () => {
      active = false;
    };
  }, [trackId]);

  function coverSrc() {
    if (!track) return null;
    if (track.coverUrl) return track.coverUrl;
    if (track.hasCoverProxy) return `/api/discover/${track.id}/cover`;
    return null;
  }

  function handlePlayClick() {
    if (!track) return;
    if (isCurrentTrack) {
      setGlobalIsPlaying(!globalIsPlaying);
      return;
    }
    playTrackFromGesture({
      id: track.id,
      title: track.title,
      provider: "discover",
      providerModel: "discover",
      prompt: "",
      status: "done",
      audioUrl: null,
      audioUrlHd: null,
      s3Key: null,
      s3KeyHd: null,
      format: null,
      formatHd: null,
      duration: track.duration,
      lyrics: null,
      createdAt: new Date().toISOString(),
      error: null,
      coverUrl: coverSrc(),
      s3KeyCover: null,
      artistName: track.artistName,
      instrumental: track.instrumental,
      publicSource: true,
    });
  }

  const hasAudioFacts =
    audioDna &&
    (audioDna.tempo != null || audioDna.key != null || audioDna.energy != null || audioDna.loudness != null);

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      {isLoggedIn && <Sidebar credits={null} />}
      <main className={`flex-1 overflow-y-auto px-4 py-6 sm:px-8 ${isLoggedIn ? "lg:pl-64" : ""}`}>
        <div className="mx-auto max-w-2xl space-y-8 pb-16">
          <Link href="/discover" className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/80">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Discover
          </Link>

          {loading ? (
            <p className="text-sm text-white/50">Loading…</p>
          ) : notFound || !track ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-white/60">This track isn&apos;t available.</p>
              <Link href="/discover" className="mt-3 inline-block text-sm text-primary-400 hover:text-primary-300">
                Back to Discover
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePlayClick}
                  className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl"
                  aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                >
                  {coverSrc() ? (
                    <img src={coverSrc()!} alt={track.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600/40 to-primary-900/40">
                      <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 transition-opacity ${
                        isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isPlaying ? (
                        <svg className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg className="ml-0.5 h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/35">Track DNA</p>
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{track.title}</h1>
                  <p className="truncate text-sm text-white/50">{track.artistName || "Unknown Artist"}</p>
                  <p className="mt-1 text-xs text-white/35">
                    {formatDuration(track.duration)} · {track.totalPlays.toLocaleString()} plays
                  </p>
                </div>
              </div>

              <section className="relative space-y-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div
                  className="pointer-events-none absolute inset-0 -z-10 scale-125 bg-cover bg-center opacity-[0.08] blur-xl"
                  style={{ backgroundImage: "url(/images/track-dna-bg.png)" }}
                />
                <h2 className="text-base font-semibold">Stats</h2>

                {!audioDna ? (
                  <p className="text-sm text-white/50">
                    Analysis in progress — Track DNA will appear once the track finishes rendering.
                  </p>
                ) : (
                  <>
                    {hasAudioFacts && (
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {audioDna.tempo != null && <Fact label="Tempo" value={`${audioDna.tempo} BPM`} />}
                        {audioDna.key != null && <Fact label="Key" value={audioDna.key} />}
                        {audioDna.energy != null && <Fact label="Energy" value={`${audioDna.energy}%`} />}
                        {audioDna.loudness != null && (
                          <Fact label="Loudness" value={`${audioDna.loudness.toFixed(1)} LUFS`} />
                        )}
                      </div>
                    )}

                    {audioDna.atmosphereTags && audioDna.atmosphereTags.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Atmosphere</div>
                        <div className="flex flex-wrap gap-1.5">
                          {audioDna.atmosphereTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/80"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {audioDna.lyricsScore != null && (
                      <div className="space-y-1 border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-white">Lyrics</span>
                          <span className="text-white/50">{audioDna.lyricsScore.toFixed(1)}/10</span>
                        </div>
                        {audioDna.lyricsNotes && <p className="text-sm text-white/40">{audioDna.lyricsNotes}</p>}
                      </div>
                    )}

                    {audioDna.compositionScore != null && (
                      <div className="space-y-1 border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-white">Composition</span>
                          <span className="text-white/50">{audioDna.compositionScore.toFixed(1)}/10</span>
                        </div>
                        {audioDna.compositionNotes && <p className="text-sm text-white/40">{audioDna.compositionNotes}</p>}
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
