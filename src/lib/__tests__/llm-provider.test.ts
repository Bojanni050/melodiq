// @vitest-environment node
// The provider wrapper is server code and imports the file logger (node:fs): node environment, which also keeps it working when the ambient NODE_ENV is production.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// callLLM used to resolve every provider's key and model before each request
// (11-16 settings reads for one lyrics call). These tests pin the new
// behaviour: only the provider that is actually called is resolved, and the
// cross-cutting options (JSON mode, token cap, usage reporting) are applied to
// the one shared request path.
const { postMock, settingsState, readKeys } = vi.hoisted(() => ({
  postMock: vi.fn(),
  settingsState: { values: {} as Record<string, string> },
  readKeys: [] as string[],
}));

vi.mock("axios", () => ({ default: { post: postMock } }));
vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async (key: string) => {
    readKeys.push(key);
    return settingsState.values[key] ?? "";
  }),
}));

import { callLLM, retryDelayMs } from "../providers/llm";

function okResponse(body: unknown) {
  return { status: 200, data: { choices: [{ message: { content: "hi" } }], ...(body as object) } };
}

describe("callLLM provider resolution", () => {
  beforeEach(() => {
    postMock.mockReset();
    readKeys.length = 0;
    settingsState.values = {};
    postMock.mockResolvedValue(okResponse({}));
  });

  it("reads only the selected provider's key and model", async () => {
    settingsState.values = {
      LYRICIQ_LLM_PROVIDER: "deepinfra",
      DEEPINFRA_API_KEY: "di-key",
      DEEPINFRA_LYRICIQ_MODEL: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      OPENROUTER_API_KEY: "or-key",
      OPENAI_API_KEY: "oai-key",
    };

    await callLLM("prompt", "system", { purpose: "lyriciq" });

    expect(readKeys).toContain("DEEPINFRA_API_KEY");
    expect(readKeys).toContain("DEEPINFRA_LYRICIQ_MODEL");
    expect(readKeys).not.toContain("OPENROUTER_API_KEY");
    expect(readKeys).not.toContain("OPENAI_API_KEY");
    expect(readKeys).not.toContain("EDENAI_API_KEY");
    expect(readKeys).not.toContain("HOPSCOTCH_API_KEY");
    // 1 purpose lookup + 1 key + 1 purpose model — not a full sweep.
    expect(readKeys.length).toBeLessThanOrEqual(4);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe("https://api.deepinfra.com/v1/openai/chat/completions");
    expect(body.model).toBe("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo");
    expect(body.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "prompt" },
    ]);
  });

  it("falls back to the generic model setting, then to the provider default", async () => {
    settingsState.values = { LYRICS_LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-key" };
    await callLLM("prompt", "system", { purpose: "lyrics" });
    expect(postMock.mock.calls[0][1].model).toBe("google/gemini-2.5-flash");

    postMock.mockClear();
    settingsState.values.OPENROUTER_MODEL = "openai/gpt-5";
    await callLLM("prompt", "system", { purpose: "lyrics" });
    expect(postMock.mock.calls[0][1].model).toBe("openai/gpt-5");
  });

  it("lets a per-request model override win", async () => {
    settingsState.values = {
      LYRICS_LLM_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "or-key",
      OPENROUTER_LYRICS_MODEL: "openai/gpt-5",
    };
    await callLLM("prompt", "system", { purpose: "lyrics", openRouterModelOverride: "anthropic/claude-sonnet-4.5" });
    expect(postMock.mock.calls[0][1].model).toBe("anthropic/claude-sonnet-4.5");
  });

  it("throws the same 'no provider configured' error when the key is missing", async () => {
    settingsState.values = { LYRICS_LLM_PROVIDER: "deepinfra" };
    await expect(callLLM("prompt", "system", { purpose: "lyrics" })).rejects.toThrow(
      "No deepinfra LLM provider configured"
    );
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe("callLLM request options", () => {
  beforeEach(() => {
    postMock.mockReset();
    readKeys.length = 0;
    settingsState.values = { LYRICS_LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-key" };
    postMock.mockResolvedValue(okResponse({}));
  });

  it("omits temperature/top_p/response_format/max_tokens when not requested", async () => {
    await callLLM("prompt", "system", { purpose: "lyrics" });
    const body = postMock.mock.calls[0][1];
    expect("temperature" in body).toBe(false);
    expect("top_p" in body).toBe(false);
    expect("response_format" in body).toBe(false);
    expect("max_tokens" in body).toBe(false);
  });

  it("sends temperature, top_p, max_tokens and response_format when asked", async () => {
    await callLLM("prompt", "system", {
      purpose: "lyrics",
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 300,
      json: true,
    });
    const body = postMock.mock.calls[0][1];
    expect(body.temperature).toBe(0.4);
    expect(body.top_p).toBe(0.9);
    expect(body.max_tokens).toBe(300);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("reports usage to the caller", async () => {
    postMock.mockResolvedValue(
      okResponse({
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 12,
          total_tokens: 1212,
          cost: 0.00042,
          prompt_tokens_details: { cached_tokens: 1024, cache_write_tokens: 0 },
        },
      })
    );

    const seen: unknown[] = [];
    await callLLM("prompt", "system", { purpose: "lyrics", onUsage: (usage) => seen.push(usage) });

    expect(seen).toEqual([
      {
        promptTokens: 1200,
        completionTokens: 12,
        totalTokens: 1212,
        cachedTokens: 1024,
        cacheWriteTokens: 0,
        costUsd: 0.00042,
      },
    ]);
  });

  it("does not call onUsage when the provider reports nothing", async () => {
    const onUsage = vi.fn();
    await callLLM("prompt", "system", { purpose: "lyrics", onUsage });
    expect(onUsage).not.toHaveBeenCalled();
  });

  it("retries once without response_format when the provider rejects JSON mode", async () => {
    postMock
      .mockRejectedValueOnce({
        response: { status: 400, data: { error: { message: "response_format is not supported" } } },
      })
      .mockResolvedValueOnce(okResponse({}));

    await callLLM("prompt", "system", { purpose: "lyrics", json: true, maxTokens: 100 });

    expect(postMock).toHaveBeenCalledTimes(2);
    expect(postMock.mock.calls[0][1].response_format).toEqual({ type: "json_object" });
    expect("response_format" in postMock.mock.calls[1][1]).toBe(false);
    // The retry keeps the rest of the request intact.
    expect(postMock.mock.calls[1][1].max_tokens).toBe(100);
  });

  it("does not retry a 400 that has nothing to do with JSON mode", async () => {
    postMock.mockRejectedValue({
      response: { status: 400, data: { error: { message: "invalid model id" } } },
    });

    await expect(callLLM("prompt", "system", { purpose: "lyrics", json: true })).rejects.toThrow(
      "OpenRouter request failed (HTTP 400): invalid model id"
    );
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("maps a non-JSON body to the overload hint", async () => {
    postMock.mockRejectedValue({ response: { status: 502, data: "<html>bad gateway</html>" } });
    await expect(callLLM("prompt", "system", { purpose: "lyrics" })).rejects.toThrow(
      /OpenRouter \(google\/gemini-2\.5-flash\) returned a non-JSON response \(HTTP 502\)/
    );
  });

  it("throws when the response carries no string content", async () => {
    postMock.mockResolvedValue({ status: 200, data: { choices: [{}] } });
    await expect(callLLM("prompt", "system", { purpose: "lyrics" })).rejects.toThrow(
      "OpenRouter response missing content"
    );
  });
});

describe("callLLM retry behaviour", () => {
  beforeEach(() => {
    postMock.mockReset();
    readKeys.length = 0;
    settingsState.values = { LYRICS_LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: "or-key" };
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries a rate-limited call once and returns the retry's response", async () => {
    postMock
      .mockRejectedValueOnce({
        response: { status: 429, headers: { "retry-after": "0" }, data: { error: { message: "rate limited" } } },
      })
      .mockResolvedValueOnce(okResponse({}));

    await expect(callLLM("prompt", "system", { purpose: "lyrics" })).resolves.toBe("hi");
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("retries a dropped connection that never produced an HTTP response", async () => {
    postMock
      .mockRejectedValueOnce(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }))
      .mockResolvedValueOnce(okResponse({}));

    await expect(callLLM("prompt", "system", { purpose: "lyrics" })).resolves.toBe("hi");
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two attempts and reports the last failure", async () => {
    postMock.mockRejectedValue({
      response: { status: 503, headers: { "retry-after": "0" }, data: { error: { message: "overloaded" } } },
    });

    await expect(callLLM("prompt", "system", { purpose: "lyrics" })).rejects.toThrow(
      "OpenRouter request failed (HTTP 503): overloaded"
    );
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry an authentication failure", async () => {
    postMock.mockRejectedValue({ response: { status: 401, data: { error: { message: "no auth" } } } });

    await expect(callLLM("prompt", "system", { purpose: "lyrics" })).rejects.toThrow("(HTTP 401)");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the JSON-mode correction out of the retry budget", async () => {
    postMock
      .mockRejectedValueOnce({ response: { status: 400, data: { error: { message: "response_format unsupported" } } } })
      .mockRejectedValueOnce({ response: { status: 429, headers: { "retry-after": "0" } } })
      .mockResolvedValueOnce(okResponse({}));

    await expect(callLLM("prompt", "system", { purpose: "lyrics", json: true })).resolves.toBe("hi");
    expect(postMock).toHaveBeenCalledTimes(3);
    // Attempt 2 dropped the field, attempt 3 kept it dropped and succeeded.
    expect(postMock.mock.calls[1][1].response_format).toBeUndefined();
    expect(postMock.mock.calls[2][1].response_format).toBeUndefined();
  });
});

describe("retryDelayMs", () => {
  it("honours Retry-After in seconds", () => {
    expect(retryDelayMs({ response: { status: 429, headers: { "retry-after": "3" } } }, 1)).toBe(3000);
  });

  it("honours Retry-After as an HTTP date", () => {
    const when = new Date(Date.now() + 5000).toUTCString();
    const delay = retryDelayMs({ response: { status: 429, headers: { "retry-after": when } } }, 1);
    expect(delay).toBeGreaterThan(3000);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it("caps a hostile header instead of parking the request", () => {
    expect(retryDelayMs({ response: { status: 429, headers: { "retry-after": "99999" } } }, 1)).toBe(20_000);
  });

  it("doubles the base delay when the provider sends no header", () => {
    expect(retryDelayMs({ response: { status: 503, headers: {} } }, 1)).toBe(800);
    expect(retryDelayMs({ response: { status: 503, headers: {} } }, 2)).toBe(1600);
    expect(retryDelayMs({ response: { status: 503, headers: {} } }, 9)).toBe(20_000);
  });

  it("falls back to the exponential path when the header is nonsense", () => {
    expect(retryDelayMs({ response: { status: 429, headers: { "retry-after": "soon" } } }, 1)).toBe(800);
  });
});
