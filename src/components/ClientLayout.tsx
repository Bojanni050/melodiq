"use client";

import { usePathname } from "next/navigation";
import Player from "@/components/Player";
import { useDpadNavigation } from "@/hooks/useDpadNavigation";
import NonAdminHeader from "@/components/NonAdminHeader";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useDpadNavigation();
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
