"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Roboto_Slab, Outfit, DM_Mono } from "next/font/google";

import { formatDuration } from "@/lib/track-utils";
import { usePlayerStore } from "@/lib/store";
import { withCdn } from "@/lib/cdn-client";

const robotoSlab = Roboto_Slab({ subsets: ["latin"], weight: ["300", "400", "700", "900"], variable: "--font-artist-slab" });
const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-artist-outfit" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-artist-mono" });

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
    return (
      <div className={`${robotoSlab.variable} ${outfit.variable} ${dmMono.variable}`} style={{ background: "#080807", minHeight: "100vh" }} />
    );
  }

  if (notFound || !artist) {
    return (
      <div
        className={`${robotoSlab.variable} ${outfit.variable} ${dmMono.variable}`}
        style={{ background: "#080807", color: "#e8e4db", minHeight: "100vh", fontFamily: "var(--font-artist-outfit), sans-serif" }}
      >
        <div className="flex h-screen items-center justify-center">
          <p style={{ color: "#6b6860" }}>Artist not found.</p>
        </div>
      </div>
    );
  }

  const hero = artist.heroUrl;
  const memberOf = artist.stats.sinceYear ? `Solo Artist · Est. ${artist.stats.sinceYear}` : "Solo Artist";

  return (
    <div
      className={`${robotoSlab.variable} ${outfit.variable} ${dmMono.variable}`}
      style={{ background: "#080807", color: "#e8e4db", fontFamily: "var(--font-artist-outfit), sans-serif", WebkitFontSmoothing: "antialiased" }}
    >
      {/* Hero */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              filter: "brightness(0.28) contrast(1.1)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 40%, #080807 100%), linear-gradient(to right, #080807 0%, transparent 40%)",
          }}
        />

        <nav
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.75rem 3rem",
            borderBottom: "1px solid #1a1917",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                background: "rgba(0, 0, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 11, letterSpacing: "0.14em", color: "#6b6860", textTransform: "uppercase" }}>
              Official
            </span>
          </div>
          <div style={{ display: "flex", gap: "2rem" }}>
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href={link === "Bio" ? "#bio" : "#tracks"}
                style={{ fontFamily: "var(--font-artist-outfit), sans-serif", fontWeight: 500, fontSize: 13, color: "#6b6860", textDecoration: "none" }}
              >
                {link}
              </a>
            ))}
          </div>
        </nav>

        <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", alignItems: "flex-end", padding: "0 3rem 5rem" }}>
          <div style={{ maxWidth: 620 }}>
            {artist.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.imageUrl}
                alt={artist.name}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  objectFit: "cover",
                  marginBottom: 28,
                  border: "1px solid #2a2825",
                }}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ width: 28, height: 1, background: "#d4500a", display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 11, letterSpacing: "0.1em", color: "#d4500a", textTransform: "uppercase" }}>
                {memberOf}
              </span>
            </div>
            <h1
              style={{
                fontFamily: "var(--font-artist-slab), serif",
                fontWeight: 900,
                fontSize: "clamp(48px, 10vw, 128px)",
                lineHeight: 0.88,
                margin: 0,
                color: "#e8e4db",
              }}
            >
              {artist.name}
            </h1>
            {bioParagraphs[0] && (
              <p style={{ fontFamily: "var(--font-artist-outfit), sans-serif", fontWeight: 300, fontSize: 18, color: "#a09d95", maxWidth: 420, marginTop: 24 }}>
                {bioParagraphs[0]}
              </p>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
              <a
                href="#tracks"
                style={{
                  fontFamily: "var(--font-artist-mono), monospace",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: "#d4500a",
                  color: "#e8e4db",
                  padding: "14px 28px",
                  textDecoration: "none",
                }}
              >
                Stream Now
              </a>
              <a
                href="#bio"
                style={{
                  fontFamily: "var(--font-artist-mono), monospace",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  border: "1px solid #252420",
                  color: "#e8e4db",
                  padding: "14px 28px",
                  textDecoration: "none",
                }}
              >
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
          style={{
            padding: "5rem 1.5rem",
            borderTop: "1px solid #1a1917",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "3rem",
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <style>{`
            @media (min-width: 900px) {
              #bio { grid-template-columns: 1fr 1.6fr !important; padding: 7rem 3rem !important; }
            }
          `}</style>
          <div>
            <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 10, letterSpacing: "0.14em", color: "#6b6860", textTransform: "uppercase" }}>
              Biography
            </span>
            <div style={{ marginTop: 20, borderTop: "1px solid #1a1917", paddingTop: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[
                [String(artist.stats.tracks), "Tracks"],
                [formatPlays(artist.stats.totalPlays), "Plays"],
                [artist.stats.sinceYear ? String(artist.stats.sinceYear) : "—", "Since"],
              ].map(([value, label]) => (
                <div key={label}>
                  <div style={{ fontFamily: "var(--font-artist-slab), serif", fontWeight: 700, fontSize: 28, color: "#e8e4db" }}>{value}</div>
                  <div style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 9, letterSpacing: "0.1em", color: "#6b6860", textTransform: "uppercase", marginTop: 4 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {bioParagraphs.map((paragraph, index) => (
              <p
                key={index}
                style={{
                  fontFamily: "var(--font-artist-outfit), sans-serif",
                  fontWeight: 300,
                  fontSize: 16,
                  lineHeight: 1.7,
                  color: index === bioParagraphs.length - 1 && bioParagraphs.length > 1 ? "#6b6860" : "#a09d95",
                  fontStyle: index === bioParagraphs.length - 1 && bioParagraphs.length > 1 ? "italic" : "normal",
                  marginBottom: 20,
                }}
              >
                {paragraph}
              </p>
            ))}

            {artist.genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
                {artist.genres.map((genre) => (
                  <span
                    key={genre}
                    style={{
                      border: "1px solid #1a1917",
                      padding: "6px 14px",
                      fontFamily: "var(--font-artist-mono), monospace",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#a09d95",
                    }}
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
      <section id="tracks" style={{ padding: "3rem 1.5rem 6rem", borderTop: "1px solid #1a1917" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
            <h2 style={{ fontFamily: "var(--font-artist-slab), serif", fontWeight: 900, fontSize: "clamp(32px, 5vw, 64px)", margin: 0 }}>
              Tracks
            </h2>
            <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 11, color: "#6b6860" }}>
              {tracks.length} {tracks.length === 1 ? "Song" : "Songs"}
            </span>
          </div>

          {tracks.length === 0 ? (
            <p style={{ color: "#6b6860", fontFamily: "var(--font-artist-outfit), sans-serif" }}>No published tracks yet.</p>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 80px 80px 60px",
                  gap: 12,
                  padding: "0 12px 12px",
                  borderBottom: "1px solid #1a1917",
                  fontFamily: "var(--font-artist-mono), monospace",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#6b6860",
                }}
              >
                <span>#</span>
                <span>Title</span>
                <span style={{ textAlign: "right" }}>Plays</span>
                <span style={{ textAlign: "right" }}>Year</span>
                <span style={{ textAlign: "right" }}>Time</span>
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
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr 80px 80px 60px",
                      gap: 12,
                      alignItems: "center",
                      padding: "14px 12px",
                      cursor: "pointer",
                      background: isHovered ? "#111110" : "transparent",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 12, color: isPlaying ? "#d4500a" : "#6b6860" }}>
                      {isPlaying ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="#d4500a">
                          <rect x="2" y="1" width="3" height="10" />
                          <rect x="7" y="1" width="3" height="10" />
                        </svg>
                      ) : isHovered ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="#e8e4db">
                          <polygon points="2,1 11,6 2,11" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-artist-outfit), sans-serif",
                        fontWeight: isPlaying ? 600 : 400,
                        fontSize: 15,
                        color: isPlaying ? "#d4500a" : "#e8e4db",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {track.title}
                    </span>
                    <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 11, color: "#6b6860", textAlign: "right" }}>
                      {formatPlays(track.plays)}
                    </span>
                    <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 11, color: "#6b6860", textAlign: "right" }}>
                      {track.year}
                    </span>
                    <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 11, color: "#6b6860", textAlign: "right" }}>
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
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2rem 3rem",
          borderTop: "1px solid #1a1917",
        }}
      >
        <span style={{ fontFamily: "var(--font-artist-slab), serif", fontWeight: 900, fontSize: 18, color: "#252420" }}>
          {artist.name}
        </span>
        <span style={{ fontFamily: "var(--font-artist-mono), monospace", fontSize: 11, color: "#6b6860" }}>
          © {new Date().getFullYear()} · All Rights Reserved
        </span>
      </footer>
    </div>
  );
}
