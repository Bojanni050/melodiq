import { describe, expect, it } from "vitest";
import {
  buildStyleSuggestionSystemPrompt,
  buildStyleSuggestionUserPrompt,
  sanitizeStyleSuggestionResponse,
} from "../lyrics-style-suggestion";

describe("lyrics-style-suggestion helpers", () => {
  it("should build a structured system prompt with fixed sections and template guidance", () => {
    const prompt = buildStyleSuggestionSystemPrompt();

    expect(prompt).toContain("Generate one elaborate style direction for AI music generation");
    expect(prompt).toContain("Genre & Feel:");
    expect(prompt).toContain("Instrumentation:");
    expect(prompt).toContain("Production & Mix:");
    expect(prompt).toContain("Vocal Direction:");
    expect(prompt).toContain("BPM range");
    expect(prompt).toContain("mix chain ideas");
    expect(prompt).toContain("Instrumental focus");
  });

  it("should build a user prompt that includes the current style hint and trims lyrics", () => {
    const prompt = buildStyleSuggestionUserPrompt({
      topic: "  Night drive  ",
      mood: "  wistful  ",
      language: "  English  ",
      styleHint: "  mellow synth pop  ",
      lyrics: "Verse 1\n" + "a".repeat(7000),
    });

    expect(prompt).toContain("Topic: Night drive");
    expect(prompt).toContain("Mood: wistful");
    expect(prompt).toContain("Language: English");
    expect(prompt).toContain("Current style hint: mellow synth pop");
    expect(prompt).toContain("Lyrics context:");
    expect(prompt.length).toBeLessThanOrEqual(6500);
  });

  it("should sanitize fenced responses while preserving the structured sections", () => {
    const raw = "```text\nGenre & Feel: nocturnal synth pop.\nInstrumentation: soft bass and glassy pads.\nProduction & Mix: wide, glossy, compressed.\nVocal Direction: intimate and breathy.\n```";

    const sanitized = sanitizeStyleSuggestionResponse(raw);

    expect(sanitized).toContain("Genre & Feel:");
    expect(sanitized).toContain("Instrumentation:");
    expect(sanitized).toContain("Production & Mix:");
    expect(sanitized).toContain("Vocal Direction:");
    expect(sanitized).not.toContain("```");
    expect(sanitized).not.toMatch(/^\s/);
    expect(sanitized).not.toMatch(/\s$/);
  });
});
