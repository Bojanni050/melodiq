"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/tracks/ConfirmDialog";
import { isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import useSWR from "swr";
import { usePlayerStore, useWorkspaceStore, useSelectionStore, useUserStore, usePlaylistStore, useArchiveLinksStore, useReleaseStore, type Workspace } from "@/lib/store";
import { useRouter } from "next/navigation";
import { formatTrackDateTime, formatGenerationTime } from "@/lib/track-utils";
import type { PlaylistOption, TrackItem } from "@/components/tracks/types";
import { STEM_TYPES } from "@/lib/stem-types";
import { MASTER_VARIATIONS } from "@/lib/master-types";
import { withCdn } from "@/lib/cdn-client";
import { useSWRConfig } from "swr";

// Extracted Sub-components
import AlreadyInPlaylistDialog from "./AlreadyInPlaylistDialog";
import CreatePlaylistDialog from "./CreatePlaylistDialog";
import PlaylistPickerDialog from "./PlaylistPickerDialog";
import ReleasePickerDialog from "./ReleasePickerDialog";
import DuplicatePlaylistDialog from "./DuplicatePlaylistDialog";
import LinkToArchiveDialog from "./LinkToArchiveDialog";
import MergeWorkspaceDialog from "./MergeWorkspaceDialog";
import MoveToWorkspaceDialog from "./MoveToWorkspaceDialog";
import TrackPlayButton from "./TrackPlayButton";
import TrackRating from "./TrackRating";
import TrackActionMenu from "./TrackActionMenu";
import TrackDnaPanel from "./TrackDnaPanel";
import SectionReplaceEditor from "./SectionReplaceEditor";

import { useTrackInlineEdit } from "./useTrackInlineEdit";
import { useTrackCardActions } from "./useTrackCardActions";
import StemRow from "./StemRow";
import MasterRow from "./MasterRow";

async function settingsFetcher(url: string): Promise<Record<string, string>> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(res.statusText || "Request failed");
  return res.json();
}

const TrackCard = memo(function TrackCard({
  track,
  onPlay,
  onSelect,
  onDelete,
  onDeleteTracks,
  onReusePrompt,
  onAddToQueue,
  onAddToPlaylist,
  onMoveToWorkspace: onMoveToWorkspaceProp,
  playlists,
  tracksById,
  onTitleUpdate,
  workspaceById: workspaceByIdProp,
  orderedWorkspaceOptions: orderedWorkspaceOptionsProp,
  workspaceDisplayNameById: workspaceDisplayNameByIdProp,
  workspaceCoverById: workspaceCoverByIdProp,
  onToggleSelection,
  onEditDetails,
  isDetailSelected = false,
  isOwner = true,
}: {
  track: TrackItem;
  onPlay: (track: TrackItem) => void;
  onSelect: (track: TrackItem) => void;
  onDelete?: (trackId: string) => void;
  onDeleteTracks?: (trackIds: string[]) => Promise<void> | void;
  onReusePrompt?: (track: TrackItem) => void;
  onAddToQueue?: (track: TrackItem) => void;
  onAddToPlaylist?: (
    trackId: string,
    playlistId: string,
    options?: { allowDuplicate?: boolean }
  ) => void;
  onMoveToWorkspace?: (trackId: string, workspaceId: string) => void;
  playlists?: PlaylistOption[];
  tracksById?: Map<string, TrackItem>;
  onTitleUpdate?: (trackId: string, newTitle: string) => void;
  workspaceById?: Map<string, Workspace>;
  orderedWorkspaceOptions?: { workspace: Workspace; depth: number }[];
  workspaceDisplayNameById?: Map<string, string>;
  workspaceCoverById?: Map<string, string | null>;
  onToggleSelection?: (trackId: string, shiftKey: boolean) => void;
  onEditDetails?: (track: TrackItem) => void;
  isDetailSelected?: boolean;
  isOwner?: boolean;
}) {
  const isSelected = useSelectionStore((state) => state.selectedIds.has(track.id));
  const user = useUserStore((state) => state.user);
  const isListenerRole = user?.role === "listener" || user?.role == null;
  const artistAlias = useUserStore((state) => state.user?.artistAlias);
  const allPlaylists = usePlaylistStore((state) => state.playlists);
  const setSelectedPlaylistId = usePlaylistStore((state) => state.setSelectedPlaylistId);
  const router = useRouter();
  const trackPlaylist = useMemo(
    () => allPlaylists.find((p) => p.trackIds.includes(track.id)) ?? null,
    [allPlaylists, track.id]
  );
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const archiveLinkKind = useArchiveLinksStore((state) => state.links[track.id]);
  const releases = useReleaseStore((state) => state.releases);
  const isInRelease = useMemo(
    () => releases.some((r) => r.tracks.some((t) => t.trackId === track.id)),
    [releases, track.id]
  );
  const loadArchiveLinks = useArchiveLinksStore((state) => state.load);
  useEffect(() => {
    loadArchiveLinks();
  }, [loadArchiveLinks]);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const isCurrentlyPlaying = currentTrack?.id === track.id;
  const playClickCooldownRef = useRef(0);

  const [optimisticPlayCount, setOptimisticPlayCount] = useState(track.playCount ?? 0);
  const [optimisticOthersPlayCount, setOptimisticOthersPlayCount] = useState(track.othersPlayCount ?? 0);
  const [dnaOpen, setDnaOpen] = useState(false);
  // Keep the panel in the DOM after first open so the fetch doesn't repeat
  // every time the card is toggled — the animation wrapper hides it instead.
  const [dnaMounted, setDnaMounted] = useState(false);
  useEffect(() => { if (dnaOpen) setDnaMounted(true); }, [dnaOpen]);
  const [stemsOpen, setStemsOpen] = useState(false);
  const [stemsMounted, setStemsMounted] = useState(false);
  useEffect(() => { if (stemsOpen) setStemsMounted(true); }, [stemsOpen]);
  const [masteringOpen, setMasteringOpen] = useState(false);
  const [masteringMounted, setMasteringMounted] = useState(false);
  useEffect(() => { if (masteringOpen) setMasteringMounted(true); }, [masteringOpen]);
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const [editSectionMounted, setEditSectionMounted] = useState(false);
  useEffect(() => { if (editSectionOpen) setEditSectionMounted(true); }, [editSectionOpen]);
  const { mutate } = useSWRConfig();
  const [showLinkToArchiveDialog, setShowLinkToArchiveDialog] = useState(false);
  const [reanalyzingAudio, setReanalyzingAudio] = useState(false);
  const [dnaRefreshKey, setDnaRefreshKey] = useState(0);
  const [retryingWav, setRetryingWav] = useState(false);
  const [retryWavResult, setRetryWavResult] = useState<"success" | "error" | null>(null);
  const [convertingOgg, setConvertingOgg] = useState(false);
  const [convertOggResult, setConvertOggResult] = useState<"success" | "error" | null>(null);
  const [togglingPublish, setTogglingPublish] = useState(false);
  const [generatingTcl, setGeneratingTcl] = useState(false);
  const [tclError, setTclError] = useState<string | null>(null);
  const { data: appSettings } = useSWR<Record<string, string>>("/api/settings", settingsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
  const tclAutoJumpToEditor = appSettings?.TCL_AUTO_JUMP_EDITOR !== "false";

  function failTclGeneration(message: string) {
    setGeneratingTcl(false);
    setTclError(message);
    setTimeout(() => setTclError(null), 5000);
  }

  async function handleGenerateTclClick() {
    setGeneratingTcl(true);
    setTclError(null);
    try {
      const res = await fetch(`/api/tracks/${track.id}/generate-tcl`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        failTclGeneration(body?.error || "Time-coded lyrics generation failed");
        return;
      }
    } catch (error) {
      console.error("Failed to start time-coded lyrics generation:", error);
      failTclGeneration("Network error — could not reach the server.");
      return;
    }

    // QuickLRC alignment runs in the background (can take up to ~90s) — poll
    // trackAlignments.status instead of blocking on the HTTP request, which
    // would otherwise risk tripping a reverse-proxy gateway timeout.
    const startedAt = Date.now();
    const poll = async () => {
      if (Date.now() - startedAt > 180_000) {
        failTclGeneration("Time-coded lyrics generation is taking longer than expected — check back shortly.");
        return;
      }
      try {
        const res = await fetch(`/api/tracks/${track.id}/generate-tcl`);
        const data = await res.json().catch(() => null);
        if (data?.status === "done") {
          setGeneratingTcl(false);
          void mutate("/api/tracks");
          window.dispatchEvent(new CustomEvent("tracks-changed"));
          if (tclAutoJumpToEditor) router.push(`/timecoded-editor/${track.id}`);
          return;
        }
        if (data?.status === "failed") {
          failTclGeneration(data?.error || "Time-coded lyrics generation failed");
          return;
        }
      } catch {
        // transient network hiccup — keep polling rather than aborting the wait
      }
      setTimeout(poll, 4000);
    };
    setTimeout(poll, 4000);
  }

      async function handleReanalyzeAudio() {
        setReanalyzingAudio(true);
        try {
          const res = await fetch(`/api/tracks/${track.id}/reanalyze-audio`, { method: "POST" });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            console.error(`Failed to re-analyze audio: HTTP ${res.status}`, body);
            return;
          }
          setDnaRefreshKey((key) => key + 1);
        } catch (error) {
          console.error("Failed to re-analyze audio:", error);
        } finally {
          setReanalyzingAudio(false);
        }
      }

      const [advancedDnaRunning, setAdvancedDnaRunning] = useState(false);
      const [advancedDnaResult, setAdvancedDnaResult] = useState<{ summary: string | null; lyricsAnalysis: string | null; compositionAnalysis: string | null; tips: string[] } | null>(() => {
        if (!track.advancedDna) return null;
        try { return JSON.parse(track.advancedDna); } catch { return null; }
      });

      async function handleAdvancedDna() {
        setAdvancedDnaRunning(true);
        try {
          const url = advancedDnaResult
            ? `/api/tracks/${track.id}/analyze-advanced?refresh=true`
            : `/api/tracks/${track.id}/analyze-advanced`;
          const res = await fetch(url, { method: "POST" });
          if (!res.ok) return;
          const data = await res.json();
          setAdvancedDnaResult(data);
          setDnaRefreshKey((key) => key + 1);
        } catch (error) {
          console.error("Failed advanced DNA analysis:", error);
        } finally {
          setAdvancedDnaRunning(false);
        }
      }

      async function handleRetryWav() {
        setRetryingWav(true);
        setRetryWavResult(null);
    try {
      const res = await fetch("/api/tracks/retry-wav", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.retried) {
        console.error(`Failed to retry WAV: HTTP ${res.status}`, body);
        setRetryWavResult("error");
      } else {
        setRetryWavResult("success");
      }
    } catch (error) {
      console.error("Failed to retry WAV:", error);
      setRetryWavResult("error");
    } finally {
      setRetryingWav(false);
      setTimeout(() => setRetryWavResult(null), 4000);
    }
  }

  async function handleConvertOgg() {
    setConvertingOgg(true);
    setConvertOggResult(null);
    try {
      const res = await fetch(`/api/tracks/${track.id}/convert-ogg`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        console.error(`Failed to convert to OGG: HTTP ${res.status}`, body);
        setConvertOggResult("error");
      } else {
        setConvertOggResult("success");
        mutate((key: any) => typeof key === "string" && key.startsWith("/api/tracks"), undefined, { revalidate: true });
        const cur = usePlayerStore.getState().currentTrack;
        if (cur && cur.id === track.id) {
          usePlayerStore.getState().setCurrentTrack({
            ...cur,
            s3KeyOgg: body.s3KeyOgg,
          });
        }
      }
    } catch (error) {
      console.error("Failed to convert to OGG:", error);
      setConvertOggResult("error");
    } finally {
      setConvertingOgg(false);
      setTimeout(() => setConvertOggResult(null), 4000);
    }
  }

  async function handleTogglePublish() {
    if (track.status !== "done") return;
    const isCurrentlyPublished = track.releaseStatus === "published";
    const nextStatus = isCurrentlyPublished ? "unpublished" : "published";
    const nextPublishDate = isCurrentlyPublished ? null : new Date().toISOString();
    setTogglingPublish(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseStatus: nextStatus,
          publishDate: nextPublishDate,
        }),
      });
      if (!res.ok) {
        console.error(`Failed to update publish status: HTTP ${res.status}`);
        return;
      }
      void mutate("/api/tracks");
      window.dispatchEvent(new CustomEvent("tracks-changed"));
    } catch (error) {
      console.error("Failed to toggle publish:", error);
    } finally {
      setTogglingPublish(false);
    }
  }

  async function handleArchive() {
    if (track.status !== "done") return;
    const trackTitle = track.title || track.prompt?.substring(0, 60) || "Deze track";
    const confirmArchive = window.confirm(
      `Weet je zeker dat je "${trackTitle}" wilt archiveren?\n\n` +
      `- Alleen de originele mp3 wordt bewaard (s3Key)\n` +
      `- De HD/WAV-versie, alle stems en alle masters worden permanently verwijderd van S3\n` +
      `- Track DNA en lyrics worden behouden`
    );
    if (!confirmArchive) return;
    try {
      const res = await fetch(`/api/tracks/${track.id}/archive`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        const message = body?.error || "Track kan niet gearchiveerd worden.";
        alert(message);
        return;
      }
      if (!res.ok) {
        console.error(`Failed to archive track: HTTP ${res.status}`);
        return;
      }
      void mutate("/api/tracks");
      window.dispatchEvent(new CustomEvent("tracks-changed"));
    } catch (error) {
      console.error("Failed to archive track:", error);
    }
  }

  useEffect(() => {
    setOptimisticPlayCount(track.playCount ?? 0);
  }, [track.playCount]);

  useEffect(() => {
    setOptimisticOthersPlayCount(track.othersPlayCount ?? 0);
  }, [track.othersPlayCount]);

  useEffect(() => {
    function handleTrackPlayed(event: Event) {
      const e = event as CustomEvent<{ trackId?: string; playCount?: number; othersPlayCount?: number }>;
      if (e.detail?.trackId !== track.id) return;
      const nextCount = e.detail?.playCount;
      const nextOthersCount = e.detail?.othersPlayCount;
      if (typeof nextCount === "number" && Number.isFinite(nextCount)) {
        setOptimisticPlayCount(nextCount);
      } else if (typeof nextOthersCount !== "number") {
        setOptimisticPlayCount((count) => Math.max(1, count + 1));
      }
      if (typeof nextOthersCount === "number" && Number.isFinite(nextOthersCount)) {
        setOptimisticOthersPlayCount(nextOthersCount);
      }
    }
    window.addEventListener("melodiq:track-played", handleTrackPlayed);
    return () => window.removeEventListener("melodiq:track-played", handleTrackPlayed);
  }, [track.id]);

  const edit = useTrackInlineEdit(track, onTitleUpdate);
  const actions = useTrackCardActions({ track, tracksById, onDelete, onDeleteTracks, onAddToPlaylist, onMoveToWorkspace: onMoveToWorkspaceProp });

  // Workspace derived data (computed once in TrackList and passed as props)
  const workspaces = useMemo(() => {
    return workspaceByIdProp ? Array.from(workspaceByIdProp.values()) : [];
  }, [workspaceByIdProp]);
  const workspaceById = useMemo(
    () => workspaceByIdProp ?? new Map(workspaces.map((w) => [w.id, w])),
    [workspaceByIdProp, workspaces]
  );
  const orderedWorkspaceOptions = useMemo(() => {
    if (orderedWorkspaceOptionsProp) return orderedWorkspaceOptionsProp;
    const roots = workspaces.filter((w) => !w.parentWorkspaceId);
    const childrenByParent = new Map<string, typeof workspaces>();
    workspaces.filter((w) => Boolean(w.parentWorkspaceId)).forEach((w) => {
      const parentId = w.parentWorkspaceId as string;
      childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), w]);
    });
    return roots.flatMap((root) => {
      const children = childrenByParent.get(root.id) ?? [];
      return [{ workspace: root, depth: 0 }, ...children.map((child) => ({ workspace: child, depth: 1 }))];
    });
  }, [orderedWorkspaceOptionsProp, workspaces]);
  const workspaceDisplayNameById = useMemo(() => {
    if (workspaceDisplayNameByIdProp) return workspaceDisplayNameByIdProp;
    const map = new Map<string, string>();
    workspaces.forEach((w) => {
      if (!w.parentWorkspaceId) { map.set(w.id, w.name); return; }
      const parentName = workspaceById.get(w.parentWorkspaceId)?.name;
      map.set(w.id, parentName ? `${parentName} / ${w.name}` : w.name);
    });
    return map;
  }, [workspaceDisplayNameByIdProp, workspaceById, workspaces]);
  // Unambiguous by construction: a workspace is only ever matched via
  // track.workspaceId — never by scanning trackIds membership.
  const assignedWorkspaceName = useMemo(() => {
    if (!track.workspaceId) return null;
    const assigned = workspaces.find((w) => !w.isDefault && w.id === track.workspaceId);
    return assigned?.name ?? null;
  }, [track.workspaceId, workspaces]);
  const workspaceCoverById = workspaceCoverByIdProp ?? new Map<string, string | null>();

  // Derived display values
  const playCount = optimisticPlayCount;
  const othersPlayCount = optimisticOthersPlayCount;
  const isNewUnplayed = track.status === "done" && playCount === 0;
  const statusConfig = {
    pending: { color: "bg-yellow-500/20 text-yellow-300", label: "Queued" },
    generating: { color: "bg-blue-500/20 text-blue-300", label: "Creating" },
    done: isNewUnplayed
      ? { color: "bg-yellow-500/20 text-yellow-300", label: "New" }
      : { color: "bg-green-500/20 text-green-300", label: "Ready" },
    failed: { color: "bg-red-500/20 text-red-300", label: "Failed" },
  };
  const baseStatus = statusConfig[track.status];
  const status = isCurrentlyPlaying
    ? isPlaying
      ? { color: "bg-primary-500/20 text-primary-200 border border-primary-500/30", label: "Now playing" }
      : { color: "bg-white/5 text-white/60 border border-white/10", label: "Paused" }
    : baseStatus;
  const statusAnimationClass = track.status === "generating" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : "";
  const createdAt = formatTrackDateTime(new Date(track.createdAt));
  const generationTime = formatGenerationTime(track.createdAt, track.completedAt);
  const title = (track.title || track.prompt.substring(0, 50)).replace(/\s*\(2\)\s*$/, "");
  const styleDesc = track.prompt.length > 80 ? track.prompt.substring(0, 80) + "..." : track.prompt;
  const mp3Label = (track.format ?? "mp3").toUpperCase();
  const hdLabel = track.formatHd ? track.formatHd.toUpperCase() : "HD";
  const isUploadedTrack = track.provider === "upload";
  const hasTcl = !!track.lyricsTimestamps && !isLyricsTaskSubmission(track.lyricsTimestamps);
  const canGenerateTcl = track.status === "done" && !!track.lyrics?.trim() && !!(track.audioUrl || track.s3KeyHd) && !hasTcl;
  const rawCoverUrl = actions.coverOverrideUrl ?? track.coverUrl ?? null;
  const effectiveCoverUrl = rawCoverUrl && (rawCoverUrl.startsWith("http") || rawCoverUrl.startsWith("/"))
    ? rawCoverUrl
    : null;
  const audioDna = useMemo<{ compositionScore?: number | null; lyricsScore?: number | null; tempo?: number | null } | null>(() => {
    if (!track.audioDna) return null;
    try {
      return JSON.parse(track.audioDna);
    } catch {
      return null;
    }
  }, [track.audioDna]);
  const hasLyricsAnalysis = audioDna?.lyricsScore != null;
  const bpm = audioDna?.tempo ?? null;
  const generationCompletedOn = track.status === "done" && track.completedAt
    ? new Date(track.completedAt).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  const effectiveThumbUrl = actions.coverOverrideUrl
    ? `${actions.coverOverrideUrl}&thumb=1`
    : track.publicSource
      ? withCdn(`/api/discover/${track.id}/cover?thumb=1`)
      : track.s3KeyCoverThumb
        ? `/api/tracks/${track.id}/cover?thumb=1`
        : effectiveCoverUrl;
  const deleteCount = actions.pendingDeleteIds && actions.pendingDeleteIds.length > 0 ? actions.pendingDeleteIds.length : 1;
  const deleteMessage = deleteCount === 1
    ? "Delete this song? This cannot be undone."
    : `Delete ${deleteCount} selected songs? This cannot be undone.`;

  return (
    <>
      {actions.confirmDelete && (
        <ConfirmDialog
          message={deleteMessage}
          onConfirm={actions.executeDelete}
          onCancel={() => actions.setConfirmDelete(false)}
        />
      )}

      <CreatePlaylistDialog
        isOpen={actions.showCreatePlaylistDialog}
        onClose={() => actions.setShowCreatePlaylistDialog(false)}
        onCreate={actions.handleCreatePlaylist}
      />

      <MoveToWorkspaceDialog
        isOpen={actions.workspaceMenuOpen}
        onClose={() => actions.setWorkspaceMenuOpen(false)}
        track={track}
        orderedWorkspaceOptions={orderedWorkspaceOptions}
        workspaceCoverById={workspaceCoverById}
        workspaceDisplayNameById={workspaceDisplayNameById}
        workspaces={workspaces}
        onMoveToWorkspace={actions.handleMoveToWorkspace}
        onCreateWorkspace={actions.handleCreateWorkspace}
        onMergeWorkspaceTrigger={actions.handleMergeWorkspaceTrigger}
      />

      <DuplicatePlaylistDialog
        isOpen={actions.showDuplicatePlaylistDialog}
        onClose={() => {
          actions.setShowDuplicatePlaylistDialog(false);
          actions.setPendingPlaylistAdd(null);
        }}
        playlistName={actions.pendingPlaylistAdd?.name || ""}
        onConfirm={actions.confirmDuplicatePlaylistAdd}
      />

      <AlreadyInPlaylistDialog
        isOpen={actions.showAlreadyInPlaylistDialog}
        onClose={() => actions.setShowAlreadyInPlaylistDialog(false)}
        playlistName={actions.alreadyInPlaylistInfo?.playlistName ?? ""}
        duplicateTitles={(actions.alreadyInPlaylistInfo?.duplicateIds ?? []).map(
          (id) => tracksById?.get(id)?.title || id
        )}
        addedCount={actions.alreadyInPlaylistInfo?.addedCount ?? 0}
        onAddAnyway={actions.confirmAlreadyInPlaylistAdd}
      />

      <PlaylistPickerDialog
        isOpen={actions.showPlaylistPickerDialog}
        onClose={() => actions.setShowPlaylistPickerDialog(false)}
        track={track}
        onAddToPlaylist={actions.handleAddToPlaylistClick}
        onCreatePlaylistClick={() => {
          actions.setShowPlaylistPickerDialog(false);
          actions.setShowCreatePlaylistDialog(true);
        }}
        tracksById={tracksById}
      />

      <ReleasePickerDialog
        isOpen={actions.showReleasePickerDialog}
        onClose={() => actions.setShowReleasePickerDialog(false)}
        track={track}
        onAddToRelease={actions.handleAddToReleaseClick}
      />

      <LinkToArchiveDialog
        isOpen={showLinkToArchiveDialog}
        track={track}
        onClose={() => setShowLinkToArchiveDialog(false)}
      />

      <MergeWorkspaceDialog
        isOpen={actions.showMergeWorkspaceDialog}
        onClose={() => {
          actions.setShowMergeWorkspaceDialog(false);
          actions.setPendingWorkspaceMerge(null);
        }}
        workspaceName={actions.pendingWorkspaceMerge?.name || ""}
        onConfirm={actions.confirmWorkspaceMerge}
      />

      <div
        role="button"
        tabIndex={0}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400 focus-visible:outline-offset-1 ${
          isCurrentlyPlaying
            ? "bg-primary-500/20 border border-primary-500/25 border-l-4 border-l-primary-400 shadow-[0_0_0_1px_rgba(99,102,241,0.2)] pl-2"
            : isDetailSelected
              ? "bg-white/[0.11] border border-white/15"
              : track.status === "generating" || track.status === "pending"
                ? "bg-primary-600/5 border border-primary-600/20"
                : "hover:bg-white/5"
        } ${isCurrentlyPlaying ? `now-playing ${isPlaying ? "is-playing" : "is-paused"}` : ""}`}
        data-now-playing={isCurrentlyPlaying ? "true" : undefined}
        data-playing={isCurrentlyPlaying ? (isPlaying ? "true" : "false") : undefined}
        onClick={(e) => {
          if (e.shiftKey) { onToggleSelection?.(track.id, true); return; }
          onSelect(track);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (track.status === "done") onPlay(track);
            else onSelect(track);
          }
        }}
      >
        {/* Selection dot */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelection?.(track.id, e.shiftKey); }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
          title="Select track"
        >
          {isSelected ? (
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : isCurrentlyPlaying ? (
            <div className="w-4 h-4 rounded-full bg-primary-500/25 border border-primary-500/35 flex items-center justify-center animate-[pulse_1.8s_ease-in-out_infinite]">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-200" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 group-hover:border-white/40 transition-colors" />
          )}
        </button>

        {/* Play button / artwork */}
        <TrackPlayButton
          track={track}
          isCurrentlyPlaying={isCurrentlyPlaying}
          isPlaying={isPlaying}
          effectiveCoverUrl={effectiveCoverUrl}
          effectiveThumbUrl={effectiveThumbUrl}
          isAnalyzing={advancedDnaRunning}
          onPlayClick={() => {
            const now = Date.now();
            if (now - playClickCooldownRef.current < 350) return;
            playClickCooldownRef.current = now;
            if (isCurrentlyPlaying) {
              setIsPlaying(!isPlaying);
            } else {
              onPlay(track);
            }
          }}
        />

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 w-full">
            {isNewUnplayed && (
              <span
                className="h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_0_2px_rgba(253,224,71,0.25),0_0_10px_rgba(253,224,71,0.85)]"
                title="New track"
                aria-label="New unplayed track"
              />
            )}
            {edit.isEditingTitle ? (
              <div className="flex items-center gap-1 min-w-0 max-w-full" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={edit.titleInputRef}
                  type="text"
                  value={edit.editTitle}
                  onChange={(e) => edit.setEditTitle(e.target.value)}
                  onKeyDown={edit.handleTitleKeyDown}
                  onBlur={edit.discardTitle}
                  aria-label="Edit track title"
                  placeholder="Track title"
                  className="field-sizing-content w-auto min-w-[10ch] max-w-[55vw] sm:max-w-[40ch] text-sm font-medium bg-white/10 border border-primary-500/40 rounded px-2 py-0.5 focus:outline-none focus:border-primary-500"
                  maxLength={200}
                  draggable={false}
                  onDragStart={(e) => e.stopPropagation()}
                />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); edit.saveTitle(); }} className="shrink-0 p-0.5 text-green-400 hover:text-green-300 transition-colors" title="Save title (Enter)">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); edit.discardTitle(); }} className="shrink-0 p-0.5 text-red-400 hover:text-red-300 transition-colors" title="Discard changes (Esc)">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <h3
                className={`text-sm font-medium truncate cursor-text flex-1 min-w-[6rem] ${isCurrentlyPlaying ? "text-primary-200" : ""}`}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={edit.handleTitleDoubleClick}
                title="Double-click to edit"
              >
                {title}
              </h3>
            )}
            {advancedDnaResult && (
              <span
                className="shrink-0 text-xs leading-none"
                title="Advanced DNA analysis available"
                aria-label="Advanced DNA analysis available"
              >
                🧬
              </span>
            )}
            {hasLyricsAnalysis && (
              <span className="shrink-0 text-xs leading-none" title="Lyrics analysis available" aria-label="Lyrics analysis available">
                📝
              </span>
            )}
            {generatingTcl && (
              <span
                className="inline-flex shrink-0 items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-blue-300/30 bg-blue-400/10 text-blue-200"
                title="Generating time-coded lyrics — this can take a bit longer than usual"
                aria-label="Generating time-coded lyrics"
              >
                <span className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-blue-300 rounded-full animate-wave-bar" />
                  <span className="w-0.5 bg-blue-300 rounded-full animate-wave-bar animation-delay-150" />
                  <span className="w-0.5 bg-blue-300 rounded-full animate-wave-bar animation-delay-300" />
                </span>
                Generating TCL…
              </span>
            )}
            {archiveLinkKind && (
              <span
                className="shrink-0"
                title={archiveLinkKind === "original" ? "Master Tracks: single source of truth" : "Master Tracks: translation"}
              >
                <svg
                  className={`w-3.5 h-3.5 ${archiveLinkKind === "original" ? "text-amber-400" : "text-sky-400"}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 18h14l1.5-9-4.5 3-4-5-4 5-4.5-3L5 18zm-.5 2h15a.5.5 0 010 1h-15a.5.5 0 010-1z" />
                </svg>
              </span>
            )}
            <span className={`${status.label === "Ready" ? "hidden sm:inline-flex" : "inline-flex"} text-[10px] px-1.5 py-0.5 rounded ${status.color} ${statusAnimationClass} shrink-0`}>
              {status.label}
            </span>
            {track.status === "done" && (
              <span
                className={`hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                  isInRelease
                    ? "border border-green-300/30 bg-green-400/10 text-green-200"
                    : "border border-white/15 bg-white/[0.05] text-white/40"
                }`}
              >
                {isInRelease ? "Released" : "Unreleased"}
              </span>
            )}
            {track.status === "done" && track.lyricsTimestamps && !isLyricsTaskSubmission(track.lyricsTimestamps) && (
              <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded border border-blue-300/30 bg-blue-400/10 text-blue-200 shrink-0 font-medium cursor-help" title="timecodedlyrics">TCL</span>
            )}
            {track.instrumental && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-violet-300/30 bg-violet-400/10 text-violet-200 shrink-0" title="No vocals">Instrumental</span>
            )}
            {track.isCollaboration && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 shrink-0" title="Made together with another artist">Collaboration</span>
            )}
            {isUploadedTrack && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 shrink-0">Uploaded</span>
            )}
            {assignedWorkspaceName && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/65 truncate max-w-[140px] shrink-0"
                title={`Workspace: ${assignedWorkspaceName}`}
              >
                <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                {assignedWorkspaceName}
              </span>
            )}
            {track.status === "done" && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDnaOpen((v) => !v); }}
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
          </div>

          {/* Artist name row */}
          {edit.isEditingArtist ? (
            <div className="flex items-center gap-1 mt-0.5 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                ref={edit.artistInputRef}
                type="text"
                value={edit.editArtist}
                onChange={(e) => edit.setEditArtist(e.target.value)}
                onKeyDown={edit.handleArtistKeyDown}
                onBlur={edit.discardArtist}
                aria-label="Edit artist name"
                placeholder="Artist name"
                className="field-sizing-content w-auto min-w-[10ch] max-w-[55vw] sm:max-w-[40ch] text-sm bg-white/10 border border-primary-500/40 rounded px-2 py-0.5 focus:outline-none focus:border-primary-500 text-white/80"
                maxLength={255}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
              />
              <button type="button" onMouseDown={(e) => { e.preventDefault(); edit.saveArtist(); }} className="shrink-0 p-0.5 text-green-400 hover:text-green-300 transition-colors" title="Save (Enter)">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); edit.discardArtist(); }} className="shrink-0 p-0.5 text-red-400 hover:text-red-300 transition-colors" title="Discard (Esc)">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ) : (
            <p
              className="text-xs text-white/50 hover:text-primary-300 mt-0.5 truncate cursor-pointer select-none transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (user?.id) router.push(`/discover/artist/${user.id}`);
              }}
              onDoubleClick={(e) => { e.stopPropagation(); edit.setIsEditingArtist(true); }}
              title={track.artistName ? "Click to view artist page · double-click to edit" : "Click to view artist page · double-click to add artist name"}
            >
              {track.artistName || artistAlias || <span className="italic opacity-50">no artist — double-click to add</span>}
            </p>
          )}

          {/* Mobile Download Buttons Row */}
          {track.status === "done" && (
            <div className="flex sm:hidden items-center gap-2 mt-1.5">
              {track.audioUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); actions.handleDownload(track.audioUrl!); }}
                  disabled={actions.downloading}
                  className="px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 text-white/50 hover:text-white/80 active:bg-white/10 transition-all shrink-0"
                  title={`Download ${mp3Label}`}
                >
                  📥 {mp3Label}
                </button>
              )}
              {track.s3KeyOgg && track.format !== "ogg" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.handleDownload(`/api/tracks/${track.id}/download?format=ogg`, false, "ogg");
                  }}
                  disabled={actions.downloading}
                  className="px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 text-white/50 hover:text-white/80 active:bg-white/10 transition-all shrink-0"
                  title="Download OGG"
                >
                  📥 OGG
                </button>
              )}
              {track.s3KeyHd && track.audioUrlHd && (
                <button
                  onClick={(e) => { e.stopPropagation(); actions.handleDownload(track.audioUrlHd!, true); }}
                  disabled={actions.downloading}
                  className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 active:scale-95 transition-all shrink-0"
                  title={`Download ${hdLabel}`}
                >
                  📥 {hdLabel}
                </button>
              )}
            </div>
          )}

          {track.status !== "generating" && track.status !== "pending" && (
            <>
              <p className="hidden sm:block text-xs text-white/30 truncate mt-0.5">{styleDesc}</p>
              {generationCompletedOn && generationTime && (
                <p className="hidden sm:block text-[10px] text-white/30 mt-0.5" title="Time from generation start to completion">
                  Generation completed on {generationCompletedOn} in {generationTime}
                </p>
              )}
              <p className="hidden sm:block text-[10px] text-white/40 mt-0.5 uppercase tracking-[0.12em]">
                {bpm != null && <>{bpm} BPM · </>}
                {playCount} {playCount === 1 ? "play" : "plays"} by you
                {othersPlayCount > 0 && (
                  <> · {othersPlayCount} {othersPlayCount === 1 ? "play" : "plays"} by others</>
                )}
              </p>
            </>
          )}
          {trackPlaylist && (
            <p className="text-[10px] text-white/30 mt-0.5 truncate">
              <span className="opacity-60">in</span>{" "}
              <button
                className="hover:text-white/70 transition-colors underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlaylistId(trackPlaylist.id);
                  router.push("/library");
                }}
              >
                {trackPlaylist.name}
              </button>
            </p>
          )}
          {track.error && (
            <p className="text-sm text-red-400 mt-0.5">{track.error}</p>
          )}
          {tclError && (
            <p className="text-sm text-red-400 mt-0.5">{tclError}</p>
          )}
        </div>

        {/* Time + actions */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="mr-1 text-right leading-tight">
            <p className="hidden sm:block text-[11px] text-white/30 whitespace-nowrap">{createdAt.date}</p>
            <p className="hidden sm:block text-[10px] text-white/20 whitespace-nowrap">{createdAt.time}</p>
          </div>
          {track.status === "done" && (
            <TrackRating
              rating={actions.currentRating}
              ratingLoading={actions.ratingLoading}
              onRate={actions.handleRating}
            />
          )}
          {track.status === "done" && (
            <>
              {track.audioUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); actions.handleDownload(track.audioUrl!); }}
                  disabled={actions.downloading}
                  className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                  title={`Download ${mp3Label}`}
                >
                  {mp3Label}
                </button>
              )}
              {track.s3KeyOgg && track.format !== "ogg" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.handleDownload(`/api/tracks/${track.id}/download?format=ogg`, false, "ogg");
                  }}
                  disabled={actions.downloading}
                  className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                  title="Download OGG"
                >
                  OGG
                </button>
              )}
              {track.s3KeyHd && track.audioUrlHd && (
                <button
                  onClick={(e) => { e.stopPropagation(); actions.handleDownload(track.audioUrlHd!, true); }}
                  disabled={actions.downloading}
                  className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                  title={`Download ${hdLabel}`}
                >
                  {hdLabel}
                </button>
              )}
            </>
          )}
          {track.status === "done" && isOwner && (
            <TrackActionMenu
              track={track}
              playlists={playlists}
              onReusePrompt={onReusePrompt}
              onRegenerateCover={actions.handleRegenerateCover}
              isRegeneratingCover={actions.isRegeneratingCover}
              onRegenerateTitle={actions.handleRegenerateTitle}
              isRegeneratingTitle={actions.isRegeneratingTitle}
              onMoveToWorkspaceClick={() => actions.setWorkspaceMenuOpen(true)}
              onAddToQueue={onAddToQueue}
              onCreatePlaylistClick={() => actions.setShowCreatePlaylistDialog(true)}
              onAddToPlaylistClick={actions.handleAddToPlaylistClick}
              onOpenPlaylistPicker={() => actions.setShowPlaylistPickerDialog(true)}
              onRemoveFromPlaylistClick={actions.handleRemoveFromPlaylistClick}
              onOpenReleasePicker={() => actions.setShowReleasePickerDialog(true)}
              onRemoveFromReleaseClick={actions.handleRemoveFromReleaseClick}
              onEditDetails={() => onEditDetails?.(track)}
              onLinkToArchiveClick={() => setShowLinkToArchiveDialog(true)}
              onArchiveClick={track.status === "done" && !isListenerRole ? handleArchive : undefined}
              archiveDisabled={track.releaseStatus === "published" || archiveLinkKind === "original"}
              archiveDisabledReason={
                track.releaseStatus === "published"
                  ? "Track is gepubliceerd in een release en kan niet gearchiveerd worden."
                  : archiveLinkKind === "original"
                    ? "Dit is een Master Track in Song Archive en kan niet gearchiveerd worden."
                    : undefined
              }
              onAdvancedDnaClick={track.status === "done" ? handleAdvancedDna : undefined}
                            advancedDnaRunning={advancedDnaRunning}
                            onAnalyzeAudioClick={handleReanalyzeAudio}
                            analyzingAudio={reanalyzingAudio}
              onRetryWavClick={
                (track.provider === "poyo" || track.provider === "apimart") && !track.s3KeyHd
                  ? handleRetryWav
                  : undefined
              }
              retryingWav={retryingWav}
              retryWavResult={retryWavResult}
              onConvertOggClick={
                track.status === "done" && !track.s3KeyOgg && track.format !== "ogg"
                  ? handleConvertOgg
                  : undefined
              }
              convertingOgg={convertingOgg}
              convertOggResult={convertOggResult}
              canExtractStems={track.provider === "apimart" && !!track.jobId}
              onStemsClick={() => setStemsOpen((v) => !v)}
              onMasteringClick={() => setMasteringOpen((v) => !v)}
              onEditSectionClick={() => setEditSectionOpen((v) => !v)}
              isPublished={track.releaseStatus === "published"}
              onTogglePublish={track.status === "done" ? handleTogglePublish : undefined}
              togglingPublish={togglingPublish}
              onGenerateTclClick={canGenerateTcl ? handleGenerateTclClick : undefined}
              generatingTcl={generatingTcl}
              isListener={isListenerRole}
              onGoToArtist={track.artistId ? () => router.push(`/discover/artist/${track.artistId}`) : undefined}
            />
          )}
          {isOwner && (
            <button
              onClick={actions.handleDelete}
              disabled={actions.deleting}
              className="p-1.5 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              title={actions.deleting ? "Deleting..." : "Delete track"}
            >
              {actions.deleting ? (
                <div className="w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Animated expand/collapse wrapper using the CSS grid trick.
          grid-template-rows: 0fr → 1fr transitions height smoothly for any
          content size without needing JS measurements. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          dnaOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          {dnaMounted && (
            <TrackDnaPanel
              trackId={track.id}
              refreshKey={dnaRefreshKey}
              advancedDnaResult={advancedDnaResult}
              advancedDnaRunning={advancedDnaRunning}
              onRunAdvancedDna={isListenerRole ? undefined : handleAdvancedDna}
              trackStatus={track.status}
              onReanalyzeAudio={isListenerRole ? undefined : handleReanalyzeAudio}
              reanalyzingAudio={reanalyzingAudio}
            />
          )}
        </div>
      </div>

      {/* Inline Stems panel */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          stemsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          {stemsMounted && (
            <div className="mt-1 rounded-xl border border-white/10 bg-[#0d0e15] p-3 space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Stems</p>
                <button type="button" onClick={() => setStemsOpen(false)} className="text-xs text-white/30 hover:text-white/60">Close</button>
              </div>
              {STEM_TYPES.map((stemDef) => {
                // Stem data lives in the right-sidebar store; here we render a standalone extraction UI.
                return (
                  <StemRow key={stemDef.value} stemDef={stemDef} trackId={track.id} />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inline Mastering panel */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          masteringOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          {masteringMounted && (
            <div className="mt-1 rounded-xl border border-white/10 bg-[#0d0e15] p-3 space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Mastering</p>
                <button type="button" onClick={() => setMasteringOpen(false)} className="text-xs text-white/30 hover:text-white/60">Close</button>
              </div>
              {MASTER_VARIATIONS.map((variationDef) => (
                <MasterRow key={variationDef.value} variationDef={variationDef} trackId={track.id} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inline Edit (Section replace) panel */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          editSectionOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          {editSectionMounted && (
            <div className="mt-1 rounded-xl border border-white/10 bg-[#0d0e15] p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Edit</p>
                <button type="button" onClick={() => setEditSectionOpen(false)} className="text-xs text-white/30 hover:text-white/60">Close</button>
              </div>
              <SectionReplaceEditor track={track} onSubmitted={() => { void mutate("/api/tracks"); }} />
            </div>
          )}
        </div>
      </div>
          </>
        );
}, (prevProps, nextProps) => {
  return (
    prevProps.track.id === nextProps.track.id &&
    prevProps.track.title === nextProps.track.title &&
    prevProps.track.prompt === nextProps.track.prompt &&
    prevProps.track.lyrics === nextProps.track.lyrics &&
    prevProps.track.status === nextProps.track.status &&
    prevProps.track.playCount === nextProps.track.playCount &&
    prevProps.track.othersPlayCount === nextProps.track.othersPlayCount &&
    prevProps.track.coverUrl === nextProps.track.coverUrl &&
    prevProps.track.rating === nextProps.track.rating &&
    prevProps.track.s3KeyHd === nextProps.track.s3KeyHd &&
    prevProps.track.lyricsTimestamps === nextProps.track.lyricsTimestamps &&
    prevProps.track.instrumental === nextProps.track.instrumental &&
    prevProps.track.isCollaboration === nextProps.track.isCollaboration &&
    prevProps.playlists?.length === nextProps.playlists?.length &&
    prevProps.workspaceById?.size === nextProps.workspaceById?.size
  );
});

export default TrackCard;
