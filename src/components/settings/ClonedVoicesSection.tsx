"use client";

import { useCallback, useEffect, useState } from "react";

interface ClonedVoice {
  id: string;
  status: "pending" | "completed" | "failed";
  personaId: string | null;
  name: string | null;
  styles: string | null;
  describe: string | null;
  isSelected: boolean;
  error: string | null;
  sourceTrackId: string | null;
  sourceTrackTitle: string | null;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4000;

function statusBadge(voice: ClonedVoice) {
  if (voice.status === "completed") {
    return { label: "Ready", className: "bg-green-500/10 text-green-300" };
  }
  if (voice.status === "pending") {
    return { label: "Cloning…", className: "bg-blue-500/10 text-blue-300" };
  }
  return { label: "Failed", className: "bg-red-500/10 text-red-300" };
}

function sourceLabel(voice: ClonedVoice): string {
  if (!voice.sourceTrackId) return "From an uploaded sample";
  return voice.sourceTrackTitle ? `From “${voice.sourceTrackTitle}”` : "From a deleted track";
}

/**
 * The list of APIMart personas this account has made. It exists next to the
 * Studio picker because the picker only shows the voices that are usable right
 * now — a failed clone or a voice from a track the user forgot about has no
 * place there, and there was no way to remove one at all.
 *
 * Deleting is local: APIMart has no documented persona delete call, so the row
 * (and the persona id with it) is all this can take away.
 */
export default function ClonedVoicesSection() {
  const [voices, setVoices] = useState<ClonedVoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/voice");
      if (!res.ok) return;
      const data = await res.json();
      setVoices(data.voices ?? []);
      setError(null);
    } catch {
      // Keep whatever is on screen; the refresh button retries.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchVoices();
  }, [fetchVoices]);

  // A clone started from a track outlives the dialog that started it, so this
  // list polls too and flips a pending row without a manual refresh.
  const hasPending = voices.some((voice) => voice.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => {
      for (const voice of voices) {
        if (voice.status !== "pending") continue;
        void fetch(`/api/voice/status/${voice.id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data?.voice) return;
            setVoices((prev) => prev.map((v) => (v.id === data.voice.id ? { ...v, ...data.voice } : v)));
          })
          .catch(() => {});
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, voices]);

  const handleUse = useCallback(
    async (voiceId: string) => {
      setBusyId(voiceId);
      setError(null);
      try {
        const res = await fetch("/api/voice/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Could not select that voice");
          return;
        }
        await fetchVoices();
      } catch {
        setError("Could not select that voice");
      } finally {
        setBusyId(null);
      }
    },
    [fetchVoices]
  );

  const handleDelete = useCallback(
    async (voice: ClonedVoice) => {
      const label = voice.name?.trim() || "this voice";
      const confirmed = window.confirm(
        `Delete ${label}? Tracks that already used it keep their audio — MelodIQ only forgets the persona.`
      );
      if (!confirmed) return;

      setBusyId(voice.id);
      setError(null);
      try {
        const res = await fetch(`/api/voice/${voice.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Could not delete that voice");
          return;
        }
        await fetchVoices();
      } catch {
        setError("Could not delete that voice");
      } finally {
        setBusyId(null);
      }
    },
    [fetchVoices]
  );

  return (
    <section className="section-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold mb-1">Cloned voices</h2>
          <p className="text-sm text-ink-dim">
            Personas APIMart extracted from your tracks or audio uploads. The Studio only offers the
            ones that are ready; everything else lives here so you can see where it came from or
            remove it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchVoices()}
          className="btn-secondary shrink-0 text-sm px-3 py-1.5"
        >
          Refresh
        </button>
      </div>

      {!loaded && <p className="mt-3 text-sm text-ink-dim">Loading…</p>}

      {loaded && voices.length === 0 && (
        <p className="mt-3 text-sm text-ink-dim">
          No cloned voices yet. Create one from a finished track&rsquo;s menu, or upload a sample in
          the Studio.
        </p>
      )}

      {voices.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {voices.map((voice) => {
            const badge = statusBadge(voice);
            return (
              <li key={voice.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-ink">
                      {voice.name?.trim() || "Unnamed voice"}
                    </p>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {badge.label}
                    </span>
                    {voice.isSelected && (
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        In use
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-ink-dim">
                    {sourceLabel(voice)}
                    {voice.styles ? ` · ${voice.styles}` : ""}
                    {` · ${new Date(voice.createdAt).toLocaleDateString()}`}
                  </p>

                  {voice.describe && (
                    <p className="mt-1 text-xs text-ink-dim line-clamp-2">{voice.describe}</p>
                  )}

                  {voice.status === "failed" && voice.error && (
                    <p className="mt-1 text-xs text-red-400">{voice.error}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {voice.status === "completed" && !voice.isSelected && (
                    <button
                      type="button"
                      onClick={() => void handleUse(voice.id)}
                      disabled={busyId === voice.id}
                      className="btn-secondary text-xs px-2.5 py-1"
                    >
                      Use
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(voice)}
                    disabled={busyId === voice.id}
                    className="text-xs px-2.5 py-1 text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
