import { describe, expect, it } from "vitest";

import { buildBlockPrompts, type BlockPromptParams } from "../lyrics-block-prompt";

// The point of these tests is the cache layout: only the *per-section* part may
// vary inside a song, everything else has to be byte-identical or a provider's
// prefix cache can never hit (which is what made every call full price before).
const base: BlockPromptParams = {
  blockType: "verse",
  blockLabel: "Verse 1",
  topic: "a long drive home",
  mood: "wistful",
  language: "Dutch",
  style: "indie folk, fingerpicked guitar",
  existingBlocks: [],
  vocalistTag: "auto",
  performerDirections: "",
  literalnessLevel: 5,
  creativityLevel: 5,
  lineCount: 4,
};

describe("buildBlockPrompts", () => {
  it("keeps the system prompt byte-identical across every knob", () => {
    const plain = buildBlockPrompts({ ...base, literalnessLevel: 2, creativityLevel: 1, lineCount: 4, vocalistTag: "male" });
    const exotic = buildBlockPrompts({
      ...base,
      blockType: "chorus",
      blockLabel: "Chorus",
      literalnessLevel: 9,
      creativityLevel: 10,
      lineCount: 8,
      vocalistTag: "duet",
      performerDirections: "female first, male answers",
      chorusMode: "repeat",
      isFirstChorus: true,
    });

    expect(plain.systemPrompt).toBe(exotic.systemPrompt);

    // Nothing that differs per request may appear in it.
    for (const volatile of [
      "exactly 4",
      "exactly 8",
      "Favor imagery",
      "Be direct and literal",
      "Treat rhyme as optional",
      "definitive, memorable chorus",
      "Now write only the lyrics for",
      "a long drive home",
    ]) {
      expect(plain.systemPrompt).not.toContain(volatile);
    }
  });

  it("keeps the song-level prefix identical across two sections of the same song", () => {
    const verse = buildBlockPrompts({ ...base, blockType: "verse", blockLabel: "Verse 1" });
    const chorus = buildBlockPrompts({
      ...base,
      blockType: "chorus",
      blockLabel: "Chorus",
      lineCount: 8,
      chorusMode: "repeat",
      isFirstChorus: true,
    });

    expect(chorus.cacheablePrefix).toBe(verse.cacheablePrefix);
    // The section-specific instructions land in the per-request part instead.
    expect(chorus.userPrompt).not.toBe(verse.userPrompt);
    expect(chorus.userPrompt).toContain("definitive, memorable chorus");
    expect(verse.userPrompt).toContain("either 4 or 8 lyric lines");
  });

  it("grows the prefix by appending sections, so call n+1 extends call n", () => {
    const first = buildBlockPrompts({
      ...base,
      existingBlocks: [{ type: "verse", label: "Verse 1", content: "regel een\nregel twee" }],
    });
    const second = buildBlockPrompts({
      ...base,
      blockType: "chorus",
      blockLabel: "Chorus",
      existingBlocks: [
        { type: "verse", label: "Verse 1", content: "regel een\nregel twee" },
        { type: "chorus", label: "Chorus", content: "hook" },
      ],
    });

    expect(second.cacheablePrefix.startsWith(first.cacheablePrefix)).toBe(true);
    // The closing marker is not part of the cached prefix — it would sit in the
    // middle of a longer context and break the common prefix.
    expect(second.cacheablePrefix).not.toContain("END CONTEXT");
    expect(second.userPrompt.startsWith("--- END CONTEXT ---")).toBe(true);
  });

  it("omits the context markers entirely when no section exists yet", () => {
    const prompt = buildBlockPrompts(base);
    expect(prompt.cacheablePrefix).not.toContain("EXISTING SECTIONS");
    expect(prompt.userPrompt).not.toContain("END CONTEXT");
    expect(prompt.userPrompt.startsWith("Now write only the lyrics for: Verse 1 (verse)")).toBe(true);
  });

  it("puts the song-level sliders in the prefix and the per-section count in the ask", () => {
    const literal = buildBlockPrompts({ ...base, blockType: "pre-chorus", blockLabel: "Pre-Chorus", literalnessLevel: 2, creativityLevel: 2, lineCount: 6 });
    const poetic = buildBlockPrompts({ ...base, blockType: "pre-chorus", blockLabel: "Pre-Chorus", literalnessLevel: 9, creativityLevel: 9, lineCount: 6 });

    expect(literal.cacheablePrefix).toContain("Favor imagery");
    expect(literal.cacheablePrefix).toContain("clear, consistent rhyme scheme");
    expect(poetic.cacheablePrefix).toContain("Be direct and literal");
    expect(poetic.cacheablePrefix).toContain("Treat rhyme as optional");
    expect(literal.userPrompt).toContain("exactly 6 lyric lines");
    // Same section, same count: the ask is identical, so the whole request only
    // differs in the (cacheable) song-level part.
    expect(literal.userPrompt).toBe(poetic.userPrompt);
  });

  it("lets a verse choose between 4 and 8 lines instead of a fixed count", () => {
    const verse = buildBlockPrompts({ ...base, lineCount: 6 });
    expect(verse.userPrompt).toContain("either 4 or 8 lyric lines");
    expect(verse.userPrompt).not.toContain("exactly 6");
  });

  it("leaves a fixed vocalist tag out of the prompt and keeps duet instructions in", () => {
    const male = buildBlockPrompts({ ...base, vocalistTag: "male" });
    const duet = buildBlockPrompts({ ...base, vocalistTag: "duet" });
    const auto = buildBlockPrompts({ ...base, vocalistTag: "auto", performerDirections: "whispered verses" });

    expect(male.cacheablePrefix).not.toContain("[male], [female], or [together]");
    expect(duet.cacheablePrefix).toContain("This is a duet");
    expect(duet.cacheablePrefix).toContain("Vocalist tag: [duet]");
    expect(auto.cacheablePrefix).toContain("Prefix every non-empty lyric line");
    expect(auto.cacheablePrefix).toContain("Performer direction: whispered verses");
  });

  it("puts the writing persona in the song-level prefix, never in the system prompt", () => {
    const persona = {
      name: "Nachtbraker",
      bio: "Schrijft nachtelijke, onderkoelde liefdesliedjes.",
      fragments: [
        { kind: "couplet" as const, text: "De stad slaapt\nmaar ik niet" },
        { kind: "chorus" as const, text: "Blijf nog even\nblijf nog even" },
      ],
    };
    const verse = buildBlockPrompts({ ...base, persona });
    const chorus = buildBlockPrompts({ ...base, blockType: "chorus", blockLabel: "Chorus", persona });
    const without = buildBlockPrompts(base);

    expect(verse.cacheablePrefix).toContain("WRITING PERSONA");
    expect(verse.cacheablePrefix).toContain("Persona: Nachtbraker");
    expect(verse.cacheablePrefix).toContain("De stad slaapt");
    expect(verse.cacheablePrefix).toContain("Do not reuse these lines");
    expect(verse.systemPrompt).not.toContain("Nachtbraker");
    expect(verse.userPrompt).not.toContain("Nachtbraker");
    // Persona is a song-level property: the prefix stays identical per section.
    expect(chorus.cacheablePrefix).toBe(verse.cacheablePrefix);
    expect(without.cacheablePrefix).not.toContain("WRITING PERSONA");
  });
});
