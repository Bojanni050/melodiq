"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";

export default function TimecodedEditorLayout({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <Sidebar credits={null} />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? "var(--sidebar-collapsed)" : isQHD ? "var(--sidebar-width-qhd)" : "var(--sidebar-width)" }}
      >
        {children}
      </main>
    </div>
  );
}
