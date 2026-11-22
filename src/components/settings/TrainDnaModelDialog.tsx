"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DNA_MODEL_MAX_TRACKS,
  DNA_MODEL_MIN_TRACKS,
} from "@/lib/dna/model-spec";

interface Candidate {
  id: string;
  title: string;
  createdAt: string;
  instrumental: boolean;
  /** null when there was nothing to compare (no audio DNA, no rating). */
  score: number | null;
  reasons: string[];
}

interface CandidatesResponse {
  profile: { name: string; summary: string | null; computedAt: string; sourceCount: number } | null;
  targets: {
    tempo: number | null;
    energy: number | null;
    genres: string[];
    atmospheres: string[];
  };
  candidates: Candidate[];
  suggestedIds: string[];
  bounds: { min: number; max: number; suggested: number };
}

interface TrainDnaModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after APIMart accepted the training job, so the list can refresh. */
  onStarted: () => void;
}

function formatTargets(targets: CandidatesResponse["targets"]): string {
  const parts: string[] = [];
  if (targets.tempo !== null) parts.push(`${Math.round(targets.tempo)} BPM`);
  if (targets.energy !== null) parts.push(`energy ${Math.round(targets.energy)}`);
  if (targets.genres.length > 0) parts.push(targets.genres.join(" · "));
  if (targets.atmospheres.length > 0) parts.push(targets.atmospheres.join(" · "));
  return parts.join(" — ");
}

/**
 * Trains one APIMart custom model from a hand-picked set of the user's own
 * tracks. Melody DNA decides which tracks fit best (the suggestions come
 * pre-selected), but the choice stays manual: a model is a snapshot, and the
 * clips in it are the style and voice the model will sing with.
 *
 * 6–24 tracks is APIMart's hard limit. One bad file fails the whole training,
 * so the route only ever sends tracks that have finished audio.
 */
export default function TrainDnaModelDialog({ isOpen, onClose, onStarted }: TrainDnaModelDialogProps) {
  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    void fetch("/api/dna-model/candidates")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "Could not load your tracks");
        return body as CandidatesResponse;
      })
      .then((body) => {
        if (cancelled) return;
        setData(body);
        // The top-ranked tracks are the ones that sound most like the DNA
        // profile; starting from them beats an empty checkbox list.
        setSelected(new Set(body.suggestedIds));
        setName((prev) => prev || `${body.profile?.name?.trim() || "My"} model`);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < DNA_MODEL_MAX_TRACKS) next.add(id);
      return next;
    });
  }, []);

  const candidates = useMemo(() => data?.candidates ?? [], [data]);
  const tooFew = selected.size < DNA_MODEL_MIN_TRACKS;
  const canSubmit = !starting && !tooFew && name.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/dna-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), trackIds: [...selected] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || "Could not start the training");
        return;
      }
      onStarted();
      onClose();
    } catch {
      setError("Could not start the training");
    } finally {
      setStarting(false);
    }
  }, [canSubmit, name, onClose, onStarted, selected]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Train a DNA model"
        className="relative flex max-h-[85vh] w-full max-w-[720px] flex-col border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold text-ink">Train a DNA model</h3>
          <p className="mt-2 text-sm text-ink-muted">
            Pick {DNA_MODEL_MIN_TRACKS}–{DNA_MODEL_MAX_TRACKS} of your own finished tracks. The model
            learns both the sound and the vocals in them, so every later generation can use that
            voice and style. Training costs about $0.96 (9.6 credits) and takes a few minutes.
          </p>
        </div>

        {loading && <p className="mt-4 text-sm text-ink-dim">Loading your tracks…</p>}

        {data && (
          <>
            <div className="mt-4 border border-line bg-black/20 p-3">
              <p className="text-xs font-medium text-ink">
                {data.profile ? (
                  <>
                    Melody DNA · {data.profile.name} · {data.profile.sourceCount} tracks analysed
                  </>
                ) : (
                  <>Melody DNA has no profile yet</>
                )}
              </p>
              {data.profile && (
                <p className="mt-1 text-xs text-ink-dim">{formatTargets(data.targets) || "No targets yet"}</p>
              )}
              {!data.profile && (
                <p className="mt-1 text-xs text-ink-dim">
                  Rate a few tracks first and the suggestions get sharper — for now the newest tracks
                  are pre-selected.
                </p>
              )}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-y border-line">
              {candidates.length === 0 && (
                <p className="py-4 text-sm text-ink-dim">
                  No finished tracks with audio yet. Generate a few songs first.
                </p>
              )}
              <ul className="divide-y divide-line">
                {candidates.map((candidate) => {
                  const checked = selected.has(candidate.id);
                  const disabled = !checked && selected.size >= DNA_MODEL_MAX_TRACKS;
                  return (
                    <li key={candidate.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 py-2.5 ${
                          disabled ? "opacity-40" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(candidate.id)}
                          className="mt-0.5 accent-white"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm text-ink">
                              {candidate.title.trim() || "Untitled"}
                            </span>
                            {candidate.instrumental && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-ink-muted">
                                Instrumental
                              </span>
                            )}
                            {candidate.score !== null && (
                              <span className="text-[10px] text-accent">
                                match {Math.round(candidate.score)}%
                              </span>
                            )}
                          </span>
                          {candidate.reasons.length > 0 && (
                            <span className="mt-0.5 block text-[11px] text-ink-dim">
                              {candidate.reasons.join(" · ")}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-dim">
                          {new Date(candidate.createdAt).toLocaleDateString()}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs text-ink-dim">Model name</span>
                <input
                  type="text"
                  value={name}
                  maxLength={160}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Late night synthwave"
                  className="w-full border border-line bg-black/30 px-3 py-2 text-sm text-ink placeholder:text-ink-dim focus:border-white/30 focus:outline-none"
                />
              </label>
              <p className="text-xs text-ink-dim">
                {selected.size} of {DNA_MODEL_MAX_TRACKS} selected
              </p>
            </div>
          </>
        )}

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {starting ? "Starting…" : tooFew ? `Pick ${DNA_MODEL_MIN_TRACKS - selected.size} more` : "Start training"}
          </button>
        </div>
      </div>
    </div>
  );
}
