"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/tracks/ConfirmDialog";
import { isLyricsTaskSubmission } from "@/lib/parse-lyrics";
import WaveformBars from "@/components/tracks/WaveformBars";
import { usePlayerStore, useWorkspaceStore, useSelectionStore, type Workspace } from "@/lib/store";
import { formatTrackDateTime } from "@/lib/track-utils";
import type { PlaylistOption, TrackItem } from "@/components/tracks/types";

// Extracted Sub-components
import AlreadyInPlaylistDialog from "./AlreadyInPlaylistDialog";
import CreatePlaylistDialog from "./CreatePlaylistDialog";
import PlaylistPickerDialog from "./PlaylistPickerDialog";
import DuplicatePlaylistDialog from "./DuplicatePlaylistDialog";
import MergeWorkspaceDialog from "./MergeWorkspaceDialog";
import MoveToWorkspaceDialog from "./MoveToWorkspaceDialog";
import TrackPlayButton from "./TrackPlayButton";
import TrackRating from "./TrackRating";
import TrackActionMenu from "./TrackActionMenu";
import { useTrackInlineEdit } from "./useTrackInlineEdit";
import { useTrackCardActions } from "./useTrackCardActions";

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
}) {
  const isSelected = useSelectionStore((state) => state.selectedIds.has(track.id));
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setIsFullscreen = usePlayerStore((state) => state.setIsFullscreen);
  const isCurrentlyPlaying = currentTrack?.id === track.id;
  const playClickCooldownRef = useRef(0);

  const [optimisticPlayCount, setOptimisticPlayCount] = useState(track.playCount ?? 0);

  useEffect(() => {
    setOptimisticPlayCount(track.playCount ?? 0);
  }, [track.playCount]);

  useEffect(() => {
    function handleTrackPlayed(event: Event) {
      const e = event as CustomEvent<{ trackId?: string; playCount?: number }>;
      if (e.detail?.trackId !== track.id) return;
      const nextCount = e.detail?.playCount;
      if (typeof nextCount === "number" && Number.isFinite(nextCount)) {
        setOptimisticPlayCount(nextCount);
        return;
      }
      setOptimisticPlayCount((count) => Math.max(1, count + 1));
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
  const assignedWorkspaceName = useMemo(() => {
    const assigned = workspaces.find((w) => !w.isDefault && workspaceById.get(w.id)?.trackIds.includes(track.id));
    if (!assigned) return null;
    return workspaceDisplayNameById.get(assigned.id) ?? assigned.name;
  }, [track.id, workspaces, workspaceById, workspaceDisplayNameById]);
  const workspaceCoverById = workspaceCoverByIdProp ?? new Map<string, string | null>();

  // Derived display values
  const statusConfig = {
    pending: { color: "bg-yellow-500/20 text-yellow-300", label: "Queued" },
    generating: { color: "bg-blue-500/20 text-blue-300", label: "Creating" },
    done: { color: "bg-green-500/20 text-green-300", label: "Ready" },
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
  const title = (track.title || track.prompt.substring(0, 50)).replace(/\s*\(2\)\s*$/, "");
  const styleDesc = track.prompt.length > 80 ? track.prompt.substring(0, 80) + "..." : track.prompt;
  const playCount = optimisticPlayCount;
  const isNewUnplayed = track.status === "done" && playCount === 0;
  const mp3Label = (track.format ?? "mp3").toUpperCase();
  const hdLabel = track.formatHd ? track.formatHd.toUpperCase() : "HD";
  const isUploadedTrack = track.provider === "upload";
  const effectiveCoverUrl = actions.coverOverrideUrl ?? track.coverUrl ?? null;
  const effectiveThumbUrl = actions.coverOverrideUrl
    ? `${actions.coverOverrideUrl}&thumb=1`
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
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
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
        onDoubleClick={(e) => {
          if (e.shiftKey) return;
          if (track.status !== "done") return;
          if (!isCurrentlyPlaying) onPlay(track);
          setIsFullscreen(true);
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
          <div className="flex items-center gap-2 min-w-0 w-full">
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
                className={`text-sm font-medium truncate cursor-text flex-1 min-w-0 ${isCurrentlyPlaying ? "text-primary-200" : ""}`}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={edit.handleTitleDoubleClick}
                title="Double-click to edit"
              >
                {title}
              </h3>
            )}
            <span className={`${status.label === "Ready" ? "hidden sm:inline-flex" : "inline-flex"} text-[10px] px-1.5 py-0.5 rounded ${status.color} ${statusAnimationClass} shrink-0`}>
              {status.label}
            </span>
            {track.status === "done" && track.lyricsTimestamps && !isLyricsTaskSubmission(track.lyricsTimestamps) && (
              <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded border border-blue-300/30 bg-blue-400/10 text-blue-200 shrink-0 font-medium cursor-help" title="timecodedlyrics">TCL</span>
            )}
            {track.instrumental && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-violet-300/30 bg-violet-400/10 text-violet-200 shrink-0" title="No vocals">Instrumental</span>
            )}
            {isUploadedTrack && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 shrink-0">Uploaded</span>
            )}
            {assignedWorkspaceName && (
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/65 truncate max-w-[140px] shrink-0" title={assignedWorkspaceName}>
                {assignedWorkspaceName}
              </span>
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
                className="field-sizing-content w-auto min-w-[10ch] max-w-[55vw] sm:max-w-[40ch] text-xs bg-white/10 border border-primary-500/40 rounded px-2 py-0.5 focus:outline-none focus:border-primary-500 text-white/80"
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
              className="text-[10px] text-white/40 mt-0.5 truncate cursor-text select-none"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => { e.stopPropagation(); edit.setIsEditingArtist(true); }}
              title={track.artistName ? "Double-click to edit artist" : "Double-click to add artist name"}
            >
              {track.artistName ?? <span className="italic opacity-50">no artist — double-click to add</span>}
            </p>
          )}

          {/* Mobile Download Buttons Row */}
          {track.status === "done" && track.audioUrl && (
            <div className="flex sm:hidden items-center gap-2 mt-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); actions.handleDownload(track.audioUrl!); }}
                disabled={actions.downloading}
                className="px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 text-white/50 hover:text-white/80 active:bg-white/10 transition-all shrink-0"
                title={`Download ${mp3Label}`}
              >
                📥 {mp3Label}
              </button>
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

          {track.status === "generating" || track.status === "pending" ? (
            <div className="mt-1.5 text-primary-500/40 w-full">
              <WaveformBars count={32} className="h-2 w-full" />
            </div>
          ) : (
            <>
              <p className="hidden sm:block text-xs text-white/30 truncate mt-0.5">{styleDesc}</p>
              <p className="hidden sm:block text-[10px] text-white/40 mt-0.5 uppercase tracking-[0.12em]">
                {playCount} {playCount === 1 ? "play" : "plays"}
              </p>
            </>
          )}
          {assignedWorkspaceName && (
            <p className="text-[10px] text-white/30 mt-0.5 truncate">
              <span className="opacity-60">in</span> {assignedWorkspaceName}
            </p>
          )}
          {track.error && (
            <p className="text-xs text-red-400 mt-0.5">{track.error}</p>
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
          {track.status === "done" && track.audioUrl && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); actions.handleDownload(track.audioUrl!); }}
                disabled={actions.downloading}
                className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                title={`Download ${mp3Label}`}
              >
                {mp3Label}
              </button>
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
          {track.status === "done" && (
            <TrackActionMenu
              track={track}
              playlists={playlists}
              onReusePrompt={onReusePrompt}
              onRegenerateCover={actions.handleRegenerateCover}
              isRegeneratingCover={actions.isRegeneratingCover}
              onMoveToWorkspaceClick={() => actions.setWorkspaceMenuOpen(true)}
              onAddToQueue={onAddToQueue}
              onCreatePlaylistClick={() => actions.setShowCreatePlaylistDialog(true)}
              onAddToPlaylistClick={actions.handleAddToPlaylistClick}
              onOpenPlaylistPicker={() => actions.setShowPlaylistPickerDialog(true)}
              onRemoveFromPlaylistClick={actions.handleRemoveFromPlaylistClick}
              onEditDetails={onEditDetails ? () => onEditDetails(track) : undefined}
            />
          )}
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
    prevProps.track.coverUrl === nextProps.track.coverUrl &&
    prevProps.track.rating === nextProps.track.rating &&
    prevProps.track.s3KeyHd === nextProps.track.s3KeyHd &&
    prevProps.track.lyricsTimestamps === nextProps.track.lyricsTimestamps &&
    prevProps.track.instrumental === nextProps.track.instrumental &&
    prevProps.playlists?.length === nextProps.playlists?.length &&
    prevProps.workspaceById?.size === nextProps.workspaceById?.size
  );
});

export default TrackCard;
