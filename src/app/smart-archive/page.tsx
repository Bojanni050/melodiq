"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore, usePlayerStore, selectionModeFromEvent, type SelectionMode } from "@/lib/store";
import { useArchiveTracks, useHideTracks } from "@/lib/hooks/use-archive-tracks";
import type { ArchiveWarning } from "@/lib/archive-guards";
import { formatDuration } from "@/lib/track-utils";
import { isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import TrackDnaPanel from "@/components/tracks/TrackDnaPanel";
import TrackOptionsMenu from "@/components/tracks/TrackOptionsMenu";
import TrackDetail, { type TrackDetailTrack } from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";

type GroupTrack = {
  id: string;
  title: string | null;
  promptSnippet: string | null;
  lyricsSnippet: string | null;
  hasCover: boolean;
  // Soft, not a lock: published / master / playlist members stay selectable,
  // the archive confirmation just spells out what would change.
  warnings: ArchiveWarning[];
  duration: number | null;
  status: string;
  releaseStatus: string | null;
  publishDate: string | null;
  playCount: number;
  lyricsTimestamps: string | null;
  instrumental: boolean;
  hasHd: boolean;
  stemsCount: number;
  mastersCount: number;
  // "up" is the heart (Favoriet).
  rating: string | null;
  // User-created playlists this track is in (system playlists excluded).
  playlistNames: string[];
  // Read by the right-hand Track Details panel, not shown in the row.
  language: string | null;
  provider: string;
  providerModel: string;
  prompt: string | null;
  createdAt: string | null;
  completedAt: string | null;
  error: string | null;
  artistName: string | null;
  composerName: string | null;
  writerName: string | null;
};

type SmartArchiveGroup = {
  id: string;
  score: number;
  matchedOn: string[];
  // Display label for the group's shared language, null when the members
  // disagree or none has a detected language.
  language: string | null;
  tracks: GroupTrack[];
};

const MATCH_LABELS: Record<string, string> = {
  lyrics: "Lyrics",
  prompt: "Prompt",
  audioDna: "Audio DNA",
  title: "Title",
  language: "Language",
};

// setSinkId (audio output routing) isn't in the standard DOM lib types yet.
type SinkableAudioElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

function trackStatusBadge(track: GroupTrack): { color: string; label: string } | null {
  if (track.status === "pending") return { color: "bg-yellow-500/20 text-yellow-300", label: "Queued" };
  if (track.status === "generating") return { color: "bg-blue-500/20 text-blue-300", label: "Creating" };
  if (track.status === "failed") return { color: "bg-red-500/20 text-red-300", label: "Failed" };
  if (track.status === "done") {
    return track.playCount === 0
      ? { color: "bg-yellow-500/20 text-yellow-300", label: "New" }
      : { color: "bg-green-500/20 text-green-300", label: "Ready" };
  }
  return null;
}

export default function SmartArchivePage() {
  const router = useRouter();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [groups, setGroups] = useState<SmartArchiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedByGroup, setCheckedByGroup] = useState<Record<string, Set<string>>>({});
  const [confirmGroup, setConfirmGroup] = useState<SmartArchiveGroup | null>(null);
  const [dnaOpenIds, setDnaOpenIds] = useState<Set<string>>(new Set());
  const [dnaMountedIds, setDnaMountedIds] = useState<Set<string>>(new Set());

  // Right-hand Track Details panel. Slim Archive owns its own track list, so the
  // shared useTrackDetailsPanel hook is given the flattened groups; it only ever
  // reads `.id`, which keeps the panel following the now-playing track exactly
  // like it does on the Library and Archive pages.
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const rightPanelWidth = usePlayerStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((s) => s.setRightPanelWidth);

  const allTracks = useMemo(() => groups.flatMap((group) => group.tracks), [groups]);

  const detailTrack = useMemo(() => {
    if (!detailTrackId) return null;
    const groupTrack = allTracks.find((t) => t.id === detailTrackId);
    if (!groupTrack) return null;
    return {
      ...groupTrack,
      createdAt: groupTrack.createdAt ?? "",
      prompt: groupTrack.prompt ?? "",
      // The API only returns snippets; the panel shows the full text where it
      // matters and the snippet is still useful in the prompt block.
      lyrics: groupTrack.lyricsSnippet,
      status: (groupTrack.status as TrackDetailTrack["status"]) ?? "done",
      coverUrl: groupTrack.hasCover ? `/api/tracks/${groupTrack.id}/cover` : null,
    } as unknown as TrackDetailTrack;
  }, [detailTrackId, allTracks]);

  // Shift-click range anchor, per group. Held in a ref rather than state: it is
  // read inside the same click handler that writes it, and `fetchGroups` needs to
  // read the current value without re-creating the callback on every change.
  const checkedAnchorRef = useRef<Record<string, string | null>>({});

  // Ids a Shift-click range may span, per group. Every track is selectable now
  // that archiving is a soft choice, so this is the full group membership.
  const selectableTrackIdsByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of groups) {
      map[group.id] = group.tracks.map((t) => t.id);
    }
    return map;
  }, [groups]);

  function toggleDna(trackId: string) {
    setDnaOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
    setDnaMountedIds((prev) => (prev.has(trackId) ? prev : new Set(prev).add(trackId)));
  }

  const { archiving, archiveResults, archiveTrackIds, clearArchiveResults } = useArchiveTracks();
  const { hiding, hideTrackIds } = useHideTracks();

  // Independent preview player — a separate <audio> element from the app's
  // global player, so comparing candidates doesn't interrupt whatever is
  // already playing. Optionally routed to a different output device below.
  const previewAudioRef = useRef<SinkableAudioElement | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [outputSupported, setOutputSupported] = useState(false);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");
  const [outputMenuOpen, setOutputMenuOpen] = useState(false);
  const [outputError, setOutputError] = useState<string | null>(null);

  useEffect(() => {
    const audio: SinkableAudioElement = new Audio();
    audio.preload = "none";
    previewAudioRef.current = audio;
    setOutputSupported(typeof audio.setSinkId === "function");
    const onPlay = () => setPreviewPlaying(true);
    const onPause = () => setPreviewPlaying(false);
    const onEnded = () => setPreviewPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, []);

  function togglePreview(trackId: string) {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (previewTrackId === trackId) {
      if (audio.paused) void audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    audio.pause();
    audio.src = `/api/tracks/${trackId}/stream`;
    setPreviewTrackId(trackId);
    void audio.play().catch(() => {});
  }

  async function handleOutputButtonClick() {
    if (!outputSupported) return;
    setOutputError(null);
    try {
      if (outputDevices.length === 0 || outputDevices.every((d) => !d.label)) {
        // Device labels are only exposed after a permission grant.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setOutputDevices(devices.filter((d) => d.kind === "audiooutput"));
      }
      setOutputMenuOpen((open) => !open);
    } catch {
      setOutputError("Couldn't access audio output devices — check your browser's microphone/sound permissions.");
    }
  }

  async function applyOutputDevice(deviceId: string) {
    const audio = previewAudioRef.current;
    if (!audio?.setSinkId) return;
    try {
      await audio.setSinkId(deviceId);
      setSelectedOutputId(deviceId);
    } catch {
      setOutputError("Couldn't switch to that output device.");
    }
    setOutputMenuOpen(false);
  }

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-archive");
      if (res.ok) {
        const data = await res.json();
        const nextGroups: SmartArchiveGroup[] = data.groups || [];
        setGroups(nextGroups);
        // Drop anchors for groups that no longer exist, otherwise a later
        // Shift-click could resolve to an anchor from a stale group id.
        const liveGroupIds = new Set(nextGroups.map((g) => g.id));
        checkedAnchorRef.current = Object.fromEntries(
          Object.entries(checkedAnchorRef.current).filter(([groupId]) => liveGroupIds.has(groupId))
        );
        setCheckedByGroup((prev) => {
          const next: Record<string, Set<string>> = {};
          for (const group of nextGroups) {
            // Nothing is preselected — the user must explicitly check each
            // track before archiving it.
            next[group.id] = prev[group.id]
              ? new Set(Array.from(prev[group.id]).filter((id) => group.tracks.some((t) => t.id === id)))
              : new Set<string>();
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

  function goToTrackInLibrary(trackId: string) {
    sessionStorage.setItem("melodiq-jump-to-track", trackId);
    router.push("/library");
  }

  function toggleTrack(groupId: string, trackId: string, mode: SelectionMode) {
    setCheckedByGroup((prev) => {
      const current = new Set(prev[groupId] ?? []);
      const anchor = checkedAnchorRef.current[groupId] ?? null;

      if (mode === "range") {
        // Ranges span the group's full membership; every track is selectable
        // now that archiving warns instead of blocking.
        const selectableIds = selectableTrackIdsByGroup[groupId] ?? [];
        const anchorIndex = anchor ? selectableIds.indexOf(anchor) : -1;
        const targetIndex = selectableIds.indexOf(trackId);

        if (targetIndex >= 0) {
          if (anchorIndex < 0) {
            current.add(trackId);
          } else {
            const start = Math.min(anchorIndex, targetIndex);
            const end = Math.max(anchorIndex, targetIndex);
            selectableIds.slice(start, end + 1).forEach((id) => current.add(id));
          }
        }
      } else if (current.has(trackId)) {
        current.delete(trackId);
      } else {
        current.add(trackId);
      }

      return { ...prev, [groupId]: current };
    });

    // An additive (Ctrl/Cmd) click must not move the anchor, so a following
    // Shift-click still spans from the original row.
    if (mode !== "additive") {
      checkedAnchorRef.current = { ...checkedAnchorRef.current, [groupId]: trackId };
    }
  }

  // Selects or clears every track in one group. Early-out only when the group is
  // empty, which cannot happen for a rendered group, so this is a safety net.
  function toggleSelectAllGroup(groupId: string) {
    const selectableIds = selectableTrackIdsByGroup[groupId] ?? [];
    if (selectableIds.length === 0) return;

    setCheckedByGroup((prev) => {
      const current = prev[groupId] ?? new Set<string>();
      const allSelected = selectableIds.every((id) => current.has(id));
      const next = new Set(current);
      selectableIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return { ...prev, [groupId]: next };
    });

    // Point the anchor at the first selectable row so a following Shift-click
    // spans from the start of the group rather than from a stale position.
    checkedAnchorRef.current = { ...checkedAnchorRef.current, [groupId]: selectableIds[0] };
  }

  // Hiding needs no confirmation dialog: nothing is deleted, so there is no
  // irreversible action to warn about. The group is refetched afterwards so the
  // hidden tracks drop out of every group they appeared in.
  async function handleHideGroupClick(group: SmartArchiveGroup) {
    const ids = Array.from(checkedByGroup[group.id] ?? []);
    if (ids.length === 0) return;
    const getTitle = (trackId: string) => group.tracks.find((t) => t.id === trackId)?.title || "Untitled";
    await hideTrackIds(ids, getTitle);
    await fetchGroups();
  }

  function handleArchiveGroupClick(group: SmartArchiveGroup) {
    const ids = checkedByGroup[group.id] ?? new Set<string>();
    if (ids.size === 0) return;
    setConfirmGroup(group);
  }

  async function executeArchiveConfirmedGroup() {
    if (!confirmGroup) return;
    const group = confirmGroup;
    const ids = Array.from(checkedByGroup[group.id] ?? []);
    if (ids.length === 0) {
      setConfirmGroup(null);
      return;
    }
    const getTitle = (trackId: string) => group.tracks.find((t) => t.id === trackId)?.title || "Untitled";
    await archiveTrackIds(ids, getTitle);
    setConfirmGroup(null);
    await fetchGroups();
  }

  // Single-track hide/archive from the row's options menu. The group-level
  // buttons act on the selection; these act on one track and use the same hooks,
  // so the result reporting and the refetch stay identical.
  async function handleHideSingle(track: GroupTrack) {
    await hideTrackIds([track.id], () => track.title || "Untitled");
    await fetchGroups();
  }

  function handleArchiveSingle(track: GroupTrack) {
    const group = groups.find((g) => g.tracks.some((t) => t.id === track.id));
    if (!group) return;
    // Reuse the existing confirmation flow by pre-selecting just this track,
    // so the user sees the same warnings and deletion summary as a bulk archive.
    setCheckedByGroup((prev) => ({ ...prev, [group.id]: new Set([track.id]) }));
    setConfirmGroup(group);
  }

  const selectedOutputLabel = outputDevices.find((d) => d.deviceId === selectedOutputId)?.label;
  const confirmTracks = confirmGroup
    ? confirmGroup.tracks.filter((t) => (checkedByGroup[confirmGroup.id] ?? new Set()).has(t.id))
    : [];

  return (
    <div className="relative h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        <main className="relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Smart Archive</h1>
                <p className="text-sm text-white/50 mt-1 max-w-2xl">
                  Tracks grouped by similar lyrics, prompt, and audio DNA — play them to compare, then choose which
                  tracks to archive. Nothing is archived automatically.
                </p>
              </div>

              {outputSupported && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={handleOutputButtonClick}
                    className="h-9 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
                    title="Choose which speaker/sound card preview playback goes through"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                    </svg>
                    {selectedOutputLabel || "Preview output: default"}
                  </button>
                  {outputMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl py-1.5 z-20">
                      <button
                        type="button"
                        onClick={() => applyOutputDevice("")}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/5 ${selectedOutputId === "" ? "text-white" : "text-white/60"}`}
                      >
                        Default output
                      </button>
                      {outputDevices.map((device) => (
                        <button
                          key={device.deviceId}
                          type="button"
                          onClick={() => applyOutputDevice(device.deviceId)}
                          className={`w-full text-left px-3 py-1.5 text-sm truncate hover:bg-white/5 ${selectedOutputId === device.deviceId ? "text-white" : "text-white/60"}`}
                        >
                          {device.label || "Unnamed output device"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {outputError && (
              <p className="text-xs text-amber-400/80 px-1">{outputError}</p>
            )}

            {archiveResults && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-start justify-between gap-3">
                <p className="text-sm text-white/80">
                  Archived {archiveResults.archivedCount} track{archiveResults.archivedCount === 1 ? "" : "s"}.
                  {archiveResults.failed.length > 0 ? ` ${archiveResults.failed.length} failed.` : ""}
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
                  const selectableIds = selectableTrackIdsByGroup[group.id] ?? [];
                  const selectableCount = selectableIds.length;
                  const selectedSelectableCount = selectableIds.filter((id) => checked.has(id)).length;
                  const allSelected = selectableCount > 0 && selectedSelectableCount === selectableCount;
                  const someSelected = selectedSelectableCount > 0 && !allSelected;
                  return (
                    <div key={group.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-white/10">
                        {group.matchedOn.map((signal) => (
                          <span key={signal} className="text-xs rounded-full bg-primary-500/20 text-primary-300 px-2.5 py-1">
                            {MATCH_LABELS[signal] ?? signal} {Math.round(group.score * 100)}%
                          </span>
                        ))}
                        {group.language && (
                          <span
                            className="text-xs rounded-full bg-white/5 text-white/60 px-2.5 py-1"
                            title="All tracks in this group share this lyrics language"
                          >
                            {group.language}
                          </span>
                        )}
                        {selectableCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleSelectAllGroup(group.id)}
                            className="ml-auto inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
                            title={allSelected ? "Deselect all tracks in this group" : "Select all tracks in this group"}
                          >
                            {/* Mirrors the main track list: a filled dot when all
                                are selected, a dimmed one for a partial
                                selection, an empty ring otherwise. */}
                            <span
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                allSelected
                                  ? "bg-blue-500"
                                  : someSelected
                                    ? "bg-blue-500/50"
                                    : "border-2 border-white/20"
                              }`}
                            >
                              {(allSelected || someSelected) && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            {allSelected ? "Deselect all" : "Select all"}
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-white/5">
                        {group.tracks.map((track) => {
                          const badge = trackStatusBadge(track);
                          const isPlayable = track.status === "done";
                          const isThisPlaying = previewTrackId === track.id && previewPlaying;
                          const hasTcl = !!track.lyricsTimestamps && !isLyricsTaskSubmission(track.lyricsTimestamps);
                          const dnaOpen = dnaOpenIds.has(track.id);
                          return (
                            <div key={track.id}>
                            <div
                              className={`flex items-center gap-3 px-4 py-3 ${track.warnings.length > 0 ? "bg-amber-500/[0.04]" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked.has(track.id)}
                                // onClick rather than onChange: React's synthetic
                                // change event carries no modifier keys, and this
                                // checkbox is controlled — the state update is the
                                // only thing that decides the new checked value.
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTrack(group.id, track.id, selectionModeFromEvent(e));
                                }}
                                className="shrink-0"
                                title={track.warnings.length > 0
                                  ? `Let op bij archiveren: ${track.warnings.map((w) => w.detail).join(" ")}`
                                  : "Select — hold Shift to select a range, or Ctrl/Cmd to add one track"}
                              />

                              <button
                                type="button"
                                onClick={() => isPlayable && togglePreview(track.id)}
                                disabled={!isPlayable}
                                title={isPlayable ? (isThisPlaying ? "Pause preview" : "Play preview") : "Not ready to play"}
                                className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-white/5 flex items-center justify-center relative group disabled:cursor-not-allowed"
                              >
                                {track.hasCover ? (
                                  <img src={`/api/tracks/${track.id}/cover`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                  <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                  </svg>
                                )}
                                {isPlayable && (
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    {isThisPlaying ? (
                                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <rect x="6" y="4" width="4" height="16" rx="1" />
                                        <rect x="14" y="4" width="4" height="16" rx="1" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (showDetailPanel && detailTrackId === track.id) {
                                        setShowDetailPanel(false);
                                        setDetailTrackId(null);
                                      } else {
                                        setDetailTrackId(track.id);
                                        setShowDetailPanel(true);
                                      }
                                    }}
                                    title="Toggle Track Details"
                                    className="text-sm font-medium text-white/80 truncate hover:text-white hover:underline underline-offset-2 text-left min-w-[6rem] max-w-[60vw] sm:max-w-xs"
                                    aria-expanded={showDetailPanel && detailTrackId === track.id}
                                  >
                                    {track.title || "Untitled"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); goToTrackInLibrary(track.id); }}
                                    title="Open in Library"
                                    className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-white/15 text-white/50 hover:text-white hover:border-white/30 transition-colors"
                                  >
                                    Library
                                  </button>
                                  {isThisPlaying && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 shrink-0 font-medium">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                                      Now playing
                                    </span>
                                  )}
                                  {badge && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${badge.color}`}>{badge.label}</span>
                                  )}
                                  {track.status === "done" && track.releaseStatus && track.releaseStatus !== "concept" && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                                        track.releaseStatus === "published"
                                          ? "border border-green-300/30 bg-green-400/10 text-green-200"
                                          : "border border-red-300/30 bg-red-400/10 text-red-200"
                                      }`}
                                      title={
                                        track.releaseStatus === "published" && track.publishDate
                                          ? `Published ${new Date(track.publishDate).toLocaleDateString()}`
                                          : undefined
                                      }
                                    >
                                      {track.releaseStatus === "published" ? "Published" : "Unpublished"}
                                    </span>
                                  )}
                                  {hasTcl && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-300/30 bg-blue-400/10 text-blue-200 shrink-0 font-medium" title="Time-coded lyrics">TCL</span>
                                  )}
                                  {track.instrumental && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-violet-300/30 bg-violet-400/10 text-violet-200 shrink-0" title="No vocals">Instrumental</span>
                                  )}
                                  {/* Heart, not a button: rating is owned by the library
                                      row (TrackRating), and a second toggle here would
                                      have to re-fetch the group to stay in sync. */}
                                  {track.rating === "up" && (
                                    <svg
                                      className="w-3.5 h-3.5 text-pink-400 shrink-0"
                                      fill="currentColor"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                      viewBox="0 0 24 24"
                                      aria-label="Favoriet"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                    </svg>
                                  )}
                                  {track.playlistNames.length > 0 && (
                                    <span
                                      className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white/60 shrink-0 truncate max-w-[16rem]"
                                      title={`In playlist${track.playlistNames.length === 1 ? "" : "s"}: ${track.playlistNames.join(", ")}`}
                                    >
                                      {track.playlistNames.join(", ")}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-white/40 shrink-0">{formatDuration(track.duration)}</span>
                                  {track.status === "done" && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleDna(track.id); }}
                                      className="inline-flex items-center justify-center w-5 h-5 rounded text-white/35 hover:text-primary-300 hover:bg-primary-500/10 shrink-0 transition-colors"
                                      title={dnaOpen ? "Hide Track DNA" : "Show Track DNA"}
                                      aria-label={dnaOpen ? "Hide Track DNA" : "Show Track DNA"}
                                    >
                                      <svg
                                        className={`w-3 h-3 shrink-0 transition-transform ${dnaOpen ? "rotate-180" : ""}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  )}
                                  {isPlayable && (
                                    <TrackOptionsMenu
                                      // The menu's own TrackItem shape needs a few
                                      // fields Slim Archive does not track, so they
                                      // are filled with neutral values here. Only
                                      // what's shown on this row is ever read.
                                      track={{
                                        id: track.id,
                                        title: track.title,
                                        provider: "",
                                        providerModel: "",
                                        prompt: track.promptSnippet ?? "",
                                        lyrics: track.lyricsSnippet,
                                        status: "done",
                                        audioUrl: null,
                                        audioUrlHd: null,
                                        format: null,
                                        formatHd: null,
                                        duration: track.duration,
                                        createdAt: "",
                                        error: null,
                                        s3KeyHd: null,
                                        rating: track.rating,
                                        coverUrl: track.hasCover ? `/api/tracks/${track.id}/cover` : null,
                                        instrumental: track.instrumental,
                                        lyricsTimestamps: track.lyricsTimestamps,
                                        releaseStatus: track.releaseStatus,
                                      }}
                                      onHideClick={() => void handleHideSingle(track)}
                                      onArchiveClick={() => handleArchiveSingle(track)}
                                      onChanged={() => void fetchGroups()}
                                    />
                                  )}
                                </div>
                                {track.lyricsSnippet && (
                                  <p className="text-xs text-white/40 mt-0.5 truncate">{track.lyricsSnippet}</p>
                                )}
                                {track.promptSnippet && (
                                  <p className="text-xs text-white/30 mt-0.5 truncate">{track.promptSnippet}</p>
                                )}
                                {track.warnings.length > 0 && (
                                  <p className="text-xs text-amber-300/80 mt-1 flex items-start gap-1">
                                    <span aria-hidden>⚠</span>
                                    <span>{track.warnings.map((w) => w.detail).join(" · ")}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div
                              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                                dnaOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                              }`}
                            >
                              <div className="overflow-hidden">
                                {dnaMountedIds.has(track.id) && <TrackDnaPanel trackId={track.id} trackStatus={track.status} />}
                              </div>
                            </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => handleHideGroupClick(group)}
                          disabled={hiding || checked.size === 0}
                          className="h-8 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 text-sm font-medium text-sky-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-500/20 transition-colors"
                          title="Hide the selected tracks — every audio file is kept, and you can restore them from the Archive tab"
                        >
                          Hide selected ({checked.size})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchiveGroupClick(group)}
                          disabled={archiving || checked.size === 0}
                          className="h-8 rounded-full bg-white px-3 text-sm font-medium text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
                        >
                          Archive selected ({checked.size})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <ResizablePanel show={showDetailPanel} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="h-full overflow-y-auto pb-4">
            {detailTrack ? (
              <TrackDetail
                mode="sidebar"
                track={detailTrack}
                onClose={() => {
                  setShowDetailPanel(false);
                  setDetailTrackId(null);
                }}
                // The panel's play button drives the same preview player the rows
                // use, so clicking it in the panel also highlights the row.
                onPlay={() => {
                  if (detailTrack.status === "done") togglePreview(detailTrack.id);
                }}
                onDownload={() => {
                  if (!detailTrack) return;
                  window.open(`/api/tracks/${detailTrack.id}/download`, "_blank", "noopener");
                }}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Select a track title to show song info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {confirmGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmGroup(null)} />
          <div className="relative bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-lg flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-semibold text-white/90">
                Archive {confirmTracks.length} track{confirmTracks.length === 1 ? "" : "s"}?
              </h3>
              <p className="text-sm text-white/50 mt-1">
                The original MP3 and Track DNA are always kept. Anything listed below is permanently deleted.
              </p>
            </div>

            <div className="space-y-3">
              {confirmTracks.map((track) => {
                const deletions: string[] = [];
                if (track.hasHd) deletions.push("HD/WAV audio file");
                if (track.stemsCount > 0) deletions.push(`${track.stemsCount} stem${track.stemsCount === 1 ? "" : "s"}`);
                if (track.mastersCount > 0) deletions.push(`${track.mastersCount} master version${track.mastersCount === 1 ? "" : "s"}`);
                return (
                  <div key={track.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded shrink-0 overflow-hidden bg-white/5 flex items-center justify-center">
                        {track.hasCover ? (
                          <img src={`/api/tracks/${track.id}/cover`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-3.5 h-3.5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-white/80 truncate">{track.title || "Untitled"}</p>
                    </div>
                    {deletions.length > 0 && (
                      <ul className="text-xs text-red-300/80 mt-2 list-disc list-inside space-y-0.5">
                        {deletions.map((d) => <li key={d}>{d}</li>)}
                      </ul>
                    )}
                    {track.warnings.length > 0 && (
                      <ul className="text-xs text-amber-300/90 mt-2 space-y-1">
                        {track.warnings.map((w) => (
                          <li key={w.type} className="flex items-start gap-1">
                            <span aria-hidden>⚠</span>
                            <span>{w.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {deletions.length === 0 && track.warnings.length === 0 && (
                      <p className="text-xs text-white/40 mt-2">Nothing extra to delete — just archiving.</p>
                    )}
                    <p className="text-xs text-emerald-300/70 mt-1">Kept: original MP3, Track DNA, lyrics &amp; prompt.</p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmGroup(null)}
                disabled={archiving}
                className="px-4 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeArchiveConfirmedGroup}
                disabled={archiving}
                className="px-4 py-1.5 rounded-lg text-sm bg-white hover:bg-white/90 text-black font-medium transition-colors disabled:opacity-50"
              >
                {archiving ? "Archiving…" : `Archive ${confirmTracks.length} track${confirmTracks.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
