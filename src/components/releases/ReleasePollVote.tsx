"use client";

import { useCallback, useEffect, useState } from "react";

interface VoteOption {
  id: string;
  trackId: string;
  position: number;
  votes: number;
}

interface VotePoll {
  id: string;
  isOpen: boolean;
  closesAt: string | null;
  isClosed: boolean;
  totalVotes: number;
  options: VoteOption[];
  myOptionId?: string | null;
}

function formatClosesAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReleasePollVote({
  releaseId,
  trackTitles,
}: {
  releaseId: string;
  trackTitles: Record<string, string>;
}) {
  const [poll, setPoll] = useState<VotePoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/discover/releases/${releaseId}/poll`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPoll(data.poll ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleVote(optionId: string) {
    setVoting(optionId);
    setError(null);
    try {
      const res = await fetch(`/api/discover/releases/${releaseId}/poll/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Stemmen mislukt");
        return;
      }
      setPoll(data.poll ?? null);
    } finally {
      setVoting(null);
    }
  }

  if (loading) return null;
  if (!poll || poll.options.length === 0) return null;

  const closesLabel = formatClosesAt(poll.closesAt);

  return (
    <section className=" border border-accent/20 bg-accent/[0.06] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Welke versie is jouw favoriet?</h3>
          <p className="text-xs text-ink-dim">
            {poll.totalVotes} {poll.totalVotes === 1 ? "stem" : "stemmen"}
            {closesLabel && !poll.isClosed ? ` · sluit ${closesLabel}` : ""}
            {poll.isClosed ? " · gesloten" : ""}
          </p>
        </div>
        {poll.myOptionId && !poll.isClosed && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            Je hebt gestemd — wijzigen mag
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {poll.options.map((option) => {
          const pct = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
          const isMine = poll.myOptionId === option.id;
          return (
            <div
              key={option.id}
              className={` border p-3 transition-colors ${
                isMine ? "border-emerald-400/40 bg-emerald-400/[0.07]" : "border-line bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {trackTitles[option.trackId] ?? "Versie"}
                </span>
                <span className="shrink-0 text-xs text-ink/55">
                  {option.votes} · {pct}%
                </span>
                {!poll.isClosed && (
                  <button
                    type="button"
                    onClick={() => handleVote(option.id)}
                    disabled={voting !== null}
                    className={`h-8 shrink-0 rounded-full px-4 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      isMine
                        ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                        : "bg-accent text-ink hover:bg-accent-strong"
                    }`}
                  >
                    {voting === option.id ? "…" : isMine ? "✓ Gekozen" : "Stem"}
                  </button>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${isMine ? "bg-emerald-400" : "bg-accent/80"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
