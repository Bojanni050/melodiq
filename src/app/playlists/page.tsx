"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TrackDetail from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { useSidebarStore, usePlaylistStore, useUserStore, usePlayerStore } from "@/lib/store";

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
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const user = useUserStore((s) => s.user);
  const isListener = user?.role === "listener" || user?.role == null;
  const isQHD = useSidebarStore((s) => s.isQHD);
  const { playlists, loadPlaylists, createPlaylist, updatePlaylistDescription } = usePlaylistStore();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [playlistCoverOverrides, setPlaylistCoverOverrides] = useState<Record<string, string>>({});
  const [coverPickerPlaylistId, setCoverPickerPlaylistId] = useState<string | null>(null);
  const [uploadingPlaylistCover, setUploadingPlaylistCover] = useState(false);
  const [editingDescriptionPlaylistId, setEditingDescriptionPlaylistId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [publishedPlaylists, setPublishedPlaylists] = useState<PublicPlaylist[]>([]);
  const playlistCoverInputRef = useRef<HTMLInputElement | null>(null);

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  useEffect(() => {
    setShowTrackDetailsPanel(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showTrackDetailsPanel) return;

    setSelectedTrack((prev) => {
      if (prev) {
        const found = tracks.find((t) => t.id === prev.id);
        if (found) return found;
        return prev;
      }
      if (currentTrack) {
        const found = tracks.find((t) => t.id === currentTrack.id);
        if (found) return found;
        return currentTrack as unknown as Track;
      }
      return null;
    });
  }, [showTrackDetailsPanel, tracks, currentTrack]);

  const prevIsPlaying = useRef(isPlaying);
  const prevCurrentTrackId = useRef(currentTrack?.id);

  useEffect(() => {
    const playResumed = isPlaying && !prevIsPlaying.current;
    const trackChanged = currentTrack?.id !== prevCurrentTrackId.current;

    prevIsPlaying.current = isPlaying;
    prevCurrentTrackId.current = currentTrack?.id;

    if (showTrackDetailsPanel && currentTrack && (playResumed || trackChanged)) {
      setSelectedTrack((prev) => {
        if (prev?.id === currentTrack.id) return prev;
        const matched = tracks.find((t) => t.id === currentTrack.id);
        return matched || (currentTrack as unknown as Track);
      });
    }
  }, [isPlaying, currentTrack, showTrackDetailsPanel, tracks]);

  function handleCloseTrackDetails() {
    setShowTrackDetailsPanel(false);
  }

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

    return () => {
      active = false;
    };
  }, [loadPlaylists]);

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

  function handleSetPlaylistCover(playlistId: string, coverUrl: string) {
    setPlaylistCoverOverrides((current) => ({ ...current, [playlistId]: coverUrl }));
  }

  function handleResetPlaylistCover(playlistId: string) {
    setPlaylistCoverOverrides((current) => {
      const next = { ...current };
      delete next[playlistId];
      return next;
    });
  }

  async function handleUploadPlaylistCover(playlistId: string, file: File) {
    setUploadingPlaylistCover(true);
    try {
      const formData = new FormData();
      formData.append("cover", file);
      const res = await fetch(`/api/playlists/${playlistId}/cover`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { coverUrl } = await res.json() as { coverUrl: string };
      const bustedUrl = `${coverUrl}?t=${Date.now()}`;
      handleSetPlaylistCover(playlistId, bustedUrl);
      const { hydratePlaylistsFromServer, playlists: storePlaylists } = usePlaylistStore.getState();
      hydratePlaylistsFromServer(storePlaylists.map((p) => p.id === playlistId ? { ...p, coverUrl: bustedUrl } : p));
    } catch (err) {
      console.error("[playlist-cover] upload error", err);
    } finally {
      setUploadingPlaylistCover(false);
    }
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

      <div className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))] flex" style={{ marginLeft: sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <main className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${isListener ? "lg:pt-20" : "lg:pt-5"}`}>
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">Playlist Manager</p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Playlists</h1>
                <p className="max-w-2xl text-sm sm:text-base text-white/60">
                  Open a playlist folder, or set a custom cover from the songs inside.
                </p>
              </div>
            </section>

            <section className="space-y-5">
              {publishedPlaylists.length > 0 && (
                <div className="space-y-4 mb-10 pt-4">
                  <h2 className="text-xl font-semibold tracking-tight text-white">Admin Playlists</h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {publishedPlaylists.map((playlist) => (
                      <Link
                        key={playlist.id}
                        href={`/discover/playlist/${playlist.id}`}
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
                            {playlist.trackCount} {playlist.trackCount === 1 ? "song" : "songs"}
                          </p>
                          <span className="text-sm text-white/60 transition-colors group-hover:text-white">View</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                  {playlists.length} playlists
                </div>
                {showCreatePlaylist ? (
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
                    <input
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreatePlaylist(); if (e.key === "Escape") { setShowCreatePlaylist(false); setNewPlaylistName(""); } }}
                      placeholder="Playlist name"
                      maxLength={100}
                      className="h-9 w-48 rounded-full bg-transparent px-3 text-sm text-white placeholder:text-white/30 outline-none"
                      autoFocus
                    />
                    <button type="button" onClick={handleCreatePlaylist} className="h-9 rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90">
                      Add
                    </button>
                    <button type="button" onClick={() => { setShowCreatePlaylist(false); setNewPlaylistName(""); }} className="h-9 rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreatePlaylist(true)}
                    className="h-10 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    + Create playlist
                  </button>
                )}
              </div>

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading playlists...</div>
              ) : playlists.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/3 p-8 text-sm text-white/55">
                  No playlists yet. Create one above or add songs to a playlist from track actions.
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
                              <p className="text-sm text-white/75">{playlistTracks.length} songs</p>
                            </div>
                          </div>
                        </button>

                        {editingDescriptionPlaylistId === playlist.id ? (
                          <div className="px-4 pb-3 pt-3 space-y-2">
                            <textarea
                              autoFocus
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value.slice(0, 500))}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") { setEditingDescriptionPlaylistId(null); setDescriptionDraft(""); }
                              }}
                              rows={3}
                              maxLength={500}
                              placeholder="Add a description…"
                              className="w-full rounded-xl border border-white/12 bg-[#11121a] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 resize-none"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-white/35">{descriptionDraft.length}/500</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setEditingDescriptionPlaylistId(null); setDescriptionDraft(""); }}
                                  className="h-8 rounded-full px-3 text-sm text-white/50 hover:text-white transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updatePlaylistDescription(playlist.id, descriptionDraft);
                                    setEditingDescriptionPlaylistId(null);
                                    setDescriptionDraft("");
                                  }}
                                  className="h-8 rounded-full bg-white px-3 text-sm font-medium text-black hover:bg-white/90 transition-colors"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : playlist.description ? (
                          <button
                            type="button"
                            onClick={() => { setEditingDescriptionPlaylistId(playlist.id); setDescriptionDraft(playlist.description ?? ""); }}
                            className="mx-4 mb-2 mt-3 block w-[calc(100%-2rem)] text-left text-sm text-white/50 hover:text-white/80 transition-colors line-clamp-2"
                          >
                            {playlist.description}
                          </button>
                        ) : null}

                        <div className="flex items-center justify-between gap-2 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openPlaylist(playlist.id)}
                            className="text-sm text-white/60 transition-colors hover:text-white"
                          >
                            Open playlist
                          </button>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => { setEditingDescriptionPlaylistId(playlist.id); setDescriptionDraft(playlist.description ?? ""); }}
                              className="text-sm text-white/45 transition-colors hover:text-white"
                            >
                              {playlist.description ? "Edit description" : "Add description"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCoverPickerPlaylistId(playlist.id)}
                              className="text-sm text-white/45 transition-colors hover:text-white"
                            >
                              Change cover
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
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
                onClose={handleCloseTrackDetails}
                onPlay={handlePlayTrack}
                onDownload={handleDownloadTrack}
              />
            ) : (
              <div className="h-full px-5 py-6 text-white/45">
                <h3 className="text-sm font-medium text-white/60">Track Details</h3>
                <p className="text-sm mt-3">Select a track or press play to show track info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {showTrackDetailsPanel && selectedTrack && (
        <div className="lg:hidden">
          <TrackDetail
            track={selectedTrack}
            onClose={handleCloseTrackDetails}
            onPlay={handlePlayTrack}
            onDownload={handleDownloadTrack}
            mode="overlay"
          />
        </div>
      )}

      {coverPickerPlaylistId && (
        <div className="fixed inset-0 z-70">
          <button
            type="button"
            aria-label="Close playlist cover picker"
            onClick={() => setCoverPickerPlaylistId(null)}
            className="absolute inset-0 bg-black/65"
          />

          <div className="absolute left-1/2 top-1/2 w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/12 bg-[#0f1119] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Change Playlist Cover</h3>
                <p className="text-sm text-white/55">Pick a cover from playlist songs, upload your own, or randomize it.</p>
              </div>
              <button
                type="button"
                onClick={() => setCoverPickerPlaylistId(null)}
                className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(() => {
              const candidates = getPlaylistCoverCandidates(coverPickerPlaylistId);
              const randomCover = getPlaylistRandomCover(coverPickerPlaylistId);

              return (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!randomCover}
                      onClick={() => {
                        if (!randomCover) return;
                        handleSetPlaylistCover(coverPickerPlaylistId, randomCover);
                      }}
                      className="h-9 rounded-full border border-white/12 bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Use random
                    </button>
                    <button
                      type="button"
                      disabled={uploadingPlaylistCover}
                      onClick={() => playlistCoverInputRef.current?.click()}
                      className="h-9 rounded-full border border-white/12 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      {uploadingPlaylistCover ? "Uploading…" : "Upload image"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetPlaylistCover(coverPickerPlaylistId)}
                      className="h-9 rounded-full border border-white/12 bg-white/5 px-4 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      Reset to auto
                    </button>
                    <input
                      ref={playlistCoverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadPlaylistCover(coverPickerPlaylistId, file);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {candidates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-white/3 p-4 text-sm text-white/55">
                      No cover images found in this playlist yet.
                    </div>
                  ) : (
                    <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                      {candidates.map((coverUrl) => {
                        const activeCover = playlistCoverOverrides[coverPickerPlaylistId] ?? null;
                        const isActive = activeCover === coverUrl;

                        return (
                          <button
                            key={coverUrl}
                            type="button"
                            onClick={() => handleSetPlaylistCover(coverPickerPlaylistId, coverUrl)}
                            className={`overflow-hidden rounded-2xl border transition ${isActive ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.5)]" : "border-white/12 hover:border-white/35"}`}
                            title="Use this cover"
                          >
                            <img src={coverUrl} alt="Playlist cover candidate" className="h-28 w-full object-cover" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
