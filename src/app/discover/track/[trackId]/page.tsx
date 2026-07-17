"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import InlineAuthForm from "@/components/discover/InlineAuthForm";
import { formatDuration } from "@/lib/track-utils";
import { usePlayerStore } from "@/lib/store";

interface TrackDetail {
  id: string;
  songId: string | null;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean;
  publishDate: string | null;
  pollsCloseAt: string | null;
}

interface DnaStat {
  average: number | null;
  count: number;
}

interface DnaStats {
  vocal: DnaStat;
  instrumental: DnaStat;
  atmosphere: DnaStat;
  lyrics: DnaStat;
}

type Category = "vocal" | "instrumental" | "atmosphere" | "lyrics";

const CATEGORY_LABELS: Record<Category, string> = {
  vocal: "Vocal",
  instrumental: "Instrumental",
  atmosphere: "Atmosphere",
  lyrics: "Lyrics",
};

function StatBar({ label, stat }: { label: string; stat: DnaStat }) {
  const pct = stat.average != null ? (stat.average / 10) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-white/50">
          {stat.average != null ? `${stat.average.toFixed(1)}/10` : "No votes yet"}
          {stat.count > 0 && <span className="text-white/30"> · {stat.count} vote{stat.count === 1 ? "" : "s"}</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function TrackDnaPage() {
  const params = useParams<{ trackId: string }>();
  const trackId = params?.trackId;

  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [stats, setStats] = useState<DnaStats | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const setGlobalIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);
  const isCurrentTrack = Boolean(track && currentTrack?.id === track.id);
  const isPlaying = isCurrentTrack && globalIsPlaying;

  const [scores, setScores] = useState<Record<Category, number>>({
    vocal: 5,
    instrumental: 5,
    atmosphere: 5,
    lyrics: 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteSaved, setVoteSaved] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (active) setIsLoggedIn(res.ok);
      } catch {
        if (active) setIsLoggedIn(false);
      } finally {
        if (active) setAuthChecked(true);
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
        setStats(data.stats);
        if (data.myVote) {
          setScores({
            vocal: data.myVote.vocal,
            instrumental: data.myVote.instrumental,
            atmosphere: data.myVote.atmosphere,
            lyrics: data.myVote.lyrics ?? 5,
          });
        }
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

  async function submitVote() {
    if (!track) return;
    setSubmitting(true);
    setVoteError(null);
    setVoteSaved(false);
    try {
      const res = await fetch(`/api/discover/${track.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scores),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVoteError(data.error || "Failed to submit vote");
        return;
      }
      setStats(data.stats);
      setVoteSaved(true);
      setTimeout(() => setVoteSaved(false), 2500);
    } catch {
      setVoteError("Network error — could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  const categories: Category[] = track?.instrumental
    ? ["vocal", "instrumental", "atmosphere"]
    : ["vocal", "instrumental", "atmosphere", "lyrics"];

  const ratedCategories = stats ? categories.map((c) => stats[c]).filter((s) => s.average != null) : [];
  const overallScore =
    ratedCategories.length > 0
      ? ratedCategories.reduce((sum, s) => sum + (s.average as number), 0) / ratedCategories.length
      : null;

  const pollsCloseDate = track?.pollsCloseAt ? new Date(track.pollsCloseAt) : null;
  const pollsClosed = Boolean(pollsCloseDate && pollsCloseDate <= new Date());

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

              <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Stats</h2>
                  {overallScore != null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white">{overallScore.toFixed(1)}</span>
                      <span className="text-sm text-white/40">/10 overall</span>
                    </div>
                  ) : (
                    <span className="text-sm text-white/40">No votes yet</span>
                  )}
                </div>
                <div className="space-y-4">
                  {categories.map((category) => (
                    <StatBar key={category} label={CATEGORY_LABELS[category]} stat={stats![category]} />
                  ))}
                </div>
              </section>

              <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Vote</h2>
                  {!pollsClosed && pollsCloseDate && (
                    <span className="text-xs text-white/40">Voting closes {pollsCloseDate.toLocaleDateString()}</span>
                  )}
                </div>
                {pollsClosed ? (
                  <p className="text-sm text-white/50">
                    Voting closed on {pollsCloseDate!.toLocaleDateString()}.
                  </p>
                ) : !authChecked ? null : !isLoggedIn ? (
                  <>
                    <p className="text-sm text-white/50">Sign in to vote on this track&apos;s DNA.</p>
                    <InlineAuthForm onAuthenticated={() => setIsLoggedIn(true)} />
                  </>
                ) : (
                  <div className="space-y-4">
                    {categories.map((category) => (
                      <div key={category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/70">{CATEGORY_LABELS[category]}</span>
                          <span className="font-mono text-white/50">{scores[category].toFixed(1)}/10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={0.1}
                          value={scores[category]}
                          onChange={(e) =>
                            setScores((prev) => ({ ...prev, [category]: Number(e.target.value) }))
                          }
                          className="w-full"
                        />
                      </div>
                    ))}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={submitVote}
                        disabled={submitting}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-60"
                      >
                        {submitting ? "Saving…" : "Submit vote"}
                      </button>
                      {voteSaved && <span className="text-xs text-green-400">Vote saved</span>}
                      {voteError && <span className="text-xs text-red-400">{voteError}</span>}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
