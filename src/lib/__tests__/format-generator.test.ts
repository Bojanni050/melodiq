import { describe, expect, it } from "vitest";
import { formatGenerator } from "../format-generator";

describe("formatGenerator", () => {
  it("names the actual generator behind a gateway provider", () => {
    // The core case: "poyo" is the API fronting Suno, not a generator. Showing
    // the raw columns would say "PoYo V5_5", which means nothing to the user.
    expect(formatGenerator("poyo", "V5_5")).toBe("Suno 5.5");
    expect(formatGenerator("poyo", "v5.5")).toBe("Suno 5.5");
    expect(formatGenerator("poyo", "V4_SALL")).toBe("Suno 4.5 (S-All)");
  });

  it("does not duplicate a product name already in the model label", () => {
    // The label already says "Lyria 3" — prefixing gives "Lyria Lyria 3".
    expect(formatGenerator("lyria", "lyria-3")).toBe("Lyria 3");
    expect(formatGenerator("mureka", "mureka-9")).toBe("Mureka 9");
    expect(formatGenerator("minimax", "minimax-music-2.6")).toBe("MiniMax 2.6");
  });

  it("keeps the gateway name when the model says nothing about the product", () => {
    // MiniMax 2 on APIFrame: nothing in the model label identifies the API, so
    // the prefix is the only provenance left.
    expect(formatGenerator("apiframe", "minimax-music-2")).toBe("APIFrame MiniMax 2");
  });

  it("drops the gateway name when the model already names the generator", () => {
    // These are products, not gateway-specific builds: "APIMart Lyria 3" would
    // imply APIMart is the generator, and "APIMart Suno 5.5" would make the
    // track indistinguishable from a native one.
    expect(formatGenerator("apimart", "lyria-3")).toBe("Lyria 3");
    expect(formatGenerator("apimart", "suno-5.5")).toBe("Suno 5.5");
  });

  it("does not credit the gateway for a passthrough model", () => {
    // MiniMax through the Suno endpoint was not made by Suno.
    expect(formatGenerator("poyo", "minimax-music-2.6")).toBe("MiniMax 2.6");
  });

  it("falls back to the provider when the model is unknown", () => {
    expect(formatGenerator("poyo", "")).toBe("Suno");
    expect(formatGenerator("suno", "")).toBe("Suno");
    expect(formatGenerator("mureka", "some-future-model")).toBe("Mureka");
  });

  it("resolves version-shaped model codes regardless of separators", () => {
    expect(formatGenerator("tempolor", "2")).toBe("Tempolor v2");
    expect(formatGenerator("tempolor", "v2")).toBe("Tempolor v2");
    expect(formatGenerator("tempolor", "1")).toBe("Tempolor v1");
  });

  it("names uploads rather than leaving a gap", () => {
    expect(formatGenerator("upload", "")).toBe("Uploaded");
  });

  it("returns null when there is nothing to show", () => {
    // Null rather than a bare bullet, so the overlay does not render "•".
    expect(formatGenerator("", "")).toBeNull();
    expect(formatGenerator(null, null)).toBeNull();
    expect(formatGenerator(undefined, undefined)).toBeNull();
  });

  it("shows an unrecognised model verbatim instead of dropping the provenance", () => {
    // A wrong-but-present label beats silently missing information.
    expect(formatGenerator("weird", "Some Model")).toBe("Some Model");
  });
});
