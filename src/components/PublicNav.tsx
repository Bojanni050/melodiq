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
    <header className="relative z-20 border-b border-white/5 bg-[#0d0d12]/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link href="/discover" className="flex shrink-0 items-center gap-2">
            <svg className="h-7 w-7 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span className="bg-linear-to-r from-primary-400 to-primary-500 bg-clip-text text-lg font-bold text-transparent">
              MelodIQ
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  l.active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link
          href="/login"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          {t("auth.signInLower")}
        </Link>
      </div>
    </header>
  );
}
