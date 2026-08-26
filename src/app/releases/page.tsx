"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackCard from "@/components/tracks/TrackCard";
import TrackDetail from "@/components/TrackDetail";
import TrackEditPanel from "@/components/tracks/TrackEditPanel";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { useSidebarStore, useReleaseStore, useUserStore, usePlayerStore, usePlaylistStore, useStudioStore } from "@/lib/store";
import { formatTotalDuration } from "@/lib/track-utils";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";
import type { TrackItem } from "@/components/tracks/types";
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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [tracksById, setTracksById] = useState<Map<string, TrackItem>>(new Map());
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [editingTrack, setEditingTrack] = useState<TrackItem | null>(null);
  const [gridMenuReleaseId, setGridMenuReleaseId] = useState<string | null>(null);

  const createRelease = useReleaseStore((state) => state.createRelease);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
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

  function handlePlayAll() {
    if (allTracks.length === 0) return;
    const player = usePlayerStore.getState();
    const playContext = allTracks.map((t) => toPlayContextTrack(t));
    player.setPlayContext(playContext);
    if (player.autoPlayNext) {
      const nextQueue = playContext.slice(1).filter((t) => t.status === "done");
      player.setQueue(nextQueue);
    }
    player.playTrackFromGesture(playContext[0]);
  }

  function playReleaseTrack(releaseTrackItems: TrackItem[], track: TrackItem, audioUrlOverride?: string | null) {
    const player = usePlayerStore.getState();
    const playContext = releaseTrackItems.map((t) => toPlayContextTrack(t));

    player.setPlayContext(playContext);
    if (player.autoPlayNext) {
      const index = playContext.findIndex((t) => t.id === track.id);
      if (index >= 0) {
        const nextQueue = playContext
          .slice(index + 1)
          .filter((t) => t.status === "done");
        player.setQueue(nextQueue);
      }
    }

    player.playTrackFromGesture(toPlayContextTrack(track, audioUrlOverride ?? null));
  }

  function handleReusePrompt(track: TrackItem) {
    const { songIdea, lyrics } = useStudioStore.getState();
    if (songIdea.trim() || lyrics.trim()) {
      // If there's already content in studio, confirm before overwriting
      if (!window.confirm("This will replace your current studio content. Continue?")) return;
    }
    sessionStorage.setItem("melodiq-reuse-prompt-payload", JSON.stringify({ songIdea: track.prompt || "", lyrics: track.lyrics || "" }));
    router.push("/studio");
  }

  function handlePlayFromDetailsPanel(url: string) {
    if (!selectedTrack) return;
    const releaseId = releaseIdByTrackId.get(selectedTrack.id);
    const releaseTrackItems = (releaseId && trackItemsByRelease.get(releaseId)) || [selectedTrack];
    playReleaseTrack(releaseTrackItems, selectedTrack, url || null);
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
    setSavingEdit(true);
    try {
      renameRelease(releaseId, title);
      updateReleaseDetails(releaseId, { artistName: editArtistAlias, writerName: editWriterName, composerName: editComposerName, credits: editCredits });
      setEditingReleaseId(null);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height))] flex"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        <main className="relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">{t("releases.tagline")}</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t("releases.title")}</h1>
                <p className="max-w-2xl text-sm sm:text-base text-white/60">
                  {t("releases.description")}
                </p>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                    {t("releases.countLabel", { count: releases.length })}
                  </div>
                  <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      aria-label={t("releases.gridView")}
                      title={t("releases.gridView")}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        viewMode === "grid" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
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
                        viewMode === "list" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
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
                        className="appearance-none rounded-full border border-white/10 bg-white/5 py-1.5 pl-3.5 pr-8 text-sm font-medium text-white/80 outline-none transition-colors hover:bg-white/10"
                        aria-label={t("releases.sortReleases")}
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-[#161621]">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                  {allTracks.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePlayAll}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleCreateRelease(); if (e.key === "Escape") { setShowCreate(false); setNewTitle(""); } }}
                      placeholder={t("releases.releaseTitlePlaceholder")}
                      maxLength={255}
                      className="h-9 w-48 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      {RELEASE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setNewType(t.value)}
                          className={`h-9 rounded-full px-3 text-sm font-medium transition-colors ${
                            newType === t.value ? "bg-primary-500/80 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={handleCreateRelease} disabled={creating} className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50">
                      {creating ? t("releases.creating") : t("releases.add")}
                    </button>
                    <button type="button" onClick={() => { setShowCreate(false); setNewTitle(""); }} className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white">
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {t("releases.createRelease")}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">{t("releases.loadingReleases")}</div>
              ) : releases.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/3 p-8 text-sm text-white/55">
                  {t("releases.noReleasesYet")}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {releases.map((release) => (
                    <article
                      key={release.id}
                      className="group overflow-hidden rounded-[26px] border border-white/10 bg-[#0f1017] shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
                    >
                      <button type="button" onClick={() => openRelease(release.id)} className="block w-full text-left">
                        <div className="relative aspect-4/3 overflow-hidden bg-linear-135 from-[#1d2333] to-[#0f121a]">
                          {release.coverUrl ? (
                            <img
                              src={release.coverUrl}
                              alt={release.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-14 w-14 text-white/35" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" strokeWidth={1.2} />
                                <circle cx="12" cy="12" r="3" strokeWidth={1.2} />
                              </svg>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-black/10" />
                          <span className="absolute left-4 top-4 rounded-full bg-black/60 px-2.5 py-1 text-[11px] uppercase tracking-wide text-white/80 backdrop-blur-sm">
                            {release.type}
                          </span>
                          {/* Three-dot menu */}
                          <div className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setGridMenuReleaseId(gridMenuReleaseId === release.id ? null : release.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
                              title="Release actions"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
                              </svg>
                            </button>
                            {gridMenuReleaseId === release.id && (
                              <div className="absolute right-0 top-10 z-30 min-w-[160px] rounded-xl border border-white/10 bg-[#12121a] p-1.5 shadow-2xl">
                                <button
                                  type="button"
                                  onClick={() => { setGridMenuReleaseId(null); openEditRelease(release); }}
                                  className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-white/80 hover:bg-white/5"
                                >
                                  {t("releases.editRelease")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setGridMenuReleaseId(null); toggleReleasePublic(release.id); }}
                                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 ${release.isPublic ? "text-emerald-400/80 hover:text-emerald-300" : "text-white/80"}`}
                                >
                                  {release.isPublic ? t("releases.unpublish") : t("releases.publish")}
                                </button>
                                <div className="my-1 h-px bg-white/10" />
                                <button
                                  type="button"
                                  onClick={() => { setGridMenuReleaseId(null); setPendingDelete({ id: release.id, title: release.title }); }}
                                  className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
                                >
                                  {t("releases.delete")}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <h3 className="flex items-center gap-1.5 truncate text-lg font-semibold text-white">
                              {release.isPublic && (
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full bg-pink-400"
                                  title={t("releases.published")}
                                  aria-label={t("releases.published")}
                                />
                              )}
                              <span className="truncate">{release.title}</span>
                            </h3>
                            <p className="text-sm text-white/75">{release.tracks.length} {t("releases.tracks")}{release.kind ? ` · ${release.kind}` : ""}</p>
                          </div>
                        </div>
                      </button>

                      <div className="px-4 py-3">
                        <button type="button" onClick={() => openRelease(release.id)} className="text-sm text-white/60 transition-colors hover:text-white">
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
                        className="rounded-3xl border border-white/8 bg-white/[0.02] p-4 sm:p-6 space-y-5"
                      >
                        {/* Hero — cover art left, meta to the right */}
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                          <button
                            type="button"
                            onClick={() => openRelease(release.id)}
                            className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1b25] shadow-xl shadow-black/40 sm:h-36 sm:w-36"
                          >
                            {release.coverUrl ? (
                              <img src={release.coverUrl} alt={release.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-600/40 to-primary-900/40">
                                <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                            )}
                          </button>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => openRelease(release.id)}
                              className="flex items-center gap-2 truncate text-left text-xl font-bold tracking-tight text-white hover:underline sm:text-2xl"
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
                            <p className="text-sm text-white/60">
                              <span className="capitalize">{release.type}</span>
                              {release.kind && (
                                <>
                                  <span className="mx-1.5 text-white/25">·</span>
                                  {release.kind}
                                </>
                              )}
                              <span className="mx-1.5 text-white/25">·</span>
                              {releaseTrackItems.length} {releaseTrackItems.length === 1 ? t("releases.track") : t("releases.tracks")}
                              {totalDuration ? `, ${totalDuration}` : ""}
                              {!release.isPublic && (
                                <>
                                  <span className="mx-1.5 text-white/25">·</span>
                                  <span className="text-white/40">{t("releases.unpublished")}</span>
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-3 pt-0.5">
                              <button
                                type="button"
                                onClick={() => openEditRelease(release)}
                                className="text-sm text-white/45 transition-colors hover:text-white"
                              >
                                {t("releases.editRelease")}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleReleasePublic(release.id)}
                                className={`text-sm transition-colors ${release.isPublic ? "text-emerald-400/70 hover:text-emerald-300" : "text-white/45 hover:text-white"}`}
                              >
                                {release.isPublic ? t("releases.unpublish") : t("releases.publish")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete({ id: release.id, title: release.title })}
                                className="text-sm text-white/45 transition-colors hover:text-red-300"
                              >
                                {t("releases.delete")}
                              </button>
                            </div>
                          </div>

                          {releaseTrackItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() => playReleaseTrack(releaseTrackItems, releaseTrackItems[0])}
                              className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg shadow-primary-500/30 transition-transform hover:scale-105 active:scale-95 sm:self-end"
                              aria-label={t("releases.play", { title: release.title })}
                              title={t("releases.play", { title: release.title })}
                            >
                              <svg className="h-4.5 w-4.5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Tracks */}
                        {releaseTrackItems.length > 0 ? (
                          <div className="space-y-1">
                            {releaseTrackItems.map((track) => (
                              <TrackCard
                                key={track.id}
                                track={track}
                                onPlay={(t) => playReleaseTrack(releaseTrackItems, t)}
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
                          <p className="px-1 text-sm text-white/40">
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
                <div className="h-full px-5 py-6 text-white/45">
                  <h3 className="text-sm font-medium text-white/60">{t("common.trackDetails")}</h3>
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
            <div className="relative w-full max-w-[480px] rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
              <h3 className="text-lg font-semibold text-white">{t("releases.editRelease")}</h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t("releases.titleLabel")}</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={255}
                    disabled={savingEdit}
                    className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:opacity-60"
                    placeholder={t("releases.releaseTitlePlaceholder")}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t("releases.artistAliasLabel")}</label>
                  {artistAliasOptions.length > 0 ? (
                    <select
                      value={editArtistAlias}
                      onChange={(e) => setEditArtistAlias(e.target.value)}
                      disabled={savingEdit}
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">Composer</label>
                    <input
                      value={editComposerName}
                      onChange={(e) => setEditComposerName(e.target.value)}
                      maxLength={255}
                      disabled={savingEdit}
                      className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:opacity-60"
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
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">Writer</label>
                    <input
                      value={editWriterName}
                      onChange={(e) => setEditWriterName(e.target.value)}
                      maxLength={255}
                      disabled={savingEdit}
                      className="h-10 w-full rounded-xl border border-white/12 bg-[#11121a] px-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:opacity-60"
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
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t("releases.creditsLabel")}</label>
                  <textarea
                    value={editCredits}
                    onChange={(e) => setEditCredits(e.target.value.slice(0, 2000))}
                    rows={3}
                    disabled={savingEdit}
                    placeholder={t("releases.creditsPlaceholder")}
                    className="w-full resize-none rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/12 bg-[#11121a] px-3 py-2.5">
                  <div>
                    <p className="text-sm text-white/80">Spotlight</p>
                    <p className="text-[11px] text-white/40">Show this release prominently on the Discover page</p>
                  </div>
                  {editingReleaseId && (() => {
                    const release = releases.find((r) => r.id === editingReleaseId);
                    return (
                      <button
                        type="button"
                        onClick={() => toggleReleaseSpotlight(editingReleaseId)}
                        disabled={savingEdit}
                        className={`relative h-6 w-11 rounded-full transition-colors ${release?.isSpotlight ? "bg-primary-500" : "bg-white/15"}`}
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
                  className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/14 disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditRelease}
                  disabled={savingEdit || !editTitle.trim()}
                  className="h-10 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {pendingDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <button type="button" aria-label={t("releases.cancelDelete")} onClick={() => setPendingDelete(null)} className="absolute inset-0 bg-black/65" />
          <div className="relative w-full max-w-[420px] rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <h3 className="text-lg font-semibold text-white">{t("releases.deleteReleaseTitle")}</h3>
            <p className="mt-2 text-sm text-white/60">
              {t("releases.deleteReleaseBody", { title: pendingDelete.title })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="h-10 rounded-full bg-white/8 px-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/14">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => { deleteRelease(pendingDelete.id); setPendingDelete(null); }}
                className="h-10 rounded-full bg-red-500/80 px-4 text-sm font-medium text-white transition-colors hover:bg-red-500"
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
