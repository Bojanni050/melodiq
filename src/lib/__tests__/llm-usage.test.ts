import { describe, expect, it } from "vitest";

import { formatLlmUsage, parseLlmUsage } from "../llm-usage";

describe("parseLlmUsage", () => {
  it("reads the Chat Completions shape including cache and cost fields", () => {
    expect(
      parseLlmUsage({
        prompt_tokens: 194,
        completion_tokens: 2,
        total_tokens: 196,
        cost: 0.95,
        prompt_tokens_details: { cached_tokens: 128, cache_write_tokens: 66, audio_tokens: 0 },
      })
    ).toEqual({
      promptTokens: 194,
      completionTokens: 2,
      totalTokens: 196,
      cachedTokens: 128,
      cacheWriteTokens: 66,
      costUsd: 0.95,
    });
  });

  it("reads the Responses API shape", () => {
    expect(parseLlmUsage({ input_tokens: 10, output_tokens: 3, input_tokens_details: { cached_tokens: 0 } })).toEqual({
      promptTokens: 10,
      completionTokens: 3,
      cachedTokens: 0,
      cacheWriteTokens: undefined,
      totalTokens: undefined,
      costUsd: undefined,
    });
  });

  it("returns null when there is nothing usable", () => {
    expect(parseLlmUsage(undefined)).toBeNull();
    expect(parseLlmUsage(null)).toBeNull();
    expect(parseLlmUsage("usage")).toBeNull();
    expect(parseLlmUsage({})).toBeNull();
  });

  it("ignores non-numeric values instead of writing NaN to the log", () => {
    expect(parseLlmUsage({ prompt_tokens: "many", cost: null })).toBeNull();
  });
});

describe("formatLlmUsage", () => {
  it("omits empty cache counters and formats the cost", () => {
    expect(
      formatLlmUsage({ promptTokens: 194, completionTokens: 2, cachedTokens: 0, cacheWriteTokens: 0, costUsd: 0.00042 })
    ).toBe("prompt=194 completion=2 cost=$0.000420");
  });

  it("includes cache counters when they are non-zero", () => {
    expect(formatLlmUsage({ promptTokens: 100, cachedTokens: 96, cacheWriteTokens: 4 })).toBe(
      "prompt=100 cached=96 cache_write=4"
    );
  });

  it("returns an empty string for no usage", () => {
    expect(formatLlmUsage(null)).toBe("");
    expect(formatLlmUsage({})).toBe("");
  });
});
