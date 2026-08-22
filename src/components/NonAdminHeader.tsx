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
    <header className="relative z-20 flex h-14 items-center border-b border-white/5 bg-[#0d0d12]/95 px-6 backdrop-blur-sm lg:hidden">
      <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-500 bg-clip-text text-transparent">
        MelodIQ
      </span>
    </header>
  );
}