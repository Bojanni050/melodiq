"use client";

import Player from "@/components/Player";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Player />
    </>
  );
}
