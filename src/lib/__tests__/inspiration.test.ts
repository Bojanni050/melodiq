import { describe, it, expect } from "vitest";
import { MAX_INSPIRATION_TRACKS, isApimartV6Model, isPoyoV6Model, isPoyoInspoModel, supportsInspiration } from "@/lib/inspiration";

describe("inspiration helpers", () => {
  it("accepts v6 generations models only", () => {
    expect(isApimartV6Model("v6")).toBe(true);
    expect(isApimartV6Model("v6-wild")).toBe(true);
    expect(isApimartV6Model("v6-mini")).toBe(true);
    expect(isApimartV6Model("v5.5")).toBe(false);
    expect(isApimartV6Model(undefined)).toBe(false);
  });

  it("accepts PoYo v6 generations models only", () => {
    expect(isPoyoV6Model("v6")).toBe(true);
    expect(isPoyoV6Model("v6-wild")).toBe(true);
    expect(isPoyoV6Model("v6-mini")).toBe(true);
    expect(isPoyoV6Model("v5.5")).toBe(false);
    expect(isPoyoV6Model(undefined)).toBe(false);
  });

  it("accepts PoYo v6 models plus v5.5 for inspiration, not older versions", () => {
    expect(isPoyoInspoModel("v6")).toBe(true);
    expect(isPoyoInspoModel("v6-wild")).toBe(true);
    expect(isPoyoInspoModel("v6-mini")).toBe(true);
    expect(isPoyoInspoModel("v5.5")).toBe(true);
    expect(isPoyoInspoModel("v5")).toBe(false);
    expect(isPoyoInspoModel("v4.5")).toBe(false);
    expect(isPoyoInspoModel(undefined)).toBe(false);
  });

  it("supportsInspiration gates by provider: APIMart v6-only, PoYo v6 + v5.5", () => {
    expect(supportsInspiration("apimart", "v6")).toBe(true);
    expect(supportsInspiration("apimart", "v5.5")).toBe(false);
    expect(supportsInspiration("poyo", "v6-mini")).toBe(true);
    expect(supportsInspiration("poyo", "v5.5")).toBe(true);
    expect(supportsInspiration("poyo", "v5")).toBe(false);
    expect(supportsInspiration("lyria", "v6")).toBe(false);
  });

  it("caps inspiration at four tracks", () => {
    expect(MAX_INSPIRATION_TRACKS).toBe(4);
  });
});
