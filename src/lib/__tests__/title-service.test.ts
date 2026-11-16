import { beforeEach, describe, expect, it, vi } from "vitest";

// The AI title call used to sit in front of every instrumental generation, even
// though a deterministic fallback was already computed a few lines below it.
// These tests pin the new contract: resolving a title never calls the LLM, and
// the AI upgrade happens afterwards, into our own row only.
const { callLLMMock, updateMock, returningMock } = vi.hoisted(() => ({
  callLLMMock: vi.fn(),
  updateMock: vi.fn(),
  returningMock: vi.fn(),
}));

vi.mock("@/lib/providers/llm", () => ({ callLLM: callLLMMock }));
vi.mock("@/db", () => ({ db: { update: updateMock } }));
vi.mock("@/db/schema", () => ({ tracks: { id: "id", title: "title" } }));

import { resolveTrackTitle, scheduleInstrumentalTitleUpgrade } from "../services/titleService";

describe("resolveTrackTitle", () => {
  beforeEach(() => {
    callLLMMock.mockReset();
    callLLMMock.mockResolvedValue("Midnight Coastline");
  });

  it("uses the user's own title and never asks the model", async () => {
    const title = await resolveTrackTitle({
      userTitle: "  mijn titel  ",
      instrumental: true,
      prompt: "warm analog synth, 90bpm",
      provider: "poyo",
    });

    expect(title).toBe("Mijn Titel");
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it("falls back to the derived prompt title for an instrumental track", async () => {
    const title = await resolveTrackTitle({
      userTitle: "",
      instrumental: true,
      prompt: "warm analog synth, 90bpm, dusty drums",
      provider: "lyria",
    });

    expect(title).toBe("Warm Analog Synth");
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it("returns nothing for a vocal track without a title (the client generates one)", async () => {
    const title = await resolveTrackTitle({
      userTitle: "",
      instrumental: false,
      prompt: "a song about the sea",
      provider: "lyria",
    });

    expect(title).toBeNull();
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it("still supports the blocking AI title when a caller opts in", async () => {
    const title = await resolveTrackTitle({
      userTitle: "",
      instrumental: true,
      prompt: "warm analog synth, 90bpm",
      provider: "lyria",
      allowAiTitle: true,
    });

    expect(title).toBe("Midnight Coastline");
    expect(callLLMMock).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleInstrumentalTitleUpgrade", () => {
  beforeEach(() => {
    callLLMMock.mockReset();
    callLLMMock.mockResolvedValue("Midnight Coastline");
    returningMock.mockReset();
    returningMock.mockResolvedValue([{ id: "track-1" }]);
    updateMock.mockReset();
    updateMock.mockImplementation(() => ({
      set: () => ({
        where: () => ({ returning: returningMock }),
      }),
    }));
  });

  it("writes the AI title into the track row", async () => {
    scheduleInstrumentalTitleUpgrade({
      trackId: "track-1",
      prompt: "warm analog synth, 90bpm",
      currentTitle: "Warm analog synth",
    });

    await vi.waitFor(() => expect(returningMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("skips the write when the model returns the title we already have", async () => {
    callLLMMock.mockResolvedValue("Warm analog synth");

    scheduleInstrumentalTitleUpgrade({
      trackId: "track-1",
      prompt: "warm analog synth, 90bpm",
      currentTitle: "Warm analog synth",
    });

    await vi.waitFor(() => expect(callLLMMock).toHaveBeenCalledTimes(1));
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does nothing without a prompt or a current title", () => {
    scheduleInstrumentalTitleUpgrade({ trackId: "track-1", prompt: "   ", currentTitle: "X" });
    scheduleInstrumentalTitleUpgrade({ trackId: "track-1", prompt: "x", currentTitle: null });
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it("stays silent and writes nothing when the model call fails", async () => {
    // generateInstrumentalTitleFromPrompt() already swallows its own errors and
    // returns null, which must leave the derived title untouched.
    callLLMMock.mockRejectedValue(new Error("provider down"));

    scheduleInstrumentalTitleUpgrade({ trackId: "track-1", prompt: "x", currentTitle: "Y" });

    await vi.waitFor(() => expect(callLLMMock).toHaveBeenCalledTimes(1));
    expect(updateMock).not.toHaveBeenCalled();
  });
});
