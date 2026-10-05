"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MAX_POLL_OPTIONS } from "@/lib/release-poll-constants";

interface ManagerTrack {
  id: string;
  title: string | null;
}

interface PollOption {
  id: string;
  trackId: string;
  position: number;
  votes: number;
}

interface Poll {
  id: string;
  isOpen: boolean;
  closesAt: string | null;
  isClosed: boolean;
  totalVotes: number;
  options: PollOption[];
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReleasePollManager({
  releaseId,
  tracks,
}: {
  releaseId: string;
  tracks: ManagerTrack[];
}) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [closesAt, setClosesAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/releases/${releaseId}/poll`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const next: Poll | null = data.poll ?? null;
        setPoll(next);
        if (next) {
          setSelected(next.options.map((o) => o.trackId));
          setClosesAt(toLocalInput(next.closesAt));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTrack = (trackId: string) => {
    setSelected((prev) => {
      if (prev.includes(trackId)) return prev.filter((t) => t !== trackId);
      if (prev.length >= MAX_POLL_OPTIONS) return prev;
      return [...prev, trackId];
    });
  };

  const titleById = useMemo(() => new Map(tracks.map((t) => [t.id, t.title || "Untitled"])), [tracks]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const method = poll ? "PATCH" : "POST";
      const payload: Record<string, unknown> = { trackIds: selected };
      payload.closesAt = closesAt ? new Date(closesAt).toISOString() : null;
      if (!poll) {
        // New polls open immediately; existing polls keep their open state.
      }
      const res = await fetch(`/api/releases/${releaseId}/poll`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Opslaan mislukt");
        return;
      }
      const next: Poll | null = data.poll ?? null;
      setPoll(next);
      if (next) {
        setSelected(next.options.map((o) => o.trackId));
        setClosesAt(toLocalInput(next.closesAt));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleOpen() {
    if (!poll || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/releases/${releaseId}/poll`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !poll.isOpen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Opslaan mislukt");
        return;
      }
      setPoll(data.poll ?? null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!poll || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/releases/${releaseId}/poll`, { method: "DELETE" });
      if (!res.ok) return;
      setPoll(null);
      setSelected([]);
      setClosesAt("");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className=" border border-line bg-white/5 p-5 text-sm text-ink-muted">
        Stemming laden…
      </div>
    );
  }

  return (
    <section className=" border border-line bg-white/5 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Stemming</h3>
          <p className="text-xs text-ink-dim">
            Koppel een poll aan deze release — kies max {MAX_POLL_OPTIONS} versies waar fans op stemmen.
          </p>
        </div>
        {poll && (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              poll.isClosed ? "bg-white/10 text-ink-dim" : "bg-emerald-500/15 text-emerald-300"
            }`}
          >
            {poll.isClosed ? "Gesloten" : "Open"} · {poll.totalVotes}{" "}
            {poll.totalVotes === 1 ? "stem" : "stemmen"}
          </span>
        )}
      </div>

      {tracks.length < 2 ? (
        <p className="text-xs text-ink-dim">
          Voeg minimaal 2 tracks aan deze release toe om een stemming te starten.
        </p>
      ) : (
        <div className="space-y-1.5">
          {tracks.map((track) => {
            const checked = selected.includes(track.id);
            const disabled = !checked && selected.length >= MAX_POLL_OPTIONS;
            return (
              <label
                key={track.id}
                className={`flex items-center gap-3  px-3 py-2 text-sm transition-colors ${
                  disabled ? "opacity-40" : "cursor-pointer hover:bg-white/5"
                } ${checked ? "bg-white/8" : "bg-white/[0.03]"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleTrack(track.id)}
                  className="h-4 w-4 accent-accent"
                />
                <span className="min-w-0 flex-1 truncate text-ink-muted">
                  {track.title || "Untitled"}
                </span>
                {poll && (
                  <span className="shrink-0 text-xs text-ink-dim">
                    {poll.options.find((o) => o.trackId === track.id)?.votes ?? 0} stemmen
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-ink-dim">Stemmen sluit op (optioneel)</span>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="h-9  border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-line/30"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selected.length < 2 || tracks.length < 2}
            className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Opslaan…" : poll ? "Poll bijwerken" : "Poll starten"}
          </button>
          {poll && (
            <>
              <button
                type="button"
                onClick={handleToggleOpen}
                disabled={saving}
                className="h-9 rounded-full border border-line bg-white/5 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-50"
              >
                {poll.isOpen ? "Sluiten" : "Heropenen"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="h-9 rounded-full border border-red-500/30 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                Verwijderen
              </button>
            </>
          )}
        </div>
      </div>

      {poll && poll.options.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {poll.options.map((option) => {
            const pct = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
            return (
              <div key={option.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span className="truncate">{titleById.get(option.trackId) ?? option.trackId}</span>
                  <span>
                    {option.votes} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent/80" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
