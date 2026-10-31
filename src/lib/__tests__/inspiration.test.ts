import { describe, it, expect } from "vitest";
import { MAX_INSPIRATION_TRACKS, isApimartV6Model, isPoyoV6Model, supportsInspiration } from "@/lib/inspiration";

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

  it("supportsInspiration gates by provider and v6 model", () => {
    expect(supportsInspiration("apimart", "v6")).toBe(true);
    expect(supportsInspiration("apimart", "v5")).toBe(false);
    expect(supportsInspiration("poyo", "v6-mini")).toBe(true);
    expect(supportsInspiration("poyo", "v5.5")).toBe(false);
    expect(supportsInspiration("lyria", "v6")).toBe(false);
  });

  it("caps inspiration at four tracks", () => {
    expect(MAX_INSPIRATION_TRACKS).toBe(4);
  });
});
