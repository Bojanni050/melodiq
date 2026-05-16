# Sonara — Walkthrough

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
