"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackList from "@/components/TrackList";
import TrackDetail from "@/components/TrackDetail";
import TrackEditPanel from "@/components/tracks/TrackEditPanel";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { usePlayerStore, usePlaylistStore, useReleaseStore, useSidebarStore } from "@/lib/store";
import type { TrackItem } from "@/components/tracks/types";
import { formatTotalDuration } from "@/lib/track-utils";

const RELEASE_TYPES: { value: string; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
];

export default function ReleaseDetailPage() {
  const params = useParams<{ releaseId: string }>();
  const router = useRouter();
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const releaseId = params?.releaseId;

  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const showTrackDetailsPanel = usePlayerStore((state) => state.showTrackDetailsPanel);
  const setShowTrackDetailsPanel = usePlayerStore((state) => state.setShowTrackDetailsPanel);
  const rightPanelWidth = usePlayerStore((state) => state.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((state) => state.setRightPanelWidth);
  const playlists = usePlaylistStore((state) => state.playlists);
  const addTrackToPlaylist = usePlaylistStore((state) => state.addTrackToPlaylist);
  const {
    releases,
    loadReleases,
    reorderReleaseTracks,
    removeTrackFromRelease,
    setTrackSide,
    renameRelease,
    updateReleaseType,
    updateReleaseCover,
  } = useReleaseStore();

  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<TrackItem | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editingTrack, setEditingTrack] = useState<TrackItem | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function fetchTracks() {
      const res = await fetch("/api/tracks?status=done");
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setTracks((data.tracks || []).map((t: TrackItem) => ({ ...t })));
      }
      if (active) setLoading(false);
    }

    fetchTracks();
    void loadReleases();

    return () => {
      active = false;
    };
  }, [loadReleases, releaseId]);

  const selectedRelease = useMemo(
    () => releases.find((r) => r.id === releaseId) ?? null,
    [releases, releaseId]
  );

  const releaseTracks = useMemo(() => {
    if (!selectedRelease) return [] as TrackItem[];
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return [...selectedRelease.tracks]
      .sort((a, b) => a.position - b.position)
      .map((rt) => byId.get(rt.trackId))
      .filter((t): t is TrackItem => Boolean(t));
  }, [selectedRelease, tracks]);

  const releaseTracksTotalDuration = useMemo(
    () => formatTotalDuration(releaseTracks.reduce((sum, t) => sum + (t.duration ?? 0), 0)),
    [releaseTracks]
  );

  function handleSelectTrack(track: TrackItem) {
    setSelectedTrack(track);
    setShowTrackDetailsPanel(true);
  }

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
      rating: selectedTrack.rating ?? null,
    });
  }

  function handleDownloadTrack(url: string, hd: boolean) {
    const a = document.createElement("a");
    a.href = url;
    const fmt = hd ? (selectedTrack?.formatHd ?? selectedTrack?.format ?? "mp3") : (selectedTrack?.format ?? "mp3");
    a.download = `${selectedTrack?.title || "track"}${hd ? "_hd" : ""}.${fmt}`;
    a.click();
  }

  function handleDeleteTrack(trackId: string) {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (selectedRelease) removeTrackFromRelease(selectedRelease.id, trackId);
  }

  function handleSaveTitle() {
    if (!selectedRelease || !titleDraft.trim()) { setEditingTitle(false); return; }
    renameRelease(selectedRelease.id, titleDraft);
    setEditingTitle(false);
  }

  async function handleCoverUpload(file: File) {
    if (!selectedRelease || uploadingCover) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("cover", file);
      const res = await fetch(`/api/releases/${selectedRelease.id}/cover`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { coverUrl } = await res.json() as { coverUrl: string };
      updateReleaseCover(selectedRelease.id, `${coverUrl}?t=${Date.now()}`);
    } catch (err) {
      console.error("[release-cover] upload error", err);
    } finally {
      setUploadingCover(false);
    }
  }

  if (!loading && !selectedRelease) {
    return (
      <div className="h-screen bg-[#09090d] overflow-hidden text-white">
        <Sidebar credits={null} />
        <div className="h-[calc(100vh-var(--player-height))] flex items-center justify-center px-6" style={{ marginLeft: sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/70">Release not found.</p>
            <button
              type="button"
              onClick={() => router.push("/releases")}
              className="mt-4 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            >
              Back to releases
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div className="h-[calc(100vh-var(--player-height))] flex" style={{ marginLeft: sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}>
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 lg:pt-5">
          <div className="max-w-400 mx-auto space-y-6">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => router.push("/releases")}
                className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All releases
              </button>
            </div>

            <section className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                {/* Cover thumbnail */}
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  title="Upload cover art"
                  className="group relative shrink-0 h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1b25] transition-opacity disabled:opacity-60"
                >
                  {selectedRelease?.coverUrl ? (
                    <img
                      src={selectedRelease.coverUrl}
                      alt="Release cover"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <svg className="h-8 w-8 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" strokeWidth={1.2} />
                        <circle cx="12" cy="12" r="3" strokeWidth={1.2} />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {uploadingCover ? (
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                  </div>
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCoverUpload(f); e.target.value = ""; }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingTitle ? (
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={handleSaveTitle}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                        maxLength={255}
                        className="h-9 rounded-lg border border-white/15 bg-[#11121a] px-2.5 text-lg font-semibold text-white outline-none focus:border-white/30"
                      />
                    ) : (
                      <h2
                        className="text-lg font-semibold truncate cursor-text"
                        onClick={() => { if (!selectedRelease) return; setTitleDraft(selectedRelease.title); setEditingTitle(true); }}
                        title="Click to rename"
                      >
                        {selectedRelease?.title}
                      </h2>
                    )}
                    <span className="shrink-0 rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-white/60">
                      {selectedRelease?.type}
                    </span>
                  </div>
                  <p className="text-sm text-white/55">
                    {releaseTracks.length} tracks in this release{releaseTracksTotalDuration ? ` (${releaseTracksTotalDuration})` : ""}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                  {RELEASE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => selectedRelease && updateReleaseType(selectedRelease.id, t.value)}
                      className={`h-9 rounded-full px-3 text-sm font-medium transition-colors ${
                        selectedRelease?.type === t.value ? "bg-primary-500/80 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingOrder && selectedRelease) {
                        reorderReleaseTracks(selectedRelease.id, releaseTracks.map((t) => t.id));
                      }
                      setIsEditingOrder((v) => !v);
                    }}
                    className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${isEditingOrder ? "border-white bg-white text-black hover:bg-white/90" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"}`}
                  >
                    {isEditingOrder ? "Save order" : "Edit order"}
                  </button>
              </div>

              {selectedRelease?.type === "single" && releaseTracks.length > 1 && (
                <p className="text-xs text-white/35">
                  Tip: use the A/B buttons below to mark sides for a classic single layout.
                </p>
              )}

              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">Loading tracks...</div>
              ) : releaseTracks.length > 0 ? (
                <TrackList
                  tracks={releaseTracks}
                  autoQueueAfterPlay
                  enableDragReorder={isEditingOrder}
                  dragOrderKey={selectedRelease?.id}
                  onManualOrderChange={(orderedTrackIds) => {
                    if (!selectedRelease) return;
                    reorderReleaseTracks(selectedRelease.id, orderedTrackIds);
                  }}
                  onSelect={handleSelectTrack}
                  onDelete={handleDeleteTrack}
                  onAddToPlaylist={(trackId, targetPlaylistId, options) => addTrackToPlaylist(targetPlaylistId, trackId, options)}
                  playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
                  onTitleUpdate={(trackId, newTitle) =>
                    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)))
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
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/55">
                  This release has no tracks yet. Use track actions and choose Add to Release.
                </div>
              )}

              {selectedRelease && releaseTracks.length > 0 && (
                <div className="space-y-1.5">
                  {releaseTracks.map((track) => {
                    const rt = selectedRelease.tracks.find((t) => t.trackId === track.id);
                    return (
                      <div key={`side-${track.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white/3 px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-white/60">{track.title || "Untitled"}</span>
                        <div className="flex shrink-0 gap-1">
                          {(["A", "B", null] as const).map((side) => (
                            <button
                              key={side ?? "none"}
                              type="button"
                              onClick={() => setTrackSide(selectedRelease.id, track.id, side)}
                              className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${
                                (rt?.side ?? null) === side ? "bg-primary-500/80 text-white" : "bg-white/5 text-white/45 hover:bg-white/10"
                              }`}
                            >
                              {side ?? "–"}
                            </button>
                          ))}
                        </div>
                      </div>
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
                <p className="text-sm mt-3">Select a track to show track info and lyrics.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </div>

      {editingTrack && (
        <TrackEditPanel
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSaved={(updated) => {
            setTracks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
            setEditingTrack(null);
          }}
        />
      )}
    </div>
  );
}
