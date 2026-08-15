"use client";

import { prefixCdn } from "@/lib/cdn";

// Client-side counterpart to cdn-server.ts's getCdnUrl(): the CDN hostname
// lives in Settings (DB), which client components can't read directly, so
// it's fetched once from the public /api/config/public endpoint and cached
// in memory for the lifetime of the page. Until that fetch resolves, or if
// no CDN is configured, withCdn() is a no-op — same as today.
let cachedCdnUrl = "";
let loadPromise: Promise<void> | null = null;

export function loadCdnConfig(): void {
  if (loadPromise) return;
  loadPromise = fetch("/api/config/public")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { cdnUrl?: string } | null) => {
      if (data?.cdnUrl) cachedCdnUrl = data.cdnUrl;
    })
    .catch(() => {
      // Stay on the no-CDN default; a retry isn't worth it for a same-page load.
    });
}

export function withCdn(path: string): string {
  return prefixCdn(cachedCdnUrl, path);
}
