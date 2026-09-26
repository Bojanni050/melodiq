"use client";

import { useCallback, useState } from "react";

export type ArchiveBlockReason = { type: string; detail: string };

export type ArchiveResult = {
  archivedCount: number;
  blocked: { trackId: string; title: string; reasons: ArchiveBlockReason[] }[];
  failed: { trackId: string; title: string; message: string }[];
};

// Shared guard-aware bulk-archive: sequential per-track POST requests
// against the existing /api/tracks/[id]/archive route (no batch endpoint
// exists in this codebase — matches the existing mass-delete convention),
// collecting both guard-blocked (409) and other failures so nothing is
// silently dropped. Used by both TrackList's selection pill and the Smart
// Archive tool.
export function useArchiveTracks() {
  const [archiving, setArchiving] = useState(false);
  const [archiveResults, setArchiveResults] = useState<ArchiveResult | null>(null);

  const archiveTrackIds = useCallback(
    async (
      trackIds: string[],
      getTitle: (trackId: string) => string,
      onArchived?: (trackId: string) => void
    ): Promise<ArchiveResult> => {
      const empty: ArchiveResult = { archivedCount: 0, blocked: [], failed: [] };
      if (trackIds.length === 0) {
        setArchiveResults(empty);
        return empty;
      }

      setArchiving(true);
      const failed: ArchiveResult["failed"] = [];
      let archivedCount = 0;

      for (const id of trackIds) {
        try {
          const res = await fetch(`/api/tracks/${id}/archive`, { method: "POST" });
          if (res.ok) {
            archivedCount++;
            onArchived?.(id);
          } else {
            const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            failed.push({ trackId: id, title: getTitle(id), message: data.error ?? `HTTP ${res.status}` });
          }
        } catch (error: any) {
          failed.push({ trackId: id, title: getTitle(id), message: error?.message ?? "Network error" });
        }
      }

      setArchiving(false);
      // `blocked` stays empty by design: published / master / playlist members are
      // no longer refused, so there is nothing left to block on. The field is kept
      // so the result shape (and the result toast) stays stable.
      const result: ArchiveResult = { archivedCount, blocked: [], failed };
      setArchiveResults(result);
      return result;
    },
    []
  );

  const clearArchiveResults = useCallback(() => setArchiveResults(null), []);

  return { archiving, archiveResults, archiveTrackIds, clearArchiveResults };
}

export type HideResult = {
  hiddenCount: number;
  failed: { trackId: string; title: string; message: string }[];
};

// Bulk-hide: same sequential convention as useArchiveTracks, but against
// /api/tracks/[id]/hide. Nothing is deleted server-side, so there are no
// archive guards to trip — the only rejection is a track sitting in the
// recycle bin, which cannot be hidden and could then not be permanently
// deleted either.
export function useHideTracks() {
  const [hiding, setHiding] = useState(false);
  const [hideResults, setHideResults] = useState<HideResult | null>(null);

  const hideTrackIds = useCallback(
    async (
      trackIds: string[],
      getTitle: (trackId: string) => string,
      onHidden?: (trackId: string) => void
    ): Promise<HideResult> => {
      const empty: HideResult = { hiddenCount: 0, failed: [] };
      if (trackIds.length === 0) {
        setHideResults(empty);
        return empty;
      }

      setHiding(true);
      const failed: HideResult["failed"] = [];
      let hiddenCount = 0;

      for (const id of trackIds) {
        try {
          const res = await fetch(`/api/tracks/${id}/hide`, { method: "POST" });
          if (res.ok) {
            hiddenCount++;
            onHidden?.(id);
          } else {
            const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            failed.push({ trackId: id, title: getTitle(id), message: data.error ?? `HTTP ${res.status}` });
          }
        } catch (error: any) {
          failed.push({ trackId: id, title: getTitle(id), message: error?.message ?? "Network error" });
        }
      }

      setHiding(false);
      const result: HideResult = { hiddenCount, failed };
      setHideResults(result);
      return result;
    },
    []
  );

  const clearHideResults = useCallback(() => setHideResults(null), []);

  return { hiding, hideResults, hideTrackIds, clearHideResults };
}

