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
  isGenerated: boolean;
  createdAt: string;
}

interface CoverManagerProps {
  entityType: "track" | "release";
  entityId: string;
  currentCoverS3Key?: string | null;
  currentCoverUrl?: string | null;
  /** True when `currentCoverUrl` is only a borrowed fallback (e.g. a single-track
   * release showing its sole track's cover) rather than a cover the entity owns. */
  inheritedFromTrack?: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

function notifyUIUpdate(entityType: "track" | "release", entityId: string) {
  window.dispatchEvent(new CustomEvent("tracks-changed"));
  // Only tracks are ever referenced by trackIds — a release id isn't a
  // trackId, so dispatching it here would falsely tell track listeners a
  // (non-existent) track's cover changed.
  if (entityType === "track") {
    window.dispatchEvent(new CustomEvent("melodiq:cover-regenerated", {
      detail: { trackIds: [entityId], ts: Date.now() },
    }));
  }
}

export default function CoverManager({
  entityType,
  entityId,
  currentCoverS3Key,
  currentCoverUrl,
  inheritedFromTrack = false,
  onClose,
  onUpdated,
}: CoverManagerProps) {
  const [covers, setCovers] = useState<CoverImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "main" | "delete"; coverId: string | null } | null>(null);
  const [working, setWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = `/api/${entityType === "track" ? "tracks" : "releases"}/${entityId}/covers`;
  const thumbBase = `/api/${entityType === "track" ? "tracks" : "releases"}/${entityId}/covers/image`;

  const fetchCovers = useCallback(async () => {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) {
        const data = await res.json();
        setCovers(data.covers || []);
      }
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => { void fetchCovers(); }, [fetchCovers]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
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
        setCovers((prev) => [...prev, data.cover].sort((a, b) => a.position - b.position));
        notifyUIUpdate(entityType, entityId);
        onUpdated?.();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function doSetMain(coverId: string) {
    setWorking(true);
    try {
      const res = await fetch(`${baseUrl}/${coverId}/main`, { method: "PATCH" });
      if (res.ok) {
        setCovers((prev) => prev.map((c) => ({ ...c, isMain: c.id === coverId })));
        notifyUIUpdate(entityType, entityId);
        onUpdated?.();
      }
    } finally {
      setWorking(false);
    }
  }

  async function doDelete(coverId: string) {
    setWorking(true);
    try {
      const res = await fetch(`${baseUrl}/${coverId}`, { method: "DELETE" });
      if (res.ok) {
        setCovers((prev) => prev.filter((c) => c.id !== coverId));
        notifyUIUpdate(entityType, entityId);
        onUpdated?.();
      }
    } finally {
      setWorking(false);
    }
  }

  async function doReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= covers.length) return;
    const reordered = [...covers];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const withPositions = reordered.map((c, i) => ({ ...c, position: i }));
    setCovers(withPositions);
    const res = await fetch(`${baseUrl}/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: withPositions.map((c) => c.id) }),
    });
    if (!res.ok) void fetchCovers();
  }

  function getThumbUrl(cover: CoverImage): string {
    return `${thumbBase}/${cover.id}?thumb=1`;
  }

  function handleConfirmYes() {
    if (!confirmAction) return;
    if (confirmAction.type === "main" && confirmAction.coverId) {
      void doSetMain(confirmAction.coverId);
    } else if (confirmAction.type === "delete" && confirmAction.coverId) {
      void doDelete(confirmAction.coverId);
    }
    setConfirmAction(null);
  }

  const hasExistingCover = !!currentCoverS3Key || !!currentCoverUrl;
  const totalCount = (hasExistingCover ? 1 : 0) + covers.length;
  const canAddMore = totalCount < 5;
  const hasUploadedMain = covers.some((c) => c.isMain);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-6 shadow-2xl z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-white/90">
            {entityType === "release" ? "Release" : "Track"} Cover Images ({totalCount}/5)
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {inheritedFromTrack && (
          <p className="text-xs text-white/40 mb-4">
            This release doesn&apos;t have its own cover yet — showing its track&apos;s cover below. Add an image to give this release its own, independent cover.
          </p>
        )}

        {/* Cover Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/40 text-sm">Loading covers...</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 mb-5">
            {/* Current/existing cover */}
            {hasExistingCover && (
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 ${!hasUploadedMain ? (inheritedFromTrack ? "border-amber-400/50" : "border-emerald-400/60") : "border-white/15"}`}
                >
                  <img
                    src={currentCoverUrl || (entityType === "track" ? `/api/tracks/${entityId}/cover` : `/api/releases/${entityId}/cover`)}
                    alt="Current cover"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {!hasUploadedMain && (
                    <span className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${inheritedFromTrack ? "bg-amber-500/80" : "bg-emerald-500/80"}`}>
                      {inheritedFromTrack ? "From track" : "Main"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-white/30">{inheritedFromTrack ? "Track's cover" : "Original"}</span>
              </div>
            )}

            {/* Uploaded covers */}
            {covers.map((cover, index) => {
              const displayIndex = (hasExistingCover ? 1 : 0) + index;
              return (
                <div key={cover.id} className="flex flex-col items-center gap-2">
                  <div className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 transition-colors ${cover.isMain ? "border-emerald-400/60" : "border-white/10 hover:border-white/30"}`}>
                    <img src={getThumbUrl(cover)} alt={`Cover ${displayIndex + 1}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    {cover.isMain && <span className="absolute top-1.5 left-1.5 rounded bg-emerald-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Main</span>}
                    {cover.isGenerated && <span className="absolute bottom-1.5 left-1.5 rounded bg-primary-500/80 px-1.5 py-0.5 text-[9px] font-medium text-white">AI</span>}
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/70">{displayIndex + 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => doReorder(index, index - 1)} disabled={index === 0 || working} className="p-1 rounded text-white/25 hover:text-white/60 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors" title="Move left">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    {!cover.isMain && (
                      <button onClick={() => setConfirmAction({ type: "main", coverId: cover.id })} disabled={working} className="p-1 rounded text-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50" title="Set as main">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      </button>
                    )}
                    {!cover.isGenerated && (
                      <button onClick={() => setConfirmAction({ type: "delete", coverId: cover.id })} disabled={working} className="p-1 rounded text-red-400/40 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50" title="Delete">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                    <button onClick={() => doReorder(index, index + 1)} disabled={index === covers.length - 1 || working} className="p-1 rounded text-white/25 hover:text-white/60 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors" title="Move right">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {Array.from({ length: Math.max(0, 3 - totalCount) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center gap-2">
                <div className="aspect-square w-full rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-[10px] text-white/20">Empty</span>
              </div>
            ))}
          </div>
        )}

        {/* Upload + Close */}
        <div className="flex items-center justify-between gap-3">
          {canAddMore ? (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-2.5 text-sm text-white/60 hover:border-white/40 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-50">
                {uploading ? (<><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Uploading...</>) : (<><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add image</>)}
              </button>
            </>
          ) : <div />}
          <button onClick={onClose} className="rounded-xl bg-white/8 px-5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/14">Done</button>
        </div>

        {/* Confirmation popup */}
        {confirmAction && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/70">
            <div className="mx-4 w-full max-w-xs rounded-xl border border-white/10 bg-[#1a1b25] p-4 shadow-2xl">
              <p className="text-sm text-white/80 text-center mb-4">
                {confirmAction.type === "main"
                  ? confirmAction.coverId ? "Set this image as the main cover?" : "Restore original cover as main?"
                  : "Delete this cover image?"}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmAction(null)} disabled={working} className="flex-1 rounded-lg bg-white/8 py-2 text-sm font-medium text-white/70 hover:bg-white/14 transition-colors">No</button>
                <button onClick={handleConfirmYes} disabled={working} className={`flex-1 rounded-lg py-2 text-sm font-medium text-white transition-colors ${confirmAction.type === "main" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"} disabled:opacity-50`}>
                  {working ? "..." : "Yes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
