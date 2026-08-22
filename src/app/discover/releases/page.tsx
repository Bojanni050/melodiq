"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore, useUserStore } from "@/lib/store";
import { formatDuration } from "@/lib/track-utils";
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
  totalPlays: number;
  coverUrl: string | null;
}

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

  const [releases, setReleases] = useState<PublicRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date");

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
                <div>
                  {/* Header row */}
                  <div className="flex items-center gap-3 border-b border-white/8 px-3 pb-2 text-xs uppercase tracking-wide text-white/35">
                    <span className="w-5 text-center">#</span>
                    <span className="flex-1">Title</span>
                    <span className="hidden sm:block w-24 text-right">Plays</span>
                    <span className="w-12 text-right">
                      <svg className="ml-auto h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 7v5l3 3" />
                      </svg>
                    </span>
                  </div>

                  {displayedReleases.map((release, index) => (
                    <Link
                      key={release.id}
                      href={`/discover/release/${release.id}`}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
                    >
                      <span className="w-5 shrink-0 text-center text-sm text-white/40">{index + 1}</span>
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/5">
                        {release.coverUrl ? (
                          <img src={release.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-600/40 to-primary-900/40">
                            <svg className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{release.title}</p>
                        <p className="truncate text-xs text-white/45">
                          {release.artistName}
                          <span className="mx-1.5 text-white/25">·</span>
                          <span className="capitalize">{release.type}</span>
                          <span className="mx-1.5 text-white/25">·</span>
                          {release.trackCount} {release.trackCount === 1 ? "track" : "tracks"}
                        </p>
                      </div>
                      <span className="hidden sm:block w-24 shrink-0 text-right text-sm text-white/45">
                        {release.totalPlays.toLocaleString()}
                      </span>
                      <span className="w-12 shrink-0 text-right text-sm text-white/45">
                        {formatDuration(release.totalDuration)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/45 px-1">No published releases yet.</p>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
