"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore, usePlayerStore, useWorkspaceStore } from "@/lib/store";
import { formatGenerationTime } from "@/lib/track-utils";
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

export default function TrackDetail({ track: initialTrack, onClose, onPlay, onDownload, mode = "overlay", allowLyricsEdit = false, onTrackUpdated }: TrackDetailProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const { user, loadUser } = useUserStore();
  const { currentTrack, isPlaying, audioElement } = usePlayerStore();
  const workspaces = useWorkspaceStore((state) => state.workspaces);

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
  const providerLabelBase = isUploadedTrack ? "Upload" : track.provider;
  const providerLabel = (() => {
    const normalized = providerLabelBase.toLowerCase();
    if (normalized === "poyo") return "PoYo";
    if (normalized === "tempolor") return "Tempolor";
    if (normalized === "apiframe") return "APIFrame";
    if (normalized === "musicgpt") return "MusicGPT";
    if (normalized === "lyria") return "Lyria";
    if (normalized === "minimax") return "MiniMax";
    if (!providerLabelBase) return "";
    return providerLabelBase[0].toUpperCase() + providerLabelBase.slice(1);
  })();
  const providerModelLabel = isUploadedTrack ? "Local file" : track.providerModel;
  const canEditPrompt = isUploadedTrack;
  const currentWorkspace = workspaces.find((w) => !w.isDefault && w.trackIds.includes(track.id)) ?? null;

  const displayDuration = track.duration
    ?? (currentTrack?.id === track.id && audioElement && isFinite(audioElement.duration) && audioElement.duration > 0
      ? Math.round(audioElement.duration)
      : null);

  const generationTime = formatGenerationTime(track.createdAt, track.completedAt);

  function formatDuration(seconds: number | null): string {
    if (!seconds || seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0d0d12]/95 backdrop-blur-sm border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60">Track Details</h3>
        <button onClick={onClose} className="text-white/50 hover:text-white" title="Close details">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Artwork with Overlay */}
      <div className="shrink-0 aspect-square relative bg-linear-to-br from-primary-500/20 to-[#ec4899]/20 overflow-hidden">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={title || "Cover art"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-24 h-24 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* Gradient Overlay for Text — only needed to keep the info overlay legible over a photo; without cover art the tinted background is already dark enough. */}
        {track.coverUrl && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
        )}

        {/* Rating Overlay (Top Right) */}
        {track.status === "done" && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              onClick={() => handleRating("up")}
              disabled={ratingLoading}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                currentRating === "up"
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-black/40 text-white/70 border border-white/10 hover:bg-black/60 hover:text-white"
              }`}
              title="Thumbs up"
              aria-label="Rate track positive"
            >
              <svg className="w-4 h-4" fill={currentRating === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>
            <button
              onClick={() => handleRating("down")}
              disabled={ratingLoading}
              className={`p-2 rounded-full backdrop-blur-md transition-all duration-200 ${
                currentRating === "down"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-black/40 text-white/70 border border-white/10 hover:bg-black/60 hover:text-white"
              }`}
              title="Thumbs down"
              aria-label="Rate track negative"
            >
              <svg className="w-4 h-4" fill={currentRating === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </div>
        )}

        {/* Info Overlay (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col justify-end z-10">
          <h2 className="text-xl font-bold text-white drop-shadow-md leading-tight">{title}</h2>
          <p className="text-sm text-white/80 mt-1.5 drop-shadow-sm font-medium">
            {artistLabel ? `${artistLabel} — ` : ""}{composerLabel ? `composer: ${composerLabel} — ` : ""}{writerLabel ? `writer: ${writerLabel} — ` : ""}{providerLabel} • {providerModelLabel}
            {displayDuration && (
              <span className="ml-1.5 text-white/60">• {formatDuration(displayDuration)}</span>
            )}
            {track.language && (
              <span className="ml-1.5 text-white/60">• {track.language}</span>
            )}
            {generationTime && (
              <span className="ml-1.5 text-white/60" title="Time from generation start to completion">
                • generated in {generationTime}
              </span>
            )}
          </p>
          {mode === "overlay" && promptFirstLine && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">Prompt</span>
                <button
                  type="button"
                  onClick={() => handleCopy(track.prompt, "prompt-overlay")}
                  className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
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
              <p className="truncate text-sm leading-relaxed text-white/75">{promptFirstLine}</p>
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
                    ? "border-primary-500/40 bg-primary-500/20 text-primary-200"
                    : "border-white/20 bg-black/40 text-white/60"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-primary-400 animate-[pulse_1.4s_ease-in-out_infinite]" : "bg-white/40"}`} />
                  {isPlaying ? "Now playing" : "Paused"}
                </span>
              )}
            </div>
            {currentWorkspace && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-medium text-white/80 max-w-[160px] truncate">
                {currentWorkspace.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details Container */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 py-5 space-y-6">

        {/* Lyrics */}
        {(track.lyrics || allowLyricsEdit) && (
          <div className={lyricsEdit.lyricsExpanded ? "flex-1 flex flex-col min-h-0 overflow-hidden" : "shrink-0"}>
            <div className="shrink-0 flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => lyricsEdit.setLyricsExpanded((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
                title={lyricsEdit.lyricsExpanded ? "Collapse lyrics" : "Expand lyrics"}
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${lyricsEdit.lyricsExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Lyrics {lyricsSync.hasTimings && <span className="text-[10px] text-blue-400 font-medium px-1.5 py-0.5 rounded border border-blue-400/20 bg-blue-400/5 normal-case ml-1.5">TCL synced</span>}
              </button>
              <div className="flex items-center gap-1">
                {allowLyricsEdit && !lyricsEdit.lyricsEditing && (
                  <button
                    type="button"
                    onClick={lyricsEdit.startEditingLyrics}
                    className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
                    title={track.lyrics ? "Edit lyrics" : "Add lyrics"}
                  >
                    {track.lyrics ? "Edit" : "Add"}
                  </button>
                )}
                {allowLyricsEdit && lyricsEdit.lyricsEditing && (
                  <>
                    <button
                      type="button"
                      onClick={lyricsEdit.cancelEditingLyrics}
                      className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
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
                    className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
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
                    className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
                    title={translation.showingTranslation ? "Show original lyrics" : `Show ${track.translatedLanguage ?? "translated"} lyrics`}
                  >
                    {translation.showingTranslation ? "Original" : track.translatedLanguage ?? "Translated"}
                  </button>
                )}
                {track.lyrics && !lyricsEdit.lyricsEditing && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => track.language && translation.setTranslateMenuOpen((v) => !v)}
                      disabled={!track.language || translation.translating}
                      className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                      title={track.language ? "Translate lyrics" : "Set a language first (see the auto-detected language above, or edit the track)"}
                    >
                      {translation.translating ? "Translating..." : "Translate"}
                    </button>
                    {translation.translateMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-40 max-h-56 overflow-y-auto rounded-lg border border-white/12 bg-[#181920] shadow-xl py-1">
                        {TRANSLATE_LANGUAGES.filter((lang) => lang !== track.language).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => translation.handleTranslateLyrics(lang)}
                            className="block w-full px-3 py-1.5 text-left text-[12px] text-white/70 hover:bg-white/10 hover:text-white/90 transition-colors"
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
                  className="h-full w-full resize-none rounded-lg border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white/80 outline-none focus:border-white/30"
                  maxLength={20000}
                  disabled={lyricsEdit.lyricsSaving}
                />
              </div>
            ) : track.lyrics ? (translation.showingTranslation && track.translatedLyrics) ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <pre className="h-full overflow-y-auto text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-mono px-1 py-2 pb-16 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]">{track.translatedLyrics}</pre>
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
                            ? "text-primary-400 font-bold scale-[1.02] filter drop-shadow-[0_0_8px_rgba(255,133,80,0.45)] opacity-100"
                            : isPlayed
                            ? "text-white/50 font-medium"
                            : "text-white/25 font-medium hover:text-white/50"
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
                <pre className="h-full overflow-y-auto text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-mono px-1 py-2 pb-16 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]">{track.lyrics}</pre>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/12 bg-white/2 px-3 py-3 text-sm text-white/45">
                {track.instrumental ? "Instrumental track — no lyrics." : "No lyrics yet."}
              </div>
            ))}
          </div>
        )}

        {/* Prompt */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => prompt.setPromptExpanded((value) => !value)}
              className="flex items-center gap-2 text-sm font-medium text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
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
                  className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
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
                    className="rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
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
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
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
                className="h-32 w-full resize-none rounded-lg border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white/80 outline-none focus:border-white/30"
                maxLength={10000}
                disabled={prompt.promptSaving}
              />
              {!prompt.promptDraftIsValid && (
                <p className="text-sm text-red-300/80">Prompt is required for uploaded tracks.</p>
              )}
            </div>
          ) : prompt.promptExpanded ? (
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{track.prompt}</p>
          ) : (
            <p className="text-sm text-white/40 leading-relaxed line-clamp-2">
              {track.prompt}
            </p>
          )}
        </div>

        {/* Error */}
        {track.error && (
          <div className="shrink-0 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{track.error}</p>
          </div>
        )}

      </div>
    </div>
  );

  if (mode === "sidebar") {
    return (
      <div className="h-full w-full bg-[#0d0d12] overflow-hidden">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md bg-[#0d0d12] border-l border-white/5 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    </div>
  );
}
