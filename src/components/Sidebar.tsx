"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspaceStore, usePlayerStore, useSidebarStore, useUserStore, useLocaleStore, type Locale } from "@/lib/store";
import { useT } from "@/hooks/useT";

interface SidebarProps {
  credits: number | null;
}

function useIsQHD() {
  const [isQHD, setIsQHD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 2560px)");
    setIsQHD(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsQHD(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isQHD;
}

// Mirrors the `lg` Tailwind breakpoint (1024px) that the desktop <aside>
// below is gated on (`hidden lg:flex`), so pages know when it's actually safe
// to reserve horizontal space for it.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export default function Sidebar({ credits }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isQHD = useIsQHD();
  const isDesktop = useIsDesktop();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const setIsQHD = useSidebarStore((s) => s.setIsQHD);
  const setIsDesktop = useSidebarStore((s) => s.setIsDesktop);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useUserStore((s) => s.user);
  const loadUser = useUserStore((s) => s.loadUser);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useT();
  const selectedWorkspaceId = useWorkspaceStore((state) => state.selectedWorkspaceId);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const sidebarCoverUrl = currentTrack?.coverUrl || (currentTrack?.s3KeyCover ? `/api/tracks/${currentTrack.id}/cover` : null);
  const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "";

  useEffect(() => {
    setIsQHD(isQHD);
  }, [isQHD, setIsQHD]);

  useEffect(() => {
    setIsDesktop(isDesktop);
  }, [isDesktop, setIsDesktop]);

  useEffect(() => {
    if (!user) void loadUser();
  }, [user, loadUser]);

  // The account's saved language is the source of truth once logged in —
  // overrides whatever locale localStorage had from before login/on this device.
  useEffect(() => {
    if (user?.language === "en" || user?.language === "nl") {
      setLocale(user.language as Locale);
    }
  }, [user?.language, setLocale]);

  const isAdmin = user?.role === "admin";
  const isListener = user?.role === "listener" || user?.role == null;

  const navGroups: Array<{ label: string; items: Array<{ href: string; label: string; icon: string; placeholder?: boolean; indent?: boolean }> }> = [
    ...(isListener
      ? [
          {
            label: t("nav.browse"),
            items: [
              { href: "/discover", label: t("nav.discover"), icon: "discover" },
              { href: "/explore", label: "Explore", icon: "discover" },
              { href: "/discover/releases", label: t("nav.releasesBrowse"), icon: "releases" },
              { href: "/library", label: t("nav.library"), icon: "library" },
              { href: "/playlists", label: t("nav.playlists"), icon: "playlists" },
            ],
          },
        ]
      : [
          {
            label: t("nav.browse"),
            items: [
              { href: "/discover", label: t("nav.discover"), icon: "discover" },
              { href: "/explore", label: "Explore", icon: "discover" },
              { href: "/discover/releases", label: t("nav.releasesBrowse"), icon: "releases" },
            ],
          },
          {
            label: t("nav.organize"),
            items: [
              { href: "/library", label: t("nav.library"), icon: "library" },
              { href: "/playlists", label: t("nav.playlists"), icon: "playlists" },
              { href: "/releases", label: t("nav.myReleases"), icon: "releases" },
              { href: "/archive", label: t("nav.masterTracks"), icon: "archive" },
              { href: "/smart-archive", label: t("nav.smartArchive"), icon: "smart-archive" },
              { href: "/workspaces", label: t("nav.workspaces"), icon: "workspaces" },
            ],
          },
        ]),
    ...(!isListener
      ? [
          {
            label: t("nav.create"),
            items: [
              { href: "/lyrics-studio", label: t("nav.lyrics"), icon: "lyrics" },
              { href: "/melody", label: t("nav.melody"), icon: "melody" },
              { href: "/studio", label: t("nav.music"), icon: "music" },
            ],
          },
          {
            label: t("nav.refine"),
            items: [
              { href: "/timecoded-editor", label: t("nav.timecodeEditor"), icon: "timecode" },
            ],
          },
        ]
      : []),
    ...(user
      ? [
          {
            label: t("nav.account"),
            items: [
              { href: "/account", label: t("nav.accountLink"), icon: "account" },
              { href: "/artist-pages", label: t("nav.artistPages"), icon: "artist-pages" },
              { href: "/settings", label: t("nav.settings"), icon: "settings" },
            ],
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            label: t("nav.developer"),
            items: [
              { href: "/logs", label: t("nav.logs"), icon: "logs" },
              { href: "/admin", label: t("nav.admin"), icon: "admin" },
            ],
          },
        ]
      : []),
  ];

  const allNavHrefs = navGroups.flatMap((group) => group.items.map((item) => item.href));

  function isNavItemActive(href: string) {
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    // Only claim active if no more specific nav item also matches this path,
    // so e.g. "/discover" doesn't light up while on "/discover/releases".
    return !allNavHrefs.some(
      (other) => other !== href && other.length > href.length && (pathname === other || pathname.startsWith(other + "/"))
    );
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function Icon({ name, active }: { name: string; active: boolean }) {
    const cls = active ? "text-accent" : "text-ink-muted";
    switch (name) {
      case "studio":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      case "lyrics":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "library":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        );
      case "playlists":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h10M4 12h10M4 18h6m8-9v9.28a2 2 0 11-2-1.96V9h-2V7h4z" />
          </svg>
        );
      case "releases":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
            <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
          </svg>
        );
      case "workspaces":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
        );
      case "settings":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "account":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case "artist-pages":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l2.6 5.6 6.4.8-4.7 4.3 1.2 6.3L12 17l-5.5 3 1.2-6.3L3 9.4l6.4-.8L12 3z" />
          </svg>
        );
      case "logs":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "discover":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zM21 17a3 3 0 11-6 0 3 3 0 016 0zM3 13l6-1.5M3 13v-2l6-1.5" />
          </svg>
        );
      case "archive":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 7v12a1 1 0 001 1h16a1 1 0 001-1V7M3 7l1.5-3h15L21 7M10 12h4" />
          </svg>
        );
      case "smart-archive":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v4a1 1 0 001 1h4M9 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-5-5H9zm-2 11l2.5 2.5L15 11" />
          </svg>
        );
      case "admin":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l7 3.5v5.25c0 4.5-3 8.5-7 9.75-4-1.25-7-5.25-7-9.75V6.5L12 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.5 12l1.75 1.75L14.5 10" />
          </svg>
        );
      case "style":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        );
      case "music":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      case "timecode":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l2.5 2.5M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.5 7.5L5 6M20.5 7.5L19 6M12 3V1.5" />
          </svg>
        );
      case "melody":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 18V5l10-2v13M9 18a3 3 0 11-3-3 3 3 0 013 3zm10-2a3 3 0 11-3-3 3 3 0 013 3z" />
          </svg>
        );
      default:
        return null;
    }
  }

  const sidebarWidth = isQHD ? (collapsed ? "w-15" : "w-75") : (collapsed ? "w-15" : "w-60");

  return (
    <>
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 bg-canvas border-r border-line transition-all duration-300 z-30 overflow-hidden ${sidebarWidth}`}
        style={isQHD && !collapsed ? { fontSize: "1.1em" } : undefined}
      >
        {sidebarCoverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center blur-[60px] opacity-20 saturate-200 pointer-events-none scale-110"
            style={{ backgroundImage: `url(${sidebarCoverUrl})` }}
          />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isQHD
              ? "linear-gradient(to right, transparent 40%, #080807 100%)"
              : collapsed
                ? "linear-gradient(to right, transparent 50%, #080807 100%)"
                : "linear-gradient(to right, transparent 30%, #080807 100%)",
          }}
        />
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
          <Link href="/discover" className="flex items-center gap-2.5">
            <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-2xl font-display font-black text-ink">
                  MelodIQ
                </span>
                <span className="text-xs text-ink-dim tracking-wide">
                  Create. Refine. Produce.
                </span>
                {buildVersion && (
                  <span className="text-[11px] text-ink-dim">
                    build number {buildVersion}
                  </span>
                )}
              </div>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
          {!collapsed && (
            <Link
              href="/discover"
              className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                pathname === "/discover"
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-ink-muted font-medium hover:text-ink hover:bg-white/[0.03]"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </Link>
          )}
          {!collapsed && <div className="border-t border-line" />}
          {!collapsed && user?.name && (
            <p className="px-3 py-2 text-sm text-ink-muted">
              Hi {user.name.split(" ")[0]}
            </p>
          )}
          {!collapsed && <div className="border-t border-line" />}
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isNavItemActive(item.href);
                  const targetHref = item.href === "/workspaces" && selectedWorkspaceId
                    ? `/workspaces/${selectedWorkspaceId}`
                    : item.href;
                  const isPlaceholder = "placeholder" in item && item.placeholder;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={targetHref}
                      onClick={isPlaceholder ? (e) => e.preventDefault() : undefined}
                      className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${item.indent ? "ml-3" : ""} ${
                        active
                          ? "bg-accent/10 text-accent font-medium"
                          : isPlaceholder
                            ? "text-ink-dim cursor-not-allowed"
                            : "text-ink-muted font-medium hover:text-ink hover:bg-white/[0.03]"
                      }`}
                      title={isPlaceholder ? "Coming soon" : undefined}
                    >
                      <Icon name={item.icon} active={active} />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          {active && <span className="text-accent mr-1 font-bold">&gt; </span>}
                          {item.label}
                          {isPlaceholder && <span className="text-[9px] text-ink-dim uppercase tracking-wider">soon</span>}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
              {!collapsed && <div className="mt-4 border-t border-line" />}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-24 space-y-3 border-t border-line pt-3">
          {user && credits !== null && (
            <div className="px-3 py-2 bg-white/[0.03]">
              <p className="text-sm text-ink-dim">Credits</p>
              <p className="text-sm font-medium text-ink">{credits.toLocaleString()}</p>
            </div>
          )}
          {user ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-ink-dim hover:text-ink hover:bg-white/[0.03] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!collapsed && <span>Logout</span>}
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium bg-accent text-ink hover:bg-accent-strong transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l4-4m0 0l-4-4m4 4H3m12 0V7a3 3 0 013-3h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a3 3 0 01-3-3" />
              </svg>
              {!collapsed && <span>{t("auth.signInLower")}</span>}
            </Link>
          )}
        </div>
      </aside>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 w-6 h-12 items-center justify-center bg-canvas border border-line-strong text-ink-dim hover:text-ink hover:bg-white/[0.03] transition-colors"
          aria-label="Sidebar openen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Collapse button when expanded */}
      {!collapsed && (
        <button
          onClick={() => setCollapsed(true)}
          className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-30 w-6 h-12 items-center justify-center bg-canvas border border-line-strong text-ink-dim hover:text-ink hover:bg-white/[0.03] transition-colors"
          style={{ left: isQHD ? "300px" : "240px" }}
          aria-label="Sidebar sluiten"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-canvas/95 backdrop-blur-sm border-b border-line h-13.25">
        <div className="flex items-center justify-between px-4 h-full">
          <Link href="/discover" className="flex items-center gap-2">
            <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-display font-black text-ink">
                MelodIQ
              </span>
              <span className="text-[11px] text-ink-dim tracking-wide">
                Create. Refine. Produce.
              </span>
              {buildVersion && (
                <span className="text-[10px] text-ink-dim">
                  build number {buildVersion}
                </span>
              )}
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-ink-muted hover:text-ink transition-colors"
            aria-label="Open navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative ml-auto h-full w-70 bg-canvas border-l border-line flex flex-col z-10">
            <div className="flex items-center justify-between px-4 py-4 border-b border-line">
              <span className="text-base font-display font-semibold text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-ink-dim hover:text-ink transition-colors"
                aria-label="Close navigation menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
              <Link
                href="/discover"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/discover"
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-ink-muted font-medium hover:text-ink hover:bg-white/[0.03]"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Dashboard</span>
              </Link>
              <div className="border-t border-line" />
              {user?.name && (
                <p className="px-3 py-2 text-sm text-ink-muted">
                  Hi {user.name.split(" ")[0]}
                </p>
              )}
              <div className="border-t border-line" />
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = isNavItemActive(item.href);
                      const targetHref = item.href === "/workspaces" && selectedWorkspaceId
                        ? `/workspaces/${selectedWorkspaceId}`
                        : item.href;
                      const isPlaceholder = "placeholder" in item && item.placeholder;
                      return (
                        <Link
                          key={item.href + item.label}
                          href={targetHref}
                          onClick={isPlaceholder ? (e) => e.preventDefault() : () => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${item.indent ? "ml-3" : ""} ${
                            active
                              ? "bg-accent/10 text-accent font-medium"
                              : isPlaceholder
                                ? "text-ink-dim cursor-not-allowed"
                                : "text-ink-muted font-medium hover:text-ink hover:bg-white/[0.03]"
                          }`}
                          title={isPlaceholder ? "Coming soon" : undefined}
                        >
                          <Icon name={item.icon} active={active} />
                          <span className="flex items-center gap-2">
                            {item.label}
                            {isPlaceholder && <span className="text-[9px] text-ink-dim uppercase tracking-wider">soon</span>}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-4 border-t border-line" />
                </div>
              ))}
            </nav>
            <div className="px-3 pb-6 pt-3 border-t border-line space-y-3">
              {user && credits !== null && (
                <div className="px-3 py-2 bg-white/[0.03]">
                  <p className="text-[11px] text-ink-dim">Credits</p>
                  <p className="text-sm font-medium text-ink">{credits.toLocaleString()}</p>
                </div>
              )}
              {user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-ink-dim hover:text-ink hover:bg-white/[0.03] transition-colors"
                >
                  <svg className="w-5 h-5 text-ink-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium bg-accent text-ink hover:bg-accent-strong transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l4-4m0 0l-4-4m4 4H3m12 0V7a3 3 0 013-3h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a3 3 0 01-3-3" />
                  </svg>
                  <span>{t("auth.signInLower")}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
