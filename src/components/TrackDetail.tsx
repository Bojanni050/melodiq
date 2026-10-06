"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useUserStore, usePlayerStore, useWorkspaceStore } from "@/lib/store";
import { formatGenerationTime } from "@/lib/track-utils";
import { formatGenerator } from "@/lib/format-generator";
import type { TrackDetailTrack } from "@/components/track-detail/types";
import { useTrackDetailSync } from "@/components/track-detail/useTrackDetailSync";
import { useTrackRating } from "@/components/track-detail/useTrackRating";
import { usePromptEditor } from "@/components/track-detail/usePromptEditor";
import { useLyricsEditor } from "@/components/track-detail/useLyricsEditor";
import { useLyricsTranslation } from "@/components/track-detail/useLyricsTranslation";
import { useCopyToClipboard } from "@/components/track-detail/useCopyToClipboard";
import { useSyncedLyrics } from "@/components/track-detail/useSyncedLyrics";

export type { TrackDetailTrack } from "@/components/track-detail/types";

const TRANSLATE_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Swedish",
  "Norwegian",
  "Danish",
  "Russian",
  "Turkish",
  "Arabic",
  "Hindi",
  "Japanese",
  "Korean",
  "Chinese",
];

interface TrackDetailProps {
  track: TrackDetailTrack;
  onClose: () => void;
  onPlay: (url: string) => void;
  onDownload: (url: string, hd: boolean) => void;
  mode?: "overlay" | "sidebar";
  allowLyricsEdit?: boolean;
  onTrackUpdated?: (track: TrackDetailTrack) => void;
}

export default function TrackDetail({ track: initialTrack, onClose, onPlay, onDownload, mode = "overlay", allowLyricsEdit, onTrackUpdated }: TrackDetailProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const { user, loadUser } = useUserStore();
  const { currentTrack, isPlaying, audioElement, queue, playQueueItem, removeFromQueue, clearQueue, reorderQueueItem } = usePlayerStore();
  const workspaces = useWorkspaceStore((state) => state.workspaces);

  // Role-based visibility: the prompt/lyrics content itself is shown to
  // every role (a listener browsing a public track sees whatever the API
  // actually sent — public tracks just never carry a prompt, see
  // PublicTrackSummary), but the editing and translation affordances are
  // admin-only. Callers can still override allowLyricsEdit explicitly if
  // they need to.
  const isAdmin = user?.role === "admin";
  const resolvedAllowLyricsEdit = allowLyricsEdit ?? isAdmin;

  // central track state that self-heals via polling (TCL sync, cover art)
  const { track, setLocalTrack, mutate } = useTrackDetailSync(initialTrack, onTrackUpdated);

  // shared by every editor hook: applies a server-returned track update to
  // local state, the player store, and the SWR track list in one place
  const applyTrackUpdate = useCallback((updatedTrack: any) => {
    setLocalTrack(updatedTrack);
    onTrackUpdated?.(updatedTrack);
    usePlayerStore.getState().syncTrackSnapshots([updatedTrack]);
    void mutate("/api/tracks");
  }, [setLocalTrack, onTrackUpdated, mutate]);

  const { currentRating, ratingLoading, handleRating } = useTrackRating(track, initialTrack);
  const { copiedField, handleCopy } = useCopyToClipboard();
  const prompt = usePromptEditor(track, initialTrack, applyTrackUpdate);
  const lyricsEdit = useLyricsEditor(track, initialTrack, applyTrackUpdate);
  const translation = useLyricsTranslation(track, initialTrack, applyTrackUpdate);
  const lyricsSync = useSyncedLyrics(track);

  // Sidebar panel tabs: the now-playing track's content (lyrics + prompt) or
  // the autoplay queue. Defaults to lyrics so the panel keeps its old look;
  // only the now-playing sidebar panel offers the queue tab.
  const [detailTab, setDetailTab] = useState<"lyrics" | "queue">("lyrics");
  const isNowPlayingPanel = mode === "sidebar" && currentTrack?.id === track.id;
  const showQueueTab = isNowPlayingPanel && detailTab === "queue";

  // Queue drag & drop: the dragged track id lives in a ref (survives
  // re-renders without effect plumbing), the insertion indicator in state so
  // the rows can show where the drop will land.
  const queueDragIdRef = useRef<string | null>(null);
  const [queueDropTarget, setQueueDropTarget] = useState<{ id: string; before: boolean } | null>(null);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  function handleDownload(url: string, hd = false) {
    setDownloading(true);
    onDownload(url, hd);
    setTimeout(() => setDownloading(false), 1000);
  }
  void handleDownload;

  const title = (track.title || track.prompt.substring(0, 60)).replace(/\s*\(2\)\s*$/, "");
  const promptFirstLine = track.prompt
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
  const isUploadedTrack = track.provider === "upload";
  const artistLabel = (track.artistName || "").trim() || (user?.artistAlias || "").trim() || (user?.name || "").trim() || "";
  const composerLabel = (track.composerName || "").trim() || (user?.composerAlias || "").trim() || "";
  const writerLabel = (track.writerName || "").trim() || (user?.writerAlias || "").trim() || "";
  const canEditPrompt = isUploadedTrack && isAdmin;
  const currentWorkspace = workspaces.find((w) => !w.isDefault && w.trackIds.includes(track.id)) ?? null;

  const displayDuration = track.duration
    ?? (currentTrack?.id === track.id && audioElement && isFinite(audioElement.duration) && audioElement.duration > 0
      ? Math.round(audioElement.duration)
      : null);

  const generationTime = formatGenerationTime(track.createdAt, track.completedAt);

  // "poyo" + "V5_5" is a Suno 5.5 track, not a "PoYo V5_5" one — PoYo is the
  // API that fronts Suno here, and the stored pair is the internal one. The
  // label therefore comes from a lookup (lib/format-generator) rather than from
  // the raw columns, and falls back to whatever is stored so an unlisted
  // provider is still named instead of silently disappearing.
  const generatorLabel = formatGenerator(track.provider, track.providerModel);

  function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-line px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-muted">Track Details</h3>
        <button onClick={onClose} className="text-ink-dim hover:text-ink" title="Close details">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Artwork with Overlay */}
      <div className="shrink-0 aspect-square relative bg-linear-to-br from-accent/20 to-[#ec4899]/20 overflow-hidden">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={title || "Cover art"}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-24 h-24 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* Gradient Overlay for Text — only needed to keep the info overlay legible over a photo; without cover art the tinted background is already dark enough. */}
        {track.coverUrl && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
        )}

        {/* Favoriet Overlay (Top Right) */}
        {track.status === "done" && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              onClick={() => handleRating("up")}
              disabled={ratingLoading}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                currentRating === "up"
                  ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                  : "bg-black/40 text-ink-muted border border-line hover:bg-black/60 hover:text-ink"
              }`}
              title="Favoriet"
              aria-label={currentRating === "up" ? "Remove from Favorieten" : "Add to Favorieten"}
            >
              <svg className="w-4 h-4" fill={currentRating === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </button>
          </div>
        )}

        {/* Info Overlay (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col justify-end z-10">
          <h2 className="text-xl font-bold text-ink drop-shadow-md leading-tight">{title}</h2>
          <p className="text-sm text-ink-muted mt-1.5 drop-shadow-sm font-medium">
            {artistLabel}{writerLabel ? ` · writer: ${writerLabel}` : ""}{composerLabel ? ` · composer: ${composerLabel}` : ""}
            {displayDuration && (
              <span className="ml-1.5 text-ink-muted">• {formatDuration(displayDuration)}</span>
            )}
            {track.language && (
              <span className="ml-1.5 text-ink-muted">• {track.language}</span>
            )}
            {generatorLabel && (
              <span className="ml-1.5 text-ink-muted" title={track.providerModel || undefined}>
                • {generatorLabel}
              </span>
            )}
            {generationTime && (
              <span className="ml-1.5 text-ink-muted" title="Time from generation start to completion">
                • generated in {generationTime}
              </span>
            )}
          </p>
          {mode === "overlay" && promptFirstLine && (
            <div className="mt-3  border border-line bg-black/35 px-3 py-2 backdrop-blur-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-dim">Prompt</span>
                <button
                  type="button"
                  onClick={() => handleCopy(track.prompt, "prompt-overlay")}
                  className="rounded p-1 text-ink-dim transition-colors hover:bg-white/10 hover:text-ink-muted"
                  title="Copy prompt"
                >
                  {copiedField === "prompt-overlay" ? (
                    <svg className="h-3.5 w-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="truncate text-sm leading-relaxed text-ink/75">{promptFirstLine}</p>
            </div>
          )}
          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isUploadedTrack && (
                <span className="inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-400/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-emerald-100 uppercase tracking-wider">
                  Uploaded file
                </span>
              )}
              {currentTrack?.id === track.id && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  isPlaying
                    ? "border-accent/40 bg-accent/20 text-accent"
                    : "border-line/20 bg-black/40 text-ink-muted"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-accent animate-[pulse_1.4s_ease-in-out_infinite]" : "bg-white/40"}`} />
                  {isPlaying ? "Now playing" : "Paused"}
                </span>
              )}
            </div>
            {currentWorkspace && (
              <span className="inline-flex items-center rounded-full border border-line/20 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-medium text-ink-muted max-w-[160px] truncate">
                {currentWorkspace.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details Container */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 py-5 space-y-6">

        {/* Sidebar-only tabs: the track's own content (lyrics + prompt) or
            the autoplay queue. The now-playing panel is the one place both
            make sense; a track overlay has no meaningful queue context. */}
        {isNowPlayingPanel && (
          <nav className="shrink-0 flex items-center gap-6 border-b border-line" aria-label="Track details views">
            {([["lyrics", "Lyrics"], ["queue", `Queue${queue.length > 0 ? ` · ${queue.length}` : ""}`]] as const).map(([tabId, label]) => (
              <button
                key={tabId}
                type="button"
                onClick={() => setDetailTab(tabId)}
                className={`relative pb-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                  detailTab === tabId ? "text-ink" : "text-ink-dim hover:text-ink-muted"
                }`}
              >
                {label}
                {detailTab === tabId && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
                )}
              </button>
            ))}
          </nav>
        )}

        {showQueueTab ? (
          <section className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-ink-dim uppercase tracking-wider">
                Queue · {queue.length}
              </h4>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="rounded px-2 py-1 text-[11px] text-ink-dim transition-colors hover:bg-white/10 hover:text-ink-muted"
                  title="Clear the queue (playback of the current track continues)"
                >
                  Clear
                </button>
              )}
            </div>
            {queue.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center">
                <svg className="h-6 w-6 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10" />
                </svg>
                <p className="text-sm text-ink-dim">Nothing queued yet.</p>
                <p className="text-xs text-ink-dim">Use "Add to queue" on any track card.</p>
              </div>
            ) : (
              <ul className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                {queue.map((item, index) => {
                  const thumb = item.coverUrl || (item.s3KeyCover ? `/api/tracks/${item.id}/cover` : null);
                  const artistLabel = (item.artistName || "").trim();
                  const itemTitle = (item.title || item.prompt?.substring(0, 50) || "Untitled").replace(/\s*\(2\)\s*$/, "");
                  const isDropBefore = queueDropTarget?.id === item.id && queueDropTarget.before;
                  const isDropAfter = queueDropTarget?.id === item.id && !queueDropTarget.before;
                  return (
                    <li
                      key={`${item.id}-${index}`}
                      draggable
                      onDragStart={(e: DragEvent<HTMLLIElement>) => {
                        // Plain text keeps native drag from complaining in
                        // Firefox (it refuses drops without data set).
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", item.id);
                        queueDragIdRef.current = item.id;
                        setQueueDropTarget(null);
                      }}
                      onDragOver={(e: DragEvent<HTMLLIElement>) => {
                        if (queueDragIdRef.current == null) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const before = e.clientY < rect.top + rect.height / 2;
                        const target = { id: item.id, before };
                        setQueueDropTarget((prev) =>
                          prev && prev.id === target.id && prev.before === target.before ? prev : target
                        );
                      }}
                      onDragEnd={() => {
                        queueDragIdRef.current = null;
                        setQueueDropTarget(null);
                      }}
                      onDrop={(e: DragEvent<HTMLLIElement>) => {
                        e.preventDefault();
                        const dragId = queueDragIdRef.current;
                        const dropBefore = queueDropTarget?.id === item.id ? queueDropTarget.before : true;
                        let insert = index;
                        if (!dropBefore) insert += 1;
                        if (dragId) reorderQueueItem(dragId, insert);
                        queueDragIdRef.current = null;
                        setQueueDropTarget(null);
                      }}
                      className={`group flex items-center gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-white/[0.04] ${
                        queueDragIdRef.current === item.id ? "opacity-40" : ""
                      } ${
                        isDropBefore
                          ? "shadow-[inset_0_2px_0_rgba(255,133,80,0.9)]"
                          : isDropAfter
                          ? "shadow-[inset_0_-2px_0_rgba(255,133,80,0.9)]"
                          : ""
                      }`}
                    >
                      <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-ink-dim">{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => playQueueItem(item.id)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        title="Play now"
                      >
                        {thumb ? (
                          <img src={thumb} alt="" loading="lazy" decoding="async" className="h-8 w-8 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/[0.06]">
                            <svg className="h-4 w-4 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                            </svg>
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{itemTitle}</span>
                          {artistLabel && (
                            <span className="block truncate text-[11px] text-ink-dim">{artistLabel}</span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(item.id)}
                        className="shrink-0 rounded p-1 text-ink-dim opacity-0 transition-all hover:bg-white/10 hover:text-ink group-hover:opacity-100"
                        title="Remove from queue"
                        aria-label={`Remove ${itemTitle} from queue`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
        <>

        {/* Lyrics */}
        {(track.lyrics || resolvedAllowLyricsEdit) && (
          <div className={lyricsEdit.lyricsExpanded ? "flex-1 flex flex-col min-h-0 overflow-hidden" : "shrink-0"}>
            <div className="shrink-0 flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => lyricsEdit.setLyricsExpanded((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-ink-dim uppercase tracking-wider hover:text-ink-muted transition-colors"
                title={lyricsEdit.lyricsExpanded ? "Collapse lyrics" : "Expand lyrics"}
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${lyricsEdit.lyricsExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Lyrics {lyricsSync.hasTimings && <span className="text-[10px] text-blue-400 font-medium px-1.5 py-0.5 rounded border border-blue-400/20 bg-blue-400/5 normal-case ml-1.5">TCL synced</span>}
              </button>
              <div className="flex items-center gap-1">
                {resolvedAllowLyricsEdit && !lyricsEdit.lyricsEditing && (
                  <button
                    type="button"
                    onClick={lyricsEdit.startEditingLyrics}
                    className="rounded px-2 py-1 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors"
                    title={track.lyrics ? "Edit lyrics" : "Add lyrics"}
                  >
                    {track.lyrics ? "Edit" : "Add"}
                  </button>
                )}
                {resolvedAllowLyricsEdit && lyricsEdit.lyricsEditing && (
                  <>
                    <button
                      type="button"
                      onClick={lyricsEdit.cancelEditingLyrics}
                      className="rounded px-2 py-1 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors"
                      disabled={lyricsEdit.lyricsSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={lyricsEdit.handleSaveLyrics}
                      className="rounded px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors disabled:opacity-60"
                      disabled={lyricsEdit.lyricsSaving}
                    >
                      {lyricsEdit.lyricsSaving ? "Saving..." : "Save"}
                    </button>
                    {lyricsEdit.lyricsSaveError && (
                      <span className="text-[11px] text-red-400" title={lyricsEdit.lyricsSaveError}>⚠ {lyricsEdit.lyricsSaveError}</span>
                    )}
                  </>
                )}
                {track.lyrics && !lyricsEdit.lyricsEditing && (
                  <button
                    onClick={() => handleCopy(track.lyrics!, "lyrics")}
                    className="p-1 rounded hover:bg-white/10 text-ink-dim hover:text-ink-muted transition-colors"
                    title="Copy lyrics"
                  >
                    {copiedField === "lyrics" ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                )}
                {track.lyrics && !lyricsEdit.lyricsEditing && track.translatedLyrics && (
                  <button
                    type="button"
                    onClick={() => translation.setShowingTranslation((v) => !v)}
                    className="rounded px-2 py-1 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors"
                    title={translation.showingTranslation ? "Show original lyrics" : `Show ${track.translatedLanguage ?? "translated"} lyrics`}
                  >
                    {translation.showingTranslation ? "Original" : track.translatedLanguage ?? "Translated"}
                  </button>
                )}
                {isAdmin && track.lyrics && !lyricsEdit.lyricsEditing && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => track.language && translation.setTranslateMenuOpen((v) => !v)}
                      disabled={!track.language || translation.translating}
                      className="rounded px-2 py-1 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                      title={track.language ? "Translate lyrics" : "Set a language first (see the auto-detected language above, or edit the track)"}
                    >
                      {translation.translating ? "Translating..." : "Translate"}
                    </button>
                    {translation.translateMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-40 max-h-56 overflow-y-auto  border border-line bg-surface shadow-xl py-1">
                        {TRANSLATE_LANGUAGES.filter((lang) => lang !== track.language).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => translation.handleTranslateLyrics(lang)}
                            className="block w-full px-3 py-1.5 text-left text-[12px] text-ink-muted hover:bg-white/10 hover:text-ink transition-colors"
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {translation.translateError && (
              <p className="shrink-0 mb-2 text-[11px] text-red-400">⚠ {translation.translateError}</p>
            )}
            {lyricsEdit.lyricsExpanded && (lyricsEdit.lyricsEditing ? (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <textarea
                  value={lyricsEdit.lyricsDraft}
                  onChange={(event) => lyricsEdit.setLyricsDraft(event.target.value)}
                  placeholder="Add or edit lyrics here"
                  className="h-full w-full resize-none  border border-line bg-surface px-3 py-2 text-sm text-ink-muted outline-none focus:border-line/30"
                  maxLength={20000}
                  disabled={lyricsEdit.lyricsSaving}
                />
              </div>
            ) : track.lyrics ? (translation.showingTranslation && track.translatedLyrics) ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <pre className="h-full overflow-y-auto text-sm text-ink-muted whitespace-pre-wrap leading-relaxed font-mono px-1 py-2 pb-16 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]">{track.translatedLyrics}</pre>
              </div>
            ) : lyricsSync.hasTimings ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <div
                  ref={lyricsSync.containerRef}
                  className="h-full overflow-y-auto px-3 pt-3 pb-16 scroll-smooth space-y-4 relative [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]"
                >
                  {lyricsSync.parsedLyrics.map((line, index) => {
                    const isActive = index === lyricsSync.activeLineIndex;
                    const isPlayed = index < lyricsSync.activeLineIndex;
                    const isTrackPlaying = currentTrack?.id === track.id;

                    return (
                      <div
                        key={index}
                        ref={isActive ? lyricsSync.sidebarActiveLineRef : null}
                        onClick={() => lyricsSync.handleLineClick(line.startTime)}
                        className={`transition-all duration-300 leading-relaxed py-0.5 ${
                          isTrackPlaying ? "cursor-pointer" : ""
                        } ${
                          isActive
                            ? "text-accent font-bold scale-[1.02] filter drop-shadow-[0_0_8px_rgba(255,133,80,0.45)] opacity-100"
                            : isPlayed
                            ? "text-ink-dim font-medium"
                            : "text-ink-dim font-medium hover:text-ink-dim"
                        }`}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden">
                <pre className="h-full overflow-y-auto text-sm text-ink-muted whitespace-pre-wrap leading-relaxed font-mono px-1 py-2 pb-16 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]">{track.lyrics}</pre>
              </div>
            ) : (
              <div className=" border border-dashed border-line bg-white/2 px-3 py-3 text-sm text-ink-dim">
                {track.instrumental ? "Instrumental track — no lyrics." : "No lyrics yet."}
              </div>
            ))}
          </div>
        )}

        {/* Prompt — shown to every role when there's actual content; public
            tracks never carry a prompt (see PublicTrackSummary) so this
            naturally stays hidden there unless the viewer is an admin, who
            can add one via Edit. */}
        {(track.prompt || isAdmin) && (
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => prompt.setPromptExpanded((value) => !value)}
              className="flex items-center gap-2 text-sm font-medium text-ink-dim uppercase tracking-wider hover:text-ink-muted transition-colors"
              title={prompt.promptExpanded ? "Collapse prompt" : "Expand prompt"}
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${prompt.promptExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Prompt
            </button>
            <div className="flex items-center gap-1">
              {canEditPrompt && !prompt.promptEditing && (
                <button
                  type="button"
                  onClick={prompt.startEditingPrompt}
                  className="rounded px-2 py-1 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors"
                  title="Edit prompt"
                >
                  Edit
                </button>
              )}
              {canEditPrompt && prompt.promptEditing && (
                <>
                  <button
                    type="button"
                    onClick={prompt.cancelEditingPrompt}
                    className="rounded px-2 py-1 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink-muted transition-colors"
                    disabled={prompt.promptSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={prompt.handleSavePrompt}
                    className="rounded px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors disabled:opacity-60"
                    disabled={prompt.promptSaving || !prompt.promptDraftIsValid}
                  >
                    {prompt.promptSaving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
              {!prompt.promptEditing && (
                <button
                  onClick={() => handleCopy(track.prompt, "prompt")}
                  className="p-1 rounded hover:bg-white/10 text-ink-dim hover:text-ink-muted transition-colors"
                  title="Copy prompt"
                >
                  {copiedField === "prompt" ? (
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
          {prompt.promptEditing ? (
            <div className="space-y-2">
              <textarea
                value={prompt.promptDraft}
                onChange={(event) => prompt.setPromptDraft(event.target.value)}
                placeholder="Add or edit the upload prompt"
                className="h-32 w-full resize-none  border border-line bg-surface px-3 py-2 text-sm text-ink-muted outline-none focus:border-line/30"
                maxLength={10000}
                disabled={prompt.promptSaving}
              />
              {!prompt.promptDraftIsValid && (
                <p className="text-sm text-red-300/80">Prompt is required for uploaded tracks.</p>
              )}
            </div>
          ) : prompt.promptExpanded ? (
            <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">{track.prompt}</p>
          ) : (
            <p className="text-sm text-ink-dim leading-relaxed line-clamp-2">
              {track.prompt}
            </p>
          )}
        </div>
        )}
        </>
        )}

        {/* Error */}
        {track.error && (
          <div className="shrink-0 p-3 bg-red-500/10 border border-red-500/20 ">
            <p className="text-sm text-red-400">{track.error}</p>
          </div>
        )}

      </div>
    </div>
  );

  if (mode === "sidebar") {
    return (
      <div className="h-full w-full bg-canvas overflow-hidden">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-canvas border-l border-line overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    </div>
  );
}
