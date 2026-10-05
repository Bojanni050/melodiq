"use client";

import { useState } from "react";
import { useReleaseStore } from "@/lib/store";
import type { TrackItem } from "./types";

const RELEASE_TYPES: { value: string; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
];

interface ReleasePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackItem;
  onAddToRelease: (releaseId: string, releaseName: string, isDuplicate: boolean) => void;
}

export default function ReleasePickerDialog({
  isOpen,
  onClose,
  track,
  onAddToRelease,
}: ReleasePickerDialogProps) {
  const releases = useReleaseStore((state) => state.releases);
  const createRelease = useReleaseStore((state) => state.createRelease);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("single");
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  function alreadyOnRelease(releaseId: string) {
    const release = releases.find((r) => r.id === releaseId);
    if (!release) return false;
    return release.tracks.some((t) => t.trackId === track.id);
  }

  function toggleRelease(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    for (const id of selected) {
      const release = releases.find((r) => r.id === id);
      if (!release) continue;
      onAddToRelease(id, release.title, alreadyOnRelease(id));
    }
    setSelected(new Set());
    onClose();
  }

  async function handleCreateRelease() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createRelease({ title: newTitle, type: newType });
      if (id) {
        onAddToRelease(id, newTitle.trim(), false);
      }
      setNewTitle("");
      setShowCreate(false);
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] rounded-[28px] border border-line bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-xl leading-none font-medium text-ink">Add to Release</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-full bg-white/5 text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Close add to release menu"
          >
            <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {showCreate ? (
          <div className="px-5 pb-5 space-y-3">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreateRelease(); if (e.key === "Escape") setShowCreate(false); }}
              placeholder="Release title"
              maxLength={255}
              className="h-11 w-full  border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-dim outline-none focus:border-line/25"
            />
            <div className="flex gap-2">
              {RELEASE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNewType(t.value)}
                  className={`h-9 flex-1  text-sm font-medium transition-colors ${
                    newType === t.value ? "bg-accent/80 text-ink" : "bg-white/5 text-ink-muted hover:bg-white/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-10  bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRelease}
                disabled={!newTitle.trim() || creating}
                className="h-10  bg-accent/80 px-4 text-sm font-medium text-ink transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? "Creating…" : "Create & add"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[380px] overflow-y-auto px-3 pb-2">
              <div className="space-y-1">
                {releases.length === 0 ? (
                  <p className="text-sm text-ink-dim italic px-3 py-6 text-center">No releases yet</p>
                ) : (
                  releases.map((release) => {
                    const fully = alreadyOnRelease(release.id);
                    const isChecked = selected.has(release.id);

                    return (
                      <button
                        key={release.id}
                        type="button"
                        onClick={() => toggleRelease(release.id)}
                        className="flex w-full items-center gap-3  px-3 py-2.5 text-left text-ink/85 transition-colors hover:bg-white/10 group"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden  bg-white/8 flex items-center justify-center">
                          {release.coverUrl ? (
                            <img src={release.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          )}
                        </div>

                        <span className="min-w-0 flex-1 truncate leading-tight font-medium text-base">{release.title}</span>
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink-dim">
                          {release.type}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">{release.tracks.length} tracks</span>

                        {fully && (
                          <svg className="shrink-0 w-4 h-4 text-accent/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}

                        <span
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-accent border-accent"
                              : "border-line/20 group-hover:border-line/40"
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-t border-line px-5 pb-4 pt-3 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="h-12 flex-1 flex items-center gap-2.5  border border-line/70 px-3 text-sm font-medium text-ink-dim hover:border-line hover:text-ink transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create new release
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12  bg-white/8 px-5 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className="h-12  bg-accent/80 px-5 text-sm font-medium text-ink transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add{selected.size > 0 ? ` (${selected.size})` : ""}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
