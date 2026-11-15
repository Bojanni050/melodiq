import { beforeEach, describe, expect, it, vi } from "vitest";

// The api log is where the P0 accounting has to land: token/cost columns filled
// from the provider's usage block, so spend can be queried per endpoint instead
// of being read back out of the response text.
const { insertMock, state } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  state: { rows: [] as Array<Record<string, unknown>>, enabled: "true" },
}));

vi.mock("@/db", () => ({ db: { insert: insertMock } }));
vi.mock("@/db/schema", () => ({ apiLogs: {} }));
vi.mock("@/lib/settings", () => ({ getSetting: vi.fn(async () => state.enabled) }));

import { logApi } from "../logger";

describe("logApi usage columns", () => {
  beforeEach(() => {
    state.rows = [];
    state.enabled = "true";
    insertMock.mockReset();
    insertMock.mockImplementation(() => ({
      values: (row: Record<string, unknown>) => {
        state.rows.push(row);
        return Promise.resolve();
      },
    }));
  });

  it("stores tokens, cached tokens and cost next to the call", async () => {
    await logApi({
      userId: "u1",
      type: "llm",
      provider: "openrouter",
      endpoint: "/api/llm",
      request: JSON.stringify({ type: "lyrics" }),
      response: JSON.stringify({ result: "ok" }),
      statusCode: 200,
      duration: 1200,
      usage: { promptTokens: 1200, completionTokens: 12, cachedTokens: 1024, costUsd: 0.00042 },
    });

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      type: "llm",
      provider: "openrouter",
      promptTokens: 1200,
      completionTokens: 12,
      cachedTokens: 1024,
      costUsd: 0.00042,
      statusCode: 200,
      duration: 1200,
    });
  });

  it("writes nulls when a call reports no usage (non-LLM or provider without usage)", async () => {
    await logApi({
      userId: "u1",
      type: "generation",
      provider: "poyo",
      endpoint: "/api/generate",
      request: JSON.stringify({ provider: "poyo" }),
      statusCode: 200,
    });

    expect(state.rows[0]).toMatchObject({
      promptTokens: null,
      completionTokens: null,
      cachedTokens: null,
      costUsd: null,
    });
  });

  it("writes nothing when API logging is disabled", async () => {
    state.enabled = "";
    await logApi({
      type: "llm",
      provider: "openrouter",
      endpoint: "/api/llm",
      request: "{}",
      usage: { promptTokens: 10 },
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
