// Pure, isomorphic helper — safe to import from client or server code (no
// I/O, no framework imports). Prefixes `path` with `cdnUrl` when set, or
// returns it unchanged. The actual CDN hostname is resolved differently on
// each side:
//   - server:  src/lib/cdn-server.ts  (Settings DB value, env var fallback)
//   - client:  src/lib/cdn-client.ts  (fetched once from /api/config/public)
export function prefixCdn(cdnUrl: string, path: string): string {
  const trimmed = cdnUrl.replace(/\/+$/, "");
  if (!trimmed) return path;
  return `${trimmed}${path.startsWith("/") ? path : `/${path}`}`;
}
