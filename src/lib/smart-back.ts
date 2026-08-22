"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export interface BackTarget {
  href: string;
  label: string;
}

/**
 * Picks a "back" link's destination/label from where the user actually came
 * from, instead of a page always pointing back to one hardcoded parent —
 * e.g. a playlist opened from the private /playlists list should go back
 * there, not always to /discover.
 *
 * Primary signal is an explicit `?from=` query param set by the linking
 * page (reliable for Next.js client-side <Link> navigation, where
 * document.referrer is never set — it's only populated on a real full-page
 * load). Falls back to document.referrer for that hard-navigation case,
 * then to `fallback`.
 */
export function useSmartBack(fallback: BackTarget): BackTarget {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [target, setTarget] = useState<BackTarget>(fallback);

  useEffect(() => {
    if (from === "playlists") {
      setTarget({ href: "/playlists", label: "Back to Playlists" });
      return;
    }
    if (from === "discover") {
      setTarget({ href: "/discover", label: "Back to Discover" });
      return;
    }

    let referrer: URL;
    try {
      if (!document.referrer) return;
      referrer = new URL(document.referrer);
    } catch {
      return;
    }
    if (referrer.origin !== window.location.origin) return;

    const path = referrer.pathname;
    if (/^\/discover\/playlist\/[^/]+\/?$/.test(path)) {
      setTarget({ href: path, label: "Back to Playlist" });
    } else if (/^\/playlists\/[^/]+\/?$/.test(path)) {
      setTarget({ href: path, label: "Back to Playlist" });
    } else if (path === "/playlists") {
      setTarget({ href: "/playlists", label: "Back to Playlists" });
    } else if (path === "/discover") {
      setTarget({ href: "/discover", label: "Back to Discover" });
    }
  }, [from]);

  return target;
}
