import { beforeEach, describe, expect, it, vi } from "vitest";

// The point of these tests is the query count, not the values: one SELECT for
// the whole settings table instead of one per key, because a single LLM call
// resolves a dozen keys.
const { selectMock, state } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  state: { rows: [] as Array<{ key: string; value: string | null }>, fail: false },
}));

vi.mock("@/db", () => ({ db: { select: selectMock } }));
vi.mock("@/db/schema", () => ({ settings: { key: "key", value: "value" } }));

import { getSetting, invalidateSettingsCache } from "../settings";

function installQuery() {
  selectMock.mockImplementation(() => ({
    from: () =>
      state.fail
        ? Promise.reject(new Error("db down"))
        : Promise.resolve(state.rows),
  }));
}

describe("getSetting caching", () => {
  beforeEach(() => {
    invalidateSettingsCache();
    selectMock.mockReset();
    state.rows = [
      { key: "LYRICS_LLM_PROVIDER", value: "openrouter" },
      { key: "OPENROUTER_API_KEY", value: "sk-test" },
      { key: "EMPTY_VALUE", value: null },
    ];
    state.fail = false;
    installQuery();
  });

  it("reads the whole table once for many keys", async () => {
    expect(await getSetting("LYRICS_LLM_PROVIDER")).toBe("openrouter");
    expect(await getSetting("OPENROUTER_API_KEY")).toBe("sk-test");
    expect(await getSetting("LYRICS_LLM_PROVIDER")).toBe("openrouter");

    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent reads onto a single query", async () => {
    const values = await Promise.all([
      getSetting("LYRICS_LLM_PROVIDER"),
      getSetting("OPENROUTER_API_KEY"),
      getSetting("LYRICS_LLM_PROVIDER"),
    ]);

    expect(values).toEqual(["openrouter", "sk-test", "openrouter"]);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty string for a key that is absent or has no value", async () => {
    expect(await getSetting("NOT_SET")).toBe("");
    expect(await getSetting("EMPTY_VALUE")).toBe("");
  });

  it("re-reads after invalidateSettingsCache() — the write path calls it", async () => {
    expect(await getSetting("OPENROUTER_API_KEY")).toBe("sk-test");
    state.rows = [{ key: "OPENROUTER_API_KEY", value: "sk-new" }];
    invalidateSettingsCache();

    expect(await getSetting("OPENROUTER_API_KEY")).toBe("sk-new");
    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it("re-reads once the TTL has passed", async () => {
    vi.useFakeTimers();
    try {
      expect(await getSetting("OPENROUTER_API_KEY")).toBe("sk-test");
      expect(selectMock).toHaveBeenCalledTimes(1);

      // Still inside the 30s window: cached.
      vi.advanceTimersByTime(20_000);
      expect(await getSetting("OPENROUTER_API_KEY")).toBe("sk-test");
      expect(selectMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(20_000);
      expect(await getSetting("OPENROUTER_API_KEY")).toBe("sk-test");
      expect(selectMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not cache a failed query", async () => {
    state.fail = true;
    await expect(getSetting("OPENROUTER_API_KEY")).rejects.toThrow("db down");

    state.fail = false;
    installQuery();
    expect(await getSetting("OPENROUTER_API_KEY")).toBe("sk-test");
    expect(selectMock).toHaveBeenCalledTimes(2);
  });
});
