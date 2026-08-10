"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import { useSidebarStore } from "@/lib/store";

export default function TimecodedEditorLayout({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const isQHD = useSidebarStore((s) => s.isQHD);
  const isDesktop = useSidebarStore((s) => s.isDesktop);

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      <Sidebar credits={null} />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ marginLeft: !isDesktop ? 0 : sidebarCollapsed ? 60 : isQHD ? 300 : 240 }}
      >
        {children}
      </main>
    </div>
  );
}
