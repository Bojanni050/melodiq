"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/hooks/useT";

// Top bar for logged-out visitors of the public pages (the studio Sidebar is
// only for signed-in users).
export default function PublicNav() {
  const pathname = usePathname();
  const t = useT();

  const links = [
    { href: "/discover", label: t("nav.discover"), active: pathname === "/discover" || pathname.startsWith("/discover/track") },
    { href: "/discover/releases", label: t("nav.releasesBrowse"), active: pathname.startsWith("/discover/release") },
    { href: "/explore", label: "Explore", active: pathname === "/explore" },
  ];

  return (
    <header className="relative z-20 border-b border-line bg-canvas/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link href="/discover" className="flex shrink-0 items-center gap-2">
            <svg className="h-7 w-7 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span className="font-display text-lg font-black text-ink">
              MelodIQ
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 font-medium transition ${
                  l.active ? "bg-accent/10 text-accent" : "text-ink-muted hover:bg-white/[0.04] hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/login"
          className="shrink-0 bg-accent px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-accent-strong"
        >
          {t("auth.signInLower")}
        </Link>
      </div>
    </header>
  );
}
