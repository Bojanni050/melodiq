# Sonara — Walkthrough

## 2026-05-18 (Directe batch cover art vanuit generate-route)

- Findings: PoYo en Tempolor cover-art werd pas gestart vanuit webhooks, wat bij multi-track batches race-condition gedrag gaf en cover-toewijzing per track versplinterde.
- Conclusions: Cover-art moet direct starten in de generate-route, parallel aan audiogeneratie, met een enkele batch-cover die aan alle tracks wordt toegewezen.
- Actions:
  - Updated `src/lib/generate-cover.ts` — delay/race-wachtlogica verwijderd; helper opgesplitst in single-track `generateAndSaveCoverArt` en batch-helper `generateAndSaveCoverArtForBatch`.
  - Updated `src/app/api/generate/route.ts` — PoYo- en Tempolor-blokken vervangen zodat ze batch tracks opbouwen en fire-and-forget `generateAndSaveCoverArtForBatch(...).catch(() => {})` starten.
  - Updated `src/app/api/webhooks/poyo/route.ts` — cover-art aanroep verwijderd (WAV-flow en sync blijven intact).
  - Updated `src/app/api/webhooks/tempolor/route.ts` — cover-art aanroep verwijderd.
  - Confirmed `src/lib/providers/poyo.ts` en `src/lib/providers/tempolor.ts` al `jobIds[]` returnen; geen aanvullende wijziging nodig.
  - Confirmed `src/app/page.tsx` bleef ongewijzigd zoals gevraagd.
  - Validated with `npm run build` na elke fase (1 t/m 4).

## 2026-05-18 (Cover art fase 11 — env template)

- Findings: The example env file had no Pixazo key entry.
- Conclusions: The new cover-art integration should be discoverable in the local env template.
- Actions:
  - Updated `.env.example` — added `PIXAZO_API_KEY` under the Pixazo cover-art section

## 2026-05-18 (Cover art fase 10 — settings page)

- Findings: Pixazo had no dedicated settings entry point in the UI.
- Conclusions: Cover-art configuration should live beside the other provider credentials.
- Actions:
  - Updated `src/app/settings/page.tsx` — added a Pixazo cover-art section with save support

## 2026-05-18 (Cover art fase 8 — UI rendering)

- Findings: The UI still showed placeholders even when cover art existed.
- Conclusions: List and detail views should prefer the generated cover art and fall back cleanly.
- Actions:
  - Updated `src/components/TrackList.tsx` — artwork button now renders `coverUrl` when available
  - Updated `src/components/TrackDetail.tsx` — artwork panel now shows `coverUrl` when available

## 2026-05-18 (Cover art fase 7 — UI types)

- Findings: The list/detail/page track types did not include the new cover-art fields.
- Conclusions: The UI types should mirror the DB-backed track shape before rendering cover art.
- Actions:
  - Updated `src/components/TrackList.tsx`, `src/components/TrackDetail.tsx`, `src/app/page.tsx`, and `src/app/library/page.tsx` with `coverUrl` and `s3KeyCover`

## 2026-05-18 (Cover art fase 6 — delete cleanup)

- Findings: Track deletion still left cover-art files behind in S3.
- Conclusions: Cleanup should remove the cover-art object alongside the audio assets.
- Actions:
  - Updated `src/app/api/tracks/[id]/route.ts` — delete `s3KeyCover` via `deleteFromS3`

## 2026-05-18 (Cover art fase 5 — generation triggers)

- Findings: Completed tracks still had no hook to start cover-art generation.
- Conclusions: Fire-and-forget calls belong right after the existing done updates so audio stays independent.
- Actions:
  - Updated `src/app/api/webhooks/tempolor/route.ts`, `src/app/api/webhooks/poyo/route.ts`, `src/app/api/webhooks/minimax/route.ts`, `src/app/api/webhooks/musicgpt/route.ts` — trigger cover art after completion
  - Updated `src/app/api/generate/route.ts` — trigger cover art in the Lyria done path

## 2026-05-18 (Cover art fase 4 — download route)

- Findings: Cover art needed an authenticated route that exposes only the internal track path.
- Conclusions: The route should resolve the S3 key and redirect to a presigned URL.
- Actions:
  - Created `src/app/api/tracks/[id]/cover/route.ts` — auth-guarded redirect to presigned cover art URL

## 2026-05-18 (Cover art fase 3 — persist helper)

- Findings: Cover art generation needed a single non-blocking persistence path.
- Conclusions: The helper should swallow failures and only update the track when upload succeeds.
- Actions:
  - Created `src/lib/generate-cover.ts` — generates cover art, uploads to S3, and writes `coverUrl` plus `s3KeyCover`

## 2026-05-18 (Cover art fase 2 — Pixazo Flux provider)

- Findings: No dedicated image-generation provider existed for cover art.
- Conclusions: Cover art needs its own reusable provider module with polling fallback.
- Actions:
  - Created `src/lib/providers/cover-art.ts` — Pixazo Flux 1 Schnell integration with direct URL and polling support

## 2026-05-18 (Cover art fase 1 — database schema en init)

- Findings: Tracks hadden nog geen opslagvelden voor cover art.
- Conclusions: Nieuwe kolommen zijn nodig voor interne cover-URL en S3 key.
- Actions:
  - Updated `src/db/schema.ts` — added `coverUrl` and `s3KeyCover` to `tracks`
  - Updated `src/db/init.ts` — added `ALTER TABLE` statements for `cover_url` and `s3_key_cover`

## 2026-05-13 (S3 connection status on settings page)

- Findings: S3 section only displayed config values read from process.env with no way to verify actual connectivity.
- Conclusions: Should provide a real connection test using S3 HeadBucket API call.
- Actions:
  - Updated `src/app/api/settings/s3/route.ts` — added POST endpoint that creates S3 client and calls HeadBucket to verify connectivity
  - Updated `src/app/settings/page.tsx` — added test connection button and status display (green for connected, red for error)

## 2026-05-13 (Settings page with individual provider cards)

- Findings: Settings page had all providers in one section with a single save/test button. No API route existed for settings CRUD.
- Conclusions: Each provider should be independently configurable with its own save and test connection buttons.
- Actions: 
  - Created `src/app/api/settings/route.ts` — GET returns all settings, POST saves key-value pair to `settings` table
  - Created `src/app/api/settings/test/route.ts` — POST tests connection to any provider, returns status/credits info
  - Created `src/app/api/settings/s3/route.ts` — GET returns S3 config (endpoint, region, bucket, path style)
  - Refactored `src/app/settings/page.tsx` — separate cards for Lyria, PoYo, Tempolor, OpenRouter, OpenAI with individual save/test buttons

## 2026-05-13 (OpenRouter model list with descriptions and pricing)

- Findings: OpenRouter has a `/api/v1/models` endpoint returning detailed model info including descriptions, pricing, context length, and architecture.
- Conclusions: After testing OpenRouter connection, should fetch and display the model list so users can select the right model.
- Actions:
  - Updated test route to fetch OpenRouter models and return them in the response
  - Added dropdown with search, showing model name, truncated description (3 lines), pricing per token, and context length
  - "Read more" link opens a modal popup with full description and all model details
  - Selected model saved to `OPENROUTER_MODEL` setting

## 2026-05-13 (S3 Storage info on settings page)

- Findings: S3 section just showed "configured via env vars" without actual values.
- Conclusions: S3 config should be fetched from backend and displayed for transparency.
- Actions:
  - Created `/api/settings/s3` route returning endpoint, region, bucket, and forcePathStyle (no secrets)
  - Settings page fetches and displays in a 2x2 grid

## 2026-05-13 (Major UI overhaul — Mureka-inspired design)

- Findings: UI had top header with horizontal nav, single-column layout, basic form and track cards. Did not match modern music generation app standards.
- Conclusions: Should adopt a sidebar-based layout similar to Mureka for better information density and workflow.
- Actions:
  - Created `src/components/Sidebar.tsx` — fixed left sidebar (240px) with logo, nav icons, credits, logout; mobile top bar with icon nav
  - Created `src/components/TrackDetail.tsx` — slide-out right panel showing artwork placeholder, track info, prompt, full lyrics, play/download actions
  - Redesigned `src/components/StudioForm.tsx` — sectioned layout: Lyrics (textarea + instrumental toggle), Style (textarea + pill tags), Provider dropdown with model selector, Language + Vocal Gender segmented control, Title with char count
  - Redesigned `src/components/TrackList.tsx` — compact list items (no card borders), play button, title + status badge, style description, time-ago, download icons; click opens TrackDetail
  - Rewrote `src/app/page.tsx` — two-column grid (form left, track list right), top tab bar (Create/Library), version dropdown
  - Updated `src/app/globals.css` — new component classes (`section-card`, `btn-ghost`, `track-card`), scrollbar styling, range input styling
  - Updated `src/lib/store.ts` — added `vocalGender` state, added `lyrics` to Track interface
  - Updated `src/app/library/page.tsx`, `src/app/logs/page.tsx`, `src/app/settings/page.tsx` — all use new Sidebar layout with `lg:ml-[240px]` offset
  - Removed old Header dependency from app pages

## 2026-05-13 (Login and register screens redesigned)

- Findings: Login/register pages were basic cards with no branding or visual identity.
- Conclusions: Auth pages should have strong visual identity with aurora background and soundwave animations.
- Actions:
  - Redesigned `src/app/login/page.tsx` — aurora background, animated soundwave decoration, logo badge, section-card form
  - Redesigned `src/app/register/page.tsx` — matching design with name, email, password fields, min-8-char hint
  - Both use compact form styling with loading spinners on submit

## 2026-05-13 (Title generation, instrumental toggle, generate validation)

- Findings: No way to auto-generate titles. Instrumental toggle was visually unclear. Generate button had no validation — could submit with missing required fields.
- Conclusions: AI should generate titles from lyrics. Instrumental mode needs clear visual feedback. Generate should block until required fields are filled.
- Actions:
  - Added `generateTitle()` to `src/lib/providers/llm.ts` — sends lyrics to LLM with "generate short song title" prompt
  - Created `src/app/api/generate-title/route.ts` — POST with lyrics, returns generated title
  - Updated `src/app/page.tsx` — added `handleGenerateTitle` function, passed to StudioForm
  - Improved instrumental toggle — VOCAL/INSTRUMENTAL badges with green/amber colors, V/I labels inside slider
  - 🤖 Generate Title button appears when vocal mode + no title + lyrics exist; calls LLM API and auto-fills title
  - Generate button validation: instrumental requires title; vocal requires lyrics AND prompt; shows red hint text for what's missing
  - Added style pill tags (FX Risers, Epic, Amapiano, Soul, Lo-Fi, Orchestral, Synthwave, Acoustic) to quickly append to style prompt
  - Vocal Gender segmented control shows pink/blue accent colors for Female/Male selection

## 2026-05-16 (Lyrics Topic/Mood, Structure section, improved prompts, form reorganization)

- Findings: Lyrics generator had no topic/mood input. No song structure selection existed. Style and lyrics prompts were generic. Form layout had buttons in confusing locations.
- Conclusions: Users need dedicated topic/mood field and structure presets for better lyric generation. LLM prompts should enforce Suno-compatible formatting. Button placement should follow logical field relationships.
- Actions:
  - Updated `src/lib/store.ts` — added `lyricsContext`, `structure`, `customStructure` state fields with setters and reset
  - Updated `src/components/StudioForm.tsx` — added single "Lyrics Topic & Mood" input above lyrics textarea; added "Structure" dropdown section with 14 presets grouped by category (Pop, Dance/TCH, Singer-songwriter) plus "Kies jij maar" (AI chooses) and "Handmatig" (manual textarea); moved Structure section to top of form; moved "Generate Style" button under Style & Prompt textarea; "Generate Lyrics" button only enabled when Topic & Mood field has text
  - Updated `src/app/api/llm/route.ts` — replaced lyrics system prompt with detailed rules (multi-language support, section labels with vocal delivery in brackets, English-only bracket text, avoid exaggerated descriptors); replaced optimize system prompt with Suno-specific rules (no artist names, comma-separated tags, BPM/key handling, production-oriented language, vocal clarity descriptors); both prompts now receive structure, context, and vocalGender from client
  - Updated `src/app/page.tsx` — `handleOptimize` and `handleGenerateLyrics` now send `language`, `context`, `structure`, `customStructure`, `vocalGender` to the API
  - Renamed "Optimize Style" button to "Generate Style" with matching loading state
  - Validated with `npm run build`.

## 2026-05-16 (Title requirements and generateTitle improvements)

- Findings: Instrumental tracks did not require a title. Vocal tracks without a title had no fallback — AI should extract title from lyrics. The generateTitle LLM prompt was overly generic (max 8 words, no language matching, no priority for repeated lines).
- Conclusions: Title should be mandatory for instrumental tracks. For vocal tracks without a title, auto-extract from lyrics before generation. The title generation prompt should follow a clear priority order (repeating lines → hook phrase → thematic core) and enforce stricter rules.
- Actions:
  - Updated `src/app/page.tsx` — `handleGenerate` now checks if vocal track has empty title but lyrics exist; if so, auto-calls `handleGenerateTitle`, stores result in Zustand, and uses it in the generate payload
  - Updated `src/app/api/generate/route.ts` — added server-side validation rejecting requests where instrumental is true and title is empty
  - Updated `src/components/StudioForm.tsx` — replaced instrumental tip text with red warning "Title is required for instrumental tracks" when title is empty
  - Updated `src/lib/providers/llm.ts` — replaced generic generateTitle prompt with structured priority system: repeating lines first, then hook phrase, then thematic core; tightened rules to max 6 words, language matching, no invented words, return title only
  - Validated with `npm run build`.

## 2026-05-20 (Poll PoYo tracks voor async WAV download)

- Findings: De poyo-wav webhook levert het WAV bestand asynchroon — minuten nadat de track al status "done" heeft. De frontend poll stopt bij "done", waardoor s3KeyHd/audioUrlHd nooit in de UI terechtkomen. De WAV download knop blijft verborgen voor PoYo tracks.
- Conclusions: Poll PoYo tracks die done zijn maar geen s3KeyHd hebben, door ze in de "needs refresh" categorie te plaatsen samen met tracks zonder coverUrl.
- Actions:
  - Updated `src/app/page.tsx` — toegevoegd: `hasDoneWithoutHd` conditie die checkt op `status === "done" && provider === "poyo" && !s3KeyHd`; interval logica aangepast om ook te triggeren bij `hasDoneWithoutHd`
  - Updated `src/app/library/page.tsx` — nieuwe polling useEffect toegevoegd met dezelfde `hasDoneWithoutHd` logica en 15 seconden interval wanneer tracks cover art of HD audio missen
  - Validated met `npm run build`.

## 2026-05-16 (Automatic database creation on app startup)

- Findings: App assumed the PostgreSQL database and tables already existed. On a fresh deploy (e.g. Docker Compose first run), the database is created via `POSTGRES_DB` env var but tables still require manual `drizzle-kit push`. No automatic initialization on startup.
- Conclusions: App should check if the database exists on startup, create it if missing, then create all tables automatically — no manual steps needed.
- Actions:
  - Created `src/db/init.ts` — startup utility that connects to PostgreSQL's default `postgres` database, checks if target database exists (via `pg_database` query), creates it if not, then connects to target database and creates all four tables (`users`, `tracks`, `api_logs`, `settings`) using `CREATE TABLE IF NOT EXISTS` with raw SQL matching the Drizzle schema
  - Created `src/instrumentation.ts` — Next.js instrumentation file with `register()` function that runs `initializeDatabase()` on server startup (nodejs runtime only); works in both dev (`next dev`) and production (`next start`); standalone Docker builds include the init logic without needing drizzle-kit at runtime
  - Validated with `npm run build`.

## 2026-05-18 (Fix Tempolor endpoint + presigned URL storage)

- Findings: Tempolor generate/status/credits used wrong base path (v1 instead of open-apis/v1).
  PoYo and Tempolor polling routes stored presigned URLs in DB instead of internal download paths.
- Conclusions: Use open-apis/v1 for all Tempolor calls. Store /api/tracks/{id}/download in DB,
  generate presigned URLs on the fly in GET /api/tracks/[id].
- Actions: Updated src/lib/providers/tempolor.ts (3 URLs). Updated src/app/api/tracks/[id]/route.ts
  (audioUrl fix in PoYo block + Tempolor block). Validated with npm run build.

## 2026-05-18 (Fix PoYo and Lyria API endpoints)

- Findings: PoYo used wrong domain (api.poyo.com instead of api.poyo.ai), wrong endpoints (/v1/generate, /v1/jobs, /v1/credits), and wrong response format (expected job_id, got data.task_id). Lyria used non-existent endpoint (api.lyria.google.com/v1/generate) — actual API is Gemini-based at generativelanguage.googleapis.com.
- Conclusions: PoYo uses api.poyo.ai with /api/generate/submit, /api/generate/status/{task_id}, /api/user/balance. Lyria 3 uses Gemini API generateContent with x-goog-api-key auth, returns base64 audio in response parts.
- Actions: Updated src/lib/providers/poyo.ts (all endpoints and response parsing). Updated src/lib/providers/lyria.ts (Gemini API format, base64 audio extraction). Updated src/app/api/settings/test/route.ts (correct test endpoints). Validated with npm run build.

## 2026-05-18 (Add track deletion with S3 cleanup)

- Findings: No way to delete songs or failed renders from the UI or API. S3 files were never cleaned up.
- Conclusions: Add DELETE /api/tracks/[id] that removes DB record and associated S3 files. Add delete button to TrackList with confirmation dialog.
- Actions: Added deleteFromS3() to src/lib/s3.ts. Added DELETE handler to src/app/api/tracks/[id]/route.ts with S3 cleanup. Added delete button and confirmation to src/components/TrackList.tsx. Added onDelete callback to TrackList usages in src/app/page.tsx and src/app/library/page.tsx. Validated with npm run build.

## 2026-05-18 (Multi-select tracks for batch deletion)

- Findings: Individual track deletion worked but no way to select and delete multiple tracks at once. No visual selection indicator in the track list.
- Conclusions: Add selectable dots (checkboxes) in front of each track row. Add a header bar with select-all toggle. Show selection count bar with bulk-delete and clear buttons.
- Actions: Updated src/components/TrackList.tsx — added selection dot button before each track, select-all toggle in header, selection count bar with bulk-delete and clear buttons. Added empty placeholder dot to GeneratingRow for layout alignment. Validated with npm run build.

## 2026-05-18 (Registration gate + MiniMax webhook route)

- Findings: Registration was open to anyone. Internal error messages were exposed in the register catch block. MiniMax webhook route was missing.
- Conclusions: Gate registration behind REGISTRATION_ENABLED env flag (absent = closed). Fix catch block to log internally and return generic message. MiniMax uses PoYo's webhook payload format so the route is a direct adaptation.
- Actions: Added REGISTRATION_ENABLED gate to src/app/api/auth/register/route.ts. Fixed catch block to use console.error and return generic message. Created src/app/api/webhooks/minimax/route.ts (task_id, status: finished, files[].audio_url, provider: "minimax"). Removed MiniMax open issue from sonara-rules.md. Validated with npm run build.

## 2026-05-18 (Webhook secret check — alle routes)
- Findings: Not all webhook routes verified WEBHOOK_SECRET.
- Conclusions: Uniform secret check required on all webhook endpoints.
- Actions: Added query-param secret check to tempolor/minimax/musicgpt webhook routes; validated.

## 2026-05-18 (Pixazo polling timeout verkleind)
- Findings: MAX_POLLS 30 × 4s = 120s max blocking time in server-side route.
- Conclusions: 15 × 3s = 45s is a safer upper bound.
- Actions: Updated POLL_INTERVAL_MS and MAX_POLLS in cover-art.ts; updated error message; validated.

## 2026-05-18 (init.ts schema sync)
- Findings: createTablesSql tracks definition missing format/cover art columns added via ALTER TABLE.
- Conclusions: CREATE TABLE should reflect full current schema to avoid confusion on fresh installs.
- Actions: Added missing columns to createTablesSql in init.ts; added explanatory comment; validated.

## 2026-05-18 (Rate limiter cleanup interval)
- Findings: Rate limit Map had no cleanup, allowing unbounded entry accumulation over time.
- Conclusions: Periodic purge prevents memory growth; setInterval guard handles Edge environments.
- Actions: Added cleanup interval with 5-min sweep to rate limiter in generate/route.ts; validated.
