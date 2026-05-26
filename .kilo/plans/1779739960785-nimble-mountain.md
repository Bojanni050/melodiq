# Plan: Default Lyric Studio Structure + OpenRouter HTML Error Fix

## Goals

1. **Lyric Studio**: finish wiring up the new default song structure
   `intro → verse → pre-chorus → chorus → verse → pre-chorus → chorus → bridge → chorus`
   so it is preselected for new users and resolves to the correct preset.

2. **OpenRouter**: stop the `Unexpected token '<', "<html> <h"...` crash when a model
   like Kimi returns an HTML error page (Cloudflare/gateway/overload). Surface a
   clear, actionable message instead.

---

## Task 1 — Lyric Studio default structure

### Already in place (from earlier edits)

- `STRUCTURES` array (`src/app/lyrics-studio/page.tsx`) has the new entry:
  ```ts
  { value: "pop-default", label: "Intro -> Verse -> Pre-Chorus -> Chorus -> Verse -> Pre-Chorus -> Chorus -> Bridge -> Chorus", desc: "Standaard pop-structuur met pre-chorus builds." }
  ```
- `BLOCK_PRESETS["Pop"]` has been updated to:
  ```ts
  ["intro", "verse", "pre-chorus", "chorus", "verse", "pre-chorus", "chorus", "bridge", "chorus"]
  ```
  (the trailing `"outro"` was removed so the preset matches the requested structure)

### Remaining work

#### 1.1  Map the new structure value to its preset
File: `src/app/lyrics-studio/page.tsx`, constant `STRUCTURE_PRESET_MAP` (~line 136).

Add the entry:
```ts
"pop-default": "Pop",
```

This makes sure that when `structure === "pop-default"` the existing
`createPresetBlocks(BLOCK_PRESETS["Pop"], "Pop")` flow kicks in (used at
~line 734 of the same file).

#### 1.2  Make `pop-default` the store-level default

File: `src/lib/store.ts`, `useStudioStore`.

Change the initial state and `reset()` so `structure` starts as `"pop-default"`
instead of `""`:

- Initial state (currently line 510): `structure: "pop-default",`
- `reset()` body (currently line 552): `structure: "pop-default",`

Effect:
- New users see the structure preselected.
- Existing users keep their persisted `structure` value (the `merge` function
  preserves it). No migration is performed — a `""` value stays `""`. If the
  user later picks the new option from the dropdown, it just works.

#### 1.3  No store interface changes needed
The `setStructure` setter, the `structure` field type (`string`), and the
persistence/merge logic all stay the same.

#### 1.4  No Lyric Studio page-level init changes needed
`page.tsx` already pulls `structure` straight from the store, so once the store
default changes the page automatically respects it. The localStorage draft path
(`LYRICS_STUDIO_STORAGE_KEY`) only overrides when a draft exists, which is the
desired behavior.

### Validation

- Open Lyric Studio in a fresh browser profile / cleared storage → structure
  dropdown should show the new "Intro -> Verse -> Pre-Chorus -> Chorus -> ..."
  option preselected.
- Selecting it (or relying on the default) should populate the block flow with
  9 blocks: intro, verse, pre-chorus, chorus, verse, pre-chorus, chorus,
  bridge, chorus.
- Existing users keep their previous selection (no surprise resets).

---

## Task 2 — OpenRouter HTML response error

### Symptom

When using OpenRouter with the Kimi model (and occasionally other models when
the upstream is overloaded), the API responds with an HTML error page
(`<html>...`) instead of JSON. The current code in `src/lib/providers/llm.ts`
calls `axios.post(...)` and then immediately accesses
`res.data.choices[0].message.content` with no validation, so axios's internal
JSON transform throws `Unexpected token '<', "<html> <h"... is not valid JSON`
and that raw error bubbles up to the user.

### Fix scope

File: `src/lib/providers/llm.ts`, function `callLLM`. Affects both the
OpenRouter branch (line ~66) and, for consistency, the OpenAI branch
(line ~89).

### Approach

Wrap the axios call in a small helper that:

1. Catches the axios/JSON-parse error.
2. Inspects `error.response?.data` and `error.response?.status`.
3. If the body is a string starting with `<` (or status is 5xx, or the message
   contains `Unexpected token`), throws a clear, human-readable error.
4. Otherwise re-throws with the upstream `error.message` / API error message.
5. After a successful call, validates the response shape
   (`res.data?.choices?.[0]?.message?.content`) before returning it.

Pseudo-code (for OpenRouter; OpenAI branch is the mirror image):

```ts
let res;
try {
  res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    { model: OPENROUTER_MODEL, /* ... */ },
    { headers: { /* ... */ }, timeout: 60_000 }
  );
} catch (err: any) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const looksLikeHtml =
    typeof data === "string" && data.trimStart().startsWith("<");
  const isParseError = /Unexpected token|is not valid JSON/i.test(err?.message || "");

  if (looksLikeHtml || isParseError) {
    throw new Error(
      `OpenRouter (${OPENROUTER_MODEL}) returned a non-JSON response` +
      (status ? ` (HTTP ${status})` : "") +
      `. The model is likely overloaded or unavailable — try again or switch model.`
    );
  }

  const apiMessage =
    (typeof data === "object" && data?.error?.message) ||
    err?.message ||
    "OpenRouter request failed";
  throw new Error(
    `OpenRouter request failed${status ? ` (HTTP ${status})` : ""}: ${apiMessage}`
  );
}

const content = res.data?.choices?.[0]?.message?.content;
if (typeof content !== "string") {
  throw new Error(
    `OpenRouter response missing content. Body: ${JSON.stringify(res.data).slice(0, 200)}`
  );
}
return content;
```

Notes:
- A `timeout: 60_000` is added because Kimi/long contexts can hang indefinitely
  otherwise — turning a hang into a clean timeout error.
- The same wrapping is applied to the OpenAI branch so identical behavior is
  guaranteed.
- The message intentionally does NOT include the API key or full HTML body —
  only a status code and short hint.

### What this does NOT change

- No automatic provider fallback (OpenRouter → OpenAI). The current
  `getLLMProviderForPurpose` routing is honored as-is. (See open question 1.)
- No retry/backoff. (See open question 2.)
- No changes to `/api/llm`, `/api/lyric-studio/*`, or `/api/generate-title`
  routes — they already wrap `callLLM` in `try/catch` and forward the error
  message to the client. With the cleaner message they will now display a
  meaningful explanation instead of the raw JSON-parse text.

### Validation

- Trigger an OpenRouter HTML error (e.g., temporarily set the model to an
  invalid id, or use a known-overloaded model). The Studio UI should show
  something like:
  *"OpenRouter (moonshotai/kimi-k2) returned a non-JSON response (HTTP 503).
  The model is likely overloaded or unavailable — try again or switch model."*
- Trigger a valid response → still works as before.
- Trigger a structured JSON error from OpenRouter (e.g., bad API key) →
  message reads:
  *"OpenRouter request failed (HTTP 401): No auth credentials found"* or
  similar.

---

## Files touched

| File | Task | Change |
|---|---|---|
| `src/app/lyrics-studio/page.tsx` | 1.1 | Add `"pop-default": "Pop"` to `STRUCTURE_PRESET_MAP` |
| `src/lib/store.ts` | 1.2 | Default `structure` to `"pop-default"` in initial state and `reset()` |
| `src/lib/providers/llm.ts` | 2 | Wrap OpenRouter + OpenAI `axios.post` calls with HTML/parse-error handling, response-shape validation, and a 60s timeout |

No DB changes, no new dependencies, no schema changes.

---

## Decisions (confirmed by user)

1. **No** automatic OpenRouter → OpenAI fallback. The user sees the clean
   "model overloaded, try again or switch" error and decides themselves.
2. **No** automatic retry. Fail fast on the first HTML/5xx response.
3. **No** migration of existing persisted `structure: ""` values. Only new
   users (or users with no draft) see `pop-default` preselected. Existing
   users keep whatever they had.

These decisions keep the change set minimal and avoid surprising existing
users with new behavior.
