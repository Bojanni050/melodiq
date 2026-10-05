"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { formatDuration } from "@/lib/track-utils";
import { usePlayerStore } from "@/lib/store";
import { withCdn } from "@/lib/cdn-client";

export interface PublicArtistTrack {
  id: string;
  title: string;
  coverUrl: string | null;
  duration: number | null;
  plays: number;
  year: number;
}

export interface PublicArtist {
  id: string;
  name: string;
  bio: string | null;
  genres: string[];
  stats: { tracks: number; totalPlays: number; sinceYear: number };
  /** Round artist portrait. Null when neither the page nor the account has one. */
  imageUrl: string | null;
  /** Full-bleed background. Falls back to the first track's cover server-side. */
  heroUrl: string | null;
}

interface Props {
  artist: PublicArtist | null;
  tracks: PublicArtistTrack[];
  loading: boolean;
  notFound: boolean;
}

const NAV_LINKS = ["Bio", "Music"];

function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

/**
 * The public artist page, shared by /discover/artist/[userId] (one page per
 * account, every published track) and /artist/[slug] (one page per artist alias,
 * only the tracks credited to that name). Both routes fetch a PublicArtist and
 * hand it in here, so the two pages can never drift apart visually.
 *
 * Styling is on the shared editorial token layer (bg-canvas / text-ink /
 * border-line / bg-accent / font-display / font-body / font-mono) — see the
 * @theme block in globals.css. The only inline art-direction left is the hero
 * overlay gradient and the fluid clamp() type sizes.
 */
export default function ArtistPublicPage({ artist, tracks, loading, notFound }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/discover");
    }
  }

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const globalIsPlaying = usePlayerStore((s) => s.isPlaying);
  const setGlobalIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const playTrackFromGesture = usePlayerStore((s) => s.playTrackFromGesture);

  const bioParagraphs = (artist?.bio ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  function handleTrackClick(track: PublicArtistTrack) {
    if (currentTrack?.id === track.id) {
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
      lyrics: null,
      createdAt: new Date().toISOString(),
      error: null,
      coverUrl: track.coverUrl ?? withCdn(`/api/discover/${track.id}/cover`),
      s3KeyCover: null,
      artistName: artist?.name ?? null,
      instrumental: false,
      publicSource: true,
    });
  }

  if (loading) {
    return <div className="min-h-screen bg-canvas" />;
  }

  if (notFound || !artist) {
    return (
      <div className="min-h-screen bg-canvas font-body text-ink">
        <div className="flex h-screen items-center justify-center">
          <p className="text-ink-dim">Artist not found.</p>
        </div>
      </div>
    );
  }

  const hero = artist.heroUrl;
  const memberOf = artist.stats.sinceYear ? `Solo Artist · Est. ${artist.stats.sinceYear}` : "Solo Artist";

  return (
    <div className="bg-canvas font-body text-ink antialiased">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top brightness-[0.28] contrast-[1.1]"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 40%, var(--mq-canvas) 100%), linear-gradient(to right, var(--mq-canvas) 0%, transparent 40%)",
          }}
        />

        <nav className="relative z-[1] flex items-center justify-between border-b border-line px-6 py-7 sm:px-12">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ink/25 bg-black/40 p-0 text-ink transition-colors hover:bg-black/60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
              Official
            </span>
          </div>
          <div className="flex gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href={link === "Bio" ? "#bio" : "#tracks"}
                className="font-body text-[13px] font-medium text-ink-dim no-underline transition-colors hover:text-ink"
              >
                {link}
              </a>
            ))}
          </div>
        </nav>

        <div className="relative z-[1] flex flex-1 items-end px-6 pb-20 sm:px-12">
          <div className="max-w-[620px]">
            {artist.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="mb-7 h-24 w-24 rounded-full border border-line-strong object-cover"
              />
            )}
            <div className="mb-6 flex items-center gap-3">
              <span className="inline-block h-px w-7 bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                {memberOf}
              </span>
            </div>
            <h1 className="font-display text-[clamp(48px,10vw,128px)] font-black leading-[0.88] text-ink">
              {artist.name}
            </h1>
            {bioParagraphs[0] && (
              <p className="mt-6 max-w-[420px] font-body text-lg font-light text-ink-muted">
                {bioParagraphs[0]}
              </p>
            )}
            <div className="mt-10 flex gap-4">
              <a href="#tracks" className="mq-btn mq-btn-primary no-underline">
                Stream Now
              </a>
              <a href="#bio" className="mq-btn mq-btn-ghost no-underline">
                About
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Bio */}
      {bioParagraphs.length > 0 && (
        <section
          id="bio"
          className="mx-auto grid max-w-[1100px] grid-cols-1 gap-12 border-t border-line px-6 py-20 md:grid-cols-[1fr_1.6fr] md:px-12 md:py-28"
        >
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
              Biography
            </span>
            <div className="mt-5 grid grid-cols-3 gap-0 border-t border-line pt-5">
              {[
                [String(artist.stats.tracks), "Tracks"],
                [formatPlays(artist.stats.totalPlays), "Plays"],
                [artist.stats.sinceYear ? String(artist.stats.sinceYear) : "—", "Since"],
              ].map(([value, label]) => (
                <div key={label}>
                  <div className="font-display text-[28px] font-bold text-ink">{value}</div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {bioParagraphs.map((paragraph, index) => {
              const isLast = index === bioParagraphs.length - 1 && bioParagraphs.length > 1;
              return (
                <p
                  key={index}
                  className={`mb-5 font-body text-base font-light leading-[1.7] ${
                    isLast ? "italic text-ink-dim" : "text-ink-muted"
                  }`}
                >
                  {paragraph}
                </p>
              );
            })}

            {artist.genres.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2.5">
                {artist.genres.map((genre) => (
                  <span
                    key={genre}
                    className="border border-line px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tracks */}
      <section id="tracks" className="border-t border-line px-6 pb-24 pt-12">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="font-display text-[clamp(32px,5vw,64px)] font-black text-ink">
              Tracks
            </h2>
            <span className="font-mono text-[11px] text-ink-dim">
              {tracks.length} {tracks.length === 1 ? "Song" : "Songs"}
            </span>
          </div>

          {tracks.length === 0 ? (
            <p className="font-body text-ink-dim">No published tracks yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-3 border-b border-line px-3 pb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                <span>#</span>
                <span>Title</span>
                <span className="text-right">Plays</span>
                <span className="text-right">Year</span>
                <span className="text-right">Time</span>
              </div>

              {tracks.map((track, index) => {
                const isCurrent = currentTrack?.id === track.id;
                const isPlaying = isCurrent && globalIsPlaying;
                const isHovered = hoveredId === track.id;

                return (
                  <div
                    key={track.id}
                    onMouseEnter={() => setHoveredId(track.id)}
                    onMouseLeave={() => setHoveredId((id) => (id === track.id ? null : id))}
                    onClick={() => handleTrackClick(track)}
                    className={`grid cursor-pointer grid-cols-[40px_1fr_80px_80px_60px] items-center gap-3 px-3 py-3.5 ${
                      isHovered ? "bg-surface" : ""
                    }`}
                  >
                    <span className={`font-mono text-xs ${isPlaying ? "text-accent" : "text-ink-dim"}`}>
                      {isPlaying ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <rect x="2" y="1" width="3" height="10" />
                          <rect x="7" y="1" width="3" height="10" />
                        </svg>
                      ) : isHovered ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-ink">
                          <polygon points="2,1 11,6 2,11" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={`truncate font-body text-[15px] ${
                        isPlaying ? "font-semibold text-accent" : "text-ink"
                      }`}
                    >
                      {track.title}
                    </span>
                    <span className="text-right font-mono text-[11px] text-ink-dim">
                      {formatPlays(track.plays)}
                    </span>
                    <span className="text-right font-mono text-[11px] text-ink-dim">
                      {track.year}
                    </span>
                    <span className="text-right font-mono text-[11px] text-ink-dim">
                      {formatDuration(track.duration)}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-line px-6 py-8 sm:px-12">
        <span className="font-display text-lg font-black text-line-strong">
          {artist.name}
        </span>
        <span className="font-mono text-[11px] text-ink-dim">
          © {new Date().getFullYear()} · All Rights Reserved
        </span>
      </footer>
    </div>
  );
}
