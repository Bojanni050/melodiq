import crypto from "crypto";

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export function generateMagicLinkToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashMagicLinkToken(raw) };
}

export function hashMagicLinkToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
