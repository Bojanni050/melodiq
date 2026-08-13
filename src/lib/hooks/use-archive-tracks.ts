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
      const blocked: ArchiveResult["blocked"] = [];
      const failed: ArchiveResult["failed"] = [];
      let archivedCount = 0;

      for (const id of trackIds) {
        try {
          const res = await fetch(`/api/tracks/${id}/archive`, { method: "POST" });
          if (res.status === 409) {
            const data = await res.json().catch(() => ({ error: "Track cannot be archived", reason: null }));
            blocked.push({
              trackId: id,
              title: getTitle(id),
              reasons: [{ type: data.reason ?? "blocked", detail: data.error ?? "Track cannot be archived" }],
            });
          } else if (res.ok) {
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
      const result: ArchiveResult = { archivedCount, blocked, failed };
      setArchiveResults(result);
      return result;
    },
    []
  );

  const clearArchiveResults = useCallback(() => setArchiveResults(null), []);

  return { archiving, archiveResults, archiveTrackIds, clearArchiveResults };
}
