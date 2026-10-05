"use client";

import { useUserStore } from "@/lib/store";

export default function NonAdminHeader() {
  const user = useUserStore((s) => s.user);
  const isListener = user?.role === "listener" || user?.role == null;

  if (!user || !isListener) return null;

  // Mobile-only: sits in normal document flow (not fixed) so the page
  // content below it is pushed down instead of getting covered. Hidden
  // entirely on desktop (lg+), where the sidebar already carries the brand.
  return (
    <header className="relative z-20 flex h-14 items-center border-b border-line bg-canvas/95 px-6 backdrop-blur-sm lg:hidden">
      <span className="font-display text-xl font-black text-ink">
        MelodIQ
      </span>
    </header>
  );
}