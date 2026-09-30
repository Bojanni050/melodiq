import { describe, it, expect } from "vitest";

import { parseAccountImageKey } from "@/lib/account-images";

const USER = "3e8ef5e5-154f-42e1-8375-bdbd690825d3";

describe("parseAccountImageKey", () => {
  it("accepts the exact shape the upload endpoint writes", () => {
    expect(parseAccountImageKey(["users", USER, "profile.avif"])).toBe(
      `users/${USER}/profile.avif`
    );
    expect(parseAccountImageKey(["users", USER, "hero.webp"])).toBe(
      `users/${USER}/hero.webp`
    );
    expect(parseAccountImageKey(["users", USER, "profile.jpg"])).toBe(
      `users/${USER}/profile.jpg`
    );
  });

  it("rejects missing or empty segments", () => {
    expect(parseAccountImageKey(undefined)).toBeNull();
    expect(parseAccountImageKey([])).toBeNull();
    expect(parseAccountImageKey(["users", USER, ""])).toBeNull();
  });

  it("rejects traversal tricks before the pattern even runs", () => {
    expect(parseAccountImageKey(["users", "..", "profile.avif"])).toBeNull();
    expect(parseAccountImageKey(["users", USER, ".."])).toBeNull();
    expect(parseAccountImageKey(["users", USER, "."])).toBeNull();
    expect(parseAccountImageKey(["users\\", USER, "profile.avif"])).toBeNull();
  });

  it("never resolves keys outside the users/ image prefix", () => {
    // A track audio key must not become downloadable through this route.
    expect(
      parseAccountImageKey(["tracks", "some-id", "audio.mp3"])
    ).toBeNull();
    expect(parseAccountImageKey(["users", USER, "audio.mp3"])).toBeNull();
    expect(parseAccountImageKey(["releases", USER, "profile.avif"])).toBeNull();
  });

  it("rejects unknown types, extensions and malformed ids", () => {
    expect(parseAccountImageKey(["users", USER, "cover.avif"])).toBeNull();
    expect(parseAccountImageKey(["users", USER, "profile.svg"])).toBeNull();
    expect(parseAccountImageKey(["users", USER, "profile"])).toBeNull();
    expect(parseAccountImageKey(["users", "not-a-uuid", "profile.avif"])).toBeNull();
    expect(parseAccountImageKey(["users", USER, "PROFILE.AVIF"])).toBeNull();
  });

  it("rejects extra nesting smuggled into one segment", () => {
    expect(
      parseAccountImageKey(["users", USER, "sub", "profile.avif"])
    ).toBeNull();
    expect(
      parseAccountImageKey(["users", `${USER}/profile.avif extra`])
    ).toBeNull();
  });
});
