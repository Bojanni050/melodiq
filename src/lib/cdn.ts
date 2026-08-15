// Rewrites a relative path to a CDN hostname when NEXT_PUBLIC_CDN_URL is
// configured (e.g. a Bunny CDN pull zone pointed at this origin) — otherwise
// returns the path unchanged, so the app works identically with no CDN set up.
//
// Only ever call this for genuinely public, unauthenticated resources
// (the /api/discover/* routes). Never wrap /api/tracks/* URLs — those are
// per-user and auth-gated, and have no business going through a public CDN
// hostname.
const CDN_URL = (process.env.NEXT_PUBLIC_CDN_URL || "").replace(/\/+$/, "");

export function withCdn(path: string): string {
  if (!CDN_URL) return path;
  return `${CDN_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
