"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Player from "@/components/Player";
import { useDpadNavigation } from "@/hooks/useDpadNavigation";
import NonAdminHeader from "@/components/NonAdminHeader";
import { initPerfMonitor } from "@/lib/perfMonitor";
import { loadCdnConfig } from "@/lib/cdn-client";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useDpadNavigation();
  useEffect(() => { initPerfMonitor(); }, []);
  useEffect(() => { loadCdnConfig(); }, []);
  const pathname = usePathname();
  const isPopupWindow = pathname === "/player-window";

  return (
    <>
      {!isPopupWindow && <NonAdminHeader />}
      {children}
      {!isPopupWindow && <Player />}
    </>
  );
}
