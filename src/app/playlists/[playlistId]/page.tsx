"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail, { type TrackDetailTrack } from "@/components/TrackDetail";
import TrackEditPanel from "@/components/tracks/TrackEditPanel";
import ResizablePanel from "@/components/studio/ResizablePanel";
import ReuseConfirmDialog from "@/components/library/ReuseConfirmDialog";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";
import {
  usePlayerStore,
  usePlaylistStore,
  useReleaseStore,
  useSidebarStore,
  useStudioStore,
  useUserStore,
  useWorkspaceStore,
} from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";
import { formatTotalDuration } from "@/lib/track-utils";
import { useT } from "@/hooks/useT";

const RELEASE_TYPES: { value: "single" | "ep" | "album"; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
];

function defaultReleaseTypeForTrackCount(count: number): "single" | "ep" | "album" {
  if (count <= 1) return "single";
  if (count <= 6) return "ep";
  return "album";
}

const PLAYLIST_COVERS_STORAGE_KEY = "melodiq.playlist-covers";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const router = useRouter();
  const t = useT();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const playlistId = params?.playlistId;
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  const isListener = user?.role === "listener";
  const isAdmin = user?.role === "admin";
  useEffect(() => {
    if (!user) void loadUser();
  }, [user, loadUser]);

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const {
    playlists,
    addTrackToPlaylist,
    reorderPlaylistTracks,
    localMovePlaylistTrack,
    loadPlaylists,
    deletePlaylist,
    updatePlaylistDescription,
  } = usePlaylistStore();
  const { loadReleases, createRelease, toggleReleasePublic } = useReleaseStore();
  const moveTracksToWorkspace = useWorkspaceStore((state) => state.moveTracksToWorkspace);

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingPlaylistOrder, setIsEditingPlaylistOrder] = useState(false);
  const [togglingPlaylistPublic, setTogglingPlaylistPublic] = useState(false);
  const [reuseConfirmTrack, setReuseConfirmTrack] = useState<TrackItem | null>(null);
  const [editingTrack, setEditingTrack] = useState<TrackItem | null>(null);

  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertTitle, setConvertTitle] = useState("");
  const [convertType, setConvertType] = useState<"single" | "ep" | "album">("single");
  const [convertArtistAlias, setConvertArtistAlias] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [publishPromptRelease, setPublishPromptRelease] = useState<{ id: string; title: string; trackCount: number } | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [playlistCoverOverrides, setPlaylistCoverOverrides] = useState<Record<string, string>>({});
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const playlistCoverInputRef = useRef<HTMLInputElement | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const fetchTracks = useCallback(async (activeCheck?: () => boolean) => {
    if (activeCheck && !activeCheck()) return;
    const res = await fetch("/api/tracks?status=done");
    if (activeCheck && !activeCheck()) return;
    if (res.ok) {
      const data = await res.json();
      setTracks((data.tracks || []).map((t: TrackItem) => ({ ...t })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchTracks(() => active);
    void loadPlaylists();
    void loadReleases();
    return () => {
      active = false;
    };
  }, [fetchTracks, loadPlaylists, loadReleases, playlistId]);

  useEffect(() => {
    function onTracksChanged() {
      let active = true;
      fetchTracks(() => active);
      return () => {
        active = false;
      };
    }
    window.addEventListener("tracks-changed", onTracksChanged);
    return () => window.removeEventListener("tracks-changed", onTracksChanged);
  }, [fetchTracks]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  useEffect(() => {
    setShowTrackDetailsPanel(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(PLAYLIST_COVERS_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (!isObjectRecord(parsed)) return;

      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && value.trim()) {
          next[key] = value;
        }
      }

      setPlaylistCoverOverrides(next);
    } catch {
      // Ignore malformed localStorage payload.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PLAYLIST_COVERS_STORAGE_KEY, JSON.stringify(playlistCoverOverrides));
  }, [playlistCoverOverrides]);

  const {
    selectedTrack,
    setSelectedTrack,
    showTrackDetailsPanel,
    openTrackDetails,
    closeTrackDetails,
  } = useTrackDetailsPanel<TrackItem>(tracks);

  const selectedPlaylist = useMemo(
    () => (playlistId ? playlists.find((playlist) => playlist.id === playlistId) ?? null : null),
    [playlistId, playlists],
  );

  const playlistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return selectedPlaylist.trackIds
      .map((id) => byId.get(id))
      .filter((t): t is TrackItem => Boolean(t));
  }, [selectedPlaylist, tracks]);

  const playlistTracksTotalDuration = useMemo(
    () => formatTotalDuration(playlistTracks.reduce((s, t) => s + (t.duration ?? 0), 0)),
    [playlistTracks],
  );

  const coverCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          playlistTracks
            .map((t) => t.coverUrl)
            .filter((coverUrl): coverUrl is string => Boolean(coverUrl)),
        ),
      ),
    [playlistTracks],
  );

  const randomCover = useMemo(() => {
    if (!selectedPlaylist || coverCandidates.length === 0) return null;
    const index = hashString(`${selectedPlaylist.id}:${coverCandidates.join("|")}`) % coverCandidates.length;
    return coverCandidates[index] ?? null;
  }, [selectedPlaylist, coverCandidates]);

  function handleSetPlaylistCover(coverUrl: string) {
    if (!selectedPlaylist) return;
    const playlistIdKey = selectedPlaylist.id;
    setPlaylistCoverOverrides((current) => ({ ...current, [playlistIdKey]: coverUrl }));
  }

  function handleResetPlaylistCover() {
    if (!selectedPlaylist) return;
    const playlistIdKey = selectedPlaylist.id;
    setPlaylistCoverOverrides((current) => {
      const next = { ...current };
      delete next[playlistIdKey];
      return next;
    });
  }

  async function handleUploadPlaylistCover(file: File) {
    if (!selectedPlaylist) return;
    const playlistIdKey = selectedPlaylist.id;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("cover", file);
      const res = await fetch(`/api/playlists/${playlistIdKey}/cover`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { coverUrl } = await res.json() as { coverUrl: string };
      const bustedUrl = `${coverUrl}?t=${Date.now()}`;
      handleSetPlaylistCover(bustedUrl);
      const { hydratePlaylistsFromServer, playlists: storePlaylists } = usePlaylistStore.getState();
      hydratePlaylistsFromServer(storePlaylists.map((p) => p.id === playlistIdKey ? { ...p, coverUrl: bustedUrl } : p));
    } catch (err) {
      console.error("[playlist-cover] upload error", err);
    } finally {
      setUploadingCover(false);
    }
  }

  function openDescriptionEditor() {
    if (!selectedPlaylist) return;
    setDescriptionDraft(selectedPlaylist.description ?? "");
    setEditingDescription(true);
  }

  function handleSaveDescription() {
    if (!selectedPlaylist) return;
    updatePlaylistDescription(selectedPlaylist.id, descriptionDraft);
    setEditingDescription(false);
    setDescriptionDraft("");
  }

  const knownArtistNames = useMemo(() => {
    const names = new Set<string>();
    tracks.forEach((t) => {
      if (t.artistName) names.add(t.artistName);
    });
    return Array.from(names).sort();
  }, [tracks]);

  const knownComposerNames = useMemo(() => {
    const names = new Set<string>();
    tracks.forEach((t) => {
      if (t.composerName) names.add(t.composerName);
    });
    return Array.from(names).sort();
  }, [tracks]);

  const knownWriterNames = useMemo(() => {
    const names = new Set<string>();
    tracks.forEach((t) => {
      if (t.writerName) names.add(t.writerName);
    });
    return Array.from(names).sort();
  }, [tracks]);

  useEffect(() => {
    function consumeJumpToTrack() {
      const trackId = sessionStorage.getItem("melodiq-jump-to-track");
      if (!trackId) return;
      sessionStorage.removeItem("melodiq-jump-to-track");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("melodiq:scroll-to-track", { detail: { trackId } }));
      }, 300);
    }

    consumeJumpToTrack();
    window.addEventListener("melodiq:jump-to-now-playing", consumeJumpToTrack);
    return () => window.removeEventListener("melodiq:jump-to-now-playing", consumeJumpToTrack);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || tracks.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetTrackId = params.get("trackId");
    if (!targetTrackId) return;

    const foundTrack = tracks.find((t) => t.id === targetTrackId);
    if (foundTrack) {
      openTrackDetails(foundTrack);
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("melodiq:scroll-to-track", { detail: { trackId: targetTrackId } }),
        );
      }, 300);
    }
  }, [tracks, openTrackDetails]);

  function handleDeleteTrack(trackId: string) {
    setTracks((current) => current.filter((track) => track.id !== trackId));
  }

  function performReusePrompt(track: TrackItem) {
    sessionStorage.setItem(
      "melodiq-reuse-prompt-payload",
      JSON.stringify({ songIdea: track.prompt || "", lyrics: track.lyrics || "" }),
    );
    router.push("/studio");
  }

  function handleReusePrompt(track: TrackItem) {
    const { songIdea, lyrics } = useStudioStore.getState();
    if (songIdea.trim() || lyrics.trim()) {
      setReuseConfirmTrack(track);
      return;
    }
    performReusePrompt(track);
  }

  const handleTrackUpdated = useCallback((updatedTrack: TrackDetailTrack) => {
    const normalizedTrack: TrackItem = {
      ...updatedTrack,
      coverUrl: updatedTrack.coverUrl ?? null,
      s3KeyCover: updatedTrack.s3KeyCover ?? null,
      rating: updatedTrack.rating ?? null,
    };

    setTracks((current) =>
      current.map((track) =>
        track.id === normalizedTrack.id ? { ...track, ...normalizedTrack } : track,
      ),
    );

    setSelectedTrack((current) =>
      current && current.id === normalizedTrack.id ? { ...current, ...normalizedTrack } : current,
    );
  }, []);

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;

    const player = usePlayerStore.getState();
    const playContext = playlistTracks
      .filter((track) => track.status === "done")
      .map((track) => ({
        id: track.id,
        title: track.title,
        provider: track.provider,
        providerModel: track.providerModel,
        prompt: track.prompt,
        status: track.status,
        audioUrl: track.audioUrl,
        audioUrlHd: track.audioUrlHd,
        format: track.format,
        formatHd: track.formatHd,
        s3Key: track.s3Key ?? null,
        s3KeyHd: track.s3KeyHd ?? null,
        s3KeyMp3: track.s3KeyMp3 ?? null,
        s3KeyOgg: track.s3KeyOgg ?? null,
        duration: track.duration,
        lyrics: track.lyrics,
        lyricsTimestamps: track.lyricsTimestamps,
        createdAt: track.createdAt,
        error: track.error,
        coverUrl: track.coverUrl ?? null,
        s3KeyCover: track.s3KeyCover ?? null,
        rating: track.rating ?? null,
        artistName: track.artistName ?? null,
      }));

    player.setPlayContext(playContext);

    if (player.autoPlayNext) {
      const index = playContext.findIndex((track) => track.id === selectedTrack.id);
      if (index >= 0) {
        player.setQueue(playContext.slice(index + 1));
      }
    }

    player.playTrackFromGesture({
      id: selectedTrack.id,
      title: selectedTrack.title,
      provider: selectedTrack.provider,
      providerModel: selectedTrack.providerModel,
      prompt: selectedTrack.prompt,
      status: selectedTrack.status,
      audioUrl: url,
      audioUrlHd: selectedTrack.audioUrlHd,
      format: selectedTrack.format,
      formatHd: selectedTrack.formatHd,
      s3Key: selectedTrack.s3Key ?? null,
      s3KeyHd: selectedTrack.s3KeyHd ?? null,
      s3KeyMp3: selectedTrack.s3KeyMp3 ?? null,
      s3KeyOgg: selectedTrack.s3KeyOgg ?? null,
      duration: selectedTrack.duration,
      lyrics: selectedTrack.lyrics,
      lyricsTimestamps: selectedTrack.lyricsTimestamps,
      createdAt: selectedTrack.createdAt,
      error: selectedTrack.error,
      coverUrl: selectedTrack.coverUrl ?? null,
      s3KeyCover: selectedTrack.s3KeyCover ?? null,
      rating: selectedTrack.rating ?? null,
      artistName: selectedTrack.artistName ?? null,
    });
  }

  function handleDownloadTrack(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd
      ? selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3"
      : selectedTrack?.format ?? "mp3";
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }

  async function handleTogglePlaylistPublic() {
    if (!selectedPlaylist) return;
    setTogglingPlaylistPublic(true);
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-public" }),
      });
      if (!res.ok) {
        console.error(`Failed to toggle playlist public: HTTP ${res.status}`);
        return;
      }
      const data = await res.json().catch(() => null);
      const updated = data?.playlist;
      if (updated) {
        const { hydratePlaylistsFromServer, playlists: storePlaylists } =
          usePlaylistStore.getState();
        hydratePlaylistsFromServer(
          storePlaylists.map((p) =>
            p.id === selectedPlaylist.id
              ? { ...p, isPublic: updated.isPublic, publishedAt: updated.publishedAt }
              : p,
          ),
        );
      }
      window.dispatchEvent(new CustomEvent("discover-playlists-changed"));
    } catch (error) {
      console.error("Failed to toggle playlist public:", error);
    } finally {
      setTogglingPlaylistPublic(false);
    }
  }

  function openConvertDialog() {
    if (!selectedPlaylist) return;
    setConvertTitle(selectedPlaylist.name);
    setConvertType(defaultReleaseTypeForTrackCount(selectedPlaylist.trackIds.length));
    setConvertArtistAlias("");
    setConvertError(null);
    setShowConvertDialog(true);
  }

  async function handleConvertToRelease() {
    if (!selectedPlaylist || selectedPlaylist.isSystem) return;

    const title = convertTitle.trim();
    if (!title) {
      setConvertError(t("playlists.titleRequired"));
      return;
    }

    setConverting(true);
    setConvertError(null);

    try {
      const releaseId = await createRelease({
        title,
        type: convertType,
        artistName: convertArtistAlias || undefined,
      });
      if (!releaseId) {
        setConvertError(t("playlists.convertFailedGeneric"));
        setConverting(false);
        return;
      }

      // Sequential + awaited: the server assigns each track's position as
      // max(existing)+1, so firing these in parallel could race and land
      // two tracks on the same position.
      for (const trackId of selectedPlaylist.trackIds) {
        const res = await fetch(`/api/releases/${releaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add-track", trackId, allowDuplicate: true }),
        });
        if (!res.ok) {
          console.error("[convert-to-release] failed to add track", trackId, res.status);
        }
      }

      await loadReleases();
      const trackCount = selectedPlaylist.trackIds.length;
      deletePlaylist(selectedPlaylist.id);

      setShowConvertDialog(false);
      setPublishPromptRelease({ id: releaseId, title, trackCount });
    } catch (error) {
      console.error("[convert-to-release] failed", error);
      setConvertError(t("playlists.convertErrorGeneric"));
    } finally {
      setConverting(false);
    }
  }

  async function handlePublishDecision(publish: boolean) {
    if (!publishPromptRelease) return;
    const releaseId = publishPromptRelease.id;
    if (publish) {
      setPublishing(true);
      await toggleReleasePublic(releaseId);
      setPublishing(false);
    }
    setPublishPromptRelease(null);
    router.push(`/releases/${releaseId}`);
  }

  const coverUrl =
    currentTrack?.coverUrl ||
    (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);

  if (!loading && !selectedPlaylist && !publishPromptRelease) {
    return (
      <div className="relative h-screen bg-[#09090d] overflow-hidden text-white">
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center scale-115 blur-[80px] opacity-20 saturate-200 pointer-events-none"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}
        <Sidebar credits={null} />
        <div
          className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex items-center justify-center px-6"
          style={{
            marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240,
          }}
        >
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center max-w-md">
            <h2 className="text-lg font-semibold text-white">{t("playlists.notFoundTitle")}</h2>
            <p className="text-sm text-white/60 mt-2">
              {t("playlists.notFoundBody")}
            </p>
            <button
              type="button"
              onClick={() => router.push("/playlists")}
              className="mt-5 rounded-full border border-white/12 bg-white/8 px-5 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            >
              {t("playlists.backToPlaylists")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-[#09090d] overflow-hidden text-white">
      {/* Blurred cover art as background */}
      {coverUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-115 blur-[80px] opacity-20 saturate-200 pointer-events-none"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      )}
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex"
        style={{
          marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240,
        }}
      >
        <main
          className={`relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${
            isListener ? "lg:pt-20" : "lg:pt-5"
          }`}
        >
          <div className="max-w-400 mx-auto space-y-6">
            {/* Header section matching Library styling */}
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                      {t("playlists.title")}
                      <span className="mx-2 text-white/25 font-light">/</span>
                      <span className="text-white/60">
                        {selectedPlaylist?.name ?? t("playlists.fallbackName")}
                      </span>
                    </h1>
                    {selectedPlaylist?.isPublic && (
                      <span className="shrink-0 rounded-full border border-fuchsia-400/40 bg-fuchsia-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
                        ● {t("playlists.published")}
                      </span>
                    )}
                    {playlistTracks.length > 0 && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 shrink-0">
                        {t("playlists.tracksCount", { count: playlistTracks.length })}
                        {playlistTracksTotalDuration ? ` (${playlistTracksTotalDuration})` : ""}
                      </span>
                    )}
                  </div>
                  {editingDescription ? (
                    <div className="max-w-xl space-y-2">
                      <textarea
                        autoFocus
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value.slice(0, 500))}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { setEditingDescription(false); setDescriptionDraft(""); }
                        }}
                        rows={3}
                        maxLength={500}
                        placeholder={t("playlists.descriptionPlaceholder")}
                        className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 resize-none"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-white/35">{descriptionDraft.length}/500</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setEditingDescription(false); setDescriptionDraft(""); }}
                            className="h-8 rounded-full px-3 text-sm text-white/50 hover:text-white transition-colors"
                          >
                            {t("common.cancel")}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDescription}
                            className="h-8 rounded-full bg-white px-3 text-sm font-medium text-black hover:bg-white/90 transition-colors"
                          >
                            {t("common.save")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : selectedPlaylist?.description ? (
                    <button
                      type="button"
                      onClick={openDescriptionEditor}
                      className="block max-w-xl text-left text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      {selectedPlaylist.description}
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => router.push("/playlists")}
                    className="h-9 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white inline-flex items-center gap-1.5"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    {t("playlists.allPlaylists")}
                  </button>

                  {playlistTracks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingPlaylistOrder && selectedPlaylist) {
                          reorderPlaylistTracks(selectedPlaylist.id, selectedPlaylist.trackIds);
                        }
                        setIsEditingPlaylistOrder((v) => !v);
                      }}
                      className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
                        isEditingPlaylistOrder
                          ? "border-white bg-white text-black hover:bg-white/90"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {isEditingPlaylistOrder ? t("playlists.saveOrder") : t("playlists.editOrder")}
                    </button>
                  )}

                  {selectedPlaylist && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMoreMenuOpen((v) => !v)}
                        aria-label={t("playlists.moreActions")}
                        title={t("playlists.moreActionsTitle")}
                        className={`h-9 w-9 rounded-full border flex items-center justify-center transition-colors ${
                          moreMenuOpen
                            ? "border-white/25 bg-white/10 text-white"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <svg className="h-4.5 w-4.5" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>

                      {moreMenuOpen && (
                        <>
                          <button
                            type="button"
                            aria-label={t("playlists.close")}
                            onClick={() => setMoreMenuOpen(false)}
                            className="fixed inset-0 z-10 cursor-default"
                          />
                          <div className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-white/12 bg-[#181920] py-1 shadow-xl">
                            <button
                              type="button"
                              onClick={() => { openDescriptionEditor(); setMoreMenuOpen(false); }}
                              className="block w-full px-3.5 py-2 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                            >
                              {selectedPlaylist.description ? t("playlists.editDescription") : t("playlists.addDescription")}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowCoverPicker(true); setMoreMenuOpen(false); }}
                              className="block w-full px-3.5 py-2 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                            >
                              {t("playlists.changeCover")}
                            </button>

                            {!selectedPlaylist.isSystem && isAdmin && (
                              <>
                                <div className="my-1 border-t border-white/8" />
                                <button
                                  type="button"
                                  onClick={() => { void handleTogglePlaylistPublic(); setMoreMenuOpen(false); }}
                                  disabled={togglingPlaylistPublic}
                                  className="block w-full px-3.5 py-2 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                                >
                                  {togglingPlaylistPublic
                                    ? selectedPlaylist.isPublic
                                      ? t("playlists.unpublishing")
                                      : t("playlists.publishing")
                                    : selectedPlaylist.isPublic
                                      ? t("playlists.unpublish")
                                      : t("playlists.publishToDiscover")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { openConvertDialog(); setMoreMenuOpen(false); }}
                                  className="block w-full px-3.5 py-2 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  {t("playlists.convertToRelease")}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Track List Section */}
            <section className="space-y-4">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">
                  {t("playlists.loadingTracks")}
                </div>
              ) : playlistTracks.length > 0 ? (
                <TrackList
                  tracks={playlistTracks}
                  autoQueueAfterPlay
                  enableDragReorder={isEditingPlaylistOrder}
                  dragOrderKey={selectedPlaylist?.id}
                  onTrackMoved={(trackId, toIndex) => {
                    if (!selectedPlaylist) return;
                    localMovePlaylistTrack(selectedPlaylist.id, trackId, toIndex);
                  }}
                  onSelect={(track) => {
                    openTrackDetails({
                      ...track,
                      coverUrl: track.coverUrl ?? null,
                      s3KeyCover: track.s3KeyCover ?? null,
                      rating: track.rating ?? null,
                    });
                  }}
                  onDelete={handleDeleteTrack}
                  onReusePrompt={handleReusePrompt}
                  onAddToPlaylist={(trackId, targetPlaylistId, options) =>
                    addTrackToPlaylist(targetPlaylistId, trackId, options)
                  }
                  onMoveToWorkspace={(trackId, workspaceId) =>
                    moveTracksToWorkspace(workspaceId, [trackId])
                  }
                  playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                  onTitleUpdate={(trackId, newTitle) =>
                    setTracks((prev) =>
                      prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)),
                    )
                  }
                  onEditDetails={(track) =>
                    setEditingTrack({
                      ...track,
                      coverUrl: track.coverUrl ?? null,
                      s3KeyCover: track.s3KeyCover ?? null,
                      rating: track.rating ?? null,
                    })
                  }
                  selectedTrackId={selectedTrack?.id ?? null}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-center text-sm text-white/55">
                  {t("playlists.noTracksYet")}
                </div>
              )}
            </section>
          </div>
        </main>

        <ResizablePanel
          show={showTrackDetailsPanel}
          width={rightPanelWidth}
          setWidth={setRightPanelWidth}
        >
          <div className="h-full overflow-y-auto pb-4">
            {selectedTrack ? (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={closeTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
                onTrackUpdated={handleTrackUpdated}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">{t("common.trackDetails")}</h3>
                <p className="text-sm mt-3">{t("common.selectTrackHint")}</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {editingTrack && (
        <TrackEditPanel
          track={editingTrack}
          knownArtistNames={knownArtistNames}
          knownComposerNames={knownComposerNames}
          knownWriterNames={knownWriterNames}
          onClose={() => setEditingTrack(null)}
          onSaved={(updated) => {
            const normalized: TrackItem = {
              ...updated,
              coverUrl: updated.coverUrl ?? null,
              s3KeyCover: updated.s3KeyCover ?? null,
              rating: updated.rating ?? null,
            };
            setTracks((prev) =>
              prev.map((t) => (t.id === normalized.id ? { ...t, ...normalized } : t)),
            );
            setSelectedTrack((prev) =>
              prev?.id === normalized.id ? { ...prev, ...normalized } : prev,
            );
            usePlayerStore.getState().syncTrackSnapshots([{ ...normalized, s3Key: null }]);
          }}
        />
      )}

      {reuseConfirmTrack && (
        <ReuseConfirmDialog
          onConfirm={() => {
            const track = reuseConfirmTrack;
            setReuseConfirmTrack(null);
            if (track) performReusePrompt(track);
          }}
          onCancel={() => setReuseConfirmTrack(null)}
        />
      )}

      {showConvertDialog && selectedPlaylist && (() => {
        const trackCount = selectedPlaylist.trackIds.length;
        const artistAliasOptions = (user?.artistAliases ?? []).filter((alias) => alias.trim());
        const defaultArtistLabel = user?.artistAlias?.trim() || user?.name?.trim() || t("releases.unknownArtist");

        return (
          <div className="fixed inset-0 z-70">
            <button
              type="button"
              aria-label={t("playlists.closeConvertDialog")}
              onClick={() => { if (!converting) setShowConvertDialog(false); }}
              className="absolute inset-0 bg-black/65"
            />

            <div className="absolute left-1/2 top-1/2 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{t("playlists.convertDialogTitle")}</h3>
                  <p className="text-sm text-white/55">
                    {t("playlists.convertDialogBody", {
                      count: trackCount,
                      tracksWord: trackCount === 1 ? t("playlists.trackWord") : t("playlists.tracksWord"),
                      name: selectedPlaylist.name,
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { if (!converting) setShowConvertDialog(false); }}
                  className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  title={t("playlists.close")}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs leading-relaxed text-amber-100/90">
                  {t("playlists.convertWarning")}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t("releases.titleLabel")}</label>
                  <input
                    value={convertTitle}
                    onChange={(e) => setConvertTitle(e.target.value)}
                    maxLength={200}
                    disabled={converting}
                    className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:opacity-60"
                    placeholder={t("releases.releaseTitlePlaceholder")}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t("playlists.kindOfRelease")}</label>
                  <div className="flex gap-2">
                    {RELEASE_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        disabled={converting}
                        onClick={() => setConvertType(t.value)}
                        className={`h-9 flex-1 rounded-full border text-sm font-medium transition-colors disabled:opacity-60 ${
                          convertType === t.value
                            ? "border-white bg-white text-black"
                            : "border-white/12 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t("releases.artistAliasLabel")}</label>
                  {artistAliasOptions.length > 0 ? (
                    <select
                      value={convertArtistAlias}
                      onChange={(e) => setConvertArtistAlias(e.target.value)}
                      disabled={converting}
                      className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white outline-none focus:border-white/25 disabled:opacity-60"
                    >
                      <option value="">{t("releases.defaultArtist", { name: defaultArtistLabel })}</option>
                      {artistAliasOptions.map((alias) => (
                        <option key={alias} value={alias}>{alias}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/55">
                      {defaultArtistLabel}
                    </p>
                  )}
                </div>

                {convertError && (
                  <p className="text-sm text-red-300/90">{convertError}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowConvertDialog(false)}
                    disabled={converting}
                    className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white disabled:opacity-50"
                  >
                    {t("playlists.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleConvertToRelease}
                    disabled={converting || !convertTitle.trim()}
                    className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {converting ? t("playlists.converting") : t("playlists.convert")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {publishPromptRelease && (
        <div className="fixed inset-0 z-70">
          <div className="absolute inset-0 bg-black/65" />
          <div className="absolute left-1/2 top-1/2 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <h3 className="text-lg font-semibold text-white">{t("playlists.releaseCreatedTitle")}</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              {t("playlists.publishPromptBody", {
                title: publishPromptRelease.title,
                count: publishPromptRelease.trackCount,
                tracksWord:
                  publishPromptRelease.trackCount === 1
                    ? t("playlists.trackWord")
                    : t("playlists.tracksWord"),
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void handlePublishDecision(false)}
                disabled={publishing}
                className="h-9 rounded-full border border-white/12 bg-white/5 px-4 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                {t("playlists.notNow")}
              </button>
              <button
                type="button"
                onClick={() => void handlePublishDecision(true)}
                disabled={publishing}
                className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishing ? t("playlists.publishing") : t("playlists.publish")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCoverPicker && selectedPlaylist && (
        <div className="fixed inset-0 z-70">
          <button
            type="button"
            aria-label={t("playlists.closeCoverPicker")}
            onClick={() => setShowCoverPicker(false)}
            className="absolute inset-0 bg-black/65"
          />

          <div className="absolute left-1/2 top-1/2 w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("playlists.coverPickerTitle")}</h3>
                <p className="text-sm text-white/55">{t("playlists.coverPickerSubtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCoverPicker(false)}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title={t("playlists.close")}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!randomCover}
                onClick={() => {
                  if (!randomCover) return;
                  handleSetPlaylistCover(randomCover);
                }}
                className="h-9 rounded-full border border-white/12 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("playlists.useRandom")}
              </button>
              <button
                type="button"
                disabled={uploadingCover}
                onClick={() => playlistCoverInputRef.current?.click()}
                className="h-9 rounded-full border border-white/12 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                {uploadingCover ? t("playlists.uploading") : t("playlists.uploadImage")}
              </button>
              <button
                type="button"
                onClick={handleResetPlaylistCover}
                className="h-9 rounded-full border border-white/12 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t("playlists.resetToAuto")}
              </button>
              <input
                ref={playlistCoverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadPlaylistCover(file);
                  e.target.value = "";
                }}
              />
            </div>

            {coverCandidates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/3 p-4 text-sm text-white/55">
                {t("playlists.noCoverImages")}
              </div>
            ) : (
              <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {coverCandidates.map((candidateUrl) => {
                  const activeCover = playlistCoverOverrides[selectedPlaylist.id] ?? null;
                  const isActive = activeCover === candidateUrl;

                  return (
                    <button
                      key={candidateUrl}
                      type="button"
                      onClick={() => handleSetPlaylistCover(candidateUrl)}
                      className={`overflow-hidden rounded-2xl border transition ${isActive ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.5)]" : "border-white/12 hover:border-white/35"}`}
                      title={t("playlists.useThisCover")}
                    >
                      <img src={candidateUrl} alt={t("playlists.coverCandidateAlt")} className="h-28 w-full object-cover" loading="lazy" decoding="async" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
