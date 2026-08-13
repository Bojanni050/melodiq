"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";
import { useArchiveTracks } from "@/lib/hooks/useArchiveTracks";
import type { ArchiveBlockReason } from "@/lib/track-archive-guards";

type GroupTrack = {
  id: string;
  title: string | null;
  promptSnippet: string | null;
  lyricsSnippet: string | null;
  hasCover: boolean;
  blocked: boolean;
  reasons: ArchiveBlockReason[];
};

type SmartArchiveGroup = {
  id: string;
  score: number;
  matchedOn: string[];
  tracks: GroupTrack[];
};

const MATCH_LABELS: Record<string, string> = {
  lyrics: "Lyrics",
  prompt: "Prompt",
  audioDna: "Audio DNA",
  title: "Title",
};

export default function SmartArchivePage() {
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [groups, setGroups] = useState<SmartArchiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedByGroup, setCheckedByGroup] = useState<Record<string, Set<string>>>({});

  const { archiving, archiveResults, archiveTrackIds, clearArchiveResults } = useArchiveTracks();

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-archive");
      if (res.ok) {
        const data = await res.json();
        const nextGroups: SmartArchiveGroup[] = data.groups || [];
        setGroups(nextGroups);
        setCheckedByGroup((prev) => {
          const next: Record<string, Set<string>> = {};
          for (const group of nextGroups) {
            // Default-checked for non-blocked tracks; blocked ones are never selectable.
            next[group.id] = prev[group.id]
              ? new Set(Array.from(prev[group.id]).filter((id) => group.tracks.some((t) => t.id === id && !t.blocked)))
              : new Set(group.tracks.filter((t) => !t.blocked).map((t) => t.id));
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  function toggleTrack(groupId: string, trackId: string) {
    setCheckedByGroup((prev) => {
      const current = new Set(prev[groupId] ?? []);
      if (current.has(trackId)) current.delete(trackId);
      else current.add(trackId);
      return { ...prev, [groupId]: current };
    });
  }

  async function handleArchiveGroup(group: SmartArchiveGroup) {
    const ids = Array.from(checkedByGroup[group.id] ?? []);
    if (ids.length === 0) return;
    const getTitle = (trackId: string) => group.tracks.find((t) => t.id === trackId)?.title || "Untitled";
    await archiveTrackIds(ids, getTitle);
    await fetchGroups();
  }

  return (
    <div className="relative h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        <main className="relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Smart Archive</h1>
              <p className="text-sm text-white/50 mt-1 max-w-2xl">
                Tracks grouped by similar lyrics, prompt, and audio DNA — review each group and choose which
                tracks to archive. Nothing is archived automatically.
              </p>
            </section>

            {archiveResults && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start justify-between gap-3">
                <p className="text-sm text-white/80">
                  Archived {archiveResults.archivedCount} track{archiveResults.archivedCount === 1 ? "" : "s"}.
                  {archiveResults.blocked.length > 0 && ` ${archiveResults.blocked.length} blocked.`}
                </p>
                <button onClick={clearArchiveResults} className="text-white/40 hover:text-white/70 transition-colors shrink-0">
                  ✕
                </button>
              </div>
            )}

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Scanning your library…</div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/30">
                <p className="text-sm">No duplicate or variant tracks found.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => {
                  const checked = checkedByGroup[group.id] ?? new Set<string>();
                  return (
                    <div key={group.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2 flex-wrap">
                          {group.matchedOn.map((signal) => (
                            <span key={signal} className="text-xs rounded-full bg-primary-500/20 text-primary-300 px-2.5 py-1">
                              {MATCH_LABELS[signal] ?? signal} {Math.round(group.score * 100)}%
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleArchiveGroup(group)}
                          disabled={archiving || checked.size === 0}
                          className="h-8 rounded-full bg-white px-3 text-sm font-medium text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
                        >
                          Archive selected ({checked.size})
                        </button>
                      </div>

                      <div className="divide-y divide-white/5">
                        {group.tracks.map((track) => (
                          <div
                            key={track.id}
                            className={`flex items-center gap-3 px-4 py-3 ${track.blocked ? "opacity-50" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked.has(track.id)}
                              disabled={track.blocked}
                              onChange={() => toggleTrack(group.id, track.id)}
                              className="shrink-0"
                            />

                            <div className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                              {track.hasCover ? (
                                <img src={`/api/tracks/${track.id}/cover`} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/80 truncate">{track.title || "Untitled"}</p>
                              {track.lyricsSnippet && (
                                <p className="text-xs text-white/40 mt-0.5 truncate">{track.lyricsSnippet}</p>
                              )}
                              {track.promptSnippet && (
                                <p className="text-xs text-white/30 mt-0.5 truncate">{track.promptSnippet}</p>
                              )}
                              {track.blocked && (
                                <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                                  🔒 {track.reasons.map((r) => r.detail).join(" · ")}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
