"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Player from "@/components/Player";
import { useDpadNavigation } from "@/hooks/useDpadNavigation";
import NonAdminHeader from "@/components/NonAdminHeader";
import { initPerfMonitor } from "@/lib/perfMonitor";
import { loadCdnConfig } from "@/lib/cdn-client";
import PerformanceOverlay from "@/components/PerformanceOverlay";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useDpadNavigation();
  useEffect(() => { initPerfMonitor(); }, []);
  useEffect(() => { loadCdnConfig(); }, []);
  const pathname = usePathname();
  const isPopupWindow = pathname === "/player-window";
  const [showPerfOverlay, setShowPerfOverlay] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle overlay with Ctrl+P or Cmd+P
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setShowPerfOverlay((prev) => !prev);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {!isPopupWindow && <NonAdminHeader />}
      {children}
      {!isPopupWindow && <Player />}
      {showPerfOverlay && <PerformanceOverlay onClose={() => setShowPerfOverlay(false)} />}
    </>
  );
}
