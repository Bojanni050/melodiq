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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const baseUrl = `/api/${entityType === "track" ? "tracks" : "releases"}/${entityId}/covers`;

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
        setCovers((prev) => [...prev, data.cover].sort((a, b) => a.position - b.position));
        onUpdated?.();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(coverId: string) {
    const res = await fetch(`${baseUrl}/${coverId}`, { method: "DELETE" });
    if (res.ok) {
      setCovers((prev) => {
        const next = prev.filter((c) => c.id !== coverId);
        void fetchCovers();
        return next;
      });
      onUpdated?.();
    }
  }

  async function handleSetMain(coverId: string) {
    const res = await fetch(`${baseUrl}/${coverId}/main`, { method: "PATCH" });
    if (res.ok) {
      setCovers((prev) => prev.map((c) => ({ ...c, isMain: c.id === coverId })));
      onUpdated?.();
    }
  }

  async function handleReorder(fromIndex: number, toIndex: number) {
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
    if (!res.ok) {
      void fetchCovers();
    }
  }

  function getThumbUrl(cover: CoverImage): string {
    return `/api/${entityType === "track" ? "tracks" : "releases"}/${entityId}/covers/image/${cover.id}?thumb=1`;
  }

  const hasExistingCover = !!currentCoverS3Key || !!currentCoverUrl;
  const totalCount = (hasExistingCover ? 1 : 0) + covers.length;
  const canAddMore = totalCount < 5;
  const hasUploadedMain = covers.some((c) => c.isMain);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        ref={menuRef}
        className="relative w-full max-w-lg rounded-xl border border-white/10 bg-[#12121a] p-5 shadow-2xl z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/90">
            Cover Images ({totalCount}/5)
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cover Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/40 text-sm">
            Loading covers...
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/40">
            <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No cover images yet</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {/* Current/existing cover */}
            {hasExistingCover && (
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2">
                <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${!hasUploadedMain ? "border-emerald-400/60" : "border-white/15"}`}>
                  <img
                    src={currentCoverUrl || (entityType === "track" ? `/api/tracks/${entityId}/cover?thumb=1` : `/api/releases/${entityId}/cover?thumb=1`)}
                    alt="Current cover"
                    className="h-full w-full object-cover"
                  />
                  {!hasUploadedMain && (
                    <span className="absolute top-0.5 left-0.5 rounded bg-emerald-500/80 px-1 py-0.5 text-[8px] font-bold uppercase text-white">
                      Main
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white/80">Current cover</p>
                  <p className="text-[11px] text-white/40">Original cover from track</p>
                </div>
                <span className="text-[10px] text-white/30">1</span>
              </div>
            )}

            {/* Uploaded covers */}
            {covers.map((cover, index) => {
              const displayIndex = (hasExistingCover ? 1 : 0) + index;
              return (
                <div
                  key={cover.id}
                  onDoubleClick={() => handleSetMain(cover.id)}
                  className={`flex items-center gap-3 rounded-lg border-2 p-2 transition-colors ${
                    cover.isMain
                      ? "border-emerald-400/60 bg-emerald-400/5"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={getThumbUrl(cover)}
                      alt={`Cover ${displayIndex + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {cover.isMain && (
                      <span className="absolute top-0.5 left-0.5 rounded bg-emerald-500/80 px-1 py-0.5 text-[8px] font-bold uppercase text-white">
                        Main
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white/80">Cover {displayIndex + 1}</p>
                    <p className="text-[11px] text-white/40">Double-click to set as main</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorder(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleReorder(index, index + 1)}
                      disabled={index === covers.length - 1}
                      className="p-1 rounded text-white/30 hover:text-white/70 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {!cover.isMain && (
                      <button
                        onClick={() => handleSetMain(cover.id)}
                        className="p-1 rounded text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                        title="Set as main"
                      >
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(cover.id)}
                      className="p-1 rounded text-red-400/50 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload button */}
        {canAddMore && (
          <div>
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
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-white/20 text-sm text-white/60 hover:border-white/40 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add cover image
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
