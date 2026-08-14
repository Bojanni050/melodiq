import { describe, expect, it } from "vitest";
import { generateMagicLinkToken, hashMagicLinkToken, MAGIC_LINK_TTL_MS } from "../magic-link";

describe("magic-link token helpers", () => {
  it("generates a sufficiently long, url-safe raw token", () => {
    const { raw } = generateMagicLinkToken();
    expect(raw.length).toBeGreaterThanOrEqual(32);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique raw tokens across calls", () => {
    const a = generateMagicLinkToken();
    const b = generateMagicLinkToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it("hashes a raw token deterministically", () => {
    const { raw, hash } = generateMagicLinkToken();
    expect(hashMagicLinkToken(raw)).toBe(hash);
    expect(hashMagicLinkToken(raw)).toBe(hashMagicLinkToken(raw));
  });

  it("produces different hashes for different raw tokens", () => {
    const a = generateMagicLinkToken();
    const b = generateMagicLinkToken();
    expect(hashMagicLinkToken(a.raw)).not.toBe(hashMagicLinkToken(b.raw));
  });

  it("uses a 15 minute TTL", () => {
    expect(MAGIC_LINK_TTL_MS).toBe(15 * 60 * 1000);
  });
});
