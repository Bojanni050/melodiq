"use client";

import Player from "@/components/Player";
import { useDpadNavigation } from "@/hooks/useDpadNavigation";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useDpadNavigation();
  return (
    <>
      {children}
      <Player />
    </>
  );
}
