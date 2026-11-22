"use client";

import { useCallback, useEffect, useState } from "react";
import TrainDnaModelDialog from "./TrainDnaModelDialog";

interface DnaModel {
  id: string;
  name: string;
  status: "pending" | "completed" | "failed";
  modelId: string | null;
  isSelected: boolean;
  trainingTrackCount: number;
  dnaProfileName: string | null;
  dnaProfileComputedAt: string | null;
  error: string | null;
  createdAt: string;
}

const POLL_INTERVAL_MS = 4000;

function statusBadge(model: DnaModel) {
  if (model.status === "completed") {
    return { label: "Ready", className: "bg-green-500/10 text-green-300" };
  }
  if (model.status === "pending") {
    return { label: "Training…", className: "bg-blue-500/10 text-blue-300" };
  }
  return { label: "Failed", className: "bg-red-500/10 text-red-300" };
}

/**
 * Custom APIMart models trained from the user's own music — the "DNA model".
 * Unlike a persona, which only carries a voice, a model carries both the voice
 * and the style of the tracks it was trained on, so the Studio offers the two as
 * alternatives.
 *
 * Deleting is local: APIMart has no documented delete call for custom models.
 */
export default function DnaModelsSection() {
  const [models, setModels] = useState<DnaModel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showTrainDialog, setShowTrainDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/dna-model");
      if (!res.ok) return;
      const data = await res.json();
      setModels(data.models ?? []);
      setError(null);
    } catch {
      // Keep whatever is on screen; the refresh button retries.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  // Training runs for minutes after the dialog that started it is gone, so the
  // list polls pending rows itself.
  const hasPending = models.some((model) => model.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => {
      for (const model of models) {
        if (model.status !== "pending") continue;
        void fetch(`/api/dna-model/status/${model.id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data?.model) return;
            setModels((prev) => prev.map((m) => (m.id === data.model.id ? { ...m, ...data.model } : m)));
          })
          .catch(() => {});
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, models]);

  const handleUse = useCallback(
    async (modelId: string) => {
      setBusyId(modelId);
      setError(null);
      try {
        const res = await fetch("/api/dna-model/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: modelId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Could not select that model");
          return;
        }
        await fetchModels();
      } catch {
        setError("Could not select that model");
      } finally {
        setBusyId(null);
      }
    },
    [fetchModels]
  );

  const handleDelete = useCallback(
    async (model: DnaModel) => {
      const confirmed = window.confirm(
        `Delete ${model.name?.trim() || "this model"}? Tracks that already used it keep their audio — MelodIQ only forgets the model.`
      );
      if (!confirmed) return;

      setBusyId(model.id);
      setError(null);
      try {
        const res = await fetch(`/api/dna-model/${model.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Could not delete that model");
          return;
        }
        await fetchModels();
      } catch {
        setError("Could not delete that model");
      } finally {
        setBusyId(null);
      }
    },
    [fetchModels]
  );

  const handleRename = useCallback(
    async (model: DnaModel) => {
      const trimmed = draftName.trim();
      if (!trimmed || trimmed === model.name) {
        setEditingId(null);
        return;
      }
      setBusyId(model.id);
      setError(null);
      try {
        const res = await fetch(`/api/dna-model/${model.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error || "Could not rename that model");
          return;
        }
        setEditingId(null);
        await fetchModels();
      } catch {
        setError("Could not rename that model");
      } finally {
        setBusyId(null);
      }
    },
    [draftName, fetchModels]
  );

  return (
    <section className="section-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold mb-1">DNA models</h2>
          <p className="text-sm text-ink-dim">
            Custom models built from your own tracks. A model brings both the voice and the style of
            the clips it was trained on; the Studio uses one model at a time, and never together with
            a cloned voice.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchModels()}
            className="btn-secondary text-sm px-3 py-1.5"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowTrainDialog(true)}
            className="text-sm px-3 py-1.5 bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            Train a model
          </button>
        </div>
      </div>

      {!loaded && <p className="mt-3 text-sm text-ink-dim">Loading…</p>}

      {loaded && models.length === 0 && (
        <p className="mt-3 text-sm text-ink-dim">
          No DNA models yet. Train one to have Suno write in your own style and voice.
        </p>
      )}

      {models.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {models.map((model) => {
            const badge = statusBadge(model);
            return (
              <li key={model.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {editingId === model.id ? (
                      <input
                        type="text"
                        value={draftName}
                        maxLength={160}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(model);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => void handleRename(model)}
                        aria-label="Model name"
                        className="border border-line bg-black/30 px-2 py-1 text-sm text-ink focus:border-white/30 focus:outline-none"
                      />
                    ) : (
                      <p className="truncate text-sm font-medium text-ink">
                        {model.name?.trim() || "Unnamed model"}
                      </p>
                    )}
                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {badge.label}
                    </span>
                    {model.isSelected && (
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        In use
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-ink-dim">
                    Trained on {model.trainingTrackCount}{" "}
                    {model.trainingTrackCount === 1 ? "track" : "tracks"}
                    {model.dnaProfileName ? ` · DNA: ${model.dnaProfileName}` : ""}
                    {` · ${new Date(model.createdAt).toLocaleDateString()}`}
                  </p>

                  {model.status === "failed" && model.error && (
                    <p className="mt-1 text-xs text-red-400">{model.error}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {model.status === "completed" && !model.isSelected && (
                    <button
                      type="button"
                      onClick={() => void handleUse(model.id)}
                      disabled={busyId === model.id}
                      className="btn-secondary text-xs px-2.5 py-1"
                    >
                      Use
                    </button>
                  )}
                  {editingId !== model.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(model.id);
                        setDraftName(model.name ?? "");
                      }}
                      disabled={busyId === model.id}
                      className="text-xs px-2.5 py-1 text-ink-muted transition-colors hover:bg-white/8 disabled:opacity-50"
                    >
                      Rename
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(model)}
                    disabled={busyId === model.id}
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

      <TrainDnaModelDialog
        isOpen={showTrainDialog}
        onClose={() => setShowTrainDialog(false)}
        onStarted={() => void fetchModels()}
      />
    </section>
  );
}
