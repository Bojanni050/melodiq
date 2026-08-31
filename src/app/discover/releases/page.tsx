"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TrackCard from "@/components/tracks/TrackCard";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { usePlayerStore, usePlaylistStore, useSidebarStore, useUserStore } from "@/lib/store";
import { formatTotalDuration } from "@/lib/track-utils";
import { useSmartBack } from "@/lib/smart-back";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";
import { publicReleaseTracksToTrackItems, type PublicReleaseSummary } from "@/lib/public-release";
import type { TrackItem } from "@/components/tracks/types";

type TypeFilter = "all" | "single" | "ep" | "album";
type SortOrder = "date" | "title";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "single", label: "Singles" },
  { value: "ep", label: "EPs" },
  { value: "album", label: "Albums" },
];

// useSmartBack() reads useSearchParams(); unlike the dynamic-segment discover
// pages, this static route needs its own Suspense boundary or the build-time
// prerender fails.
export default function DiscoverReleasesPage() {
  return (
    <Suspense fallback={null}>
      <DiscoverReleasesPageInner />
    </Suspense>
  );
}

function DiscoverReleasesPageInner() {
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  const isListener = user?.role === "listener" || user?.role == null;
  const backTarget = useSmartBack({ href: "/discover", label: "Back to Discover" });

  const [releases, setReleases] = useState<PublicReleaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date");

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const rightPanelWidth = usePlayerStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((s) => s.setRightPanelWidth);
  const { playlists, addTrackToPlaylist, loadPlaylists } = usePlaylistStore();

  useEffect(() => {
    if (!user) void loadUser();
  }, [user, loadUser]);

  useEffect(() => {
    let active = true;
    async function fetchReleases() {
      try {
        const res = await fetch("/api/discover/releases");
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setReleases(Array.isArray(data.releases) ? data.releases : []);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchReleases();
    void loadPlaylists();
    return () => {
      active = false;
    };
  }, [loadPlaylists]);

  useEffect(() => {
    document.documentElement.style.setProperty("--right-panel-width", `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  const displayedReleases = useMemo(() => {
    const filtered = typeFilter === "all" ? releases : releases.filter((r) => r.type === typeFilter);
    const sorted = [...filtered];
    if (sortOrder === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => {
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        return bTime - aTime;
      });
    }
    return sorted;
  }, [releases, typeFilter, sortOrder]);

  // Each release's tracks, keyed by release id, plus a flat pool of every
  // track across every displayed release — the shared details panel and
  // "which release is this track from" lookups both need the flat pool.
  const trackItemsByRelease = useMemo(() => {
    const map = new Map<string, TrackItem[]>();
    displayedReleases.forEach((release) => {
      map.set(release.id, publicReleaseTracksToTrackItems(release));
    });
    return map;
  }, [displayedReleases]);

  const allTracks = useMemo(
    () => Array.from(trackItemsByRelease.values()).flat(),
    [trackItemsByRelease]
  );

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
      publicSource: true,
    };
  }

  // One ordered play context spanning every displayed release, in listed
  // order — mirroring the "My Releases" fix: scoping the queue to a single
  // release meant a one-track (or last-track) release's slice(1) === [], so
  // autoplay had nothing to advance to and playback just stopped. Carrying
  // the releaseId lets us locate the exact occurrence of a track that
  // appears on more than one release.
  const orderedPlayContext = useMemo(() => {
    const entries: { releaseId: string; track: TrackItem }[] = [];
    displayedReleases.forEach((release) => {
      (trackItemsByRelease.get(release.id) ?? []).forEach((track) => {
        entries.push({ releaseId: release.id, track });
      });
    });
    return entries;
  }, [displayedReleases, trackItemsByRelease]);

  function playFromContextIndex(startIndex: number, audioUrlOverride?: string | null) {
    if (startIndex < 0 || startIndex >= orderedPlayContext.length) return;
    const player = usePlayerStore.getState();
    const playContext = orderedPlayContext.map((entry) => toPlayContextTrack(entry.track));

    player.setPlayContext(playContext);
    if (player.autoPlayNext) {
      player.setQueue(playContext.slice(startIndex + 1));
    }

    player.playTrackFromGesture(
      toPlayContextTrack(orderedPlayContext[startIndex].track, audioUrlOverride ?? null)
    );
  }

  function playReleaseTrack(releaseId: string | null, track: TrackItem, audioUrlOverride?: string | null) {
    const index = orderedPlayContext.findIndex(
      (entry) => entry.track.id === track.id && (releaseId === null || entry.releaseId === releaseId)
    );

    if (index >= 0) {
      playFromContextIndex(index, audioUrlOverride);
      return;
    }

    // Not in the context (e.g. filtered out). Play it on its own and clear
    // the queue, so a queue left over from an earlier selection can't
    // hijack autoplay and jump somewhere unrelated.
    const player = usePlayerStore.getState();
    const standalone = toPlayContextTrack(track, audioUrlOverride ?? null);
    player.setPlayContext([standalone]);
    player.setQueue([]);
    player.playTrackFromGesture(standalone);
  }

  function handlePlayAll() {
    if (allTracks.length === 0) return;
    if (currentTrack && allTracks.some((t) => t.id === currentTrack.id)) {
      const player = usePlayerStore.getState();
      player.setIsPlaying(!player.isPlaying);
      return;
    }
    playFromContextIndex(0);
  }

  function handlePlayFromDetailsPanel(url: string) {
    if (!selectedTrack) return;
    playReleaseTrack(releaseIdByTrackId.get(selectedTrack.id) ?? null, selectedTrack, url || null);
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

  return (
    <div className="relative h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        <main
          className={`relative z-10 min-w-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${
            isListener ? "lg:pt-20" : "lg:pt-5"
          }`}
        >
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Releases</h1>
                    {allTracks.length > 0 && (
                      <button
                        type="button"
                        onClick={handlePlayAll}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg shadow-primary-500/30 transition-transform hover:scale-105 active:scale-95"
                        aria-label="Play all releases"
                        title="Play all releases"
                      >
                        <svg className="h-4 w-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white/45">
                    Published singles, EPs, and albums from every artist on Melodiq.
                  </p>
                </div>
                <Link
                  href={backTarget.href}
                  className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {backTarget.label}
                </Link>
              </div>
            </section>

            <section className="space-y-1">
              {/* Filter / sort toolbar */}
              <div className="flex items-center justify-end gap-2 px-1 pb-2">
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                    className="appearance-none rounded-full border border-white/10 bg-white/5 py-1.5 pl-3.5 pr-8 text-sm font-medium text-white/80 outline-none transition-colors hover:bg-white/10"
                    aria-label="Filter by release type"
                  >
                    {TYPE_FILTERS.map((f) => (
                      <option key={f.value} value={f.value} className="bg-[#161621]">
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="appearance-none rounded-full border border-white/10 bg-white/5 py-1.5 pl-3.5 pr-8 text-sm font-medium text-white/80 outline-none transition-colors hover:bg-white/10"
                    aria-label="Sort releases"
                  >
                    <option value="date" className="bg-[#161621]">Release date</option>
                    <option value="title" className="bg-[#161621]">Title</option>
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">
                  Loading releases...
                </div>
              ) : displayedReleases.length > 0 ? (
                <div className="space-y-8">
                  {displayedReleases.map((release) => {
                    const releaseTrackItems = trackItemsByRelease.get(release.id) ?? [];
                    const totalDuration = formatTotalDuration(
                      releaseTrackItems.reduce((s, t) => s + (t.duration ?? 0), 0)
                    );
                    const year = release.publishedAt ? new Date(release.publishedAt).getFullYear() : null;

                    return (
                      <section
                        key={release.id}
                        className="rounded-3xl border border-white/8 bg-white/[0.02] p-4 sm:p-6 space-y-5"
                      >
                        {/* Hero — cover art left, meta to the right */}
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                          <Link
                            href={`/discover/release/${release.id}`}
                            className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1b25] shadow-xl shadow-black/40 sm:h-36 sm:w-36"
                          >
                            {release.coverUrl ? (
                              <img src={release.coverUrl} alt={release.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-600/40 to-primary-900/40">
                                <svg className="h-8 w-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                            )}
                          </Link>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Link
                              href={`/discover/release/${release.id}`}
                              className="block truncate text-xl font-bold tracking-tight text-white hover:underline sm:text-2xl"
                            >
                              {release.title}
                            </Link>
                            <p className="text-sm text-white/60">
                              <span className="text-white/85 font-semibold">{release.artistName}</span>
                              <span className="mx-1.5 text-white/25">·</span>
                              <span className="capitalize">{release.type}</span>
                              {year && (
                                <>
                                  <span className="mx-1.5 text-white/25">·</span>
                                  {year}
                                </>
                              )}
                              <span className="mx-1.5 text-white/25">·</span>
                              {releaseTrackItems.length} {releaseTrackItems.length === 1 ? "track" : "tracks"}
                              {totalDuration ? `, ${totalDuration}` : ""}
                            </p>
                          </div>

                          {releaseTrackItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() => playReleaseTrack(release.id, releaseTrackItems[0])}
                              className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg shadow-primary-500/30 transition-transform hover:scale-105 active:scale-95 sm:self-end"
                              aria-label={`Play ${release.title}`}
                              title={`Play ${release.title}`}
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
                                onPlay={(t) => playReleaseTrack(release.id, t)}
                                onSelect={(t) =>
                                  openTrackDetails({
                                    ...t,
                                    coverUrl: t.coverUrl ?? null,
                                    s3KeyCover: t.s3KeyCover ?? null,
                                    rating: t.rating ?? null,
                                  })
                                }
                                onAddToPlaylist={(trackId, targetPlaylistId, options) =>
                                  addTrackToPlaylist(targetPlaylistId, trackId, options)
                                }
                                playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                                isDetailSelected={selectedTrack?.id === track.id}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="px-1 text-sm text-white/40">This release has no published tracks.</p>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-white/45 px-1">No published releases yet.</p>
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
                onPlay={handlePlayFromDetailsPanel}
                onDownload={handleDownloadFromDetailsPanel}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Select a track to show song info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}
