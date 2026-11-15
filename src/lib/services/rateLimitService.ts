const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT = 5;

// Note: this resets on container restart. For multi-container setups, use Redis instead.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Purge stale entries every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Fixed-window limiter. `key` is namespaced by the caller so unrelated
 * endpoints never share a bucket: `checkRateLimit(userId)` for generation,
 * `checkRateLimit(`dna-feedback-${userId}`, 30)` for cheap DNA writes.
 */
export function checkRateLimit(
  key: string,
  limit: number = DEFAULT_RATE_LIMIT,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    if (rateLimitMap.size > 500) {
      for (const [k, val] of rateLimitMap.entries()) {
        if (Date.now() > val.resetAt) rateLimitMap.delete(k);
      }
    }
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
