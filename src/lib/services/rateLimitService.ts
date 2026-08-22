const RATE_LIMIT_WINDOW_MS = 60_000;

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

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateLimitMap.size > 500) {
      for (const [key, val] of rateLimitMap.entries()) {
        if (Date.now() > val.resetAt) rateLimitMap.delete(key);
      }
    }
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}
