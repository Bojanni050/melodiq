"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

interface SidebarProps {
  credits: number | null;
}

export default function Sidebar({ credits }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const buildVersion = "za 03:02";

  const navItems = [
    { href: "/", label: "Studio", icon: "studio" },
    { href: "/lyrics-studio", label: "Lyric Studio", icon: "lyrics" },
    { href: "/library", label: "Library", icon: "library" },
    { href: "/workspaces", label: "Workspaces", icon: "library" },
    { href: "/account", label: "Account", icon: "account" },
    { href: "/settings", label: "Settings", icon: "settings" },
    { href: "/logs", label: "Logs", icon: "logs" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function Icon({ name, active }: { name: string; active: boolean }) {
    const cls = active ? "text-white" : "text-white/50";
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
      case "logs":
        return (
          <svg className={`w-5 h-5 ${cls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <aside className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-[var(--player-height)] bg-[#0d0d12] border-r border-white/5 transition-all duration-300 z-30 ${collapsed ? "w-[60px]" : "w-[240px]"}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <svg className="w-7 h-7 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            {!collapsed && (
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-bold bg-gradient-to-r from-primary-400 to-[#ff530c] bg-clip-text text-transparent">
                  Sonara
                </span>
                {buildVersion && (
                  <span className="text-[11px] text-white/35">
                    version number {buildVersion}
                  </span>
                )}
              </div>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon name={item.icon} active={active} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4 space-y-3 border-t border-white/5 pt-3">
          {credits !== null && (
            <div className="px-3 py-2 bg-white/5 rounded-lg">
              <p className="text-xs text-white/40">Credits</p>
              <p className="text-sm font-medium text-white">{credits.toLocaleString()}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0d0d12]/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold bg-gradient-to-r from-primary-400 to-[#ff530c] bg-clip-text text-transparent">
                Sonara
              </span>
              {buildVersion && (
                <span className="text-[11px] text-white/35">
                  version number {buildVersion}
                </span>
              )}
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`p-2 rounded-lg ${
                    active ? "bg-white/10 text-white" : "text-white/50"
                  }`}
                >
                  <Icon name={item.icon} active={active} />
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
    </>
  );
}
