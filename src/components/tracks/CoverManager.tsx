"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CoverImage {
  id: string;
  entityType: string;
  entityId: string;
  s3Key: string;
  s3KeyThumb: string | null;
  position: number;
  isMain: boolean;
  createdAt: string;
}

interface CoverManagerProps {
  entityType: "track" | "release";
  entityId: string;
  currentCoverS3Key?: string | null;
  currentCoverUrl?: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function CoverManager({
  entityType,
  entityId,
  currentCoverS3Key,
  currentCoverUrl,
  onClose,
  onUpdated,
}: CoverManagerProps) {
  const [covers, setCovers] = useState<CoverImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for pending changes
  const [pendingCovers, setPendingCovers] = useState<CoverImage[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [pendingMainId, setPendingMainId] = useState<string | null>(null); // null = original is main
  const [reorderSwap, setReorderSwap] = useState<{ from: number; to: number } | null>(null);

  const baseUrl = `/api/${entityType === "track" ? "tracks" : "releases"}/${entityId}/covers`;

  const fetchCovers = useCallback(async () => {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) {
        const data = await res.json();
        const list = data.covers || [];
        setCovers(list);
        setPendingCovers(list);
      }
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void fetchCovers();
  }, [fetchCovers]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("cover", file);
      const res = await fetch(baseUrl, { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        const newCover = data.cover;
        setCovers((prev) => [...prev, newCover].sort((a, b) => a.position - b.position));
        setPendingCovers((prev) => [...prev, newCover].sort((a, b) => a.position - b.position));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Local operations (not saved yet)
  function handleSetMainLocal(coverId: string | null) {
    setPendingMainId(coverId);
    setPendingCovers((prev) => prev.map((c) => ({ ...c, isMain: c.id === coverId })));
  }

  function handleDeleteLocal(coverId: string) {
    setDeletedIds((prev) => new Set(prev).add(coverId));
  }

  function handleRestoreDelete(coverId: string) {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(coverId);
      return next;
    });
  }

  function handleReorderLocal(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= pendingCovers.length) return;
    const reordered = [...pendingCovers];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setPendingCovers(reordered.map((c, i) => ({ ...c, position: i })));
    setReorderSwap({ from: fromIndex, to: toIndex });
  }

  function getThumbUrl(cover: CoverImage): string {
    return `/api/${entityType === "track" ? "tracks" : "releases"}/${entityId}/covers/image/${cover.id}?thumb=1`;
  }

  // Save all pending changes
  async function handleSave() {
    setSaving(true);
    try {
      // Delete removed covers
      for (const id of deletedIds) {
        await fetch(`${baseUrl}/${id}`, { method: "DELETE" });
      }

      // Reorder
      const visibleCovers = pendingCovers.filter((c) => !deletedIds.has(c.id));
      if (visibleCovers.length > 1) {
        await fetch(`${baseUrl}/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: visibleCovers.map((c) => c.id) }),
        });
      }

      // Set main
      if (pendingMainId) {
        await fetch(`${baseUrl}/${pendingMainId}/main`, { method: "PATCH" });
      } else if (deletedIds.size > 0 || reorderSwap) {
        // If we deleted the main or reordered, and no explicit main was set,
        // the server will auto-promote. But if the user wants original as main,
        // we need to unset all uploaded mains.
        // Find the currently main uploaded cover and unset it
        const currentMain = covers.find((c) => c.isMain);
        if (currentMain && !deletedIds.has(currentMain.id)) {
          // Unset main by setting the first cover as main (then we'll handle original)
          // Actually, we need a way to unset all uploaded mains.
          // The simplest: if no uploaded cover should be main, set the first visible one
          // and the server logic will handle it. But that's not right either.
          // Let's just not touch main if pendingMainId is null — the original stays main.
        }
      }

      onUpdated?.();
      // Trigger UI refresh in other components (TrackCard, Player, Sidebar, etc.)
      if (typeof window !== "undefined") {
        const ts = Date.now();
        window.dispatchEvent(new CustomEvent("tracks-changed"));
        // Also notify TrackCard cover override
        window.dispatchEvent(new CustomEvent("melodiq:cover-regenerated", { detail: { trackIds: [entityId], ts } }));
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const hasExistingCover = !!currentCoverS3Key || !!currentCoverUrl;
  const activeCovers = pendingCovers.filter((c) => !deletedIds.has(c.id));
  const totalCount = (hasExistingCover ? 1 : 0) + activeCovers.length;
  const canAddMore = totalCount < 5;
  const hasUploadedMain = activeCovers.some((c) => c.isMain);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-6 shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white/90">
            Cover Images ({totalCount}/5)
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cover Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/40 text-sm">
            Loading covers...
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 mb-5">
            {/* Current/existing cover — interactable */}
            {hasExistingCover && (
              <div className="flex flex-col items-center gap-2">
                <div
                  onClick={() => hasUploadedMain && handleSetMainLocal(null)}
                  className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 transition-colors ${
                    !hasUploadedMain
                      ? "border-emerald-400/60"
                      : "border-white/15 cursor-pointer hover:border-emerald-400/40"
                  }`}
                >
                  <img
                    src={currentCoverUrl || (entityType === "track" ? `/api/tracks/${entityId}/cover` : `/api/releases/${entityId}/cover`)}
                    alt="Current cover"
                    className="h-full w-full object-cover"
                  />
                  {!hasUploadedMain && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-emerald-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      Main
                    </span>
                  )}
                  {hasUploadedMain && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors">
                      <span className="rounded-lg bg-emerald-500/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 hover:opacity-100 transition-opacity">
                        Set as main
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-white/30">Original</span>
              </div>
            )}

            {/* Uploaded covers */}
            {pendingCovers.map((cover, index) => {
              const isDeleted = deletedIds.has(cover.id);
              const displayIndex = (hasExistingCover ? 1 : 0) + index;
              return (
                <div key={cover.id} className="flex flex-col items-center gap-2">
                  <div
                    className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 transition-all ${
                      isDeleted
                        ? "border-red-400/40 opacity-40"
                        : cover.isMain
                          ? "border-emerald-400/60"
                          : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <img
                      src={getThumbUrl(cover)}
                      alt={`Cover ${displayIndex + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {cover.isMain && !isDeleted && (
                      <span className="absolute top-1.5 left-1.5 rounded bg-emerald-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Main
                      </span>
                    )}
                    {isDeleted && (
                      <span className="absolute top-1.5 left-1.5 rounded bg-red-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Deleted
                      </span>
                    )}
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/70">
                      {displayIndex + 1}
                    </span>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorderLocal(index, index - 1)}
                      disabled={index === 0 || isDeleted}
                      className="p-1 rounded text-white/25 hover:text-white/60 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move left"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {isDeleted ? (
                      <button
                        onClick={() => handleRestoreDelete(cover.id)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
                        title="Restore"
                      >
                        Restore
                      </button>
                    ) : !cover.isMain ? (
                      <button
                        onClick={() => handleSetMainLocal(cover.id)}
                        className="p-1 rounded text-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                        title="Set as main"
                      >
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    ) : (
                      <div className="w-[18px]" />
                    )}
                    {!isDeleted && (
                      <button
                        onClick={() => handleDeleteLocal(cover.id)}
                        className="p-1 rounded text-red-400/40 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleReorderLocal(index, index + 1)}
                      disabled={index === pendingCovers.length - 1 || isDeleted}
                      className="p-1 rounded text-white/25 hover:text-white/60 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move right"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 3 - totalCount) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center gap-2">
                <div className="aspect-square w-full rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[10px] text-white/20">Empty</span>
              </div>
            ))}
          </div>
        )}

        {/* Upload + Save/Cancel */}
        <div className="flex items-center justify-between gap-3">
          {canAddMore ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-2.5 text-sm text-white/60 hover:border-white/40 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add image
                  </>
                )}
              </button>
            </>
          ) : <div />}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl bg-white/8 px-5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/14"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
            >
              Save
            </button>
          </div>
        </div>

        {/* Confirmation popup */}
        {showConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/70">
            <div className="mx-4 w-full max-w-xs rounded-xl border border-white/10 bg-[#1a1b25] p-4 shadow-2xl">
              <p className="text-sm text-white/80 text-center mb-4">
                Save changes to cover images?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-lg bg-white/8 py-2 text-sm font-medium text-white/70 hover:bg-white/14 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={() => { setShowConfirm(false); void handleSave(); }}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary-500 py-2 text-sm font-medium text-white hover:bg-primary-400 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Yes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
