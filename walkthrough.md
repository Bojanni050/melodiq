# Sonara — Walkthrough

## 2026-05-22 vr 13:32 (MusicGPT timeout skip + failed-track recovery)

- Findings: MusicGPT tracks could still be pushed into generic timeout handling, and the recovery endpoint only retried tracks in `generating`, leaving already-timed-out MusicGPT jobs out of the recovery flow.
- Conclusions: MusicGPT needs its own timeout exception in the polling routes, and recovery should accept both `generating` and `failed` states as recoverable.
- Actions:
  - Updated `src/app/api/tracks/route.ts` — timeout loop now skips tracks with `provider === "musicgpt"`
  - Updated `src/app/api/tracks/[id]/route.ts` — single-track timeout check now skips MusicGPT tracks
  - Updated `src/app/api/tracks/recover-musicgpt/route.ts` — recovery query now includes both `generating` and `failed`, and the empty-state message now says “No recoverable MusicGPT tracks found”
  - Validated with `npm run build`.

## 2026-05-22 vr 13:25 (Lyric blocks draggable op desktop en mobiel)

- Findings: De lyric blokken hadden al reorder helpers, maar het drag startpunt en de affordance waren te subtiel voor comfortabel gebruik op touch en in compacte layouts.
- Conclusions: Laat de kaart zelf ook drag-starten, maak de drag-handle altijd zichtbaar en blokkeer interactieve controls zodat invoervelden en knoppen gewoon bruikbaar blijven.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — kaart-level pointer drag start toegevoegd met guard voor inputs, buttons en links
  - Updated `src/app/lyrics-studio/page.tsx` — drag handle groter gemaakt, de hint altijd zichtbaar gemaakt en de card zelf als grab target gemarkeerd
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 13:25`
  - Validated with `npm run build`.

## 2026-05-22 vr 12:37 (Right sidebar prompt collapsed by default)

- Findings: De prompttekst in het TrackDetail-paneel nam veel verticale ruimte in beslag, waardoor de rechterzijbalk onnodig lang werd op grotere schermen.
- Conclusions: De prompt moet standaard ingeklapt zijn met een duidelijke toggle en copy-actie, zodat de sidebar compact blijft maar de volledige tekst nog steeds direct beschikbaar is.
- Actions:
  - Updated `src/components/TrackDetail.tsx` — promptsectie krijgt nu een inklapbare header met toggle en copy-knop; volledige prompt staat standaard dicht
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 12:37` volgens de app-version update conventie
  - Validated with `npm run build`.

## 2026-05-22 vr 13:13 (Lyric Studio blokken draggable op desktop en touch)

- Findings: Lyric Studio kon blokken alleen via up/down-knoppen herschikken, wat traag was bij langere songs en onhandig op zowel groot scherm als mobiel.
- Conclusions: Voeg pointer-based drag-and-drop toe met een expliciete drag handle per blok, zodat dezelfde reorder-flow werkt met muis en touch zonder de bestaande knoppen weg te nemen.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added pointer drag state, drop target detection en reorder via insertion position
  - Updated `src/app/lyrics-studio/page.tsx` — elk lyric block heeft nu een drag handle en visuele drop-indicator boven/onder het targetblok
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 13:13`
  - Validated with `npm run build`.

## 2026-05-21 do 05:04 (Studio create button sticky)

- Findings: In de Studio create-flow scrollt de `Generate Track` knop buiten beeld bij lange forms, waardoor de primaire actie minder toegankelijk is.
- Conclusions: Maak de create/generate action sticky onderaan de form-kolom zodat de knop zichtbaar blijft tijdens scrollen.
- Actions:
  - Updated `src/components/StudioForm.tsx` — wrapped generate button + validation hint in sticky container (`sticky bottom-3 z-20`) with translucent background and border
  - Preserve existing generate logic (`onGenerate`, `canGenerate`) while improving persistent visibility of the CTA
  - Validated with `npm run build`.

## 2026-05-21 do 04:43 (PoYo WAV debug visibility — matchedBy logging)

- Findings: Voor verificatie van multi-variant WAV matching ontbrak inzicht op welke sleutel (`wavJobId`, `audioId`, of `jobId`) een callback precies werd gematcht.
- Conclusions: Voeg expliciete `matchedBy` debug metadata toe in webhook logs en API logging, zodat productiegedrag direct traceerbaar is.
- Actions:
  - Updated `src/app/api/webhooks/poyo-wav/route.ts` — split matching in `byWavJobId`, `byAudioId`, `byJobId` + computed `matchedBy`
  - Updated `src/app/api/webhooks/poyo-wav/route.ts` — `logApi(...response...)` uitgebreid met `matchedBy`
  - Updated `src/app/api/webhooks/poyo-wav/route.ts` — console success-log uitgebreid met `matchedBy`, `taskId`, `audioId`
  - Validated with `npm run build`.

## 2026-05-21 do 04:32 (PoYo WAV matching fix — voorkom overschrijven van eerste track)

- Findings: Bij multi-variant PoYo WAV webhooks kon de query meerdere tracks tegelijk matchen (`jobId` + `audioId` + `wavJobId`), maar de handler gebruikte altijd `result[0]`; daardoor werd vaak alleen de eerste track met WAV bijgewerkt.
- Conclusions: Trackselectie in de WAV webhook moet prioriteit geven aan unieke identifiers (`wavJobId`, daarna `audioId`) i.p.v. blind de eerste query-rij te pakken.
- Actions:
  - Updated `src/app/api/webhooks/poyo-wav/route.ts` — trackselectie aangepast naar prioriteit: `wavJobId === taskId` → `audioId === audioId` → `jobId === taskId` → fallback `result[0]`
  - Hiermee wordt bij meerdere matches de juiste variant-track geüpdatet in plaats van steeds de eerste
  - Validated with `npm run build`.

## 2026-05-21 do 04:17 (Use lyrics + style to Studio met safety confirm)

- Findings: Derde kolom had al style suggestion + copy, maar geen directe workflow om zowel lyrics als style naar Studio te sturen met bescherming tegen overschrijven van bestaande Studio-inhoud.
- Conclusions: Voeg een dedicated knop onder de style suggestion box toe die eerst controleert of Studio leeg is, anders bevestiging vraagt, en daarna Studio reset + vult met huidige lyrics en style.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added `useLyricsAndStyleInStudio()`
  - Updated `src/app/lyrics-studio/page.tsx` — safety check op bestaande Studio-data (`songIdea`, `lyrics`, `lyricsContext`, `title`) met confirm prompt bij overschrijven
  - Updated `src/app/lyrics-studio/page.tsx` — bij bevestiging: `reset()`, daarna `setLyrics(combinedLyrics)` en `setSongIdea(styleSuggestion || style)`, vervolgens navigatie naar Studio (`/`)
  - Updated `src/app/lyrics-studio/page.tsx` — added button “Use lyrics + style in Studio” onder de style suggestion box
  - Validated with `npm run build`.

## 2026-05-21 do 04:03 (Lyric Studio third-column AI style suggestion + copy)

- Findings: In de derde kolom bestond alleen de flowchart; er was geen snelle manier om op basis van topic, mood en bestaande lyrics een bruikbare style prompt te laten genereren.
- Conclusions: Voeg een dedicated Lyric Studio style-suggestie endpoint toe en render een compacte “Style Suggestion” kaart in de rechterkolom met AI-fill en copy workflow.
- Actions:
  - Added `src/app/api/lyric-studio/style-suggestion/route.ts` — authenticated endpoint dat topic/mood/lyrics/language/styleHint accepteert en via LLM een enkele compacte stijlregel (comma-separated) teruggeeft
  - Updated `src/app/lyrics-studio/page.tsx` — added state voor `styleSuggestion`, `generatingStyleSuggestion`, `copiedStyleSuggestion`
  - Updated `src/app/lyrics-studio/page.tsx` — added `generateStyleSuggestion()` (calls `/api/lyric-studio/style-suggestion`) en `copyStyleSuggestion()`
  - Updated `src/app/lyrics-studio/page.tsx` — third column uitgebreid met nieuwe “Style Suggestion” card inclusief `AI Fill` en `Copy` knop
  - Updated `src/app/lyrics-studio/page.tsx` — style suggestion opgenomen in lokale draft-persistentie en `Clear all` reset
  - Validated with `npm run build`.

## 2026-05-21 do 03:57 (Lyric Studio persistentie + Clear all)

- Findings: Lyric Studio verloor lokale invoer (topic/mood/style/blocks/layout) na refresh, omdat deze state buiten Zustand stond en niet werd opgeslagen.
- Conclusions: Voeg expliciete localStorage-persistentie toe in de pagina voor lokale lyric-studio state en geef gebruikers een `Clear all`-actie die zowel state als opgeslagen draft reset.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added `LYRICS_STUDIO_STORAGE_KEY` load/restore effect met veilige JSON parsing en block-sanitizing
  - Updated `src/app/lyrics-studio/page.tsx` — added save effect that persists `topic`, `mood`, `style`, `blocks`, `activePreset`, `lyricCols`, `showLyricsSidebar`, `structure`, `customStructure`, `language`, `customLanguage`
  - Updated `src/app/lyrics-studio/page.tsx` — added `clearAllDraft()` with confirm dialog that clears all lyric-studio fields and removes stored draft
  - Updated `src/app/lyrics-studio/page.tsx` — added visible `Clear all` button in header controls next to `Lyrics`
  - Validated with `npm run build`.

## 2026-05-21 do 03:30 (Grouped style tags with category headers)

- Findings: Style tags were displayed as a flat list of 80+ items; difficult to navigate and discover relevant tags by genre, mood, or production style.
- Conclusions: Organize tags into 12 logical categories (Electronic, Urban & World, Band & Organic, Cinematic & Classical, Ambient & Texture, Drums & Rhythm, Bass & Low End, Synths & Keys, Guitar & Strings, FX & Processing, Mood & Energy, Vocal Style) with uppercase category headers for better UX.
- Actions:
  - Updated `src/components/StudioForm.tsx` — replaced flat `STYLE_TAGS` array with `STYLE_TAG_GROUPS: { label: string; tags: string[] }[]` structure containing 12 organized categories
  - Updated tag panel UI — changed from flex flex-wrap layout to grouped layout with category headers (`text-[10px] font-semibold uppercase tracking-wider text-white/25 mb-1.5`) above each group's tag flex row
  - Updated container from `max-h-48` to `max-h-64` to accommodate more visible categories
  - `addStyleTag(tag: string)` function remains unchanged (works with plain string tags)
  - Validated with `npm run build`.

## 2026-05-21 do 03:28 (Flowchart visualization in lyric studio right column)

- Findings: Song structure flowchart was only visible on mobile/tablet (xl:hidden), even though a 3-column layout exists on lg+ screens with an empty right sidebar.
- Conclusions: The flowchart should display in the right column (340px) on lg+ screens alongside the lyric blocks, giving users instant visual feedback on their song structure.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — replaced placeholder "Extra kolom" aside with Flowchart component; flowchart now receives `blocks.map(b => ({ label: b.label, type: b.type }))` and displays in a styled container
  - Updated `src/components/Flowchart.tsx` — removed `mt-8` margin and `p-4 bg-[#181820]` styling for inline integration; restructured as compact embedded component with `p-3 bg-[#0f0f16] rounded-lg border border-white/10`; legend rearranged as stacked list instead of single line for better readability in narrow sidebar
  - Validated with `npm run build`.

## 2026-05-21 do 03:27 (StudioForm STYLE_TAGS expansion — 8 to 80+ tags with collapsible panel)

- Findings: Only 8 basic style tags available in the form; users needed more genre, mood, and production options to describe their song effectively.
- Conclusions: Expand tag library to 80+ tags organized in 8 categories (Electronic, Urban & World, Band & Organic, Cinematic & Classical, Production, Mood & Texture, Vocal, Tempo) with a collapsible panel UI to keep the form compact.
- Actions:
  - Updated `src/components/StudioForm.tsx` — replaced `STYLE_TAGS` constant with 80+ categorized tags (organized by genre, production style, mood, and tempo)
  - Added local state `const [showTags, setShowTags] = useState(false);` to toggle tag panel visibility
  - Replaced hardcoded tag flex layout with collapsible button ("Browse style tags"/"Hide style tags") with chevron icon and conditional tag grid rendering (`max-h-48 overflow-y-auto`)
  - Validated with `npm run build`.

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

## 2026-05-20 (Database schema completeness — missende kolommen fix)

- Findings: VPS database miste kolommen die wel in schema.ts staan: `audio_url_hd`, `s3_key_hd`, en `rating`. CREATE TABLE IF NOT EXISTS voegt ze niet toe als de tabel al bestaat. ALTER TABLE statements in init.ts waren incompleet.
- Conclusions: ALTER TABLE statements in init.ts moeten alle kolommen bevatten die later zijn toegevoegd. Voeg helper scripts toe om kolommen te checken en repareren op bestaande databases.
- Actions:
  - Updated `src/db/init.ts` — toegevoegd aan alterTracksSql: `audio_url_hd TEXT`, `s3_key_hd TEXT`, `rating VARCHAR(10)`; toegevoegd aan CREATE TABLE: `rating VARCHAR(10)` (voor nieuwe installs)
  - Created `check-columns.sh` — script om te checken welke kolommen bestaan in tracks table via PostgreSQL information_schema
  - Created `fix-columns.sh` — script om missende kolommen toe te voegen met ALTER TABLE IF NOT EXISTS
  - Created `fix-db-schema.sh` — run-once script dat alle missende kolommen toevoegt en de volledige tracks table structuur toont; safe om meerdere keren te draaien; instructie om app container te restarten na fix
  - Updated `migrate.sh` — roept nu eerst init.ts aan (voor ALTER TABLE statements) voordat drizzle-kit push draait
  - Validated met `npm run build`.

## 2026-05-20 (Info Auto button verwijderd — auto-open gedrag behouden)

- Findings: "Info Auto On/Off" button in Player component bood een toggle voor het automatisch openen van het track details panel. Gebruiker wilde de button verwijderd maar het auto-open gedrag behouden.
- Conclusions: Het automatisch openen van het details panel bij afspelen van een track is gewenst gedrag. De toggle button was overbodig omdat gebruikers de "Details On/Off" button kunnen gebruiken om het panel te verbergen als ze het niet willen zien.
- Actions:
  - Removed `autoOpenNowPlayingPanel` state uit `src/lib/store.ts` — verwijderd uit PlayerState interface, initial state, setter functie en persist configuratie
  - Removed "Info Auto On/Off" button uit `src/components/Player.tsx` — alleen Autoplay en Details buttons blijven over
  - Kept auto-open useEffect in `src/app/page.tsx` — het track details panel opent automatisch bij afspelen wanneer `showTrackDetailsPanel` true is
  - Kept auto-open useEffect in `src/app/library/page.tsx` — consistent gedrag op beide pagina's
  - Het auto-open gedrag is nu altijd actief als het Details panel zichtbaar is — geen aparte toggle meer nodig
  - Validated met `npm run build`.

## 2026-05-20 (PoYo WAV webhook matching fix — wavJobId tracking)

- Findings: Wanneer `requestWavConversion()` een WAV conversie vraag stuurt naar PoYo, krijgt het een nieuwe `task_id` terug (de WAV job ID), maar deze werd nooit opgeslagen in de database. Wanneer de `poyo-wav` webhook later binnenkomt met die WAV task_id, kan het de bijbehorende track niet vinden — de lookup zocht alleen op de originele `jobId` (van de muziek generatie) of `audioId`.
- Conclusions: De WAV task_id moet worden opgeslagen als aparte kolom (`wav_job_id`) in de tracks tabel, zodat de webhook de track kan vinden via deze ID. Dit lost het probleem op dat WAV downloads niet verschenen na webhook ontvangst.
- Actions:
  - Updated `src/lib/request-wav-conversion.ts` — functie return type veranderd van `Promise<void>` naar `Promise<string | null>`; extraheert `task_id` uit response data (`response.data.task_id` of `response.data.data.task_id`); returned de WAV task_id of null bij failure; logt: `[wav] conversion task_id: {wavTaskId} for track {track.id}`
  - Updated `src/app/api/webhooks/poyo/route.ts` — `await` de result van `requestWavConversion()` om de WAV task_id te krijgen; als een WAV task_id terugkomt, save deze naar DB: `db.update(tracks).set({ wavJobId: wavTaskId }).where(eq(tracks.id, trackForFile.id!))`
  - Updated `src/db/schema.ts` — toegevoegd: `wavJobId: varchar("wav_job_id", { length: 255 })`
  - Updated `src/db/init.ts` — toegevoegd aan alterTracksSql: `ALTER TABLE tracks ADD COLUMN IF NOT EXISTS wav_job_id VARCHAR(255);`
  - Updated `src/app/api/webhooks/poyo-wav/route.ts` — DB lookup uitgebreid om ook te matchen op `wavJobId`: `or(taskId ? eq(tracks.jobId, taskId) : undefined, taskId ? eq(tracks.wavJobId, taskId) : undefined, audioId ? eq(tracks.audioId, String(audioId)) : undefined)`
  - Created `src/app/api/tracks/retry-wav/route.ts` — POST endpoint om WAV conversie opnieuw aan te vragen voor oude tracks zonder HD audio; selecteert tracks met `status='done', provider='poyo', audioId NOT NULL, s3KeyHd NULL`; roept `requestWavConversion()` aan en saved nieuwe `wavJobId`; returned stats over hoeveel tracks zijn geretried
  - Created `retry-wav-browser.js` — browser console script om `/api/tracks/retry-wav` aan te roepen; toont welke tracks zijn geretried
  - Created `check-wav-status-browser.js` — browser console script om WAV status van tracks te inspecteren; toont welke velden wel/niet gevuld zijn
  - Created `check-wav-status-db.sh` — database query script om WAV status van recent PoYo tracks te checken
  - Updated `fix-db-schema.sh` — toegevoegd: `wav_job_id VARCHAR(255)` kolom
  - Created `add-wav-job-id-column.sh` — dedicated script om alleen `wav_job_id` kolom toe te voegen
  - Validated met `npm run build`.

## 2026-05-20 (PoYo webhook — per-variant audioId + WAV conversie)

- Findings: PoYo webhook sloeg audioId alleen op voor het eerste track en vroeg maar één WAV conversie aan, terwijl PoYo meerdere variants retourneert (elk met eigen audio_id in body.files[]). Variants zonder audioId kregen geen WAV conversie.
- Conclusions: Loop over alle files[] en match elk bestand aan de corresponderende track (via index). Sla voor elk bestand met audio_id die audio_id op in het juiste track en vraag WAV conversie aan.
- Actions:
  - Updated `src/app/api/webhooks/poyo/route.ts` — single audioId save + single requestWavConversion vervangen door loop over files[]; voor elk bestand met audio_id: track ophalen uit syncedTracks[i], audioId opslaan via db.update, requestWavConversion aanroepen met correct trackId + jobId + audioId; cover art batch blijft ongewijzigd
  - Validated met `npm run build`.

## 2026-05-20 (Brand color unification — orange consistency)

- Findings: Purple (#8b5cf6) had leaked into focus rings, range slider thumb, aurora background, and VOCAL badge — conflicting with Sonara's orange (#ff530c) brand identity.
- Conclusions: Replace all purple UI elements with orange to maintain consistent brand identity throughout the app.
- Actions:
  - Updated `src/app/globals.css` — replaced purple aurora gradient with orange gradient (#cc4109, #e64a0b, #ff530c, #ff8550); replaced purple focus rings with orange for `.input-field:focus` and `.select-field:focus` (rgba(255, 83, 12, 0.3) and rgba(255, 83, 12, 0.5)); replaced purple range slider thumb (#8b5cf6) with orange (#ff530c)
  - Updated `src/components/StudioForm.tsx` — replaced green VOCAL badge with orange primary colors (bg-primary-500/20 text-primary-400 border border-primary-500/30); added font-medium and changed from rounded-full to rounded
  - Validated met `npm run build`.

## 2026-05-20 (poyo-wav webhook cover art fallback)

- Findings: De poyo-wav webhook heeft geen cover art trigger — als Pixazo down was bij generate, krijgt de track nooit een cover.
- Conclusions: Voeg een cover art fallback toe aan poyo-wav webhook: als de track na succesvolle WAV upload nog geen s3KeyCover heeft, start dan fire-and-forget generateAndSaveCoverArt.
- Actions:
  - Updated `src/app/api/webhooks/poyo-wav/route.ts` — import toegevoegd voor `generateAndSaveCoverArt`; na logApi call en vóór return: fallback check `if (!track.s3KeyCover)` triggert fire-and-forget cover art generatie met `.catch(() => {})`
  - Validated met `npm run build`.

## 2026-05-20 (Poll PoYo tracks voor async WAV download)

- Findings: De poyo-wav webhook levert het WAV bestand asynchroon — minuten nadat de track al status "done" heeft. De frontend poll stopt bij "done", waardoor s3KeyHd/audioUrlHd nooit in de UI terechtkomen. De WAV download knop blijft verborgen voor PoYo tracks.
- Conclusions: Poll PoYo tracks die done zijn maar geen s3KeyHd hebben, door ze in de "needs refresh" categorie te plaatsen samen met tracks zonder coverUrl.
- Actions:
  - Updated `src/app/page.tsx` — toegevoegd: `hasDoneWithoutHd` conditie die checkt op `status === "done" && provider === "poyo" && !s3KeyHd`; interval logica aangepast om ook te triggeren bij `hasDoneWithoutHd`
  - Updated `src/app/library/page.tsx` — nieuwe polling useEffect toegevoegd met dezelfde `hasDoneWithoutHd` logica en 15 seconden interval wanneer tracks cover art of HD audio missen
  - Validated met `npm run build`.

## 2026-05-21 (Provider naar Studio card, taal naar Lyric Studio)

- Findings: Provider-keuze stond in een losse settings-rij in de Create-form, terwijl de language-selector op dezelfde plek stond en niet in de context van Lyric Studio.
- Conclusions: Provider hoort dicht bij de primaire Studio-controls op de Create-pagina; language hoort bij lyric- en structuurinstellingen op de Lyric Studio-pagina.
- Actions:
  - Updated `src/components/StudioForm.tsx` — provider dropdown + model-select verplaatst naar de `Studio` card; language-selector verwijderd uit de Create-pagina; `Vocal Gender` als losse card behouden voor vocal mode
  - Updated `src/app/lyrics-studio/page.tsx` — language-selector (incl. `Other...` custom language input) toegevoegd boven de Structure-sectie
  - Updated `sonara-user.md` — secties geactualiseerd met nieuwe locatie van Provider en Language + versie bump

## 2026-05-21 (Fullscreen player album art zichtbaar + fuzzy achtergrond)

- Findings: In fullscreen mode werd album art vaak niet getoond omdat `currentTrack.coverUrl` niet op alle play/queue paden werd doorgegeven; daarnaast miste de fullscreen achtergrond een uitgesproken fuzzy ambience en waren lyrics visueel te groot.
- Conclusions: Cover-art velden moeten consequent door alle player context-objecten lopen (play, queue, autoplay-next) en fullscreen moet een robuuste fallback hebben. Voor leesbaarheid in fullscreen hoort de lyrics-typografie compacter te zijn.
- Actions:
  - Updated `src/components/Player.tsx` — cover-resolve fallback toegevoegd (`coverUrl` of `/api/tracks/{id}/cover` wanneer `s3KeyCover` aanwezig is); fuzzy ambience layer toegevoegd boven diffuse artwork-bg; lyrics font size verkleind naar `text-sm md:text-base`; aria-labels toegevoegd op seek/volume sliders in fullscreen
  - Updated `src/components/TrackList.tsx` — `coverUrl` en `s3KeyCover` toegevoegd aan `playContext` en `playTrackFromGesture(...)`
  - Updated `src/app/page.tsx` — `coverUrl` en `s3KeyCover` toegevoegd aan `enqueueTrack`, `playContext` en fullscreen play-start object
  - Updated `src/app/library/page.tsx` — `coverUrl` en `s3KeyCover` toegevoegd aan `enqueueTrack`, `playContext` en fullscreen play-start object
  - Validated met `npm run build`.

## 2026-05-16 (Automatic database creation on app startup)

- Findings: App assumed the PostgreSQL database and tables already existed. On a fresh deploy (e.g. Docker Compose first run), the database is created via `POSTGRES_DB` env var but tables still require manual `drizzle-kit push`. No automatic initialization on startup.
- Conclusions: App should check if the database exists on startup, create it if missing, then create all tables automatically — no manual steps needed.
- Actions:
  - Created `src/db/init.ts` — startup utility that connects to PostgreSQL's default `postgres` database, checks if target database exists (via `pg_database` query), creates it if not, then connects to target database and creates all four tables (`users`, `tracks`, `api_logs`, `settings`) using `CREATE TABLE IF NOT EXISTS` with raw SQL matching the Drizzle schema
  - Created `src/instrumentation.ts` — Next.js instrumentation file with `register()` function that runs `initializeDatabase()` on server startup (nodejs runtime only); works in both dev (`next dev`) and production (`next start`); standalone Docker builds include the init logic without needing drizzle-kit at runtime
  - Validated with `npm run build`.

## 2026-05-23 za 00:49 (Studio workspace cards: grid-instelling + clickability + single-cover center)

- Findings: In Studio hadden workspace cards geen gebruikersinstelling voor grid-omvang, een enkele cover werd in een 2x2 collage niet mooi gecentreerd, en mappen voelden op sommige delen van de kaart niet betrouwbaar klikbaar.
- Conclusions: Voeg een persistente grid-optie toe (4/8/12/16), render single-cover kaarten als gecentreerde hero-cover, en maak de volledige kaart betrouwbaar klikbaar door decoratieve lagen pointer-events uit te zetten.
- Actions:
  - Updated `src/app/page.tsx` — added persistente workspace grid setting met localStorage key `sonara-studio-workspace-grid-size` en selectorchips voor 4/8/12/16
  - Updated `src/app/page.tsx` — workspace cards tonen nu alleen het ingestelde aantal via `visibleWorkspaces`
  - Updated `src/app/page.tsx` — single-cover layout gecentreerd met flex-variant i.p.v. altijd een 2x2 collage
  - Updated `src/app/page.tsx` — clickability verbeterd via `cursor-pointer`, `pointer-events-none` op overlays en `draggable={false}` op cover images
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 00:49`
  - Validated with `npm run build`.

## 2026-05-23 za 00:53 (Default workspace + automatische track-toewijzing)

- Findings: Er bestond geen vaste fallback-workspace, waardoor niet-toegewezen songs verspreid konden raken en nieuwe generations niet consistent aan een map werden gekoppeld.
- Conclusions: Introduceer een niet-verwijderbare Default Workspace en sync alle niet-toegewezen tracks daarheen. Nieuwe tracks moeten naar Default gaan, behalve wanneer een andere workspace actief geselecteerd is tijdens generation.
- Actions:
  - Updated `src/lib/store.ts` — toegevoegd: `DEFAULT_WORKSPACE_ID`, `DEFAULT_WORKSPACE_NAME`, `ensureDefaultWorkspace()`, `syncTracksToDefaultWorkspace(trackIds)` en persist-merge die legacy state migreert met een default workspace
  - Updated `src/lib/store.ts` — `deleteWorkspace` blokkeert nu verwijderen van de default workspace
  - Updated `src/app/page.tsx` — Studio mount zorgt voor `ensureDefaultWorkspace()`, `fetchTracks()` synct niet-toegewezen tracks naar default, en `handleGenerate()` routeert nieuwe tracks naar actieve workspace of anders default
  - Updated `src/app/library/page.tsx` — delete-actie verborgen voor default workspace (label `Default`)
  - Updated `src/app/workspaces/page.tsx` — delete-knop vervangen door `System default` badge voor de default workspace
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 00:53`
  - Updated `sonara-user.md` — gebruikersdocumentatie uitgebreid met default workspace gedrag
  - Validated with `npm run build`.

## 2026-05-23 za 00:56 (Studio workspace: folder-open mode + back/breadcrumb navigatie)

- Findings: In Studio bleven alle workspace-cards zichtbaar na selectie; dat voelde alsof de grid-selector niet reageerde en de folder-open state was onduidelijk.
- Conclusions: Workspace selectie moet een echte folder-open state tonen: overige cards verbergen, alleen foldertracks tonen, met expliciete terugnavigatie via knop en breadcrumb.
- Actions:
  - Updated `src/app/page.tsx` — toegevoegd `isWorkspaceFolderOpen` en conditionele rendering: overview-grid alleen zichtbaar zonder geselecteerde workspace
  - Updated `src/app/page.tsx` — bij klik op workspace-card opent nu folderweergave; overige workspaces worden verborgen
  - Updated `src/app/page.tsx` — toegevoegd `Back to folders` knop in de header wanneer een folder open is
  - Updated `src/app/page.tsx` — breadcrumb `Workspaces / {naam}` gemaakt met klik op `Workspaces` om terug te keren naar overview
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 00:56`
  - Updated `sonara-user.md` — user guide aangevuld met folder-open gedrag en terugnavigatie
  - Validated with `npm run build`.

## 2026-05-22 vr 14:44 (Workspaces page, folder gradients, and sidebar navigation)

- Findings: Workspace management already existed in the store and track actions, but the UI was split across an unstable library page and no dedicated workspace route existed for browsing folder-style cards.
- Conclusions: The workspace feature should be surfaced as a first-class page with seeded cover collages and persistent folder gradients, while the library route should stay clean and build-safe.
- Actions:
  - Updated `src/app/workspaces/page.tsx` — dedicated workspace page renders folder-gradient cards and seeded cover collages from the tracks inside each workspace
  - Updated `src/components/Sidebar.tsx` — added a Workspaces navigation item and refreshed the version stamp to `vr 14:44`
  - Rebuilt `src/app/library/page.tsx` — replaced the broken duplicate workspace block with a clean track browser that reuses `TrackList` and shows workspace cards in a stable layout
  - Updated `src/app/library/page.tsx` — workspace cards now use gradient-backed covers and seeded collage selection from the tracks in each folder
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

## 2026-05-20 (PWA ondersteuning)
- Findings: Sonara had geen Progressive Web App functionaliteit — geen installeerbaar maken, geen offline ondersteuning, geen app manifest.
- Conclusions: PWA-ondersteuning met next-pwa zorgt voor installable web app ervaring met service worker en manifest. Next.js 16 vereist Turbopack-compatibiliteit en correcte TypeScript manifest types. Icons placeholder met README voor toekomstige generatie.
- Actions: Geïnstalleerd next-pwa dependency. Gemaakt src/app/manifest.ts met Sonara manifest config (name, icons, theme colors, standalone mode). Updated next.config.mjs — wrapped config met withPWA (dest: public, disable in dev, register: true), toegevoegd turbopack: {} voor compatibiliteit. Updated src/app/layout.tsx — toegevoegd PWA meta tags (theme-color, apple-mobile-web-app-capable, status-bar-style). Gemaakt public/icons/ folder met README.icons.md voor placeholder icons instructies (192×192 en 512×512 PNG, muzieknoot SVG basis). Updated .gitignore — excluded PWA-gegenereerde bestanden (sw.js, workbox-*.js, worker-*.js plus maps). Fixed manifest purpose type ("maskable" in plaats van "any maskable" voor TypeScript). Validated met npm run build — manifest route beschikbaar op /manifest.webmanifest; validated.

## 2026-05-20 (Create playlist vanuit track options)
- Findings: Playlists moesten eerst in Library worden aangemaakt voordat tracks eraan toegevoegd konden worden. Track options menu had geen directe manier om nieuwe playlists te maken.
- Conclusions: "Create new playlist" optie in track menu maakt workflow sneller — gebruiker kan direct een playlist maken en de track toevoegen zonder naar Library te navigeren.
- Actions: Updated src/components/TrackList.tsx — toegevoegd "Create new playlist" button in track options menu met plus icon, priority styling (text-primary-300, hover:bg-primary-500/10). Gemaakt create playlist dialog met input field, focus management, keyboard shortcuts (Enter = create & add, Escape = cancel). Geïmporteerd usePlaylistStore hooks (createPlaylist, addTrackToPlaylist). Dialog toont playlist name input, Create & Add button (disabled wanneer leeg). Na create wordt track automatisch toegevoegd en menu gesloten. Validated met npm run build; validated.

## 2026-05-20 (Fullscreen player met diffuse background en lyrics)
- Findings: Player was alleen beschikbaar als bottom bar — geen immersive fullscreen mode voor focus op lyrics en album art.
- Conclusions: Fullscreen mode biedt Apple Photos-achtige ervaring met diffuse background, grote album art, lyrics in kolommen. Ideaal voor lyrics volgen tijdens afspelen.
- Actions: Updated src/lib/store.ts — toegevoegd isFullscreen boolean state en setIsFullscreen action aan PlayerState interface. Added coverUrl en s3KeyCover properties aan Track interface. Persisted isFullscreen in zustand storage. Created FullscreenPlayer component in src/components/Player.tsx — fullscreen overlay (z-index 60) met diffuse ingezoomde album art als background (scale-110, blur-3xl, opacity-30), dark gradient overlay (from-black/60 via-black/70 to-black/90). Layout: header met close button en track info, main content area met lyrics links (responsive 1-3 kolom grid afhankelijk van aantal regels: ≤20 = 1 kolom, ≤40 = 2 kolommen, >40 = 3 kolommen), album art rechts (w-96, aspect-square, rounded-2xl, shadow-2xl). Player controls onderaan met backdrop-blur, progress bar met grotere thumb (h-1.5, w-3 h-3 thumb), play/pause/previous/next buttons (w-16 h-16 center play button), volume slider. Added fullscreen button in normal Player component (hidden sm:flex, expand icon, disabled wanneer geen currentTrack). Conditional render — toont FullscreenPlayer wanneer isFullscreen true en currentTrack bestaat. Validated met npm run build; validated.

## 2026-05-21 (Block-based Lyric Studio)

- Findings: Lyric Studio had alleen taal- en songstructuurkeuzes, waardoor lyrics nog niet sectie-voor-sectie konden worden opgebouwd.
- Conclusions: Een lokale block editor past bij de bestaande Studio-flow zonder databasewijziging; omdat dnd-kit niet aanwezig is, zijn reorder-knoppen gebruikt in plaats van een nieuwe dependency.
- Actions: Updated src/app/lyrics-studio/page.tsx met metadataformulier, bestaande structure dropdown, block presets, add-block controls, block cards met generate/copy/use-in-studio acties en lokale LyricBlock state. Added src/app/api/lyric-studio/generate-block/route.ts met requireAuth(), centrale callLLM() en logApi(). Updated src/lib/providers/llm.ts om callLLM te exporteren. Updated src/components/Sidebar.tsx versie naar do 02:05. Updated sonara-user.md met Lyric Studio uitleg. Validated met npm run build; validated.

## 2026-05-21 (Split prompt and lyrics LLM routing)

- Findings: Settings gebruikte een gecombineerd Lyrics & Prompt model, en /api/llm had nog lokale LLM/logging-logica waardoor prompt- en lyric-generatie niet apart routeerbaar waren.
- Conclusions: Prompt-optimalisatie en lyric-generatie hebben aparte provider/model-keuzes nodig. Centrale callLLM() moet daarom purpose-aware zijn, zodat Studio lyrics en Lyric Studio blocks dezelfde lyrics provider gebruiken.
- Actions: Updated src/app/settings/page.tsx met LLM Routing, aparte Prompt/Lyrics providers, aparte OpenRouter prompt/lyrics model selectors en aparte OpenAI prompt/lyrics model fields. Updated src/lib/providers/llm.ts met purpose-based provider/model selectie via PROMPT_LLM_PROVIDER, LYRICS_LLM_PROVIDER, OPENROUTER_PROMPT_MODEL, OPENROUTER_LYRICS_MODEL, OPENAI_PROMPT_MODEL en OPENAI_LYRICS_MODEL. Rebuilt src/app/api/llm/route.ts op centrale callLLM() en logApi(). Updated src/app/api/lyric-studio/generate-block/route.ts om de lyrics provider te gebruiken. Updated src/components/Sidebar.tsx versie naar do 02:12 en sonara-user.md Settings uitleg. Validated met npm run build; validated.

## 2026-05-21 (Lyric Studio presets and complete song generation)

- Findings: De Simple preset was dubbel met Pop en Lyric Studio miste snelle block-duplicatie en een manier om direct alle secties van een songstructuur te vullen.
- Conclusions: Presets moeten scherper aansluiten op pop, AABA en dance/EDM flows; complete-song generatie kan veilig sequentieel per block lopen zodat eerdere blocks context geven aan latere blocks.
- Actions: Updated src/app/lyrics-studio/page.tsx met nieuwe BLOCK_PRESETS, EDM/Dance labelmapping (Drop, Breakdown, Build-up), duplicateBlock(), duplicate button per block, preset/structure parsing en Generate complete song button in de Song Structure card. Updated src/components/Sidebar.tsx versie naar do 02:19 en sonara-user.md Lyric Studio uitleg. Validated met npm run build; validated.

## 2026-05-21 (Lyric Studio: rechter lyrics-sidebar)

- Findings: Er was geen mogelijkheid om de volledige lyrics direct te bekijken tijdens het bouwen.
- Conclusions: Een dynamische, inklapbare rechter zijbalk met alle lyrics verhoogt overzicht en workflow.
- Actions:
  - Added `src/components/CollapsibleSidebar.tsx`: generieke collapsible sidebar component.
  - Updated `src/app/lyrics-studio/page.tsx`: knop toegevoegd (alleen zichtbaar op xl), sidebar toont altijd de actuele lyrics (`combinedLyrics`).
  - Build gevalideerd met `npm run build`.

## 2026-05-21 (Lyric Studio: derde kolom + kolom-toggles)

- Findings: Alleen lyric blocks in het midden, geen ruimte voor extra features. Kolom-indeling was niet aanpasbaar.
- Conclusions: Een derde kolom rechts maakt uitbreidingen mogelijk. Gebruiker kan nu kiezen tussen 1 of 2 lyric block kolommen.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx`: derde kolom toegevoegd, toggle voor 1/2 lyric block kolommen (state-based, geen window property meer).
  - Build gevalideerd met `npm run build`.

## 2026-05-21 (Lyric Studio: 3 kolommen, resizebare tekstvakken, flowchart mobiel)

- Findings: Op grote schermen was de lyric studio slechts 1 kolom, tekstvakken waren niet resizebaar, en er was geen visueel overzicht van de songstructuur.
- Conclusions: Voor overzicht en UX is een 3-koloms grid gewenst op XL, tekstvakken moeten handmatig vergroot kunnen worden, en een flowchart van de huidige songstructuur is handig op mobiel.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx`: lyric blocks in 3 kolommen op xl, textarea nu `resize-y`, flowchart onderaan toegevoegd (alleen zichtbaar op 1 kolom).
  - Added `src/components/Flowchart.tsx`: eenvoudige flowchart met symbolen per block type.
  - Validated met `npm run build` (geen errors).

## 2026-05-21 (Player: altijd voldoende bottom-marge)

- Findings: Buttons/controls konden wegvallen achter de vaste player onderin.
- Conclusions: Altijd een vaste bottom padding onder de hoofdcontent voorkomt dit probleem.
- Actions:
  - Updated `src/app/layout.tsx`: body krijgt nu standaard `pb-[120px]` (120px bottom padding) zodat alle content altijd boven de player blijft.
  - Build gevalideerd met `npm run build`.

## 2026-05-21 do 05:29 (Generate button onderaan Studio-kolom)

- Findings: De generate CTA stond als viewport-sticky en hoorde visueel niet bij de Studio-kolom, waardoor de knop niet duidelijk aan de linker form-kolom gekoppeld bleef.
- Conclusions: Maak van de Studio-kolom op desktop een vaste/sticky kolom met interne scroll voor form-secties, en plaats de generate CTA vast onderaan die kolom.
- Actions:
  - Updated `src/app/page.tsx` — form-kolom aangepast naar desktop sticky + vaste hoogte (`xl:sticky`, `xl:top-16`, `xl:h-[calc(100vh-10rem)]`)
  - Updated `src/components/StudioForm.tsx` — form herstructureerd naar flex-kolom met scrollbare contentzone en non-viewport-sticky generate container onderaan
  - Validated with `npm run build`.

## 2026-05-21 do 05:29 (Studio-kolom sticky precisie boven player)

- Findings: De sticky hoogte van de Studio-kolom was nog gebaseerd op een vaste rem-waarde, waardoor de uitlijning per schermhoogte kon verschillen.
- Conclusions: Gebruik gedeelde CSS-variabelen voor player-hoogte, sticky-top en ondermarge zodat de kolomhoogte exact berekend wordt uit de viewport.
- Actions:
  - Updated `src/app/globals.css` — added `--player-height`, `--studio-top-offset`, `--studio-bottom-gap`
  - Updated `src/app/layout.tsx` — bottom padding nu via `pb-[var(--player-height)]`
  - Updated `src/app/page.tsx` — sticky top en kolomhoogte nu op basis van CSS variabelen (`calc(100vh - top - player - gap)`)
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-05:29`

## 2026-05-21 do 05:34 (Studio zonder Create/Library submenu)

- Findings: De Studio-pagina had bovenaan een Create/Library submenu, terwijl de gewenste flow alleen de Create-ervaring op deze pagina is.
- Conclusions: Verwijder tabs-state en submenu-UI uit de Studio-pagina en render de Create-layout altijd direct.
- Actions:
  - Updated `src/app/page.tsx` — removed `useUIStore` tab state, removed Create/Library top submenu, removed conditional tab rendering, and kept only the Create layout
  - Updated `sonara-user.md` — wording aangepast naar Studio Create page + Library page via sidebar
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-05:34`

## 2026-05-21 do 05:41 (Library playlists als gallery view)

- Findings: In Library bestond alleen een songlist met playlist-filters; er was geen visuele playlist-overview zoals een galerij.
- Conclusions: Voeg een aparte Playlists-view toe met cards en cover-collage op basis van cover art van tracks in de playlist.
- Actions:
  - Updated `src/app/library/page.tsx` — added `Songs`/`Playlists` view switch in Library header
  - Updated `src/app/library/page.tsx` — added playlist gallery grid with create-card and playlist cards
  - Updated `src/app/library/page.tsx` — playlist card cover now uses up to 4 song cover images from that playlist (collage), fallback placeholder when empty
  - Updated `src/app/library/page.tsx` — clicking playlist card sets active playlist and switches to Songs view
  - Updated `sonara-user.md` — added Library Views section
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-05:41`

## 2026-05-21 do 11:14 (Player spacing + mobile details panel start-off fix)

- Findings: Pagina's hadden dubbele bottom spacing (`body` + `main pb-32`) en de mobile track details overlay kon terug blijven komen doordat sluiten alleen `selectedTrack` leegmaakte terwijl `showTrackDetailsPanel` actief bleef (ook persisted).
- Conclusions: Maak de player-bottomruimte globaal leidend op exact `76.5px`, verwijder extra page-level bottom padding, en koppel detail-close aan het daadwerkelijk uitschakelen van de panel-state; forceer daarnaast mobile start op `off`.
- Actions:
  - Updated `src/app/globals.css` — changed `--player-height` from `120px` to `76.5px`
  - Updated `src/app/page.tsx`, `src/app/library/page.tsx`, `src/app/account/page.tsx`, `src/app/logs/page.tsx`, `src/app/settings/page.tsx` — removed redundant `pb-32` page-level bottom padding
  - Updated `src/app/page.tsx`, `src/app/library/page.tsx` — added shared close handler that sets `showTrackDetailsPanel=false` on close (sidebar + mobile overlay)
  - Updated `src/components/Player.tsx` — added mobile-on-mount guard to start details panel off for viewports `<=1023px`
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-11:14`
  - Updated `sonara-user.md` — version updated to `do 11:14`
  - Validated with `npm run build`.

## 2026-05-21 do 11:39 (Viewport shell boven fixed player, geen overlap)

- Findings: Hoewel player-height was afgestemd, konden pagina's nog body-scroll of viewport-overlap krijgen doordat content-shells `min-h-screen` gebruikten; hierdoor kon content (zoals `Generate Track`) te dicht bij of onder de fixed player vallen.
- Conclusions: Alle hoofdpagina's moeten een vaste shell gebruiken met hoogte `calc(100vh - 77px)` en interne `overflow-y-auto`, zodat scroll altijd stopt exact boven de fixed player.
- Actions:
  - Updated `src/app/globals.css` — set `--player-height` to exact `77px`
  - Updated `src/app/layout.tsx` — removed global body bottom padding; scrolling is now owned by per-page constrained shells
  - Updated `src/app/page.tsx` — main shell set to `h-[calc(100vh-var(--player-height))]` with internal scrolling; right details panel height aligned to same calc height
  - Updated `src/app/library/page.tsx` — same constrained shell + loading state alignment; details panel aligned to calc height
  - Updated `src/app/account/page.tsx`, `src/app/logs/page.tsx`, `src/app/settings/page.tsx` — replaced full-page scroll wrappers with constrained `calc(100vh - player)` scroll containers
  - Updated `src/app/lyrics-studio/page.tsx` — root shell constrained to `h-[calc(100vh-var(--player-height))]`
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-11:39`
  - Updated `sonara-user.md` — version updated to `do 11:39`
  - Validated with `npm run build`.

## 2026-05-21 do 11:43 (Sidebar credits/logout boven player)

- Findings: In desktop sidebar konden het creditsblok en de logout-link visueel achter de fixed player vallen omdat de sidebar tot onderaan viewport doorliep.
- Conclusions: Laat de sidebar eindigen op de player-top door de fixed bottom-offset gelijk te maken aan `--player-height`.
- Actions:
  - Updated `src/components/Sidebar.tsx` — desktop sidebar changed from `bottom-0` to `bottom-[var(--player-height)]`
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-11:43`
  - Updated `sonara-user.md` — version updated to `do 11:43`
  - Validated with `npm run build`.

## 2026-05-21 do 12:16 (Lyric Studio repetitive chorus toggle)

- Findings: In Lyric Studio was er geen directe manier om chorus-gedrag te sturen; meerdere chorusblokken werden steeds opnieuw gegenereerd zonder expliciete keuze tussen exact herhalen of variëren.
- Conclusions: Voeg in de Song Structure card een `Repetitive chorus` checkbox toe (standaard aan), persist die in de local draft, en stuur de AI-generatie met expliciete chorus-mode instructies.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added `repetitiveChorus` state (default `true`) + restore/persist in `LYRICS_STUDIO_STORAGE_KEY`
  - Updated `src/app/lyrics-studio/page.tsx` — added checkbox UI in Song Structure card with helper text for repeat vs variation mode
  - Updated `src/app/lyrics-studio/page.tsx` — updated full-song generation flow: first chorus is generated once and reused verbatim when repetitive mode is enabled; when disabled, chorus blocks are generated with variation mode
  - Updated `src/app/api/lyric-studio/generate-block/route.ts` — added `chorusMode` and `isFirstChorus` request handling + validation + prompt instructions for repeat/variation behavior
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-12:16`
  - Updated `sonara-user.md` — version updated to `do 12:16` and Lyric Studio docs include repetitive chorus option
  - Validated with `npm run build`.

## 2026-05-21 do 12:18 (Lyric Studio stop generating button)

- Findings: Tijdens `Generate complete song` bestond er geen manier om een lopende AI-lyrics run te stoppen; gebruikers moesten wachten tot alle blokken klaar waren.
- Conclusions: Voeg een expliciete stopactie toe die de lopende request abort, de generatie-loop breekt en resterende blokken direct uit loading haalt.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added `Stop generating` button shown while full-song generation is active
  - Updated `src/app/lyrics-studio/page.tsx` — added `AbortController` + stop refs (`songGenerationAbortRef`, `stopSongGenerationRef`) and wired cancellation into block generation loop
  - Updated `src/app/lyrics-studio/page.tsx` — `requestBlockLyrics` now accepts `AbortSignal` for cancellable fetch calls
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-12:18`
  - Updated `sonara-user.md` — version updated to `do 12:18` and Lyric Studio section mentions stop action
  - Validated with `npm run build`.

## 2026-05-21 do 15:34 (Lyric Studio creativity + top-p sliders)

- Findings: Er was geen directe controle in Lyric Studio op LLM sampling; temperature en top-p konden niet per generatie worden gestuurd.
- Conclusions: Voeg twee sliders toe in de Song Structure card met 1-10 UX-schaal en map intern naar API-waardige waarden, vervolgens meesturen naar de LLM-call.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added `creativityLevel` and `contextLevel` sliders (1-10), with internal mapping to `temperature` (0.1-1.2) and `topP` (0.1-1.0)
  - Updated `src/app/lyrics-studio/page.tsx` — added zone labels for creativity (laag/middel/hoog) and persisted slider values in lyric-studio local draft storage
  - Updated `src/app/lyrics-studio/page.tsx` — request payload for `/api/lyric-studio/generate-block` now includes `temperature` and `topP`
  - Updated `src/app/api/lyric-studio/generate-block/route.ts` — added validation for `temperature` (0.1-1.2) and `topP` (0.1-1.0), then forwarded both into `callLLM(...)`
  - Updated `src/lib/providers/llm.ts` — `callLLM` now accepts `temperature` and `topP` options and passes them to OpenRouter/OpenAI payloads (`temperature`, `top_p`)
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-15:34`
  - Updated `sonara-user.md` — version updated to `do 15:34` and Lyric Studio docs mention both sliders
  - Validated with `npm run build`.

## 2026-05-21 do 15:51 (API sent/received logging in centrale logger)

- Findings: API logging bestond al in `api_logs`, maar er was geen directe server-side output van wat precies werd verstuurd en ontvangen per gelogde API-call.
- Conclusions: Centraliseer sent/received output in `logApi` zodat alle bestaande route-calls die `logApi(...)` gebruiken automatisch ook leesbare request/response console-logging krijgen.
- Actions:
  - Updated `src/lib/logger.ts` — added console output for every successful `logApi(...)` call with endpoint, status, duration, sent payload, and received payload
  - Updated `src/lib/logger.ts` — added safe truncation helper (`MAX_LOG_CHARS = 4000`) to avoid oversized terminal log spam
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-15:51`
  - Validated with `npm run build`.

## 2026-05-21 do 16:07 (Lyric Studio snapshots + unieke chorus override)

- Findings: Er ontbrak een snelle manier om lyric-drafts op te slaan/herladen, en bij repetitieve chorus was er geen block-level escape om een specifieke chorus toch uniek te genereren.
- Conclusions: Voeg lokale snapshot-opslag toe voor volledige Lyric Studio state en voeg per chorus block een expliciete unique override toe die de auto-repeat kan overrulen.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added local snapshot model/state (`LYRICS_STUDIO_SNAPSHOTS_KEY`) with save, load, and delete actions for up to 30 named snapshots
  - Updated `src/app/lyrics-studio/page.tsx` — added snapshot load UI panel and safe hydration/sanitization of loaded block data
  - Updated `src/app/lyrics-studio/page.tsx` — extended `LyricBlock` with `uniqueChorusOverride` and added per-chorus checkbox in block editor UI
  - Updated `src/app/lyrics-studio/page.tsx` — generation logic now reuses first chorus only when repetitive mode is on and the current chorus block does not request unique override
  - Updated `src/app/lyrics-studio/page.tsx` — single block generation now also respects repetitive chorus mode versus unique override
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-16:07`
  - Updated `sonara-user.md` — version updated to `do 16:07` and Lyric Studio docs now include snapshot and unique chorus override usage
  - Validated with `npm run build`.

## 2026-05-21 do 17:53 (Logs page collapsible input/output per call)

- Findings: Op de Logs-pagina was alleen een compacte tabel zichtbaar; input/output payloads per call waren niet direct beschikbaar in de UI.
- Conclusions: Vervang tabelweergave met klikbare call-items die standaard collapsed zijn en per item openklappen om Input en Output te tonen.
- Actions:
  - Updated `src/app/logs/page.tsx` — replaced table rows with collapsed-by-default clickable log cards
  - Updated `src/app/logs/page.tsx` — added per-log expand/collapse state and toggle behavior on click
  - Updated `src/app/logs/page.tsx` — expanded detail view now shows both Input (`request`) and Output (`response`) payloads in formatted panels
  - Updated `src/app/logs/page.tsx` — refresh now resets expanded state so all calls return to collapsed view
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-17:53`
  - Updated `sonara-user.md` — version updated to `do 17:53` and added Logs section behavior
  - Validated with `npm run build`.

## 2026-05-21 do 18:00 (Lyrics generator: alleen section-tagged output)

- Findings: De algemene Generate Lyrics output kon soms extra tekst bevatten buiten de lyrics-body.
- Conclusions: Versterk de LLM system-instructies zodat output strikt alleen uit section tags en lyricregels bestaat.
- Actions:
  - Updated `src/app/api/llm/route.ts` — tightened `type === "lyrics"` system prompt to require plain section tags (`[Verse]`, `[Chorus]`, `[Bridge]`) and forbid intro/outro text, commentary, numbering, markdown, quotes, or notes
  - Updated `src/app/api/llm/route.ts` — added explicit rule: return exactly lyrics content with section tags, nothing else
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-18:00`
  - Updated `sonara-user.md` — version updated to `do 18:00` and documented strict generated-lyrics output format
  - Validated with `npm run build`.

## 2026-05-22 vr 21:48 (MusicGPT lyrics max 3000 blokkeren met popup)

- Findings: Bij MusicGPT kon een te lange lyrics-invoer alsnog de generate-flow starten, terwijl de provider een striktere limiet heeft.
- Conclusions: Voeg een vroege client-check toe met een zichtbare notificatie, en een server-side guard in de generate API zodat ook directe API-calls correct worden geblokkeerd.
- Actions:
  - Updated `src/app/page.tsx` — added preflight check in `handleGenerate()` that blocks MusicGPT generation when lyrics exceed 3000 chars and shows an error popup via `setNotice(...)`
  - Updated `src/app/api/generate/route.ts` — added provider-specific validation returning `400` when `provider === "musicgpt"` and lyrics exceed 3000 chars
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 21:48`
  - Updated `sonara-user.md` — user guide versie ververst naar `vr 21:48` en MusicGPT 3000-char limiet gedocumenteerd
  - Validated with `npm run build`.

## 2026-05-22 vr 22:03 (Lyric Studio in-app dialogs + player persistent tussen pagina's)

- Findings: Lyric Studio gebruikte nog browser-popups (`window.confirm`/`window.prompt`) voor belangrijke acties, en playback kon stoppen bij navigatie naar andere routes zoals Lyric Studio.
- Conclusions: Vervang alle default browser-popups met in-app confirm/save dialogs en notices; maak de player-audio route-onafhankelijk met een gedeeld audio-element zodat afspelen doorloopt bij routewissels.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — replaced browser popups with in-app dialogs for preset replace, studio replace, clear-all, and snapshot naming
  - Updated `src/app/lyrics-studio/page.tsx` — added in-app notice banners for generation/copy/style errors and save/clear feedback
  - Updated `src/components/Player.tsx` — introduced module-level shared audio element to keep playback alive across component remounts during navigation
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 22:03`
  - Updated `sonara-user.md` — user guide versie ververst naar `vr 22:03` met uitleg over in-app dialogs en persistente playback
  - Validated with `npm run build`.

## 2026-05-22 vr 22:39 (MusicGPT webhook verwerkt MusicAI conversion_path)

- Findings: De MusicGPT `MusicAI` webhook-docs tonen audio-callbacks met `success: true`, `conversion_id` en `conversion_path`, terwijl de generieke webhook-doc ook `status: "COMPLETED"` noemt. Sonara verwerkte alleen exact `COMPLETED`, waardoor geldige MusicGPT audio-webhooks zonder `status` als wachtend konden blijven staan.
- Conclusions: Behandel een payload met audio-URL (`audio_url` of `conversion_path`) als voltooid zolang MusicGPT niet expliciet een failure meldt, en houd `conversion_id` matching leidend voor de twee trackvarianten.
- Actions:
  - Updated `src/app/api/webhooks/musicgpt/route.ts` — added typed payload parsing, header-or-query secret support, non-audio callback skipping, and completion detection based on actual audio URL instead of only `status === "COMPLETED"`
  - Updated `src/lib/settings.ts` — webhook URL secret appending now uses URL query params safely and falls back to `NEXT_PUBLIC_APP_URL` when deriving webhook URLs from app config
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 22:39`
  - Updated `sonara-user.md` — user guide versie ververst naar `vr 22:39` en MusicGPT als webhook-provider verduidelijkt
  - Validated with `npm run build`.

## 2026-05-22 vr 22:50 (Studio tracks kolom gesplitst: workspace + recent)

- Findings: In Studio stond rechts alleen één lange `Recent Tracks` lijst, waardoor workspace-context ontbrak en navigatie tussen workspace en globale tracks onduidelijk bleef.
- Conclusions: Splits de rechterkolom in twee gelijke blokken met eigen scroll: boven de geselecteerde workspace-tracks met breadcrumb, onder de volledige recente tracks.
- Actions:
  - Updated `src/app/page.tsx` — imported `useWorkspaceStore` and wired `selectedWorkspaceId`, selected workspace lookup, and workspace track filtering
  - Updated `src/app/page.tsx` — replaced single right-column list with two half-height cards: top `Workspace Tracks` block with breadcrumb (`Workspaces / {workspace}`), bottom `Recent Tracks` block
  - Updated `src/app/page.tsx` — each block now has independent `overflow-y-auto` for easier browsing in long lists
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 22:50`
  - Updated `sonara-user.md` — user guide versie ververst naar `vr 22:50` en Studio split-column gedrag gedocumenteerd
  - Validated with `npm run build`.

## 2026-05-22 vr 23:31 (Track sorting in alle tracklijsten)

- Findings: Tracklijsten hadden geen expliciete sorteeroptie, waardoor gebruikers niet snel konden wisselen tussen nieuwste en oudste items.
- Conclusions: Voeg sortering centraal toe in `TrackList`, zodat Studio (workspace + recent) en Library automatisch dezelfde sort-controls krijgen.
- Actions:
  - Updated `src/components/TrackList.tsx` — added sort control with `New to old` and `Old to new`
  - Updated `src/components/TrackList.tsx` — introduced sorted `displayedTracks` (by `createdAt`) for rendering and selection counts
  - Updated `src/components/TrackList.tsx` — autoplay play-context now follows the active list sorting order
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 23:31`
  - Updated `sonara-user.md` — user guide versie ververst naar `vr 23:31` en sorteeropties gedocumenteerd
  - Validated with `npm run build`.

## 2026-05-23 za 00:21 (Studio workspace cards gelijk aan Workspaces)

- Findings: De Studio-pagina gebruikte een dropdown voor workspace-selectie, terwijl de Workspaces-pagina werkt met folder-cards (gradient + collage), waardoor look-and-feel en interactie niet consistent waren.
- Conclusions: Studio moet dezelfde workspace card-ervaring gebruiken als Workspaces, inclusief kaartselectie, actieve state en dezelfde create-workspace flow.
- Actions:
  - Updated `src/app/page.tsx` — dropdown vervangen door workspace folder cards met dezelfde gradient/collage styling en klik-selectie als op de Workspaces-pagina
  - Updated `src/app/page.tsx` — create-workspace controls in Studio gelijkgetrokken met de Workspaces implementatie (`+ Create Workspace`, Add/Cancel flow)
  - Updated `src/app/page.tsx` — `No workspace` card toegevoegd om selectie expliciet te resetten en alleen recent tracks te tonen
  - Updated `sonara-user.md` — Workspace-sectie geactualiseerd en versiestempel bijgewerkt
  - Validated with `npm run build`.

## 2026-05-23 za 00:27 (PoYo WAV per variant)

- Findings: PoYo retourneert volgens de docs een enkele generation `task_id` met meerdere `files[]`, ieder met een eigen `audio_id`; Sonara gaf variant 2 intern een synthetische `jobId` (`taskId:v2`) en gebruikte die vervolgens voor `convert-to-wav`, waardoor alleen variant 1 een geldige WAV-conversie kreeg.
- Conclusions: WAV-conversies moeten altijd de originele PoYo generation task-id gebruiken en alleen per variant verschillen via `audio_id`; fallback-polling moet dezelfde normalisatie gebruiken zodat gemiste webhooks geen WAV-aanvraag overslaan.
- Actions:
  - Updated `src/app/api/generate/route.ts` — tweede PoYo-reservetrack blijft `generating` met synthetische lokale variant-id in plaats van direct `failed`
  - Updated `src/lib/request-wav-conversion.ts` — lokale `:vN` suffix wordt verwijderd voordat PoYo `convert-to-wav` wordt aangeroepen; helper toegevoegd om ontbrekende WAV-jobs idempotent aan te vragen en op te slaan
  - Updated `src/lib/providers/poyo.ts` en `src/lib/poyo-sync.ts` — `audio_id` wordt meegenomen in variantextractie en opgeslagen op de juiste track
  - Updated `src/app/api/webhooks/poyo/route.ts`, `src/app/api/tracks/route.ts` en `src/app/api/tracks/[id]/route.ts` — webhook en fallback-polling vragen WAV-conversie per gesyncte variant aan met de originele task-id
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 00:27`
  - Updated `sonara-user.md` — user guide versie ververst naar `za 00:27` en PoYo HD/WAV per variant verduidelijkt
  - Validated with `npm run build`.
