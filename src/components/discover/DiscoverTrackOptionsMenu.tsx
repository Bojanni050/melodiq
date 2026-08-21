"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReleaseStore } from "@/lib/store";

interface DiscoverTrackOptionsMenuProps {
  trackId: string;
}

export default function DiscoverTrackOptionsMenu({ trackId }: DiscoverTrackOptionsMenuProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const releases = useReleaseStore((state) => state.releases);
  const trackReleases = releases.filter((release) =>
    release.tracks.some((t) => t.trackId === trackId)
  );

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSubmenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function handleGoToTrack(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    setSubmenuOpen(false);
    router.push(`/library?trackId=${trackId}`);
  }

  function handleGoToSingleRelease(e: React.MouseEvent, releaseId: string) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    setSubmenuOpen(false);
    router.push(`/releases/${releaseId}`);
  }

  return (
    <div
      ref={menuRef}
      className="absolute top-2 right-2 z-20"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
          setSubmenuOpen(false);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/75 backdrop-blur-sm transition-colors hover:bg-black/85 hover:text-white shadow-md"
        title="Track options"
        aria-label="Track options"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
        </svg>
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-8.5 z-30 min-w-44 rounded-xl border border-white/10 bg-[#12121a] p-1.5 shadow-2xl backdrop-blur-md text-left"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* Go to track */}
          <button
            type="button"
            onClick={handleGoToTrack}
            className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
          >
            <span>Go to track</span>
          </button>

          <div className="my-1 h-px bg-white/10" />

          {/* Go to release */}
          {trackReleases.length === 0 ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs text-white/30 cursor-not-allowed opacity-50"
              title="Track is not in any release"
            >
              <span>Go to release</span>
            </button>
          ) : trackReleases.length === 1 ? (
            <button
              type="button"
              onClick={(e) => handleGoToSingleRelease(e, trackReleases[0].id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
            >
              <span>Go to release</span>
            </button>
          ) : (
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSubmenuOpen((prev) => !prev);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
              >
                <span>Go to release</span>
                <span className={`text-xs text-white/40 transition-transform ${submenuOpen ? "rotate-90" : ""}`}>›</span>
              </button>

              {submenuOpen && (
                <div className="my-1 space-y-0.5 border-l border-white/10 pl-2.5 py-0.5">
                  {trackReleases.map((release) => (
                    <button
                      key={release.id}
                      type="button"
                      onClick={(e) => handleGoToSingleRelease(e, release.id)}
                      className="block w-full truncate rounded px-2 py-1 text-left text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {release.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
