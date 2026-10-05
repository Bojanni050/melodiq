"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TrackDetail, { type TrackDetailTrack } from "@/components/TrackDetail";
import ResizablePanel from "@/components/studio/ResizablePanel";
import { formatDuration } from "@/lib/track-utils";
import { usePlayerStore, useSidebarStore } from "@/lib/store";
import { withCdn } from "@/lib/cdn-client";
import { useSmartBack } from "@/lib/smart-back";
import { useTrackDetailsPanel } from "@/hooks/useTrackDetailsPanel";

interface PublicTrack {
  id: string;
  title: string;
  artistName: string | null;
  writerName: string | null;
  composerName: string | null;
  coverUrl: string | null;
  hasCoverProxy: boolean;
  duration: number | null;
  totalPlays: number;
  instrumental: boolean;
  publishDate: string | null;
  lyrics: string | null;
  lyricsTimestamps: string | null;
  language: string | null;
}

interface AudioDna {
  tempo: number | null;
  key: string | null;
  energy: number | null;
  loudness: number | null;
  atmosphereTags: string[] | null;
  lyricsScore: number | null;
  lyricsNotes: string | null;
  compositionScore: number | null;
  compositionNotes: string | null;
  computedAt: string;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-dim">{label}</div>
      <div className="text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

export default function TrackDnaPage() {
  const params = useParams<{ trackId: string }>();
  const trackId = params?.trackId;

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [track, setTrack] = useState<PublicTrack | null>(null);
  const [audioDna, setAudioDna] = useState<AudioDna | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const setGlobalIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);
  const rightPanelWidth = usePlayerStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = usePlayerStore((s) => s.setRightPanelWidth);

  const isCurrentTrack = Boolean(track && currentTrack?.id === track.id);
  const isPlaying = isCurrentTrack && globalIsPlaying;
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);
  const backTarget = useSmartBack({ href: "/discover", label: "Back to Discover" });

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (active) setIsLoggedIn(res.ok);
      } catch {
        if (active) setIsLoggedIn(false);
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!trackId) return;
    let active = true;
    async function fetchTrack() {
      const res = await fetch(`/api/discover/${trackId}`);
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTrack(data.track);
        setAudioDna(data.audioDna ?? null);
      }
      setLoading(false);
    }
    fetchTrack();
    return () => {
      active = false;
    };
  }, [trackId]);

  function coverSrc() {
    if (!track) return null;
    if (track.coverUrl) return track.coverUrl;
    if (track.hasCoverProxy) return withCdn(`/api/discover/${track.id}/cover`);
    return null;
  }

  // Same shape every other page (Library, Discover, Releases, ...) feeds into
  // the shared TrackDetail sidebar — so the panel looks and behaves
  // identically here: listener/anonymous viewers get the read-only view,
  // everyone else gets Prompt/Edit affordances, exactly as TrackDetail
  // already handles internally.
  const mappedTrack = useMemo<TrackDetailTrack | null>(() => {
    if (!track) return null;
    return {
      id: track.id,
      title: track.title,
      provider: "discover",
      providerModel: "discover",
      prompt: "",
      lyrics: track.lyrics,
      lyricsTimestamps: track.lyricsTimestamps,
      language: track.language,
      status: "done",
      audioUrl: null,
      audioUrlHd: null,
      format: null,
      formatHd: null,
      duration: track.duration,
      createdAt: track.publishDate ?? new Date().toISOString(),
      error: null,
      s3KeyHd: null,
      coverUrl: coverSrc(),
      s3KeyCover: null,
      artistName: track.artistName,
      composerName: track.composerName,
      writerName: track.writerName,
      instrumental: track.instrumental,
    };
  }, [track]);

  const {
    selectedTrack,
    showTrackDetailsPanel,
    openTrackDetails,
    closeTrackDetails,
  } = useTrackDetailsPanel<TrackDetailTrack>(mappedTrack ? [mappedTrack] : []);

  // This page is dedicated to a single track, so its details panel opens
  // automatically once the track loads rather than waiting for a click.
  useEffect(() => {
    if (mappedTrack) openTrackDetails(mappedTrack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappedTrack]);

  function handlePlayClick() {
    if (!track) return;
    if (isCurrentTrack) {
      setGlobalIsPlaying(!globalIsPlaying);
      return;
    }
    playTrackFromGesture({
      id: track.id,
      title: track.title,
      provider: "discover",
      providerModel: "discover",
      prompt: "",
      status: "done",
      audioUrl: null,
      audioUrlHd: null,
      s3Key: null,
      s3KeyHd: null,
      format: null,
      formatHd: null,
      duration: track.duration,
      lyrics: track.lyrics,
      createdAt: new Date().toISOString(),
      error: null,
      coverUrl: coverSrc(),
      s3KeyCover: null,
      artistName: track.artistName,
      instrumental: track.instrumental,
      publicSource: true,
    });
  }

  function handleDetailPlay(_url: string) {
    handlePlayClick();
  }

  function handleDownloadTrack() {
    // Public discover tracks stream through the player; there is no direct
    // download link exposed on this page.
  }

  const hasAudioFacts =
    audioDna &&
    (audioDna.tempo != null || audioDna.key != null || audioDna.energy != null || audioDna.loudness != null);

  const releaseYear = track?.publishDate ? new Date(track.publishDate).getFullYear() : null;

  // Credit line: artist, then writer/composer if different from the artist —
  // mirrors how a streaming service lists collaborators under the title.
  const credits = track
    ? Array.from(
        new Set(
          [track.artistName, track.writerName, track.composerName].filter(
            (name): name is string => Boolean(name)
          )
        )
      )
    : [];

  return (
    <div className="bg-canvas text-ink h-screen overflow-hidden">
      <div className="h-[calc(100vh-var(--player-height))] flex">
        <Sidebar credits={null} />
        <main
          className="flex-1 min-w-0 overflow-y-auto px-4 py-6 sm:px-8 pb-16 @container"
          style={{ paddingLeft: !isDesktop ? 0 : sidebarCollapsed ? "var(--sidebar-collapsed)" : isQHD ? "var(--sidebar-width-qhd)" : "var(--sidebar-width)" }}
        >
          <Link href={backTarget.href} className="inline-flex items-center gap-1.5 text-xs text-ink-dim hover:text-ink-muted">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backTarget.label}
          </Link>

          {loading ? (
            <p className="mt-6 text-sm text-ink-dim">Loading…</p>
          ) : notFound || !track ? (
            <div className="mx-auto mt-6 max-w-2xl  border border-line bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-ink-muted">This track isn&apos;t available.</p>
              <Link href={backTarget.href} className="mt-3 inline-block text-sm text-accent hover:text-accent">
                {backTarget.label}
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {/* Hero header — cover art left, artist/writer info beside it */}
              <section className="relative overflow-hidden border border-line bg-canvas">
                {coverSrc() && (
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-[60px] opacity-20 saturate-200 pointer-events-none scale-110"
                    style={{ backgroundImage: `url(${coverSrc()})` }}
                  />
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(to right, transparent 30%, var(--mq-canvas) 100%)" }}
                />
                <div className="relative flex flex-col items-start gap-6 p-6 @sm:flex-row @sm:items-end @sm:p-8">
                  <button
                    type="button"
                    onClick={handlePlayClick}
                    className="group relative h-36 w-36 shrink-0 overflow-hidden  shadow-2xl shadow-black/50 @sm:h-48 @sm:w-48"
                    aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  >
                    {coverSrc() ? (
                      <img src={coverSrc()!} alt={track.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-surface-2">
                        <svg className="h-10 w-10 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40">
                      <div
                        className={`absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 transition-opacity ${
                          isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isPlaying ? (
                          <svg className="h-5 w-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg className="ml-0.5 h-5 w-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Single</p>
                    <h1 className="mt-2 truncate text-3xl font-black tracking-tight text-ink @sm:text-5xl">
                      {track.title}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-muted">
                      {credits.map((name, i) => (
                        <span key={name} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-ink-dim">•</span>}
                          <span className="font-semibold text-ink">{name}</span>
                        </span>
                      ))}
                      {releaseYear && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-ink-dim">•</span>
                          {releaseYear}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <span className="text-ink-dim">•</span>
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Track card row — single-track "list" styled like a streaming release page */}
              <section>
                <div className="flex items-center gap-3 border-b border-line px-3 pb-2 text-xs uppercase tracking-wide text-ink-dim">
                  <span className="w-5 text-center">#</span>
                  <span className="flex-1">Title</span>
                  <span className="hidden @sm:block w-24 text-right">Plays</span>
                  <span className="w-12 text-right">
                    <svg className="ml-auto h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7v5l3 3" />
                    </svg>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handlePlayClick}
                  className="group flex w-full items-center gap-3  px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <span className="relative w-5 shrink-0 text-center text-sm text-ink-dim">
                    <span className="group-hover:hidden">{isCurrentTrack && isPlaying ? "▶" : "1"}</span>
                    <svg className="hidden h-4 w-4 group-hover:inline text-ink" fill="currentColor" viewBox="0 0 24 24">
                      {isPlaying && isCurrentTrack ? (
                        <>
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </>
                      ) : (
                        <path d="M8 5v14l11-7z" />
                      )}
                    </svg>
                  </span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden  bg-white/5">
                    {coverSrc() ? (
                      <img src={coverSrc()!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${isCurrentTrack ? "text-accent" : "text-ink"}`}>
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-ink-dim">{credits.join(", ") || "Unknown Artist"}</p>
                  </div>
                  <span className="hidden @sm:block w-24 shrink-0 text-right text-sm text-ink-dim">
                    {track.totalPlays.toLocaleString()}
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm text-ink-dim">
                    {formatDuration(track.duration)}
                  </span>
                </button>
              </section>

              {/* Track DNA — auto-computed analysis, not part of the shared Track Details sidebar */}
              {audioDna && (hasAudioFacts || (audioDna.atmosphereTags && audioDna.atmosphereTags.length > 0) || audioDna.lyricsScore != null) && (
                <section className="space-y-4  border border-line bg-white/[0.03] p-5 @sm:p-6">
                  <h2 className="text-sm font-semibold text-ink-muted">Track DNA</h2>

                  {hasAudioFacts && (
                    <div className="grid grid-cols-2 gap-4 @sm:grid-cols-4">
                      {audioDna.tempo != null && <Fact label="Tempo" value={`${audioDna.tempo} BPM`} />}
                      {audioDna.key != null && <Fact label="Key" value={audioDna.key} />}
                      {audioDna.energy != null && <Fact label="Energy" value={`${audioDna.energy}%`} />}
                      {audioDna.loudness != null && (
                        <Fact label="Loudness" value={`${audioDna.loudness.toFixed(1)} LUFS`} />
                      )}
                    </div>
                  )}

                  {audioDna.atmosphereTags && audioDna.atmosphereTags.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-dim">Atmosphere</div>
                      <div className="flex flex-wrap gap-1.5">
                        {audioDna.atmosphereTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-line bg-white/[0.06] px-3 py-1 text-xs text-ink-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {audioDna.lyricsScore != null && (
                    <div className="space-y-1 border-t border-line pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-ink">Lyrics</span>
                        <span className="text-ink-dim">{audioDna.lyricsScore.toFixed(1)}/10</span>
                      </div>
                      {audioDna.lyricsNotes && <p className="text-sm text-ink-dim">{audioDna.lyricsNotes}</p>}
                    </div>
                  )}

                </section>
              )}
            </div>
          )}
        </main>

        {/* Track Details — the same shared sidebar every other page uses
            (Library, Discover, Releases, ...): listener/anonymous viewers
            get the read-only view, other roles get Prompt/Edit affordances,
            all handled inside TrackDetail itself. */}
        <ResizablePanel show={showTrackDetailsPanel && Boolean(selectedTrack)} width={rightPanelWidth} setWidth={setRightPanelWidth}>
          <div className="h-full overflow-y-auto">
            {selectedTrack && (
              <TrackDetail
                mode="sidebar"
                track={selectedTrack}
                onClose={closeTrackDetails}
                onPlay={handleDetailPlay}
                onDownload={handleDownloadTrack}
              />
            )}
          </div>
        </ResizablePanel>
      </div>
    </div>
  );
}
