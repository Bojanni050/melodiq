import { describe, it, expect } from "vitest";
import {
  INSPIRATION_STORAGE_KEY,
  MAX_INSPIRATION_TRACKS,
  isApimartV6Model,
  parseInspirationPayload,
} from "@/lib/inspiration";

describe("inspiration helpers", () => {
  it("accepts v6 generations models only", () => {
    expect(isApimartV6Model("v6")).toBe(true);
    expect(isApimartV6Model("v6-wild")).toBe(true);
    expect(isApimartV6Model("v6-mini")).toBe(true);
    expect(isApimartV6Model("v5.5")).toBe(false);
    expect(isApimartV6Model(undefined)).toBe(false);
  });

  it("parses the menu handoff payload", () => {
    expect(parseInspirationPayload(null)).toEqual([]);
    expect(parseInspirationPayload("not-json")).toEqual([]);
    expect(
      parseInspirationPayload(JSON.stringify({ tracks: [{ id: "a", title: "Song", coverUrl: "/c.jpg" }] }))
    ).toEqual([{ id: "a", title: "Song", coverUrl: "/c.jpg" }]);
  });

  it("drops tracks without id and caps at the maximum", () => {
    const tracks = Array.from({ length: MAX_INSPIRATION_TRACKS + 2 }, (_, i) => ({
      id: `t${i}`,
      title: null,
      coverUrl: null,
    }));
    const parsed = parseInspirationPayload(JSON.stringify({ tracks: [...tracks, { title: "no-id" }] }));
    expect(parsed).toHaveLength(MAX_INSPIRATION_TRACKS);
    expect(parsed[0]).toEqual({ id: "t0", title: null, coverUrl: null });
  });

  it("uses a stable storage key", () => {
    expect(INSPIRATION_STORAGE_KEY).toBe("melodiq-inspiration-payload");
  });
});
