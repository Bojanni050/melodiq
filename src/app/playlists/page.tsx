"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { useSidebarStore, usePlaylistStore, useReleaseStore, useUserStore, usePlayerStore } from "@/lib/store";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";
import { useT } from "@/hooks/useT";

const PLAYLIST_COVERS_STORAGE_KEY = "melodiq.playlist-covers";

type Track = {
  id: string;
  title: string | null;
  provider: string;
  providerModel: string;
  prompt: string;
  lyrics: string | null;
  status: "pending" | "generating" | "done" | "failed";
  audioUrl: string | null;
  audioUrlHd: string | null;
  format: string | null;
  formatHd: string | null;
  duration: number | null;
  createdAt: string;
  error: string | null;
  s3KeyHd: string | null;
  coverUrl: string | null;
  s3KeyCover: string | null;
  rating?: string | null;
  playCount?: number | null;
  othersPlayCount?: number | null;
  lyricsTimestamps?: string | null;
};

interface PublicPlaylist {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
}

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

export default function PlaylistsPage() {
  const router = useRouter();
  const t = useT();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const user = useUserStore((s) => s.user);
  const isListener = user?.role === "listener" || user?.role == null;
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const { playlists, loadPlaylists, createPlaylist } = usePlaylistStore();
  const loadReleases = useReleaseStore((state) => state.loadReleases);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [playlistCoverOverrides, setPlaylistCoverOverrides] = useState<Record<string, string>>({});
  const [publishedPlaylists, setPublishedPlaylists] = useState<PublicPlaylist[]>([]);

  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const {
    selectedTrack,
    showTrackDetailsPanel,
    closeTrackDetails,
  } = useTrackDetailsPanel<Track>(tracks);

  // This page always shows the panel (even before a track is selected —
  // it has its own "select a track" placeholder state), unlike other pages
  // which only open it once a track is actually played.
  useEffect(() => {
    setShowTrackDetailsPanel(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePlayTrack(url: string) {
    if (!selectedTrack) return;

    const player = usePlayerStore.getState();
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
      s3Key: null,
      s3KeyHd: selectedTrack.s3KeyHd,
      duration: selectedTrack.duration,
      lyrics: selectedTrack.lyrics,
      lyricsTimestamps: selectedTrack.lyricsTimestamps,
      createdAt: selectedTrack.createdAt,
      error: selectedTrack.error,
      coverUrl: selectedTrack.coverUrl ?? null,
      s3KeyCover: selectedTrack.s3KeyCover ?? null,
    });
  }

  function handleDownloadTrack(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd
      ? (selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3")
      : (selectedTrack?.format ?? "mp3");
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }

  useEffect(() => {
    let active = true;
    async function fetchPublishedPlaylists() {
      const res = await fetch("/api/discover/playlists");
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setPublishedPlaylists(data.playlists || []);
      }
    }
    fetchPublishedPlaylists();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const res = await fetch("/api/tracks?status=done");
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setTracks((data.tracks || []).map((t: Track) => ({ ...t })));
      }
      if (active) setLoading(false);
    }

    fetchTracks();
    void loadPlaylists();
    void loadReleases();

    return () => {
      active = false;
    };
  }, [loadPlaylists, loadReleases]);

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

  function getPlaylistCoverCandidates(playlistId: string) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist) return [] as string[];

    const covers = tracks
      .filter((track) => playlist.trackIds.includes(track.id))
      .map((track) => track.coverUrl)
      .filter((coverUrl): coverUrl is string => Boolean(coverUrl));

    if (covers.length === 0) return [];
    return Array.from(new Set(covers));
  }

  function getPlaylistRandomCover(playlistId: string) {
    const candidates = getPlaylistCoverCandidates(playlistId);
    if (candidates.length === 0) return null;
    const index = hashString(`${playlistId}:${candidates.join("|")}`) % candidates.length;
    return candidates[index] ?? null;
  }

  function getPlaylistCover(playlistId: string) {
    const override = playlistCoverOverrides[playlistId];
    if (override) return override;
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist?.coverUrl) return playlist.coverUrl;
    return getPlaylistRandomCover(playlistId);
  }

  function handleCreatePlaylist() {
    const id = createPlaylist(newPlaylistName);
    if (!id) return;
    setNewPlaylistName("");
    setShowCreatePlaylist(false);
    router.push(`/playlists/${id}`);
  }

  function openPlaylist(playlistId: string) {
    router.push(`/playlists/${playlistId}`);
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex" style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <main className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${isListener ? "lg:pt-20" : "lg:pt-5"}`}>
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">{t("playlists.tagline")}</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{t("playlists.title")}</h1>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                  {t("playlists.countLabel", { count: playlists.length })}
                </div>
                {showCreatePlaylist ? (
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                    <input
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreatePlaylist(); if (e.key === "Escape") { setShowCreatePlaylist(false); setNewPlaylistName(""); } }}
                      placeholder={t("playlists.namePlaceholder")}
                      maxLength={100}
                      className="h-9 w-48 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                      autoFocus
                    />
                    <button type="button" onClick={handleCreatePlaylist} className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90">
                      {t("playlists.add")}
                    </button>
                    <button type="button" onClick={() => { setShowCreatePlaylist(false); setNewPlaylistName(""); }} className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white">
                      {t("playlists.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreatePlaylist(true)}
                    className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {t("playlists.createPlaylist")}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">{t("playlists.loading")}</div>
              ) : playlists.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/3 p-8 text-sm text-white/55">
                  {t("playlists.noPlaylistsYet")}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {playlists.map((playlist) => {
                    const playlistTracks = tracks.filter((track) => playlist.trackIds.includes(track.id));
                    const playlistCover = getPlaylistCover(playlist.id);

                    return (
                      <article
                        key={playlist.id}
                        className="group overflow-hidden rounded-[26px] border border-white/10 bg-[#0f1017] shadow-[0_18px_60px_rgba(0,0,0,0.25)]"
                      >
                        <button
                          type="button"
                          onClick={() => openPlaylist(playlist.id)}
                          className="block w-full text-left"
                        >
                          <div className="relative aspect-4/3 overflow-hidden bg-linear-135 from-[#1d2333] to-[#0f121a]">
                            {playlistCover ? (
                              <img
                                src={playlistCover}
                                alt={playlist.name}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <svg className="h-14 w-14 text-white/35" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                                </svg>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-black/10" />
                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <h3 className="truncate text-lg font-semibold text-white">{playlist.name}</h3>
                              <p className="text-sm text-white/75">{t("playlists.songsCount", { count: playlistTracks.length })}</p>
                            </div>
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

              {publishedPlaylists.length > 0 && (
                <div className="space-y-4 pt-10">
                  <h2 className="text-xl font-semibold tracking-tight text-white">{t("playlists.curatedByMelodiq")}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {publishedPlaylists.map((playlist) => (
                      <Link
                        key={playlist.id}
                        href={`/discover/playlist/${playlist.id}?from=playlists`}
                        className="group flex flex-col gap-3 rounded-[26px] border border-white/10 bg-[#0f1017] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)] transition-colors hover:border-white/20"
                      >
                        <div className="flex aspect-4/3 w-full items-center justify-center rounded-2xl bg-linear-to-br from-fuchsia-600/40 to-primary-900/40 overflow-hidden relative">
                          <svg className="h-12 w-12 text-white/50 transition-transform duration-500 group-hover:scale-105" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-white">{playlist.name}</h3>
                          {playlist.description && (
                            <p className="truncate text-sm text-white/50 mt-0.5">{playlist.description}</p>
                          )}
                        </div>
                        <div className="mt-auto flex items-center justify-between">
                          <p className="text-sm text-white/40">
                            {playlist.trackCount === 1
                              ? t("playlists.songCountSingular", { count: playlist.trackCount })
                              : t("playlists.songCountPlural", { count: playlist.trackCount })}
                          </p>
                          <span className="text-sm text-white/60 transition-colors group-hover:text-white">{t("playlists.view")}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>

        <ResizablePanel show={showTrackDetailsPanel} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="h-full overflow-y-auto">
            {selectedTrack ? (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={closeTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">{t("common.trackDetails")}</h3>
                <p className="text-sm mt-3">{t("playlists.selectTrackHint")}</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}
