"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore, useUserStore } from "@/lib/store";
import { formatTotalDuration } from "@/lib/track-utils";
import { useSmartBack } from "@/lib/smart-back";

interface PublicRelease {
  id: string;
  title: string;
  type: string;
  kind: string | null;
  artistName: string;
  publishedAt: string | null;
  trackCount: number;
  totalDuration: number;
  coverUrl: string | null;
}

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

  const [releases, setReleases] = useState<PublicRelease[]>([]);
  const [loading, setLoading] = useState(true);

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
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="h-screen bg-[#09090d] overflow-hidden text-white">
      <Sidebar credits={null} />

      <div
        className="h-[calc(100vh-var(--player-height)-var(--non-admin-header-height,0px))]"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        <main
          className={`h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 pt-18.25 ${
            isListener ? "lg:pt-20" : "lg:pt-5"
          }`}
        >
          <div className="max-w-400 mx-auto space-y-6">
            <section className="px-1 py-2 sm:px-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Releases</h1>
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

            <section className="space-y-3">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/60">
                  Loading releases...
                </div>
              ) : releases.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {releases.map((release) => (
                    <Link
                      key={release.id}
                      href={`/discover/release/${release.id}`}
                      className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-white/20"
                    >
                      {release.coverUrl ? (
                        <img
                          src={release.coverUrl}
                          alt={release.title}
                          className="aspect-square w-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br from-sky-600/40 to-primary-900/40">
                          <svg className="h-10 w-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{release.title}</p>
                        <p className="truncate text-xs text-white/45">{release.artistName}</p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/35">
                        <span className="uppercase tracking-wide">{release.type}</span>
                        <span>
                          {release.trackCount} {release.trackCount === 1 ? "track" : "tracks"}
                          {release.totalDuration > 0 ? ` · ${formatTotalDuration(release.totalDuration)}` : ""}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/45">No published releases yet.</p>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
