"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Player from "@/components/Player";
import { useUserStore } from "@/lib/store";

const AUTH_PATHS = new Set(["/login", "/register"]);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    if (AUTH_PATHS.has(pathname)) return;

    let cancelled = false;

    async function verifySession() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUser(data.user ?? null);
          return;
        }

        if (res.status === 401 || res.status === 404) {
          setUser(null);
          router.replace("/login");
          router.refresh();
        }
      } catch {
        // Keep the current page on transient network errors.
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, setUser]);

  return (
    <>
      {children}
      <Player />
    </>
  );
}
