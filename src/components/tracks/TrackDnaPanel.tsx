"use client";

import { useEffect, useState } from "react";

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

// Track DNA stats + voting, embedded inline on a track row (Song/Library/
// Workspaces pages). Always renders in an authenticated app context — the
// owner can view/vote on their own track regardless of publish status, per
// getTrackDnaAccess in src/lib/songs.ts — so unlike the public Discover
// Track DNA page this skips the logged-out/InlineAuthForm branch entirely.
export default function TrackDnaPanel({
  trackId,
  instrumental,
}: {
  trackId: string;
  instrumental: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [stats, setStats] = useState<DnaStats | null>(null);
  const [pollsCloseAt, setPollsCloseAt] = useState<string | null>(null);

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
    async function fetchDna() {
      const res = await fetch(`/api/discover/${trackId}`);
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setPollsCloseAt(data.track?.pollsCloseAt ?? null);
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
    fetchDna();
    return () => {
      active = false;
    };
  }, [trackId]);

  async function submitVote() {
    setSubmitting(true);
    setVoteError(null);
    setVoteSaved(false);
    try {
      const res = await fetch(`/api/discover/${trackId}/vote`, {
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

  const categories: Category[] = instrumental
    ? ["vocal", "instrumental", "atmosphere"]
    : ["vocal", "instrumental", "atmosphere", "lyrics"];

  const ratedCategories = stats ? categories.map((c) => stats[c]).filter((s) => s.average != null) : [];
  const overallScore =
    ratedCategories.length > 0
      ? ratedCategories.reduce((sum, s) => sum + (s.average as number), 0) / ratedCategories.length
      : null;

  const pollsCloseDate = pollsCloseAt ? new Date(pollsCloseAt) : null;
  const pollsClosed = Boolean(pollsCloseDate && pollsCloseDate <= new Date());

  if (loading) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/40">
        Loading Track DNA…
      </div>
    );
  }

  if (notFound || !stats) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/40">
        Track DNA isn&apos;t available for this track.
      </div>
    );
  }

  return (
    <div
      className="mx-3 mb-2 space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Stats</h4>
        {overallScore != null ? (
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-white">{overallScore.toFixed(1)}</span>
            <span className="text-xs text-white/40">/10 overall</span>
          </div>
        ) : (
          <span className="text-xs text-white/40">No votes yet</span>
        )}
      </div>

      <div className="space-y-3">
        {categories.map((category) => (
          <StatBar key={category} label={CATEGORY_LABELS[category]} stat={stats[category]} />
        ))}
      </div>

      <div className="space-y-3 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Vote</h4>
          {!pollsClosed && pollsCloseDate && (
            <span className="text-xs text-white/40">Voting closes {pollsCloseDate.toLocaleDateString()}</span>
          )}
        </div>

        {pollsClosed ? (
          <p className="text-sm text-white/50">Voting closed on {pollsCloseDate!.toLocaleDateString()}.</p>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
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
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Submit vote"}
              </button>
              {voteSaved && <span className="text-xs text-green-400">Vote saved</span>}
              {voteError && <span className="text-xs text-red-400">{voteError}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
