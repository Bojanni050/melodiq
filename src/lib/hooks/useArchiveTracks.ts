"use client";

import { useCallback, useState } from "react";
import type { ArchiveBlockReason } from "@/lib/track-archive-guards";

export type ArchiveResult = {
  archivedCount: number;
  blocked: { trackId: string; title: string; reasons: ArchiveBlockReason[] }[];
};

// Shared guard-aware bulk-archive: sequential per-track PATCH requests (no
// batch endpoint exists in this codebase — matches the existing mass-delete
// convention), collecting 409s so blocked tracks are always surfaced instead
// of silently dropped. Used by both TrackList's selection pill and the Smart
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
      const empty: ArchiveResult = { archivedCount: 0, blocked: [] };
      if (trackIds.length === 0) {
        setArchiveResults(empty);
        return empty;
      }

      setArchiving(true);
      const blocked: ArchiveResult["blocked"] = [];
      let archivedCount = 0;

      for (const id of trackIds) {
        try {
          const res = await fetch(`/api/tracks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true }),
          });
          if (res.status === 409) {
            const data = await res.json().catch(() => ({ reasons: [] }));
            blocked.push({ trackId: id, title: getTitle(id), reasons: data.reasons ?? [] });
          } else if (res.ok) {
            archivedCount++;
            onArchived?.(id);
          }
        } catch {
          blocked.push({ trackId: id, title: getTitle(id), reasons: [] });
        }
      }

      setArchiving(false);
      const result: ArchiveResult = { archivedCount, blocked };
      setArchiveResults(result);
      return result;
    },
    []
  );

  const clearArchiveResults = useCallback(() => setArchiveResults(null), []);

  return { archiving, archiveResults, archiveTrackIds, clearArchiveResults };
}
