import { describe, expect, it } from "vitest";

import { extractPromotedFragments, pickRandomFragments } from "../lyric-persona-fragments";
import type { LyricPersonaFragment } from "../lyric-personas";

function fragment(id: string, kind: LyricPersonaFragment["kind"], text: string): LyricPersonaFragment {
  return { id, kind, text, sourceTitle: "Source" };
}

describe("extractPromotedFragments", () => {
  it("turns headed sections into couplets and one chorus", () => {
    const fragments = extractPromotedFragments(
      [
        "[Verse 1]",
        "De straat is nat",
        "De lichten laag",
        "Ik tel de stappen",
        "Tot aan de brug",
        "",
        "[Chorus]",
        "Dit is de hook",
        "En hij blijft hangen",
      ].join("\n"),
      "Natte Straat"
    );

    expect(fragments).toHaveLength(3);
    expect(fragments.map((f) => f.kind)).toEqual(["couplet", "couplet", "chorus"]);
    expect(fragments[0].text).toBe("De straat is nat\nDe lichten laag");
    expect(fragments[1].text).toBe("Ik tel de stappen\nTot aan de brug");
    expect(fragments[2].text).toBe("Dit is de hook\nEn hij blijft hangen");
    expect(fragments[0].sourceTitle).toBe("Natte Straat");
    // Headers and performer tags never end up in the material.
    expect(fragments.some((f) => f.text.includes("[Verse"))).toBe(false);
  });

  it("keeps one copy of a chorus that repeats and still emits its couplets only once", () => {
    const lyrics = [
      "[Verse]",
      "regel een",
      "regel twee",
      "",
      "[Chorus]",
      "zelfde hook",
      "zelfde regel",
      "",
      "[Verse 2]",
      "regel drie",
      "regel vier",
      "",
      "[Chorus]",
      "zelfde hook",
      "zelfde regel",
    ].join("\n");

    const fragments = extractPromotedFragments(lyrics);
    expect(fragments.filter((f) => f.kind === "chorus")).toHaveLength(1);
    expect(fragments.filter((f) => f.kind === "couplet")).toHaveLength(2);
  });

  it("treats a repeated stanza as the chorus when there are no headers", () => {
    const lyrics = [
      "eerste regel",
      "tweede regel",
      "",
      "hook regel een",
      "hook regel twee",
      "",
      "derde regel",
      "vierde regel",
      "",
      "hook regel een",
      "hook regel twee",
    ].join("\n");

    const fragments = extractPromotedFragments(lyrics);
    const choruses = fragments.filter((f) => f.kind === "chorus");
    expect(choruses).toHaveLength(1);
    expect(choruses[0].text).toBe("hook regel een\nhook regel twee");
  });

  it("skips performer-tag-only lines", () => {
    const fragments = extractPromotedFragments(
      ["[Verse]", "[male]", "regel een", "[female]", "regel twee"].join("\n")
    );
    expect(fragments[0].text).toBe("regel een\nregel twee");
    expect(fragments[0].text).not.toContain("[male]");
  });

  it("caps a source and gives every fragment a stable id", () => {
    const lines: string[] = ["[Verse]"];
    for (let i = 0; i < 30; i++) lines.push(`regel ${i}`);

    const first = extractPromotedFragments(lines.join("\n"));
    const second = extractPromotedFragments(lines.join("\n"));

    expect(first.filter((f) => f.kind === "couplet").length).toBeLessThanOrEqual(8);
    expect(first.map((f) => f.id)).toEqual(second.map((f) => f.id));
  });
});

describe("pickRandomFragments", () => {
  const candidates = [
    fragment("c1", "couplet", "couplet een"),
    fragment("c2", "couplet", "couplet twee"),
    fragment("c3", "couplet", "couplet drie"),
    fragment("h1", "chorus", "chorus een"),
    fragment("h2", "chorus", "chorus twee"),
    // Same text as c1, different id: must not appear twice.
    fragment("c1-copy", "couplet", "couplet een"),
  ];

  it("never returns excluded ids or duplicate texts", () => {
    const picked = pickRandomFragments(candidates, {
      limit: 10,
      excludeIds: ["c1"],
    });

    expect(picked.map((f) => f.id)).not.toContain("c1");
    expect(picked.map((f) => f.text)).not.toContain("couplet een");
    expect(new Set(picked.map((f) => f.text)).size).toBe(picked.length);
  });

  it("respects the kind caps but fills the batch when one kind runs out", () => {
    const picked = pickRandomFragments(candidates, {
      limit: 5,
      coupletLimit: 1,
      chorusLimit: 1,
    });

    expect(picked).toHaveLength(5);
    expect(picked.filter((f) => f.kind === "chorus").length).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic with an injected random source", () => {
    const first = pickRandomFragments(candidates, { limit: 4, random: () => 0.42 });
    const second = pickRandomFragments(candidates, { limit: 4, random: () => 0.42 });
    expect(first).toEqual(second);
  });
});
