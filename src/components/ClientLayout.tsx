"use client";

import { usePathname } from "next/navigation";
import Player from "@/components/Player";
import RoleSwitcher from "@/components/RoleSwitcher";
import { useDpadNavigation } from "@/hooks/useDpadNavigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useDpadNavigation();
  const pathname = usePathname();
  const isPopupWindow = pathname === "/player-window";

  return (
    <>
      {children}
      {!isPopupWindow && <Player />}
      <RoleSwitcher />
    </>
  );
}
