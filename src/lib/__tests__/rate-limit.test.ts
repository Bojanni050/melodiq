import { describe, expect, it, vi, afterEach } from "vitest";

import { checkRateLimit } from "../services/rateLimitService";

let seq = 0;
const nextKey = (label: string) => `${label}-${++seq}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows exactly the given number of calls, then blocks", () => {
    const key = nextKey("limit");
    expect(checkRateLimit(key, 3)).toBe(true);
    expect(checkRateLimit(key, 3)).toBe(true);
    expect(checkRateLimit(key, 3)).toBe(true);
    expect(checkRateLimit(key, 3)).toBe(false);
    expect(checkRateLimit(key, 3)).toBe(false);
  });

  it("keeps the historical default of five per minute", () => {
    const key = nextKey("default");
    for (let i = 0; i < 5; i++) expect(checkRateLimit(key)).toBe(true);
    expect(checkRateLimit(key)).toBe(false);
  });

  it("namespaces do not share a budget", () => {
    const user = nextKey("user");
    expect(checkRateLimit(`dna-recompute-${user}`, 1)).toBe(true);
    expect(checkRateLimit(`dna-recompute-${user}`, 1)).toBe(false);
    // Same user, different endpoint: still allowed.
    expect(checkRateLimit(`dna-feedback-${user}`, 1)).toBe(true);
  });

  it("resets once the window has passed", () => {
    vi.useFakeTimers();
    const key = nextKey("window");
    expect(checkRateLimit(key, 1, 1_000)).toBe(true);
    expect(checkRateLimit(key, 1, 1_000)).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(checkRateLimit(key, 1, 1_000)).toBe(true);
  });
});
