import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One 850 KB / 460-model fetch per hour per process, shared between the Lyrics
// Studio picker and the settings provider test — instead of one per studio mount.
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("axios", () => ({ default: { get: getMock } }));

import { getOpenRouterCatalog, invalidateOpenRouterCatalog, isTextCapable } from "../openrouter-catalog";

const catalog = {
  data: {
    data: [
      {
        id: "openai/gpt-5",
        name: "GPT-5",
        description: "flagship",
        pricing: { prompt: "0.000001", completion: "0.000002" },
        context_length: 400000,
        architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      },
      {
        id: "flux/schnell",
        name: "Flux Schnell",
        pricing: {},
        context_length: 0,
        architecture: { input_modalities: ["text"], output_modalities: ["image"] },
      },
    ],
  },
};

describe("getOpenRouterCatalog", () => {
  beforeEach(() => {
    invalidateOpenRouterCatalog();
    getMock.mockReset();
    getMock.mockResolvedValue(catalog);
  });

  afterEach(() => {
    invalidateOpenRouterCatalog();
  });

  it("fetches once and serves the second call from cache", async () => {
    const first = await getOpenRouterCatalog();
    const second = await getOpenRouterCatalog();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("collapses concurrent callers onto one request", async () => {
    await Promise.all([getOpenRouterCatalog(), getOpenRouterCatalog(), getOpenRouterCatalog()]);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("drops image-only models and maps the shape the pickers use", async () => {
    const models = await getOpenRouterCatalog();

    expect(models.map((m) => m.id)).toEqual(["openai/gpt-5"]);
    expect(models[0]).toMatchObject({
      name: "GPT-5",
      description: "flagship",
      context_length: 400000,
      capabilities: { inputModalities: ["text"], outputModalities: ["text"] },
    });
  });

  it("re-fetches after the TTL", async () => {
    vi.useFakeTimers();
    try {
      await getOpenRouterCatalog();
      expect(getMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(59 * 60 * 1000);
      await getOpenRouterCatalog();
      expect(getMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2 * 60 * 1000);
      await getOpenRouterCatalog();
      expect(getMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not cache a failed fetch", async () => {
    getMock.mockRejectedValueOnce(new Error("openrouter down"));
    await expect(getOpenRouterCatalog()).rejects.toThrow("openrouter down");

    getMock.mockResolvedValue(catalog);
    await expect(getOpenRouterCatalog()).resolves.toHaveLength(1);
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});

describe("isTextCapable", () => {
  it("accepts models without architecture information", () => {
    expect(isTextCapable({ id: "x" })).toBe(true);
    expect(isTextCapable({ architecture: { modality: "text->text" } })).toBe(true);
  });

  it("rejects image-only output when the input modality is known", () => {
    expect(isTextCapable({ architecture: { modality: "text->image" } })).toBe(false);
    expect(isTextCapable({ architecture: { input_modalities: ["text"], output_modalities: ["image"] } })).toBe(false);
  });

  it("assumes text-capable when only one side is reported", () => {
    // Same behaviour as the inline filter this was extracted from: with no input
    // modality to check there is nothing to reject, and the pickers show it.
    expect(isTextCapable({ architecture: { output_modalities: ["image"] } })).toBe(true);
  });
});
