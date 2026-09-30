import { and, eq, isNull, type SQL } from "drizzle-orm";

import { tracks } from "@/db/schema";

// Artist pages (per-alias public showcase at /artist/[slug]) share their rules
// between the API routes, the management page and the public page, so they
// live here rather than in any single route.

export const ARTIST_PAGE_BIO_MAX_LENGTH = 2000;
const SLUG_MAX_LENGTH = 80;

export interface ArtistPageInput {
  alias: string;
  slug: string;
  bio: string | null;
  hasImage: boolean;
  hasHero: boolean;
}

/**
 * Turns an artist name into a URL segment: lowercase, ASCII-folded (so "Björk"
 * becomes "bjork" instead of a percent-encoded mess), everything else collapsed
 * into single dashes. Returns "" when the name has no usable characters left
 * (e.g. "!!!" or a pure-emoji name) — callers must treat that as "needs a
 * manual slug" rather than silently producing an empty URL.
 */
export function slugifyArtistPageSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  return slug;
}

/**
 * Picks a slug that is free within `takenSlugs`. Tries the plain slugified
 * name first, then appends an incrementing counter ("jay-blake-2"). Both inputs
 * are checked against the same set, so the result is free when returned —
 * callers still have to handle the unique index as the real arbiter, since two
 * concurrent creations can pass this check simultaneously.
 */
export function buildUniqueArtistPageSlug(alias: string, takenSlugs: Set<string>): string {
  const base = slugifyArtistPageSlug(alias) || "artist";
  if (!takenSlugs.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!takenSlugs.has(candidate)) return candidate;
  }
  // Absurdly unlikely (999 same-named artists); keep the function total anyway.
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Validates a hand-typed slug from the management form. Stricter than
 * slugifyArtistPageSlug because the user's exact input is what gets used.
 */
export function validateArtistPageSlug(value: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = value.trim().toLowerCase();
  if (!slug) return { ok: false, error: "Slug is required" };
  if (slug.length > SLUG_MAX_LENGTH) {
    return { ok: false, error: `Slug too long (max ${SLUG_MAX_LENGTH} characters)` };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: "Slug may only contain letters, numbers and single dashes" };
  }
  return { ok: true, slug };
}

export function normalizeArtistPageBio(value: unknown): { ok: true; bio: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") return { ok: true, bio: null };
  if (typeof value !== "string") return { ok: false, error: "Bio must be text" };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, bio: null };
  if (trimmed.length > ARTIST_PAGE_BIO_MAX_LENGTH) {
    return { ok: false, error: `Bio too long (max ${ARTIST_PAGE_BIO_MAX_LENGTH} characters)` };
  }
  return { ok: true, bio: trimmed };
}

/** True when `alias` is one of the user's own artist names (account aliases). */
export function isOwnArtistAlias(aliases: string[], alias: string): boolean {
  const target = alias.trim().toLowerCase();
  return aliases.some((entry) => entry.trim().toLowerCase() === target);
}

/**
 * Which tracks an artist page shows: the owner's published tracks credited to
 * that artist name.
 *
 * This is the whole feature in one predicate, so it lives here and is unit
 * tested rather than inlined in the route. Two things are load-bearing:
 *
 *  - `artistName = alias` is an exact match on the same string the owner picks
 *    from their alias dropdown when uploading, which is why pages can be
 *    created for aliases but never for names invented on the page itself.
 *  - the privacy boundary mirrors the discover feed (published + done, not
 *    deleted / archived / hidden). A page must never leak drafts or archived
 *    masters through a public URL.
 */
export function publishedArtistTracksFilter(userId: string, alias: string): SQL {
  // drizzle types and() as `SQL | undefined` even though every condition below
  // is concrete, so the result is never actually undefined; assert it once here
  // instead of making every caller (and the test) deal with a phantom case.
  return and(
    eq(tracks.userId, userId),
    eq(tracks.artistName, alias),
    eq(tracks.releaseStatus, "published"),
    eq(tracks.status, "done"),
    isNull(tracks.deletedAt),
    isNull(tracks.archivedAt),
    isNull(tracks.hiddenAt)
  ) as SQL;
}
