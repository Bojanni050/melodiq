// @vitest-environment node
// Upload override helpers are server code (filename/format/override parsing next to node: builtins): node environment, which also keeps them working when the ambient NODE_ENV is production.
import { describe, expect, it } from "vitest";
import { parseUploadItemOverrides } from "@/app/api/tracks/upload-helpers";

describe("parseUploadItemOverrides — Melody Genie", () => {
  it("keeps the Melody Genie fields of an upload item", () => {
    const [item] = parseUploadItemOverrides(JSON.stringify([
      {
        sourceProvider: "melodygenie",
        melodyGenieArtistInfluence: "Billie Eilish",
        melodyGenieAdditions: "spanish guitar, orchestral strings",
        melodyGenieStyleInfluence: 100,
        melodyGenieDnaInfluence: true,
      },
    ]));

    expect(item.sourceProvider).toBe("melodygenie");
    expect(item.melodyGenieArtistInfluence).toBe("Billie Eilish");
    expect(item.melodyGenieAdditions).toBe("spanish guitar, orchestral strings");
    expect(item.melodyGenieStyleInfluence).toBe(100);
    expect(item.melodyGenieDnaInfluence).toBe(true);
  });

  it("clamps the style influence to 1..100 and rounds it", () => {
    const [low, high, rounded] = parseUploadItemOverrides(JSON.stringify([
      { melodyGenieStyleInfluence: 0 },
      { melodyGenieStyleInfluence: 250 },
      { melodyGenieStyleInfluence: 42.6 },
    ]));

    expect(low.melodyGenieStyleInfluence).toBe(1);
    expect(high.melodyGenieStyleInfluence).toBe(100);
    expect(rounded.melodyGenieStyleInfluence).toBe(43);
  });

  it("blanks empty text and rejects wrong types instead of guessing", () => {
    const [item] = parseUploadItemOverrides(JSON.stringify([
      {
        melodyGenieArtistInfluence: "   ",
        melodyGenieAdditions: null,
        melodyGenieStyleInfluence: "80",
        melodyGenieDnaInfluence: "yes",
      },
    ]));

    expect(item.melodyGenieArtistInfluence).toBeNull();
    expect(item.melodyGenieAdditions).toBeNull();
    expect(item.melodyGenieStyleInfluence).toBeNull();
    expect(item.melodyGenieDnaInfluence).toBeNull();
  });

  it("returns nulls for items from a client that predates the fields", () => {
    const [item] = parseUploadItemOverrides(JSON.stringify([
      { sourceProvider: "suno", sourceModel: "v5", sunoStyleInfluence: 60 },
    ]));

    expect(item.melodyGenieArtistInfluence).toBeNull();
    expect(item.melodyGenieAdditions).toBeNull();
    expect(item.melodyGenieStyleInfluence).toBeNull();
    expect(item.melodyGenieDnaInfluence).toBeNull();
  });
});
