import { describe, it, expect } from "vitest";
import { MAX_INSPIRATION_TRACKS, isApimartV6Model } from "@/lib/inspiration";

describe("inspiration helpers", () => {
  it("accepts v6 generations models only", () => {
    expect(isApimartV6Model("v6")).toBe(true);
    expect(isApimartV6Model("v6-wild")).toBe(true);
    expect(isApimartV6Model("v6-mini")).toBe(true);
    expect(isApimartV6Model("v5.5")).toBe(false);
    expect(isApimartV6Model(undefined)).toBe(false);
  });

  it("caps inspiration at four tracks", () => {
    expect(MAX_INSPIRATION_TRACKS).toBe(4);
  });
});
