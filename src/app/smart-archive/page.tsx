"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";
import { useArchiveTracks, type ArchiveBlockReason } from "@/lib/hooks/use-archive-tracks";
import { formatDuration } from "@/lib/track-utils";
import { isLyricsTaskSubmission } from "@/lib/parse-lyrics";

type GroupTrack = {
  id: string;
  title: string | null;
  promptSnippet: string | null;
  lyricsSnippet: string | null;
  hasCover: boolean;
  blocked: boolean;
  reasons: ArchiveBlockReason[];
  duration: number | null;
  status: string;
  releaseStatus: string | null;
  publishDate: string | null;
  playCount: number;
  lyricsTimestamps: string | null;
  instrumental: boolean;
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
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  const [groups, setGroups] = useState<SmartArchiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedByGroup, setCheckedByGroup] = useState<Record<string, Set<string>>>({});

  const { archiving, archiveResults, archiveTrackIds, clearArchiveResults } = useArchiveTracks();

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
        setCheckedByGroup((prev) => {
          const next: Record<string, Set<string>> = {};
          for (const group of nextGroups) {
            // Nothing is preselected — the user must explicitly check each
            // track before archiving it. Blocked tracks are never selectable.
            next[group.id] = prev[group.id]
              ? new Set(Array.from(prev[group.id]).filter((id) => group.tracks.some((t) => t.id === id && !t.blocked)))
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

  const selectedOutputLabel = outputDevices.find((d) => d.deviceId === selectedOutputId)?.label;

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
                        {group.tracks.map((track) => {
                          const badge = trackStatusBadge(track);
                          const isPlayable = track.status === "done";
                          const isThisPlaying = previewTrackId === track.id && previewPlaying;
                          const hasTcl = !!track.lyricsTimestamps && !isLyricsTaskSubmission(track.lyricsTimestamps);
                          return (
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

                              <button
                                type="button"
                                onClick={() => isPlayable && togglePreview(track.id)}
                                disabled={!isPlayable}
                                title={isPlayable ? (isThisPlaying ? "Pause preview" : "Play preview") : "Not ready to play"}
                                className="w-10 h-10 rounded-md shrink-0 overflow-hidden bg-white/5 flex items-center justify-center relative group disabled:cursor-not-allowed"
                              >
                                {track.hasCover ? (
                                  <img src={`/api/tracks/${track.id}/cover`} alt="" className="w-full h-full object-cover" />
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
                                  <p className="text-sm font-medium text-white/80 truncate">{track.title || "Untitled"}</p>
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
                                  <span className="text-[10px] text-white/40 shrink-0">{formatDuration(track.duration)}</span>
                                </div>
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
                          );
                        })}
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
