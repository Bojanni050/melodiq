"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackCard from "@/components/tracks/TrackCard";
import TrackDetail from "@/components/TrackDetail";
import TrackEditPanel from "@/components/tracks/TrackEditPanel";
import ResizablePanel from "@/components/studio/ResizablePanel";
import ArtistLink from "@/components/artist/ArtistLink";
import { useSidebarStore, useReleaseStore, useUserStore, usePlayerStore, usePlaylistStore, useStudioStore } from "@/lib/store";
import { formatTotalDuration } from "@/lib/track-utils";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";
import type { ReuseScope, TrackItem } from "@/components/tracks/types";
import { buildReusePayload } from "@/lib/reuse-prompt";
import { useT } from "@/hooks/useT";

const RELEASE_TYPES: { value: string; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
];

type ViewMode = "grid" | "list";
type SortBy = "recent" | "title" | "unpublished";

export default function ReleasesPage() {
  const router = useRouter();
  const t = useT();
  const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: "recent", label: t("releases.sortRecent") },
    { value: "title", label: t("releases.sortTitle") },
    { value: "unpublished", label: t("releases.sortUnpublished") },
  ];
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const { releases, loadReleases, deleteRelease, updateReleaseDetails, renameRelease, toggleReleasePublic, toggleReleaseSpotlight } = useReleaseStore();
  const user = useUserStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("single");
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtistAlias, setEditArtistAlias] = useState("");
  const [editWriterName, setEditWriterName] = useState("");
  const [editComposerName, setEditComposerName] = useState("");
  const [editCredits, setEditCredits] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingArtistApply, setPendingArtistApply] = useState<{ releaseId: string; artist: string; count: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tracksById, setTracksById] = useState<Map<string, TrackItem>>(new Map());
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [editingTrack, setEditingTrack] = useState<TrackItem | null>(null);
  const [gridMenuReleaseId, setGridMenuReleaseId] = useState<string | null>(null);

  const createRelease = useReleaseStore((state) => state.createRelease);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  // The cover play button mirrors TrackCard's thumbnail: it shows a pause glyph
  // while this release's first track is loaded and actually playing.
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const rightPanelWidth = usePlayerStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((s) => s.setRightPanelWidth);
  const { playlists, addTrackToPlaylist, loadPlaylists } = usePlaylistStore();

  useEffect(() => {
    void loadReleases().finally(() => setLoading(false));
  }, [loadReleases]);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    if (!gridMenuReleaseId) return;
    function handleClick() { setGridMenuReleaseId(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [gridMenuReleaseId]);

  // Only needed for the list view (full track cards) — fetched lazily so
  // switching to list never blocks the default grid view on it.
  useEffect(() => {
    if (viewMode !== "list" || tracksById.size > 0) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/tracks?status=done");
        if (!active || !res.ok) return;
        const data = await res.json();
        const list: TrackItem[] = Array.isArray(data) ? data : data.tracks ?? [];
        setTracksById(new Map(list.map((t) => [t.id, t])));
      } catch (error) {
        console.error("Failed to load tracks for release list view:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [viewMode, tracksById.size]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  const trackItemsByRelease = useMemo(() => {
    const map = new Map<string, TrackItem[]>();
    releases.forEach((release) => {
      const items = [...release.tracks]
        .sort((a, b) => a.position - b.position)
        .map((rt) => tracksById.get(rt.trackId))
        .filter((t): t is TrackItem => !!t);
      map.set(release.id, items);
    });
    return map;
  }, [releases, tracksById]);

  const allTracks = useMemo(
    () => Array.from(trackItemsByRelease.values()).flat(),
    [trackItemsByRelease]
  );

  const sortedReleases = useMemo(() => {
    const sorted = [...releases];
    if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "unpublished") {
      // Not-published releases first (so drafts are easy to find), newest first within each group.
      sorted.sort((a, b) => {
        if (!!a.isPublic !== !!b.isPublic) return a.isPublic ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  }, [releases, sortBy]);

  const releaseIdByTrackId = useMemo(() => {
    const map = new Map<string, string>();
    trackItemsByRelease.forEach((items, releaseId) => {
      items.forEach((item) => map.set(item.id, releaseId));
    });
    return map;
  }, [trackItemsByRelease]);

  const {
    selectedTrack,
    showTrackDetailsPanel,
    openTrackDetails,
    closeTrackDetails,
  } = useTrackDetailsPanel<TrackItem>(allTracks);

  function toPlayContextTrack(t: TrackItem, audioUrlOverride?: string | null) {
    return {
      id: t.id,
      title: t.title,
      provider: t.provider,
      providerModel: t.providerModel,
      prompt: t.prompt,
      status: t.status,
      audioUrl: audioUrlOverride !== undefined ? audioUrlOverride : t.audioUrl,
      audioUrlHd: t.audioUrlHd,
      format: t.format,
      formatHd: t.formatHd,
      s3Key: null,
      s3KeyHd: t.s3KeyHd,
      duration: t.duration,
      lyrics: t.lyrics,
      lyricsTimestamps: t.lyricsTimestamps,
      createdAt: t.createdAt,
      error: t.error,
      coverUrl: t.coverUrl ?? null,
      s3KeyCover: t.s3KeyCover ?? null,
      rating: t.rating ?? null,
      artistName: t.artistName ?? null,
      archivedAt: t.archivedAt,
    };
  }

  // One ordered play context for the whole page, in the order the releases are
  // listed. Scoping it to a single release meant a one-track release queued
  // slice(1) === [] and autoplay had nothing to advance to, so playback stopped
  // after the first track. Carrying the entry's releaseId lets us locate the
  // exact occurrence of a track that appears on more than one release.
  const orderedPlayContext = useMemo(() => {
    const entries: { releaseId: string; track: TrackItem }[] = [];
    sortedReleases.forEach((release) => {
      (trackItemsByRelease.get(release.id) ?? []).forEach((track) => {
        if (track.status === "done") entries.push({ releaseId: release.id, track });
      });
    });
    return entries;
  }, [sortedReleases, trackItemsByRelease]);

  function playFromContextIndex(startIndex: number, audioUrlOverride?: string | null) {
    if (startIndex < 0 || startIndex >= orderedPlayContext.length) return;
    const player = usePlayerStore.getState();
    const playContext = orderedPlayContext.map((entry) => toPlayContextTrack(entry.track));

    player.setPlayContext(playContext);
    if (player.autoPlayNext) {
      player.setQueue(playContext.slice(startIndex + 1));
    }

    player.playTrackFromGesture(
      toPlayContextTrack(orderedPlayContext[startIndex].track, audioUrlOverride)
    );
  }

  function handlePlayAll() {
    playFromContextIndex(0);
  }

  function playReleaseTrack(releaseId: string | null, track: TrackItem, audioUrlOverride?: string | null) {
    const index = orderedPlayContext.findIndex(
      (entry) => entry.track.id === track.id && (releaseId === null || entry.releaseId === releaseId)
    );

    if (index >= 0) {
      playFromContextIndex(index, audioUrlOverride);
      return;
    }

    // Not in the context (e.g. the track isn't done). Play it on its own and
    // clear the queue, so a queue left over from an earlier selection can't
    // hijack autoplay and jump somewhere unrelated.
    const player = usePlayerStore.getState();
    const standalone = toPlayContextTrack(track, audioUrlOverride);
    player.setPlayContext([standalone]);
    player.setQueue([]);
    player.playTrackFromGesture(standalone);
  }

  function handleReusePrompt(track: TrackItem, scope: ReuseScope) {
    const { songIdea, lyrics } = useStudioStore.getState();
    if (songIdea.trim() || lyrics.trim()) {
      // If there's already content in studio, confirm before overwriting
      if (!window.confirm("This will replace your current studio content. Continue?")) return;
    }
    sessionStorage.setItem("melodiq-reuse-prompt-payload", JSON.stringify(buildReusePayload(track, scope)));
    router.push("/studio");
  }

  function handlePlayFromDetailsPanel(url: string) {
    if (!selectedTrack) return;
    playReleaseTrack(releaseIdByTrackId.get(selectedTrack.id) ?? null, selectedTrack, url || undefined);
  }

  function handleDownloadFromDetailsPanel(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd
      ? selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3"
      : selectedTrack?.format ?? "mp3";
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }

  async function handleCreateRelease() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createRelease({ title: newTitle, type: newType });
      if (id) {
        setNewTitle("");
        setShowCreate(false);
        router.push(`/releases/${id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  function openRelease(releaseId: string) {
    router.push(`/releases/${releaseId}`);
  }

  function openEditRelease(release: { id: string; title: string; artistName?: string | null; writerName?: string | null; composerName?: string | null; credits?: string | null }) {
    setEditingReleaseId(release.id);
    setEditTitle(release.title);
    setEditArtistAlias(release.artistName ?? "");
    setEditWriterName(release.writerName ?? "");
    setEditComposerName(release.composerName ?? "");
    setEditCredits(release.credits ?? "");
  }

  async function handleSaveEditRelease() {
    if (!editingReleaseId || savingEdit) return;
    const releaseId = editingReleaseId;
    const title = editTitle.trim();
    if (!title) return;
    const release = releases.find((r) => r.id === releaseId);
    const nextArtist = editArtistAlias.trim();
    const prevArtist = (release?.artistName ?? "").trim();
    const trackCount = release?.tracks.length ?? 0;
    if (release && nextArtist !== prevArtist && trackCount > 0) {
      setPendingArtistApply({ releaseId, artist: nextArtist, count: trackCount });
      return;
    }
    await persistEditRelease(releaseId, false);
  }

  async function persistEditRelease(releaseId: string, applyArtistToTracks: boolean) {
    const title = editTitle.trim();
    if (!title) return;
    setSavingEdit(true);
    try {
      renameRelease(releaseId, title);
      updateReleaseDetails(
        releaseId,
        { artistName: editArtistAlias, writerName: editWriterName, composerName: editComposerName, credits: editCredits },
        applyArtistToTracks ? { applyArtistToTracks: true } : undefined
      );
      if (applyArtistToTracks) {
        const nextArtist = editArtistAlias.trim() || null;
        setTracksById((prev) => {
          const next = new Map(prev);
          const release = releases.find((r) => r.id === releaseId);
          release?.tracks.forEach((rt) => {
            const track = next.get(rt.trackId);
            if (track) next.set(rt.trackId, { ...track, artistName: nextArtist });
          });
          return next;
        });
      }
      setEditingReleaseId(null);
      setPendingArtistApply(null);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="h-screen bg-canvas overflow-hidden text-ink">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height))] flex"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        <main className="relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-ink-dim">{t("releases.tagline")}</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t("releases.title")}</h1>
                <p className="max-w-2xl text-sm sm:text-base text-ink-muted">
                  {t("releases.description")}
                </p>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-ink-muted">
                    {t("releases.countLabel", { count: releases.length })}
                  </div>
                  <div className="flex items-center gap-0.5 rounded-full border border-line bg-white/5 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      aria-label={t("releases.gridView")}
                      title={t("releases.gridView")}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        viewMode === "grid" ? "bg-white/15 text-ink" : "text-ink-dim hover:text-ink-muted"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" strokeWidth={1.6} />
                        <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" strokeWidth={1.6} />
                        <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" strokeWidth={1.6} />
                        <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" strokeWidth={1.6} />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      aria-label={t("releases.listView")}
                      title={t("releases.listView")}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        viewMode === "list" ? "bg-white/15 text-ink" : "text-ink-dim hover:text-ink-muted"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                  {viewMode === "list" && (
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        className="appearance-none rounded-full border border-line bg-white/5 py-1.5 pl-3.5 pr-8 text-sm font-medium text-ink-muted outline-none transition-colors hover:bg-white/10"
                        aria-label={t("releases.sortReleases")}
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-surface">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                  {allTracks.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePlayAll}
                      className="flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
                      title="Play all tracks from all releases"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Play all
                    </button>
                  )}
                </div>
                {showCreate ? (
                  <div className="flex flex-wrap items-center gap-2  border border-line bg-white/5 p-2">
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleCreateRelease(); if (e.key === "Escape") { setShowCreate(false); setNewTitle(""); } }}
                      placeholder={t("releases.releaseTitlePlaceholder")}
                      maxLength={255}
                      className="h-9 w-48 rounded-full bg-transparent px-3 text-sm text-ink placeholder:text-ink-dim outline-none"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {RELEASE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setNewType(t.value)}
                          className={`h-9 rounded-full px-3 text-sm font-medium transition-colors ${
                            newType === t.value ? "bg-accent/80 text-ink" : "bg-white/5 text-ink-muted hover:bg-white/10"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={handleCreateRelease} disabled={creating} className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:opacity-50">
                      {creating ? t("releases.creating") : t("releases.add")}
                    </button>
                    <button type="button" onClick={() => { setShowCreate(false); setNewTitle(""); }} className="h-9 rounded-full px-4 text-sm text-ink-muted transition-colors hover:text-ink">
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="h-10 rounded-full border border-line bg-white/5 px-4 text-sm text-ink/75 transition-colors hover:bg-white/10 hover:text-ink"
                  >
                    {t("releases.createRelease")}
                  </button>
                )}
              </div>

              {loading ? (
                <div className=" border border-line bg-white/5 p-8 text-sm text-ink-muted">{t("releases.loadingReleases")}</div>
              ) : releases.length === 0 ? (
                <div className=" border border-dashed border-line bg-white/3 p-8 text-sm text-ink/55">
                  {t("releases.noReleasesYet")}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {releases.map((release) => (
                    <article
                      key={release.id}
                      className="group overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
                    >
                      <button type="button" onClick={() => openRelease(release.id)} className="block w-full text-left">
                        <div className="relative aspect-4/3 overflow-hidden bg-linear-135 from-[#1d2333] to-[#0f121a]">
                          {release.coverUrl ? (
                            <img
                              src={release.coverUrl}
                              alt={release.title}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-14 w-14 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" strokeWidth={1.2} />
                                <circle cx="12" cy="12" r="3" strokeWidth={1.2} />
                              </svg>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-black/10" />
                          <span className="absolute left-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-[11px] uppercase tracking-wide text-ink-muted backdrop-blur-sm">
                            {release.type}
                          </span>
                          {/* Three-dot menu */}
                          <div className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setGridMenuReleaseId(gridMenuReleaseId === release.id ? null : release.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-ink-muted backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-ink"
                              title="Release actions"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                              </svg>
                            </button>
                            {gridMenuReleaseId === release.id && (
                              <div className="absolute right-0 top-10 z-30 min-w-[160px]  border border-line bg-surface p-1.5 shadow-2xl">
                                <button
                                  type="button"
                                  onClick={() => { setGridMenuReleaseId(null); openEditRelease(release); }}
                                  className="w-full text-left px-3 py-1.5  text-sm text-ink-muted hover:bg-white/5"
                                >
                                  {t("releases.editRelease")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setGridMenuReleaseId(null); toggleReleasePublic(release.id); }}
                                  className={`w-full text-left px-3 py-1.5  text-sm hover:bg-white/5 ${release.isPublic ? "text-emerald-400/80 hover:text-emerald-300" : "text-ink-muted"}`}
                                >
                                  {release.isPublic ? t("releases.unpublish") : t("releases.publish")}
                                </button>
                                <div className="my-1 h-px bg-white/10" />
                                <button
                                  type="button"
                                  onClick={() => { setGridMenuReleaseId(null); setPendingDelete({ id: release.id, title: release.title }); }}
                                  className="w-full text-left px-3 py-1.5  text-sm text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
                                >
                                  {t("releases.delete")}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <h3 className="flex items-center gap-1.5 truncate text-lg font-semibold text-ink">
                              {release.isPublic && (
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full bg-pink-400"
                                  title={t("releases.published")}
                                  aria-label={t("releases.published")}
                                />
                              )}
                              <span className="truncate">{release.title}</span>
                            </h3>
                            {(release.artistName?.trim()) && (
                              <div className="truncate text-sm text-ink/85" onClick={(e) => e.stopPropagation()}>
                                <ArtistLink name={release.artistName} className="font-medium hover:underline" />
                              </div>
                            )}
                            <p className="text-sm text-ink/75">{release.tracks.length} {t("releases.tracks")}{release.kind ? ` · ${release.kind}` : ""}</p>
                          </div>
                        </div>
                      </button>

                      <div className="px-4 py-3">
                        <button type="button" onClick={() => openRelease(release.id)} className="text-sm text-ink-muted transition-colors hover:text-ink">
                          {t("releases.openRelease")}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  {sortedReleases.map((release) => {
                    const releaseTrackItems = trackItemsByRelease.get(release.id) ?? [];
                    const totalDuration = formatTotalDuration(
                      releaseTrackItems.reduce((s, t) => s + (t.duration ?? 0), 0)
                    );

                    return (
                      <section
                        key={release.id}
                        className=" border border-line bg-white/[0.02] p-4 sm:p-6 space-y-5"
                      >
                        {/* Hero — cover art left, meta to the right */}
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                          <div className="group/cover relative h-28 w-28 shrink-0 sm:h-36 sm:w-36">
                            <button
                              type="button"
                              onClick={() => openRelease(release.id)}
                              className="h-full w-full overflow-hidden  border border-line bg-surface shadow-xl shadow-black/40"
                            >
                              {release.coverUrl ? (
                                <img src={release.coverUrl} alt={release.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-surface-2">
                                  <svg className="h-8 w-8 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </div>
                              )}
                            </button>

                            {/* Play button pinned to the bottom-right of the
                                cover: white glyph, revealed on hover only,
                                and held open with a pause glyph while this
                                release is playing. */}
                            {releaseTrackItems.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Same track already loaded? Toggle playback,
                                  // the way clicking a playing thumbnail does.
                                  if (currentTrack?.id === releaseTrackItems[0].id) {
                                    setIsPlaying(!isPlaying);
                                    return;
                                  }
                                  playReleaseTrack(release.id, releaseTrackItems[0]);
                                }}
                                className="absolute inset-0 transition-colors group-hover/cover:bg-black/45"
                                aria-label={currentTrack?.id === releaseTrackItems[0].id && isPlaying ? t("releases.pause", { title: release.title }) : t("releases.play", { title: release.title })}
                                title={currentTrack?.id === releaseTrackItems[0].id && isPlaying ? t("releases.pause", { title: release.title }) : t("releases.play", { title: release.title })}
                              >
                                <span
                                  className={`absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all duration-200 ${
                                    currentTrack?.id === releaseTrackItems[0].id && isPlaying
                                      ? "opacity-100"
                                      : "opacity-0 group-hover/cover:opacity-100"
                                  }`}
                                >
                                  {currentTrack?.id === releaseTrackItems[0].id && isPlaying ? (
                                    <svg className="h-4 w-4 text-ink" fill="currentColor" viewBox="0 0 24 24">
                                      <rect x="6" y="4" width="4" height="16" rx="1" />
                                      <rect x="14" y="4" width="4" height="16" rx="1" />
                                    </svg>
                                  ) : (
                                    <svg className="h-4 w-4 translate-x-0.5 text-ink" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  )}
                                </span>
                              </button>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => openRelease(release.id)}
                              className="flex items-center gap-2 truncate text-left text-xl font-bold tracking-tight text-ink hover:underline sm:text-2xl"
                            >
                              {release.isPublic && (
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-pink-400"
                                  title={t("releases.published")}
                                  aria-label={t("releases.published")}
                                />
                              )}
                              <span className="truncate">{release.title}</span>
                            </button>
                            {(() => {
                              const artistLabel =
                                release.artistName?.trim() ||
                                releaseTrackItems[0]?.artistName?.trim() ||
                                "";
                              return artistLabel ? (
                                <div className="truncate">
                                  <ArtistLink
                                    name={artistLabel}
                                    className="text-sm font-semibold text-ink/85 hover:underline hover:text-ink"
                                  />
                                </div>
                              ) : null;
                            })()}
                            <p className="text-sm text-ink-muted">
                              <span className="capitalize">{release.type}</span>
                              {release.kind && (
                                <>
                                  <span className="mx-1.5 text-ink-dim">·</span>
                                  {release.kind}
                                </>
                              )}
                              <span className="mx-1.5 text-ink-dim">·</span>
                              {releaseTrackItems.length} {releaseTrackItems.length === 1 ? t("releases.track") : t("releases.tracks")}
                              {totalDuration ? `, ${totalDuration}` : ""}
                              {!release.isPublic && (
                                <>
                                  <span className="mx-1.5 text-ink-dim">·</span>
                                  <span className="text-ink-dim">{t("releases.unpublished")}</span>
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-3 pt-0.5">
                              <button
                                type="button"
                                onClick={() => openEditRelease(release)}
                                className="text-sm text-ink-dim transition-colors hover:text-ink"
                              >
                                {t("releases.editRelease")}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleReleasePublic(release.id)}
                                className={`text-sm transition-colors ${release.isPublic ? "text-emerald-400/70 hover:text-emerald-300" : "text-ink-dim hover:text-ink"}`}
                              >
                                {release.isPublic ? t("releases.unpublish") : t("releases.publish")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete({ id: release.id, title: release.title })}
                                className="text-sm text-ink-dim transition-colors hover:text-red-300"
                              >
                                {t("releases.delete")}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Tracks */}
                        {releaseTrackItems.length > 0 ? (
                          <div className="space-y-1">
                            {releaseTrackItems.map((track) => (
                              <TrackCard
                                key={track.id}
                                track={track}
                                onPlay={(t) => playReleaseTrack(release.id, t)}
                                onSelect={(t) =>
                                  openTrackDetails({
                                    ...t,
                                    coverUrl: t.coverUrl ?? null,
                                    s3KeyCover: t.s3KeyCover ?? null,
                                    rating: t.rating ?? null,
                                  })
                                }
                                onReusePrompt={handleReusePrompt}
                                onAddToPlaylist={(trackId, targetPlaylistId, options) =>
                                  addTrackToPlaylist(targetPlaylistId, trackId, options)
                                }
                                playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                                onTitleUpdate={(trackId, newTitle) => {
                                  setTracksById((prev) => {
                                    const next = new Map(prev);
                                    const t = next.get(trackId);
                                    if (t) next.set(trackId, { ...t, title: newTitle });
                                    return next;
                                  });
                                }}
                                onArtistUpdate={(trackId, artistName) => {
                                  setTracksById((prev) => {
                                    const next = new Map(prev);
                                    const t = next.get(trackId);
                                    if (t) next.set(trackId, { ...t, artistName });
                                    return next;
                                  });
                                }}
                                onEditDetails={(t) =>
                                  setEditingTrack({
                                    ...t,
                                    coverUrl: t.coverUrl ?? null,
                                    s3KeyCover: t.s3KeyCover ?? null,
                                    rating: t.rating ?? null,
                                  })
                                }
                                isDetailSelected={selectedTrack?.id === track.id}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="px-1 text-sm text-ink-dim">
                            {tracksById.size === 0 ? t("releases.loadingTracksList") : t("releases.noTracksYet")}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>

        {viewMode === "list" && (
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
                  onPlay={handlePlayFromDetailsPanel}
                  onDownload={handleDownloadFromDetailsPanel}
                />
              ) : (
                <div className="h-full px-5 py-6 text-ink-dim">
                  <h3 className="text-sm font-medium text-ink-muted">{t("common.trackDetails")}</h3>
                  <p className="text-sm mt-3">{t("common.selectTrackHint")}</p>
                </div>
              )}
            </div>
          </ResizablePanel>
        )}
      </div>

      {editingReleaseId && (() => {
        const artistAliasOptions = (user?.artistAliases ?? []).filter((alias) => alias.trim());
        const defaultArtistLabel = user?.artistAlias?.trim() || user?.name?.trim() || t("releases.unknownArtist");
        const defaultWriterLabel = user?.writerAlias?.trim() || "";
        const defaultComposerLabel = user?.composerAlias?.trim() || "";

        return (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
            <button
              type="button"
              aria-label={t("releases.cancelEditRelease")}
              onClick={() => { if (!savingEdit) setEditingReleaseId(null); }}
              className="absolute inset-0 bg-black/65"
            />
            <div className="relative w-full max-w-[480px]  border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <h3 className="text-lg font-semibold text-ink">{t("releases.editRelease")}</h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-dim">{t("releases.titleLabel")}</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={255}
                    disabled={savingEdit}
                    className="h-10 w-full  border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-dim outline-none focus:border-line/25 disabled:opacity-60"
                    placeholder={t("releases.releaseTitlePlaceholder")}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-dim">{t("releases.artistAliasLabel")}</label>
                  {artistAliasOptions.length > 0 ? (
                    <select
                      value={editArtistAlias}
                      onChange={(e) => setEditArtistAlias(e.target.value)}
                      disabled={savingEdit}
                      className="h-10 w-full  border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-line/25 disabled:opacity-60"
                    >
                      <option value="">{t("releases.defaultArtist", { name: defaultArtistLabel })}</option>
                      {artistAliasOptions.map((alias) => (
                        <option key={alias} value={alias}>{alias}</option>
                      ))}
                    </select>
                  ) : (
                    <p className=" border border-line bg-white/5 px-3 py-2.5 text-sm text-ink/55">
                      {defaultArtistLabel}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-dim">Composer</label>
                    <input
                      value={editComposerName}
                      onChange={(e) => setEditComposerName(e.target.value)}
                      maxLength={255}
                      disabled={savingEdit}
                      className="h-10 w-full  border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-dim outline-none focus:border-line/25 disabled:opacity-60"
                      placeholder={defaultComposerLabel || "Composer name"}
                      list="release-composer-options"
                    />
                    {defaultComposerLabel && (
                      <datalist id="release-composer-options">
                        <option value={defaultComposerLabel} />
                      </datalist>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-dim">Writer</label>
                    <input
                      value={editWriterName}
                      onChange={(e) => setEditWriterName(e.target.value)}
                      maxLength={255}
                      disabled={savingEdit}
                      className="h-10 w-full  border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-dim outline-none focus:border-line/25 disabled:opacity-60"
                      placeholder={defaultWriterLabel || "Writer name"}
                      list="release-writer-options"
                    />
                    {defaultWriterLabel && (
                      <datalist id="release-writer-options">
                        <option value={defaultWriterLabel} />
                      </datalist>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-dim">{t("releases.creditsLabel")}</label>
                  <textarea
                    value={editCredits}
                    onChange={(e) => setEditCredits(e.target.value.slice(0, 2000))}
                    rows={3}
                    disabled={savingEdit}
                    placeholder={t("releases.creditsPlaceholder")}
                    className="w-full resize-none  border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-dim outline-none focus:border-line/25 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-center justify-between  border border-line bg-surface px-3 py-2.5">
                  <div>
                    <p className="text-sm text-ink-muted">Spotlight</p>
                    <p className="text-[11px] text-ink-dim">Show this release prominently on the Discover page</p>
                  </div>
                  {editingReleaseId && (() => {
                    const release = releases.find((r) => r.id === editingReleaseId);
                    return (
                      <button
                        type="button"
                        onClick={() => toggleReleaseSpotlight(editingReleaseId)}
                        disabled={savingEdit}
                        className={`relative h-6 w-11 rounded-full transition-colors ${release?.isSpotlight ? "bg-accent" : "bg-white/15"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${release?.isSpotlight ? "left-[22px]" : "left-0.5"}`} />
                      </button>
                    );
                  })()}
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReleaseId(null)}
                  disabled={savingEdit}
                  className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14 disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditRelease}
                  disabled={savingEdit || !editTitle.trim()}
                  className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {pendingArtistApply && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4">
          <button type="button" aria-label={t("common.cancel")} onClick={() => { if (!savingEdit) setPendingArtistApply(null); }} className="absolute inset-0 bg-black/65" />
          <div className="relative w-full max-w-[420px]  border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <h3 className="text-lg font-semibold text-ink">{t("releases.applyArtistTitle")}</h3>
            <p className="mt-2 text-sm text-ink-muted">
              {t("releases.applyArtistBody", {
                artist: pendingArtistApply.artist || t("releases.unknownArtist"),
                count: pendingArtistApply.count,
                trackWord: pendingArtistApply.count === 1 ? t("releases.track") : t("releases.tracks"),
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingArtistApply(null)} disabled={savingEdit} className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14 disabled:opacity-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void persistEditRelease(pendingArtistApply.releaseId, false)}
                disabled={savingEdit}
                className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14 disabled:opacity-50"
              >
                {t("releases.applyArtistReleaseOnly")}
              </button>
              <button
                type="button"
                onClick={() => void persistEditRelease(pendingArtistApply.releaseId, true)}
                disabled={savingEdit}
                className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("releases.applyArtistReleaseAndTracks")}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <button type="button" aria-label={t("releases.cancelDelete")} onClick={() => setPendingDelete(null)} className="absolute inset-0 bg-black/65" />
          <div className="relative w-full max-w-[420px]  border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <h3 className="text-lg font-semibold text-ink">{t("releases.deleteReleaseTitle")}</h3>
            <p className="mt-2 text-sm text-ink-muted">
              {t("releases.deleteReleaseBody", { title: pendingDelete.title })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-ink-muted transition-colors hover:bg-white/14">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => { deleteRelease(pendingDelete.id); setPendingDelete(null); }}
                className="h-10 rounded-full bg-red-500/80 px-4 text-sm font-medium text-ink transition-colors hover:bg-red-500"
              >
                {t("releases.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTrack && (
        <TrackEditPanel
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSaved={(updated) => {
            setTracksById((prev) => {
              const next = new Map(prev);
              next.set(updated.id, updated);
              return next;
            });
            setEditingTrack(null);
          }}
        />
      )}
    </div>
  );
}
