import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  ARTIST_PAGE_BIO_MAX_LENGTH,
  buildUniqueArtistPageSlug,
  isOwnArtistAlias,
  normalizeArtistPageBio,
  publishedArtistTracksFilter,
  slugifyArtistPageSlug,
  validateArtistPageSlug,
} from "@/lib/artist-pages";

const dialect = new PgDialect();

/** The filter as bound parameters + SQL, so it can be asserted on precisely. */
function filterQuery(userId: string, alias: string) {
  return dialect.sqlToQuery(publishedArtistTracksFilter(userId, alias));
}

describe("slugifyArtistPageSlug", () => {
  it("lowercases and dashes a plain artist name", () => {
    expect(slugifyArtistPageSlug("Jay Blake")).toBe("jay-blake");
  });

  it("folds diacritics instead of percent-encoding them", () => {
    expect(slugifyArtistPageSlug("Björk")).toBe("bjork");
    expect(slugifyArtistPageSlug("Café Tacvba")).toBe("cafe-tacvba");
  });

  it("collapses runs of punctuation and trims the edges", () => {
    expect(slugifyArtistPageSlug("  //  DJ  ***  Bojan!!  ")).toBe("dj-bojan");
    expect(slugifyArtistPageSlug("---ana---")).toBe("ana");
  });

  it("drops a trailing dash left behind by the length cut", () => {
    const long = "a".repeat(60) + " " + "b".repeat(40);
    const slug = slugifyArtistPageSlug(long);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns empty when nothing usable is left, so callers can fall back", () => {
    expect(slugifyArtistPageSlug("!!!")).toBe("");
    expect(slugifyArtistPageSlug("🎵")).toBe("");
  });
});

describe("buildUniqueArtistPageSlug", () => {
  it("uses the plain slug when it is free", () => {
    expect(buildUniqueArtistPageSlug("Jay Blake", new Set(["someone-else"]))).toBe("jay-blake");
  });

  it("appends an incrementing counter on collision", () => {
    expect(buildUniqueArtistPageSlug("Jay Blake", new Set(["jay-blake"]))).toBe("jay-blake-2");
    expect(buildUniqueArtistPageSlug("Jay Blake", new Set(["jay-blake", "jay-blake-2"]))).toBe("jay-blake-3");
  });

  it("skips a taken counter instead of returning it", () => {
    expect(buildUniqueArtistPageSlug("Jay", new Set(["jay", "jay-2", "jay-3"]))).toBe("jay-4");
  });

  it("falls back to 'artist' when the name slugifies to nothing", () => {
    expect(buildUniqueArtistPageSlug("!!!", new Set())).toBe("artist");
    expect(buildUniqueArtistPageSlug("!!!", new Set(["artist"]))).toBe("artist-2");
  });
});

describe("validateArtistPageSlug", () => {
  it("accepts a normal slug, trimmed and lowercased", () => {
    expect(validateArtistPageSlug("  Jay-Blake ")).toEqual({ ok: true, slug: "jay-blake" });
  });

  it("rejects empty, overlong and malformed input", () => {
    expect(validateArtistPageSlug("").ok).toBe(false);
    expect(validateArtistPageSlug("   ").ok).toBe(false);
    expect(validateArtistPageSlug("a".repeat(81)).ok).toBe(false);
    expect(validateArtistPageSlug("jay blake").ok).toBe(false);
    expect(validateArtistPageSlug("jay--blake").ok).toBe(false);
    expect(validateArtistPageSlug("-jay").ok).toBe(false);
    expect(validateArtistPageSlug("jay/../etc").ok).toBe(false);
  });
});

describe("normalizeArtistPageBio", () => {
  it("treats empty values as no page-specific bio, so the account one shows", () => {
    expect(normalizeArtistPageBio(null)).toEqual({ ok: true, bio: null });
    expect(normalizeArtistPageBio("")).toEqual({ ok: true, bio: null });
    expect(normalizeArtistPageBio("   \n ")).toEqual({ ok: true, bio: null });
  });

  it("trims stored copy", () => {
    expect(normalizeArtistPageBio("  hello  ")).toEqual({ ok: true, bio: "hello" });
  });

  it("rejects non-text and overlong bios", () => {
    expect(normalizeArtistPageBio(42).ok).toBe(false);
    expect(normalizeArtistPageBio("a".repeat(ARTIST_PAGE_BIO_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("accepts a bio exactly at the limit", () => {
    const atLimit = "a".repeat(ARTIST_PAGE_BIO_MAX_LENGTH);
    expect(normalizeArtistPageBio(atLimit)).toEqual({ ok: true, bio: atLimit });
  });
});

describe("isOwnArtistAlias", () => {
  it("matches regardless of case and surrounding spaces", () => {
    expect(isOwnArtistAlias(["Jay Blake"], " jay blake ")).toBe(true);
    expect(isOwnArtistAlias([" Jay Blake "], "JAY BLAKE")).toBe(true);
  });

  it("does not collapse inner whitespace — a different name is a different name", () => {
    expect(isOwnArtistAlias(["Jay Blake"], "jay  blake")).toBe(false);
  });

  it("rejects a name that is not on the account", () => {
    expect(isOwnArtistAlias(["Jay Blake"], "Someone Else")).toBe(false);
    expect(isOwnArtistAlias([], "Jay Blake")).toBe(false);
  });
});

describe("publishedArtistTracksFilter", () => {
  const USER = "11111111-1111-1111-1111-111111111111";

  it("scopes to the owner and to that exact artist name", () => {
    const { sql, params } = filterQuery(USER, "Jay Blake");

    expect(params).toContain(USER);
    expect(params).toContain("Jay Blake");
    expect(sql).toContain('"tracks"."user_id" = $1');
    expect(sql).toContain('"tracks"."artist_name" = $2');
  });

  it("keeps the public privacy boundary: published + done only", () => {
    const { sql } = filterQuery(USER, "Jay Blake");

    expect(sql).toContain('"tracks"."release_status" = ');
    expect(sql).toContain('"tracks"."status" = ');
    expect(sql).toContain('"tracks"."deleted_at" is null');
    expect(sql).toContain('"tracks"."archived_at" is null');
    expect(sql).toContain('"tracks"."hidden_at" is null');
  });

  it("joins every condition with AND, so none can be bypassed", () => {
    const { sql } = filterQuery(USER, "Jay Blake");
    expect(sql.match(/ and /g)).toHaveLength(6);
  });

  it("does not fold case on the artist name — the credit must match exactly", () => {
    const { sql } = filterQuery(USER, "jay blake");
    expect(sql).toContain('"tracks"."artist_name" = $2');
    expect(sql).not.toContain("lower(");
    expect(sql).not.toContain("ILIKE");
  });
});
