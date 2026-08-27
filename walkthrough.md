# MelodIQ — Walkthrough

## 2026-08-14 vr (Lyrics pagina: bottom-actions vereenvoudigd + Translate in rechterkolom)

- Findings: De bottom bar van de Lyrics pagina had Copy- en Translate-knoppen naast de taal-select; "Use in Studio" navigeerde naar "/" (redirect naar /discover, dus nooit naar de studio). De rechterkolom (alle lyrics) had alleen een Copy-knop.
- Conclusions: Vereenvoudig de bottom bar tot taal-select + navigatieknoppen, en verplaats de vertaalactie naar de rechterkolom naast Copy.
- Actions:
  - Modified `src/components/lyrics-studio/LyricsBottomActions.tsx` — Translate- en Copy-knoppen verwijderd; "Use in Studio" → "Go to Music" (naar /studio), nieuwe "Go to Melody" (naar /melody); overbodige props verwijderd
  - Modified `src/app/lyrics-studio/page.tsx` — `useInStudio` schrijft nu `lyrics-studio-payload` naar sessionStorage en pusht naar `/studio`; nieuwe `goToMelody()` naar `/melody`; Translate-knop naast Copy toegevoegd in de rechterkolom (gebruikt `translateAllLyrics`)
  - Validated with `npm run build` — ✅ succesvol

## 2026-08-14 vr (Line editor: artistieke expressie boven spelling/grammatica)

- Findings: De line-editor (ai-edit) kon door de algemene "choose the less obvious expression"-richtlijn in conflict komen met spelling-/grammaticacorrecties; risico was dat bewuste artistieke keuzes (dialect, slang, stijl) werden genormaliseerd.
- Conclusions: Maak expliciet dat artistieke expressie altijd boven spelling/grammatica gaat en alleen duidelijke, onbedoelde fouten gecorrigeerd mogen worden.
- Actions:
  - Modified `src/app/api/timecoded-editor/ai-edit/route.ts` — "ARTISTIC EXPRESSION TAKES PRECEDENCE"-regel toegevoegd aan basis-prompt; spelling- en grammatica-instructies verduidelijkt (alleen onbedoelde fouten, bewuste stijl intact)
  - Validated with `npm run build` — ✅ succesvol

## 2026-08-14 vr (Algemeen songwriting-kader toegevoegd aan alle lyric-prompts)

- Findings: Het algemene schrijf-kader ("write with the sensibility of an experienced songwriter...") zat alleen in de generate-block system prompt, niet in LyricIQ of de timecoded-editor.
- Conclusions: Voeg dezelfde richtlijn als algemeen kader toe aan alle LLM-endpoints die lyrics genereren/bewerken, zodat de stijl consistent is.
- Actions:
  - Modified `src/app/api/lyric-studio/generate-block/route.ts` — richtlijn toegevoegd aan system prompt (tussen syllable-flow en literalness-instructie)
  - Modified `src/app/api/lyric-studio/lyric-iq/route.ts` — zelfde richtlijn na de "lived-in" regels, vóór de Section Awareness
  - Modified `src/app/api/timecoded-editor/ai-edit/route.ts` — compacte versie toegevoegd aan het basis-systeemprompt van de line-editor
  - Validated with `npm run build` — ✅ succesvol (éénmalige EPERM bestandslot op `.next/standalone/.git` opgelost door cache te verwijderen)

## 2026-08-14 vr (Lyric Studio: "Lyrics generator" toont echte modelnaam)

- Findings: De display toonde "Standaard (uit Instellingen)" in plaats van de naam van het actieve LLM. De default-modelresolutie gebeurt server-side (`OPENROUTER_LYRICS_MODEL` → `OPENROUTER_MODEL` → env → fallback) en was client-side niet bekend. Daarnaast laadden modellen pas na een handmatige klik, dus er was nooit een naam beschikbaar.
- Conclusions: Laat de models-API het effectieve default-model meeleveren en autoload de modellen bij mount, zodat de display direct de juiste modelnaam toont.
- Actions:
  - Modified `src/app/api/lyric-studio/models/route.ts` — respons uitgebreid met `defaultModel` (id + naam), resolved via dezelfde fallback-keten als in `lib/providers/llm.ts`
  - Modified `src/components/lyrics-studio/LyricsControlPanel.tsx` — `selectedModelName` toont nu de naam van het gekozen model (of het `defaultModel`); `loadModelOptions()` wordt bij mount automatisch aangeroepen
  - Validated with `npm run build` — ✅ succesvol

## 2026-08-14 vr (Lyric Studio: huidig LLM model zichtbaar boven Geavanceerde instellingen)

- Findings: De modelpicker zat in de standaard ingeklapte "Geavanceerde instellingen" sectie, waardoor gebruikers niet zagen welk LLM actief is zonder de sectie open te klappen.
- Conclusions: Houd de modelpicker in de collapsible (waar hij ook gewijzigd wordt), maar toon daar altijd boven — in de vorm "Lyrics generator: <model>" — het actief ingestelde model.
- Actions:
  - Modified `src/components/lyrics-studio/LyricsControlPanel.tsx` — `selectedModelName` afgeleid uit `modelOptions` + `llmModel` (valt terug op "Standaard (uit Instellingen)"); display-regel boven de "Geavanceerde instellingen" toggle; `LyricStudioModelPicker` teruggezet in de collapsible sectie
  - Validated with `npm run build` — ✅ succesvol

## 2026-08-10 ma 18:26 (Docker build type-fout TrackVisual)

- Findings: Tijdens Docker-build faalde `npm run build` met TS2322 op `player-window/page.tsx:183` — `track?.publishDate` (string | null | undefined) kon niet worden toegewezen aan `TrackVisual.publishDate: string | undefined`. Dezelfde constructie zat ook in `FullscreenPlayer.tsx:253`.
- Conclusions: Met `?? undefined` wordt `null` netjes omgezet naar `undefined` zonder de runtime-semantiek te veranderen. Daarmee matcht het type TrackVisual en kan Next.js de type-check voltooien.
- Actions:
  - Modified `src/app/player-window/page.tsx` — `publishDate/writerName/composerName` omgezet naar `track?.X ?? undefined` (regel 183-185)
  - Modified `src/components/player/FullscreenPlayer.tsx` — zelfde aanpassing voor `currentTrack?.X ?? undefined` (regel 253-255)
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608101826`
  - Validated via Docker-build op de server (lokale `npm run build` niet mogelijk omdat dependencies niet lokaal geinstalleerd zijn)

## 2026-08-04 di 19:04 (Style Suggestion: 500 tekens limiet verwijderd)

- Findings: De style suggestion werd afgekapt op 500 tekens. De hard limit in zowel het LLM prompt als de sanitize function zorgde voor onvolledige antwoorden.
- Conclusions: Verwijder de character limit zodat het volledige antwoord van de LLM wordt weergegeven. De LLM wordt nog steeds gevraagd om compact en productiegericht te schrijven.
- Actions:
  - Modified `src/lib/lyrics-style-suggestion.ts` — "Hard limit: maximum 500 characters" verwijderd uit system prompt (regel 15); `slice(0, 500)` truncatie verwijderd uit `sanitizeStyleSuggestionResponse` (regel 49)
  - Validated with `npm run build` — ✅ succesvol

## 2026-08-04 di 18:39 (Lyric Studio: huidig LLM model tonen in geavanceerde instellingen)

- Findings: In de geavanceerde instellingen van de Lyric Studio werd het huidige gekozen LLM model niet weergegeven. Gebruikers wisten niet welk model er actief was zonder op de dropdown te klikken.
- Conclusions: Voeg een label toe dat het huidige model toont in het formaat "LLM model — <model naam>" boven de "Modellen ophalen" knop. Dit geeft direct inzicht in de actieve configuratie.
- Actions:
  - Modified `src/components/lyrics-studio/LyricStudioModelPicker.tsx` — label aangepast van "LLM model" naar "LLM model — {selected.name}" (regel 95-97)
  - Validated with `npm run build` — ✅ succesvol

## 2026-06-02 ma 11:25 (page.tsx refactored — 1332 → 180 regels)

- Findings: `src/app/page.tsx` was 1332 regels en 60 KB en bevatte alles: SWR data fetching, track state management, workspace logica, AI generatie en alle JSX. Dit maakten de file moeilijk te onderhouden en te begrijpen.
- Conclusions: Extraheer logica naar custom hooks en JSX naar sub-componenten, zodat page.tsx een dunne orkestratie-laag wordt van ~180 regels.
- Actions:
  - Created `src/hooks/useTrackManager.ts` — SWR fetching, chunked rendering, auto-polling, `handleDeleteTrack`, `handleTitleUpdate`
  - Created `src/hooks/useStudioActions.ts` — `handleGenerate`, `handleOptimize`, `handleGenerateLyrics`, `handleGenerateTitle`, `handleReusePrompt`, `generating` en `notice` state
  - Created `src/hooks/useWorkspaceView.ts` — studioTab, grid/list view mode, workspaceGridSize, create workspace/folder dialogs, afgeleide workspace data
  - Created `src/hooks/useTrackPlayer.ts` — credits SWR, `selectedTrack`, `handleSelectTrack`, `handlePlayTrack`, `handleDownloadTrack`, `handleAddToQueue`, `handleAddToPlaylist`, `handleMoveTrackToWorkspace`
  - Created `src/components/studio/StudioTabBar.tsx` — stateless segmented tab-balk (Workspaces / Recent Tracks)
  - Created `src/components/studio/WorkspacePanel.tsx` — volledig workspace-paneel: header met view-toggles, grid/list workspace-kaarten, subfolder-listing en ingesloten TrackList
  - Created `src/components/studio/RecentTracksPanel.tsx` — dunne wrapper rond TrackList voor de "Recent Tracks" tab
  - Rewrote `src/app/page.tsx` — van 1332 naar ~180 regels; puur orkestratie
  - Validated with `npm run build` — ✅ 0 TypeScript errors, 39 pagina's gegenereerd

## 2026-05-27 wo 02:31 (Lyric Studio drag kan nu meerdere posities overslaan)

- Findings: De Lyric Studio drop-target berekening voelde nog te lokaal aan, waardoor het verplaatsen over grotere afstanden niet altijd betrouwbaar was wanneer je door lege ruimte tussen blokken slepte.
- Conclusions: De target moet op basis van de verticale positie over alle blokken worden bepaald, zodat je een block ook in één keer verderop kunt neerzetten.
- Actions:
  - Updated `src/lib/hooks/useLyricBlockDrag.ts` — drop-target selectie gebruikt nu een verticale insertion scan over alle blokken, inclusief lege ruimte tussen items
  - Validated with `npm run build`.

## 2026-05-27 wo 02:31 (Lyric Studio drag werkt nu ook met muis)

- Findings: De bestaande Lyric Studio reorder-flow werkte niet betrouwbaar met de muis; touch-pointer support was aanwezig, maar desktop users konden de blokvolgorde niet consistent verslepen.
- Conclusions: Voeg een native mouse drag-and-drop pad toe naast de pointer-based touch flow, zodat desktop mouse dragging en mobiele touch dragging allebei expliciet ondersteund worden.
- Actions:
  - Updated `src/lib/hooks/useLyricBlockDrag.ts` — added native mouse drag handling and a shared finalize path for pointer and mouse reorder events
  - Updated `src/components/lyrics-studio/LyricBlockEditor.tsx` — lyric block cards and drag handles now emit HTML drag events for mouse users
  - Updated `src/app/lyrics-studio/page.tsx` — wired the new mouse drag handlers into the page component
  - Validated with `npm run build`.

## 2026-05-27 do 16:55 (Drag-and-drop play order op track listings)

- Findings: Buiten de Recent Tracks-weergave was er geen directe manier om de afspeelvolgorde in tracklijsten handmatig te bepalen; de volgorde hing alleen af van sortering.
- Conclusions: Voeg drag-and-drop reordering toe in de gedeelde `TrackList` zodat dezelfde interactie werkt in Library, Workspaces en Workspace Tracks, en sluit `Recent Tracks` expliciet uit.
- Actions:
  - Updated `src/components/TrackList.tsx` — added optionele `enableDragReorder` prop (default `true`) met drag state, drop handling en handmatige lijstvolgorde die gebruikt wordt voor play context
  - Updated `src/app/page.tsx` — `Recent Tracks` `TrackList` call now sets `enableDragReorder={false}`
  - Updated `melodiq-user.md` — gebruikersdocumentatie aangevuld met drag-and-drop play-order gedrag en de uitzondering voor Recent Tracks
  - Validated with `npm run build`.

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

- Findings: Purple (#8b5cf6) had leaked into focus rings, range slider thumb, aurora background, and VOCAL badge — conflicting with MelodIQ's orange (#ff530c) brand identity.
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
  - Updated `melodiq-user.md` — secties geactualiseerd met nieuwe locatie van Provider en Language + versie bump

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
  - Updated `src/app/page.tsx` — added persistente workspace grid setting met localStorage key `melodiq-studio-workspace-grid-size` en selectorchips voor 4/8/12/16
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
  - Updated `melodiq-user.md` — gebruikersdocumentatie uitgebreid met default workspace gedrag
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
  - Updated `melodiq-user.md` — user guide aangevuld met folder-open gedrag en terugnavigatie
  - Validated with `npm run build`.

## 2026-05-23 za 01:03 (Grid selector gedrag + Workspaces pagina playable TrackList)

- Findings: De workspace grid-selector voelde defect omdat de layout visueel op 2 kolommen bleef; daarnaast toonde de Workspaces pagina een losse, niet-standaard trackweergave i.p.v. de normale speelbare TrackList.
- Conclusions: Laat de selector ook de grid-dichtheid sturen (niet alleen max aantal items) en gebruik op de Workspaces pagina dezelfde TrackList-component als elders voor consistente playback/acties.
- Actions:
  - Updated `src/app/page.tsx` — toegevoegd `workspaceGridClass` mapping op basis van selector (4/8/12/16) zodat het aantal grid-kolommen meeschakelt
  - Updated `src/app/page.tsx` — overviewtekst toont nu `Showing X of Y folders` voor directe feedback
  - Updated `src/app/page.tsx` — `No workspace` kaart uit de folders-grid verwijderd om selector-gedrag en foldertellingen eenduidig te houden
  - Updated `src/app/workspaces/page.tsx` — vervangen van custom track tiles door `TrackList` met `autoQueueAfterPlay`, playlist-opties en delete callback
  - Updated `src/app/workspaces/page.tsx` — track type uitgebreid naar volledige velden die `TrackList` gebruikt
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 01:03`
  - Validated with `npm run build`.

## 2026-05-23 za 01:25 (Selector semantiek: max per rij + Add to Workspace fix vanuit Recent Tracks)

- Findings: De 4/8/12/16 selector werd nog als limiet op zichtbare items gebruikt i.p.v. “max folders per rij”; daarnaast gaf Move To Workspace vanuit Recent Tracks geen directe folderfocus waardoor het leek alsof de actie niets deed.
- Conclusions: Selector moet alle folders blijven tonen en alleen de rij-dichtheid sturen; na Move To Workspace vanuit Recent Tracks moet de gekozen workspace direct geselecteerd/opengezet worden voor zichtbare feedback.
- Actions:
  - Updated `src/app/page.tsx` — verwijderd `slice(0, workspaceGridSize)` zodat alle folders zichtbaar blijven
  - Updated `src/app/page.tsx` — selector stuurt nu griddichtheid met expliciete kolomprofielen voor 4/8/12/16 (max per rij)
  - Updated `src/app/page.tsx` — helpertekst aangepast naar `Max {n} folders per row`
  - Updated `src/components/TrackList.tsx` — added optional `onMoveToWorkspace(trackId, workspaceId)` callback
  - Updated `src/components/TrackList.tsx` — callback wordt aangeroepen na `moveTrackToWorkspace(...)`
  - Updated `src/app/page.tsx` — Recent Tracks `TrackList` gebruikt nu `onMoveToWorkspace` en opent direct de gekozen workspace
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 01:25`
  - Validated with `npm run build`.

## 2026-05-23 za 01:37 (Exacte 4/8/12/16 folders per rij)

- Findings: De selector moest exact het aantal folders per rij bepalen; responsive profielen konden op sommige schermen minder kolommen tonen dan geselecteerd.
- Conclusions: Gebruik vaste grid-template kolommen per gekozen waarde (4, 8, 12, 16) zodat de rij altijd exact overeenkomt met de selector.
- Actions:
  - Updated `src/app/page.tsx` — `workspaceGridClass` omgezet naar vaste kolomclasses: `repeat(4|8|12|16, minmax(0, 1fr))`
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 01:37`
  - Validated with `npm run build`.

## 2026-05-23 za 02:01 (Play-icoon loader tijdens trackgeneratie)

- Findings: In de tracklisting bleef tijdens `pending/generating` een generieke waveform zichtbaar in de play-slot, terwijl de gewenste feedback een duidelijke draaiende loader was.
- Conclusions: Gebruik in de play-button placeholder een spinner voor `pending` en `generating`, zodat de status direct herkenbaar is als actief proces.
- Actions:
  - Updated `src/components/TrackList.tsx` — play-button renderlogica aangepast: voor `track.status === "pending" || "generating"` wordt nu een draaiende cirkel (`animate-spin`) getoond
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 02:01`
  - Validated with `npm run build`.

## 2026-05-23 za 02:14 (Move To Workspace verplaatst nu alle geselecteerde tracks)

- Findings: Vanuit Track Actions verplaatste `Move To Workspace` alleen de aangeklikte track, ook wanneer meerdere tracks geselecteerd waren.
- Conclusions: Als de aangeklikte track deel uitmaakt van de actieve selectie, moet de workspace-actie op alle geselecteerde tracks worden toegepast; bestaande toewijzingen mogen stil worden overgeslagen.
- Actions:
  - Updated `src/components/TrackList.tsx` — toegevoegd `handleMoveToWorkspace(sourceTrackId, workspaceId)` op lijstniveau
  - Updated `src/components/TrackList.tsx` — move scope: geselecteerde set als brontrack geselecteerd is, anders alleen brontrack
  - Updated `src/components/TrackList.tsx` — `TrackCard` krijgt nieuwe prop `onMoveTracksToWorkspace` en gebruikt die in zowel bestaande workspace-selectie als `Create New Workspace`
  - Reused bestaande store-logica (`moveTrackToWorkspace`) die duplicates in dezelfde workspace stil overslaat
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 02:14`
  - Validated with `npm run build`.

## 2026-05-23 za 02:37 (Recent Tracks multi-select move stabiliteit)

- Findings: In de Studio Recent Tracks listing kon de actieve selectie bij snelle interacties verouderen (stale state), waardoor `Move To Workspace` niet altijd de volledige multi-selectie meenam.
- Conclusions: Selectiebeheer voor batch-move moet gebaseerd zijn op actuele state via refs + functionele setState updates.
- Actions:
  - Updated `src/components/TrackList.tsx` — toegevoegd `selectedIdsRef` met sync `useEffect` voor actuele selectie tijdens move-acties
  - Updated `src/components/TrackList.tsx` — `toggleSelection` omgezet naar functionele `setSelectedIds(current => ...)`
  - Updated `src/components/TrackList.tsx` — `toggleSelectAll` omgezet naar functionele `setSelectedIds(current => ...)`
  - Updated `src/components/TrackList.tsx` — `handleMoveToWorkspace` gebruikt nu `selectedIdsRef.current` voor betrouwbare batch-scope
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 02:37`
  - Validated with `npm run build`.

## 2026-05-23 za 03:02 (Studio default provider naar PoYo)

- Findings: De Studio state startte standaard op Lyria, terwijl de gewenste default provider PoYo is.
- Conclusions: Zet provider/default model in de Studio store init en reset naar PoYo, zodat nieuwe sessies en reset-flow consistent starten op PoYo.
- Actions:
  - Updated `src/lib/store.ts` — `provider` default gewijzigd van `lyria` naar `poyo`
  - Updated `src/lib/store.ts` — `providerModel` default gewijzigd van `lyria-3` naar `v5.5`
  - Updated `src/lib/store.ts` — `reset()` defaults aangepast naar `provider: "poyo"`, `providerModel: "v5.5"`
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 03:02`
  - Validated with `npm run build`.

## 2026-05-23 za 17:50 (Lyric Studio sidebar copy button)

- Findings: In de inklapbare `Volledige lyrics` sidebar op Lyric Studio ontbrak een directe copy-actie; users moesten naar de onderkant van de pagina voor `Copy all lyrics`.
- Conclusions: Voeg een compacte copy-knop toe in de sidebar-header, gekoppeld aan dezelfde copy-flow als de bestaande globale knop.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — sidebar header omgezet naar row layout met nieuwe `Copy` knop rechts
  - Updated `src/app/lyrics-studio/page.tsx` — knop gebruikt bestaande `copyAllLyrics()` en `copied` feedback (`Copied!`)
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 17:50`
  - Updated `melodiq-user.md` — user guide uitgebreid met nieuwe sidebar copy-knop
  - Validated with `npm run build`.

## 2026-05-23 za 18:31 (Playlist duplicate prompt met Yes/No)

- Findings: Bij “Add to playlist” werd een al bestaande track stil genegeerd; er was geen keuze om bewust een duplicate toe te voegen.
- Conclusions: Voeg een expliciete confirm-popup toe wanneer een track al in de playlist staat: `Song is already on the playlist. Do you want to add it again? Yes / No`.
- Actions:
  - Updated `src/lib/store.ts` — `addTrackToPlaylist` accepteert nu optionele `options.allowDuplicate`
  - Updated `src/lib/store.ts` — standaard gedrag blijft dedupe; bij `allowDuplicate: true` wordt track opnieuw toegevoegd
  - Updated `src/components/TrackList.tsx` — added duplicate-check tegen volledige playlist state en nieuwe confirm modal met `Yes`/`No`
  - Updated `src/components/TrackList.tsx` — bij `Yes` wordt add uitgevoerd met `allowDuplicate: true`; bij `No` wordt actie geannuleerd
  - Updated `src/components/TrackList.tsx` — fallback toegevoegd zodat add-to-playlist ook zonder parent callback de store direct gebruikt
  - Updated `src/app/page.tsx` en `src/app/workspaces/page.tsx` — callback signatures aangepast voor optionele playlist-add options
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 18:31`
  - Validated with `npm run build`.

## 2026-05-23 za 01:54 (Move-to-workspace robuust + workspace-label in tracklisting)

- Findings: Vanuit Recent Tracks werd de doel-workspace wel geopend maar niet altijd zichtbaar toegevoegd; daarnaast ontbrak in de tracklisting context over in welke workspace een track staat.
- Conclusions: Borg assignment in de parent callback (toevoegen + openen), maak move idempotent (track al aanwezig stil overslaan) en toon workspace-label direct in elke trackrij.
- Actions:
  - Updated `src/app/page.tsx` — `handleMoveTrackToWorkspace(trackId, workspaceId)` voert nu zowel `moveTrackToWorkspace(...)` als `setSelectedWorkspaceId(...)` uit
  - Updated `src/lib/store.ts` — `moveTrackToWorkspace` doet nu een stille no-op wanneer de track al in de doel-workspace zit
  - Updated `src/components/TrackList.tsx` — added workspace badge per track op basis van huidige store-assignments
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 01:54`
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
- Actions: Added REGISTRATION_ENABLED gate to src/app/api/auth/register/route.ts. Fixed catch block to use console.error and return generic message. Created src/app/api/webhooks/minimax/route.ts (task_id, status: finished, files[].audio_url, provider: "minimax"). Removed MiniMax open issue from melodiq-rules.md. Validated with npm run build.

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
- Findings: MelodIQ had geen Progressive Web App functionaliteit — geen installeerbaar maken, geen offline ondersteuning, geen app manifest.
- Conclusions: PWA-ondersteuning met next-pwa zorgt voor installable web app ervaring met service worker en manifest. Next.js 16 vereist Turbopack-compatibiliteit en correcte TypeScript manifest types. Icons placeholder met README voor toekomstige generatie.
- Actions: Geïnstalleerd next-pwa dependency. Gemaakt src/app/manifest.ts met MelodIQ manifest config (name, icons, theme colors, standalone mode). Updated next.config.mjs — wrapped config met withPWA (dest: public, disable in dev, register: true), toegevoegd turbopack: {} voor compatibiliteit. Updated src/app/layout.tsx — toegevoegd PWA meta tags (theme-color, apple-mobile-web-app-capable, status-bar-style). Gemaakt public/icons/ folder met README.icons.md voor placeholder icons instructies (192×192 en 512×512 PNG, muzieknoot SVG basis). Updated .gitignore — excluded PWA-gegenereerde bestanden (sw.js, workbox-*.js, worker-*.js plus maps). Fixed manifest purpose type ("maskable" in plaats van "any maskable" voor TypeScript). Validated met npm run build — manifest route beschikbaar op /manifest.webmanifest; validated.

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
- Actions: Updated src/app/lyrics-studio/page.tsx met metadataformulier, bestaande structure dropdown, block presets, add-block controls, block cards met generate/copy/use-in-studio acties en lokale LyricBlock state. Added src/app/api/lyric-studio/generate-block/route.ts met requireAuth(), centrale callLLM() en logApi(). Updated src/lib/providers/llm.ts om callLLM te exporteren. Updated src/components/Sidebar.tsx versie naar do 02:05. Updated melodiq-user.md met Lyric Studio uitleg. Validated met npm run build; validated.

## 2026-05-21 (Split prompt and lyrics LLM routing)

- Findings: Settings gebruikte een gecombineerd Lyrics & Prompt model, en /api/llm had nog lokale LLM/logging-logica waardoor prompt- en lyric-generatie niet apart routeerbaar waren.
- Conclusions: Prompt-optimalisatie en lyric-generatie hebben aparte provider/model-keuzes nodig. Centrale callLLM() moet daarom purpose-aware zijn, zodat Studio lyrics en Lyric Studio blocks dezelfde lyrics provider gebruiken.
- Actions: Updated src/app/settings/page.tsx met LLM Routing, aparte Prompt/Lyrics providers, aparte OpenRouter prompt/lyrics model selectors en aparte OpenAI prompt/lyrics model fields. Updated src/lib/providers/llm.ts met purpose-based provider/model selectie via PROMPT_LLM_PROVIDER, LYRICS_LLM_PROVIDER, OPENROUTER_PROMPT_MODEL, OPENROUTER_LYRICS_MODEL, OPENAI_PROMPT_MODEL en OPENAI_LYRICS_MODEL. Rebuilt src/app/api/llm/route.ts op centrale callLLM() en logApi(). Updated src/app/api/lyric-studio/generate-block/route.ts om de lyrics provider te gebruiken. Updated src/components/Sidebar.tsx versie naar do 02:12 en melodiq-user.md Settings uitleg. Validated met npm run build; validated.

## 2026-05-21 (Lyric Studio presets and complete song generation)

- Findings: De Simple preset was dubbel met Pop en Lyric Studio miste snelle block-duplicatie en een manier om direct alle secties van een songstructuur te vullen.
- Conclusions: Presets moeten scherper aansluiten op pop, AABA en dance/EDM flows; complete-song generatie kan veilig sequentieel per block lopen zodat eerdere blocks context geven aan latere blocks.
- Actions: Updated src/app/lyrics-studio/page.tsx met nieuwe BLOCK_PRESETS, EDM/Dance labelmapping (Drop, Breakdown, Build-up), duplicateBlock(), duplicate button per block, preset/structure parsing en Generate complete song button in de Song Structure card. Updated src/components/Sidebar.tsx versie naar do 02:19 en melodiq-user.md Lyric Studio uitleg. Validated met npm run build; validated.

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
  - Updated `melodiq-user.md` — wording aangepast naar Studio Create page + Library page via sidebar
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-05:34`

## 2026-05-21 do 05:41 (Library playlists als gallery view)

- Findings: In Library bestond alleen een songlist met playlist-filters; er was geen visuele playlist-overview zoals een galerij.
- Conclusions: Voeg een aparte Playlists-view toe met cards en cover-collage op basis van cover art van tracks in de playlist.
- Actions:
  - Updated `src/app/library/page.tsx` — added `Songs`/`Playlists` view switch in Library header
  - Updated `src/app/library/page.tsx` — added playlist gallery grid with create-card and playlist cards
  - Updated `src/app/library/page.tsx` — playlist card cover now uses up to 4 song cover images from that playlist (collage), fallback placeholder when empty
  - Updated `src/app/library/page.tsx` — clicking playlist card sets active playlist and switches to Songs view
  - Updated `melodiq-user.md` — added Library Views section
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
  - Updated `melodiq-user.md` — version updated to `do 11:14`
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
  - Updated `melodiq-user.md` — version updated to `do 11:39`
  - Validated with `npm run build`.

## 2026-05-21 do 11:43 (Sidebar credits/logout boven player)

- Findings: In desktop sidebar konden het creditsblok en de logout-link visueel achter de fixed player vallen omdat de sidebar tot onderaan viewport doorliep.
- Conclusions: Laat de sidebar eindigen op de player-top door de fixed bottom-offset gelijk te maken aan `--player-height`.
- Actions:
  - Updated `src/components/Sidebar.tsx` — desktop sidebar changed from `bottom-0` to `bottom-[var(--player-height)]`
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-11:43`
  - Updated `melodiq-user.md` — version updated to `do 11:43`
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
  - Updated `melodiq-user.md` — version updated to `do 12:16` and Lyric Studio docs include repetitive chorus option
  - Validated with `npm run build`.

## 2026-05-21 do 12:18 (Lyric Studio stop generating button)

- Findings: Tijdens `Generate complete song` bestond er geen manier om een lopende AI-lyrics run te stoppen; gebruikers moesten wachten tot alle blokken klaar waren.
- Conclusions: Voeg een expliciete stopactie toe die de lopende request abort, de generatie-loop breekt en resterende blokken direct uit loading haalt.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — added `Stop generating` button shown while full-song generation is active
  - Updated `src/app/lyrics-studio/page.tsx` — added `AbortController` + stop refs (`songGenerationAbortRef`, `stopSongGenerationRef`) and wired cancellation into block generation loop
  - Updated `src/app/lyrics-studio/page.tsx` — `requestBlockLyrics` now accepts `AbortSignal` for cancellable fetch calls
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-12:18`
  - Updated `melodiq-user.md` — version updated to `do 12:18` and Lyric Studio section mentions stop action
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
  - Updated `melodiq-user.md` — version updated to `do 15:34` and Lyric Studio docs mention both sliders
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
  - Updated `melodiq-user.md` — version updated to `do 16:07` and Lyric Studio docs now include snapshot and unique chorus override usage
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
  - Updated `melodiq-user.md` — version updated to `do 17:53` and added Logs section behavior
  - Validated with `npm run build`.

## 2026-05-21 do 18:00 (Lyrics generator: alleen section-tagged output)

- Findings: De algemene Generate Lyrics output kon soms extra tekst bevatten buiten de lyrics-body.
- Conclusions: Versterk de LLM system-instructies zodat output strikt alleen uit section tags en lyricregels bestaat.
- Actions:
  - Updated `src/app/api/llm/route.ts` — tightened `type === "lyrics"` system prompt to require plain section tags (`[Verse]`, `[Chorus]`, `[Bridge]`) and forbid intro/outro text, commentary, numbering, markdown, quotes, or notes
  - Updated `src/app/api/llm/route.ts` — added explicit rule: return exactly lyrics content with section tags, nothing else
  - Updated `src/components/Sidebar.tsx` — version number updated to `0.do-18:00`
  - Updated `melodiq-user.md` — version updated to `do 18:00` and documented strict generated-lyrics output format
  - Validated with `npm run build`.

## 2026-05-22 vr 21:48 (MusicGPT lyrics max 3000 blokkeren met popup)

- Findings: Bij MusicGPT kon een te lange lyrics-invoer alsnog de generate-flow starten, terwijl de provider een striktere limiet heeft.
- Conclusions: Voeg een vroege client-check toe met een zichtbare notificatie, en een server-side guard in de generate API zodat ook directe API-calls correct worden geblokkeerd.
- Actions:
  - Updated `src/app/page.tsx` — added preflight check in `handleGenerate()` that blocks MusicGPT generation when lyrics exceed 3000 chars and shows an error popup via `setNotice(...)`
  - Updated `src/app/api/generate/route.ts` — added provider-specific validation returning `400` when `provider === "musicgpt"` and lyrics exceed 3000 chars
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 21:48`
  - Updated `melodiq-user.md` — user guide versie ververst naar `vr 21:48` en MusicGPT 3000-char limiet gedocumenteerd
  - Validated with `npm run build`.

## 2026-05-22 vr 22:03 (Lyric Studio in-app dialogs + player persistent tussen pagina's)

- Findings: Lyric Studio gebruikte nog browser-popups (`window.confirm`/`window.prompt`) voor belangrijke acties, en playback kon stoppen bij navigatie naar andere routes zoals Lyric Studio.
- Conclusions: Vervang alle default browser-popups met in-app confirm/save dialogs en notices; maak de player-audio route-onafhankelijk met een gedeeld audio-element zodat afspelen doorloopt bij routewissels.
- Actions:
  - Updated `src/app/lyrics-studio/page.tsx` — replaced browser popups with in-app dialogs for preset replace, studio replace, clear-all, and snapshot naming
  - Updated `src/app/lyrics-studio/page.tsx` — added in-app notice banners for generation/copy/style errors and save/clear feedback
  - Updated `src/components/Player.tsx` — introduced module-level shared audio element to keep playback alive across component remounts during navigation
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 22:03`
  - Updated `melodiq-user.md` — user guide versie ververst naar `vr 22:03` met uitleg over in-app dialogs en persistente playback
  - Validated with `npm run build`.

## 2026-05-22 vr 22:39 (MusicGPT webhook verwerkt MusicAI conversion_path)

- Findings: De MusicGPT `MusicAI` webhook-docs tonen audio-callbacks met `success: true`, `conversion_id` en `conversion_path`, terwijl de generieke webhook-doc ook `status: "COMPLETED"` noemt. MelodIQ verwerkte alleen exact `COMPLETED`, waardoor geldige MusicGPT audio-webhooks zonder `status` als wachtend konden blijven staan.
- Conclusions: Behandel een payload met audio-URL (`audio_url` of `conversion_path`) als voltooid zolang MusicGPT niet expliciet een failure meldt, en houd `conversion_id` matching leidend voor de twee trackvarianten.
- Actions:
  - Updated `src/app/api/webhooks/musicgpt/route.ts` — added typed payload parsing, header-or-query secret support, non-audio callback skipping, and completion detection based on actual audio URL instead of only `status === "COMPLETED"`
  - Updated `src/lib/settings.ts` — webhook URL secret appending now uses URL query params safely and falls back to `NEXT_PUBLIC_APP_URL` when deriving webhook URLs from app config
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 22:39`
  - Updated `melodiq-user.md` — user guide versie ververst naar `vr 22:39` en MusicGPT als webhook-provider verduidelijkt
  - Validated with `npm run build`.

## 2026-05-22 vr 22:50 (Studio tracks kolom gesplitst: workspace + recent)

- Findings: In Studio stond rechts alleen één lange `Recent Tracks` lijst, waardoor workspace-context ontbrak en navigatie tussen workspace en globale tracks onduidelijk bleef.
- Conclusions: Splits de rechterkolom in twee gelijke blokken met eigen scroll: boven de geselecteerde workspace-tracks met breadcrumb, onder de volledige recente tracks.
- Actions:
  - Updated `src/app/page.tsx` — imported `useWorkspaceStore` and wired `selectedWorkspaceId`, selected workspace lookup, and workspace track filtering
  - Updated `src/app/page.tsx` — replaced single right-column list with two half-height cards: top `Workspace Tracks` block with breadcrumb (`Workspaces / {workspace}`), bottom `Recent Tracks` block
  - Updated `src/app/page.tsx` — each block now has independent `overflow-y-auto` for easier browsing in long lists
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 22:50`
  - Updated `melodiq-user.md` — user guide versie ververst naar `vr 22:50` en Studio split-column gedrag gedocumenteerd
  - Validated with `npm run build`.

## 2026-05-22 vr 23:31 (Track sorting in alle tracklijsten)

- Findings: Tracklijsten hadden geen expliciete sorteeroptie, waardoor gebruikers niet snel konden wisselen tussen nieuwste en oudste items.
- Conclusions: Voeg sortering centraal toe in `TrackList`, zodat Studio (workspace + recent) en Library automatisch dezelfde sort-controls krijgen.
- Actions:
  - Updated `src/components/TrackList.tsx` — added sort control with `New to old` and `Old to new`
  - Updated `src/components/TrackList.tsx` — introduced sorted `displayedTracks` (by `createdAt`) for rendering and selection counts
  - Updated `src/components/TrackList.tsx` — autoplay play-context now follows the active list sorting order
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `vr 23:31`
  - Updated `melodiq-user.md` — user guide versie ververst naar `vr 23:31` en sorteeropties gedocumenteerd
  - Validated with `npm run build`.

## 2026-05-23 za 00:21 (Studio workspace cards gelijk aan Workspaces)

- Findings: De Studio-pagina gebruikte een dropdown voor workspace-selectie, terwijl de Workspaces-pagina werkt met folder-cards (gradient + collage), waardoor look-and-feel en interactie niet consistent waren.
- Conclusions: Studio moet dezelfde workspace card-ervaring gebruiken als Workspaces, inclusief kaartselectie, actieve state en dezelfde create-workspace flow.
- Actions:
  - Updated `src/app/page.tsx` — dropdown vervangen door workspace folder cards met dezelfde gradient/collage styling en klik-selectie als op de Workspaces-pagina
  - Updated `src/app/page.tsx` — create-workspace controls in Studio gelijkgetrokken met de Workspaces implementatie (`+ Create Workspace`, Add/Cancel flow)
  - Updated `src/app/page.tsx` — `No workspace` card toegevoegd om selectie expliciet te resetten en alleen recent tracks te tonen
  - Updated `melodiq-user.md` — Workspace-sectie geactualiseerd en versiestempel bijgewerkt
  - Validated with `npm run build`.

## 2026-05-23 za 00:27 (PoYo WAV per variant)

- Findings: PoYo retourneert volgens de docs een enkele generation `task_id` met meerdere `files[]`, ieder met een eigen `audio_id`; MelodIQ gaf variant 2 intern een synthetische `jobId` (`taskId:v2`) en gebruikte die vervolgens voor `convert-to-wav`, waardoor alleen variant 1 een geldige WAV-conversie kreeg.
- Conclusions: WAV-conversies moeten altijd de originele PoYo generation task-id gebruiken en alleen per variant verschillen via `audio_id`; fallback-polling moet dezelfde normalisatie gebruiken zodat gemiste webhooks geen WAV-aanvraag overslaan.
- Actions:
  - Updated `src/app/api/generate/route.ts` — tweede PoYo-reservetrack blijft `generating` met synthetische lokale variant-id in plaats van direct `failed`
  - Updated `src/lib/request-wav-conversion.ts` — lokale `:vN` suffix wordt verwijderd voordat PoYo `convert-to-wav` wordt aangeroepen; helper toegevoegd om ontbrekende WAV-jobs idempotent aan te vragen en op te slaan
  - Updated `src/lib/providers/poyo.ts` en `src/lib/poyo-sync.ts` — `audio_id` wordt meegenomen in variantextractie en opgeslagen op de juiste track
  - Updated `src/app/api/webhooks/poyo/route.ts`, `src/app/api/tracks/route.ts` en `src/app/api/tracks/[id]/route.ts` — webhook en fallback-polling vragen WAV-conversie per gesyncte variant aan met de originele task-id
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 00:27`
  - Updated `melodiq-user.md` — user guide versie ververst naar `za 00:27` en PoYo HD/WAV per variant verduidelijkt
  - Validated with `npm run build`.

## 2026-05-23 za 21:34 (Zoekbalken in alle tracklistings)

- Findings: Tracklijsten hadden al sortering, maar geen snelle tekstzoekfunctie; hierdoor werd het lastig om specifieke songs te vinden in lange lijsten op Studio, Library en Workspaces.
- Conclusions: Omdat alle listings dezelfde `TrackList`-component gebruiken, is een centrale zoekbalk in die component de meest consistente aanpak zonder duplicatie.
- Actions:
  - Updated `src/components/TrackList.tsx` — zoekveld toegevoegd in de list-controls met live filtering op titel, prompt, provider, model en lyrics
  - Updated `src/components/TrackList.tsx` — selectie-logica verbeterd voor gefilterde resultaten (select all werkt nu op zichtbare items)
  - Updated `src/components/TrackList.tsx` — empty-state boodschap uitgebreid met “No tracks match your search” bij geen zoekmatches
  - Updated `src/components/Sidebar.tsx` — build version tekst ververst naar `za 21:34`
  - Updated `melodiq-user.md` — user guide versie ververst naar `za 21:34` en tracklist-zoekfunctie gedocumenteerd
  - Validated with `npm run build`.

## 2026-05-31 zo 06:49 (PoYo WAV S3 SSL bypass en Mureka BGM webhook status fix)

- Findings: 
  - PoYo WAV-downloads verschenen niet na "Dance It Away" op desktop doordat de achtergrond S3-upload faalde op SSL certificate verification (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) voor `s3.danubedata.ro`.
  - Mureka BGM (instrumental) tracks bleven oneindig op "generating" staan in de UI na succesvolle generatie, omdat de Mureka webhook-parser alleen arrays ondersteunde en faalde op de single-object output structuur van `generate-bgm`.
- Conclusions: 
  - S3 uploads moeten TLS/SSL errors bypassen (`rejectUnauthorized: false`), en er moet een makkelijke herstelknop in Settings komen om ontbrekende WAV-bestanden opnieuw te triggeren.
  - De Mureka webhook-parser moet uiterst robuust zijn en alle mogelijke output-varianten (single object, array, geneste data) en task ID parameters correct parsen.
- Actions:
  - Updated `src/lib/s3.ts` — ingesteld met `rejectUnauthorized: false` in NodeHttpHandler HTTPS agent om SSL intermediate validation errors te negeren.
  - Created `src/components/settings/WavRecoverySection.tsx` — een premium UI-panel in Settings waarmee de gebruiker met één klik `/api/tracks/retry-wav` kan aanroepen en mislukte WAV-bestanden kan herstellen.
  - Updated `src/app/settings/page.tsx` — `WavRecoverySection` geïmporteerd en gerenderd naast MusicGPT recovery.
  - Updated `src/app/api/webhooks/mureka/route.ts` — `extractOutputs` helper toegevoegd om robuust audio-URLs te parsen (arrays, strings, objects). Tevens robuuste `requestId` extractie toegevoegd om alle Mureka status-updates correct te synchroniseren.
  - Validated with `npx tsc --noEmit` which completed successfully with **0 compilation errors**.
  - Pushed all changes successfully to `main` branch on GitHub.

## 2026-05-31 zo 07:40 (Studio Page Track Title Edit Slowdown Fix)

- Findings: Het aanpassen van een tracktitel op de Studio-pagina veroorzaakte een ernstige vertraging/bevriezing van de computer. Dit kwam doordat SWR de `/api/tracks` cache niet automatisch synchroniseerde bij een lokale titelwijziging, waardoor de SWR-herauthenticatie naderhand een volledige, synchrone herberekening en re-render van de gehele tracklijst (die wel 1000+ nummers kan bevatten) forceerde.
- Conclusions: We moeten de SWR-cache van SWR direct optimistisch en in-memory muteren bij een titelwijziging middels `mutateTracksResponse` met `{ revalidate: false }`. Dit zorgt voor een instant update zonder dat er een zware netwerkrefetch of dubbele synchrone render van de gehele component-boom wordt getriggerd.
- Actions:
  - Updated `src/app/page.tsx` — `handleTitleUpdate` geoptimaliseerd met een optimistische `mutateTracksResponse` cache-update met `{ revalidate: false }` om direct de SWR-status te synchroniseren zonder vertraging.
  - Validated with `npx tsc --noEmit` which completed successfully with **0 compilation errors**.
  - Pushed all changes successfully to `main` branch on GitHub.

## 2026-05-31 zo 07:46 (Studio Page Track Title Edit Rendering Path Optimization)

- Findings: Despite the SWR optimistic update, editing or saving a track title on the Studio page still caused browser lag when the track list was extremely large (1000+ tracks). This was caused by three issues:
  1. The `allTracks` prop was passed to all `TrackCard`s, changing its reference and forcing all cards to re-render.
  2. Inside every `TrackCard`'s render body, a heavy $O(N)$ workspace cover mapping calculation (`workspaceCoverById`) was performed on every render.
  3. Unstable callbacks (`onPlay` and selection) were recreated on every render of `TrackList` due to dependencies on the transient `displayedTracks` reference.
- Conclusions: We must stabilize all callbacks and completely remove the transient `allTracks` prop from `TrackCard` to let `React.memo` successfully skip unchanged cards. Furthermore, the `workspaceCoverById` Map should be calculated exactly once in `TrackList` with a stable cover key (`tracks.map((t) => `${t.id}:${t.coverUrl ?? ""}`).join("|")`) that doesn't change on title updates, making its reference 100% stable.
- Actions:
  - Updated `src/components/tracks/TrackCard.tsx` — removed `allTracks` prop, accepted pre-computed `workspaceCoverById` and `onToggleSelection` props, and removed the heavy internal `useMemo` cover calculation.
  - Updated `src/components/TrackList.tsx` — pre-computed `workspaceCoverById` once using the stable cover key, added a `displayedTracksRef` pattern to stabilize `handlePlay` and `handleToggleSelection` callbacks, and updated `TrackCard` to receive the new stable props.
  - Updated `src/components/Sidebar.tsx` — updated the sidebar build version stamp to `zo 07:50`.
  - Validated with `npx tsc --noEmit` returning **0 compile errors**.

## 2026-06-02 di 11:15 (TrackCard component refactoring into smaller reusable sub-components)

- Findings: TrackCard.tsx was a massive file (1171 lines, 51.2 KB) containing multiple inline dialogs, play button logic, rating actions, and action menus, making it difficult to maintain and understand.
- Conclusions: Extract distinct responsibilities (modal dialogs, play button, rating thumbs, action menu) into highly cohesive, modular, and reusable sub-components in the same folder. This cuts the file size and complexity of TrackCard.tsx in half, improving maintainability while fully preserving memoization and performance optimizations.
- Actions:
  - Created `src/components/tracks/CreatePlaylistDialog.tsx` — extracted custom fixed-overlay playlist creation dialog.
  - Created `src/components/tracks/DuplicatePlaylistDialog.tsx` — extracted warning dialog for duplicate tracks.
  - Created `src/components/tracks/MergeWorkspaceDialog.tsx` — extracted workspace naming conflict confirmation dialog.
  - Created `src/components/tracks/MoveToWorkspaceDialog.tsx` — extracted the complex workspace selector modal with folder visualizers and search inputs.
  - Created `src/components/tracks/TrackPlayButton.tsx` — extracted dynamic play/pause controls, waveforms, error indicators, and album art loaders.
  - Created `src/components/tracks/TrackRating.tsx` — extracted thumbs up/down visual components and rating styles.
  - Created `src/components/tracks/TrackActionMenu.tsx` — extracted dropdown action menu, which fully encapsulates its own click-outside listener and local open state.
  - Updated `src/components/tracks/TrackCard.tsx` — removed massive inline structures, replaced them with the newly created sub-components, and simplified props/callbacks while fully preserving custom React.memo performance caching.
  - Updated `src/components/Sidebar.tsx` — build version stamp updated to `di 11:15`.
  - Updated `melodiq-user.md` — user guide version updated to `di 11:15`.
  - Validated with `npm run build` which succeeded completely with **0 compilation or TypeScript errors**.

## 2026-08-02 zo 23:58 (Fullscreen credits)

- Findings: De fullscreenspelers vermengden artiest-, componist- en schrijvergegevens in één technische providerregel, waardoor de credits niet als duidelijke metadata onder de titel stonden.
- Conclusions: Toon de artiest op een eigen regel onder de titel en groepeer schrijver en componist in een subtielere, consistente creditsregel; gebruik daarbij de op de track opgeslagen aliassen met de bestaande gebruikersalias-fallback in de hoofdspeler.
- Actions: Updated `src/components/player/FullscreenPlayer.tsx` and `src/app/player-window/page.tsx` to display `Lyrics: <writer> / Composed by <composer>` under the artist; updated `src/components/Sidebar.tsx` build stamp and `melodiq-user.md`.

## 2026-08-03 ma 00:12 (APIMart section editor)

- Findings: APIMart supports asynchronous Suno section replacement through `replaceMusic`, but MelodIQ had no way to select a musical range or submit the operation.
- Conclusions: Build the section selector from lyric headers when available, retain a manual two-handle timeline for exact selection, and keep one-second snap-to-grid enabled by default.
- Actions: Added `src/components/tracks/SectionReplaceEditor.tsx`, `src/app/api/tracks/[id]/replace-section/route.ts`, and the APIMart provider submission helper; added it to Track Details and documented the user-facing flow.

## 2026-08-03 ma 00:20 (Known Track DNA in editor)

- Findings: The Track DNA textarea in Edit Track Details showed only a generic placeholder even where `audioDna` analysis was already stored for the track.
- Conclusions: Prefer manually authored Track DNA when present; otherwise transform the available structured audio analysis into a readable editor value.
- Actions: Updated `src/components/tracks/TrackEditPanel.tsx` to populate Track DNA from the existing audio analysis, and updated user documentation and build stamp.

## 2026-08-05 wo (Listener library fix: images + crash)

- Findings: As listener, the Library page showed no track list and no artwork on melodiq.nl. Root cause (two coupled bugs): (1) library/page.tsx put raw /api/discover PublicTrackSummary objects straight into TrackCard — those have no `prompt`/`lyrics`/`audioUrl` fields, and TrackCard.tsx L417 calls `track.prompt.length`, throwing a TypeError that crashed the whole page. (2) The discover feed exposes `coverUrl: "/api/tracks/{id}/cover"`, an owner-only route that 404s for a listener.
- Conclusions: Discover tracks must be normalized into a full LibraryTrack before rendering, and their cover must point at the public `/api/discover/{id}/cover` proxy route instead of the owner-only one.
- Actions: `src/app/library/page.tsx` listener branch now maps each published track to a complete LibraryTrack (prompt:'', lyrics null, status 'done', provider 'discover', coverUrl=/api/discover/{id}/cover, publicSource true). Build clean; deployed to VPS via git pull + docker compose build/up. endpoints /api/discover, /api/discover/{id}/cover, /api/discover/{id}/stream all 200.

## 2026-08-12 wo 19:05 (Track Archive feature)

- Findings: Tracks accumuleerden in de Library zonder manier om ze op te bergen zonder ze definitief te wissen. Prullenbak (deletedAt) is natuurlijk een verwijder-functie; er ontbrak een apart, bewarend "Archief"-concept dat alleen de originele mp3 bewaart en de HD/WAV-versie + stems + masters verwijdert om S3-ruimte te besparen.
- Conclusions: Voeg een `archivedAt`-kolom toe die los staat van `deletedAt`; gearchiveerde tracks blijven zichtbaar in een apart Archief-tabblad, zijn niet afspeelbaar, niet bruikbaar in releases/playlists en kunnen op elk moment hersteld worden (zonder dat de verwijderde WAV/stems herleven — alleen de mp3 was bewaard). Serverside guards (published, master_track, in_playlist) voorkomen dat locks-position tracks worden weggestopt.
- Actions:
  - `src/db/schema.ts` — `archivedAt` kolom + `tracks_archived_at_idx` index toegevoegd (apart van `deletedAt`).
  - `src/db/init.ts` — `ALTER TABLE tracks ADD COLUMN IF NOT EXISTS archived_at` + `CREATE INDEX IF NOT EXISTS tracks_archived_at_idx` toegevoegd, automatisch uitgevoerd bij startup (zelfde self-healing patroon als voorgaande kolommen).
  - `src/lib/archive-guards.ts` — nieuwe herbruikbare `checkArchiveGuards(trackId, userId)`: published -> master_track (Song Archive zonder parent) -> in_playlist, stopt bij de eerste hit en geeft een Nederlandstalige reden.
  - `src/app/api/tracks/[id]/archive/route.ts` — nieuwe route: POST archiveert (S3-opschoon van stems/masters/s3KeyHd, verwijdert release_tracks rijen, stelt `archivedAt` in, wist s3KeyHd/audioUrlHd/formatHd, raakt de mp3 en Track DNA/lyrics/prompt niet aan); DELETE herstelt door `archivedAt = null` en documenteert dat WAV/stems/masters definitief weg zijn.
  - `src/app/api/tracks/route.ts` — `archivedAt` toegevoegd aan `trackListSelect`; nieuwe `?archived=true` query-param (zelfde patroon als `?trash=true`); alle bestaande lijst-queries + de active-poll/timeout-queries filteren nu op `isNull(tracks.archivedAt)`.
  - `src/lib/songs.ts` — both published-track gates (`getPublishedTracksFeed` + `getPublishedTrackById`) sluiten gearchiveerde tracks uit.
  - `src/app/api/discover/artist/[userId]/route.ts` — artist profile feed sluit nu ook archived tracks uit.
  - `src/lib/apimart-wav.ts`, `src/lib/apimart-lyrics.ts`, `src/lib/request-wav-conversion.ts` — self-healing WAV/lyrics polls slaan gearchiveerde tracks over.
  - `src/components/library/types.ts` — `LibraryView` uitgebreid met "archive"; `LibraryTrack` krijgt `archivedAt` veld.
  - `src/components/tracks/types.ts` + `src/lib/stores/playerStore.ts` — `TrackItem`/player `Track` krijgen `archivedAt`; player-store autostart queue-filtert nu op `!archivedAt` zodat een gearchiveerde track nooit stiekem in de afspeelwachtrij belandt.
  - `src/components/library/ArchivePanel.tsx` — nieuw panel (kopie van TrashPanel, NL teksten), Archief-tabblad met lege-staat en alleen een Herstellen-knop (geen permanent-delete — dat hoort bij de prullenbak).
  - `src/app/library/page.tsx` — derde tab-knop toegevoegd naast Tracks/Recycle Bin, met `archivedTracks` state + `fetchArchived` + `handleRestoreArchivedTrack`; subtitel van de header schakelt mee.
  - `src/components/tracks/TrackActionMenu.tsx` — nieuw `onArchiveClick` prop + amberkleurig "Archiveren" menu-item; disabled wanneer `releaseStatus === "published"` of `archiveLinkKind === "original"` (zelfde Song-Archive indicatie als reeds gebruikt in TrackCard), met een tooltip met de reden.
  - `src/components/tracks/TrackCard.tsx` — `handleArchive` roept `POST /api/tracks/{id}/archive` aan: bij HTTP 409 wordt de nederlandstalige error uit de response als alert getoond; bij succes worden de tracklijsten gemuteerd; de actie is alleen zichtbaar voor eigenaars, niet voor listeners of niet-done tracks.
  - `src/components/tracks/TrackPlayButton.tsx` — ipv de play-knop wordt voor een gearchiveerde track een archief-icoon + title="Gearchiveerd — alleen mp3 bewaard" getoond.
  - Release-uitsluiting: `/api/releases/[releaseId]`-pagina en `ReleasePickerDialog` lezen tracks via `/api/tracks?status=done` of via de reeds ingevulde release store — beide vanzelf gearchiveerde tracks uitsluiten zonder verdere code-wijziging.
  - Build versie bijgewerkt naar `202608121905` in `src/components/Sidebar.tsx`.
  - Validated with `npm run build` which succeeded completely.

## 2026-08-12 wo 21:22 (Lyrics Topic & Mood veld verwijderd van Music pagina)

- Findings: Het veld "Lyrics Topic & Mood" op de Music pagina (/studio) vulde alleen lyricsContext in de studio store. Dat veld ging uitsluitend mee als context bij het /api/llm optimise-call en werd nergens anders gebruikt. Voor de eigenaar was het overbodige input, waardoor de Lyrics sectie onnodig veel ruimte innam.
- Conclusions: Het veld weghalen uit de UI; de store-field en de context-pass-through in handleOptimize blijven intact (default leeg) zodat de API contracten onveranderd blijven en er niets kan breken.
- Actions:
  - src/components/StudioForm.tsx ""  label + input voor "Lyrics Topic & Mood" verwijderd uit de Lyrics sectie (regel 332-341); ook de gedestructureerde lyricsContext/setLyricsContext uit useStudioStore() gehaald zodat er geen ongebruikte variabelen achterblijven.
  - Build versie bijgewerkt naar 202608122122 in src/components/Sidebar.tsx.
  - Validated with npm run build which succeeded completely.

## 2026-08-15 za 12:53 (Audio streaming path: fewer settings lookups, real disk caching on ranged cache-misses, non-blocking playback start, next-track prefetch)

- Findings: Three separate slow points in the audio streaming path compounded on mobile. (1) `getPresignedUrl()` in `src/lib/s3.ts` re-read all 5 S3 settings from the DB sequentially on every single call, with no caching. (2) `src/app/api/tracks/[id]/stream/route.ts` destroyed the tee'd S3 stream from `getCachedAudioStream()` on every cache-miss Range request and fired a second, separate presigned-URL fetch instead — that second fetch was never written to disk, so a track played entirely via Range requests (the common case) never warmed the disk cache. (3) `Player.tsx`'s track-loading effect awaited a `Range: bytes=0-0` probe fetch — used only to set the debug AudioSourceBadge — before ever setting `audioEl.src`, blocking the actual start of playback on every track load/skip.
- Conclusions: Cache the S3 settings in-memory with a 5-minute TTL and fetch them with `Promise.all` when cold. On a cache-miss Range request, reuse the already-in-flight tee'd client-side branch from `getCachedAudioStream()` instead of discarding it — slice out the requested byte range for the client while the independent disk-side branch keeps writing the full file in the background. Fire the AudioSourceBadge probe in parallel instead of awaiting it, so `audioEl.src`/`load()` happen immediately. Also warm the next queued track's cache ahead of time: once `autoPlayNext` is on and the current track has been playing for a bit, fire a low-priority `Range: bytes=0-0` request for the next track so its S3 fetch + disk-cache write is already underway before the current track ends; the warm-up re-checks the live queue right before firing so a mid-playback skip/reorder/autoplay-toggle cancels it.
- Actions:
  - `src/lib/s3.ts` — added a module-level `getS3Config()` helper with a 5-minute in-memory cache, fetching the 5 settings via `Promise.all` on a cold cache; `getPresignedUrl()` now uses it instead of 5 sequential `getSetting()` awaits.
  - `src/app/api/tracks/[id]/stream/route.ts` — cache-miss Range requests now reuse `getCachedAudioStream()`'s tee'd stream, manually slicing out the `[start, end]` byte range from the live from-byte-0 stream for the client response instead of destroying it and re-fetching a second presigned URL; the underlying stream is only destroyed once the needed range has been fully emitted, so the disk-side tee branch keeps writing independently.
  - `src/components/Player.tsx` — the `Range: bytes=0-0` source-detection probe in the track-loading effect is now a fire-and-forget `fetch(...).then(...).catch(() => {})` that only updates `audioSource`/`audioSourceState` for the badge; `audioEl.src`/`load()` happen immediately without waiting on it. Also added a `scheduleNextTrackPrefetchIfNeeded` "playing"-event handler (same timer/guard pattern as the existing cover-art/language-detection schedulers) that, 10s into playback with `autoPlayNext` on, fires a low-priority `Range: bytes=0-0` request for `queue[0]` — guarded against the queue having changed by re-reading `usePlayerStore.getState().queue[0]` right before firing.
  - Build versie bijgewerkt naar 202608151253 in src/components/Sidebar.tsx.
  - Validated with `npx tsc --noEmit` (0 errors) and `npm run build`, which succeeded completely.

## 2026-08-15 za 12:56 (Persist selected track sort order across navigation)

- Findings: `TrackList.tsx`'s sort dropdown (New/Old/A-Z/Z-A) was local `useState<SortOrder>("newest")`, so it reset to "newest" every time the component remounted — which happens on every navigation between Library, Playlists, Workspaces, Archive, Releases, and the Studio panels, since each renders its own `<TrackList>` instance.
- Conclusions: Persist the selected sort order the same way the existing manual drag-order is already persisted (`trackListOrder.ts`, localStorage-backed), but as a single shared key rather than per-list, so picking a sort once applies everywhere and survives navigation.
- Actions:
  - `src/components/tracks/trackListOrder.ts` — added `readPersistedSortOrder()`/`writePersistedSortOrder()` (localStorage key `melodiq.track-sort-order.v1`), mirroring the existing persisted-manual-order helpers.
  - `src/components/TrackList.tsx` — `sortOrder` now lazily initializes from `readPersistedSortOrder() ?? "newest"`, and the `setSortOrder` passed down to `TrackListHeader` now also writes through to localStorage on every change.
  - Build versie bijgewerkt naar 202608151256 in src/components/Sidebar.tsx.
  - Validated with `npx tsc --noEmit` (0 errors) and `npm run build`, which succeeded completely.

## 2026-08-15 za 14:16 (Private stream route no longer marks responses Cache-Control: public)

- Findings: `src/app/api/tracks/[id]/stream/route.ts` requires `requireAuth()` and re-checks track ownership per request, but all 4 of its response branches sent `Cache-Control: public, ...`. `public` tells any shared cache/proxy/CDN sitting in front of the app that the response is safe to store and replay to other, unauthenticated requesters — which it isn't, since this route serves private per-user audio. Came up while scoping whether a CDN could safely be added in front of the app: it can't, as long as this route claims to be publicly cacheable. The sibling `/api/discover/[trackId]/stream` route (genuinely public, no auth, published tracks only) was already correctly `public`, and `/api/tracks/[id]/cover` (also auth-gated) was already correctly `private` — this route was the one outlier.
- Conclusions: Mark all of this route's responses `private` instead of `public` so a shared cache/CDN won't store them (the requesting user's own browser can still cache its own copy, which is what you want), independent of whether/when a CDN actually gets added in front of the domain.
- Actions:
  - `src/app/api/tracks/[id]/stream/route.ts` — changed `Cache-Control` from `public, max-age=31536000, immutable` to `private, max-age=31536000, immutable` on the cache-miss Range branch, the cached Range branch, and the full-file response; changed the direct-S3-fallback branch from `public, max-age=300` to `private, max-age=300`.
  - Build versie bijgewerkt naar 202608151416 in src/components/Sidebar.tsx.
  - Validated with `npx tsc --noEmit` (0 errors) and `npm run build`, which succeeded completely.

## 2026-08-15 za 14:32 (Optional CDN hostname for public discover audio/cover URLs, ready for e.g. Bunny CDN)

- Findings: Scoping "put a CDN in front of the public discover audio/cover traffic" surfaced that the ~12 places building `/api/discover/{id}/cover` and `/api/discover/{id}/stream` URLs are scattered across client components and API routes, with no single seam to inject a CDN hostname. It also surfaced a real deploy gotcha: `NEXT_PUBLIC_*` vars only get inlined into client bundles at `next build` time, but this project's Docker build stage (`COPY . .` in the `builder` stage) never sees `.env.production` — it's excluded via `.dockerignore` on purpose, since it holds runtime secrets and is only wired in as `env_file` for the *running* container. That's exactly why every existing `NEXT_PUBLIC_APP_URL` read in this codebase is server-only (`settings.ts`, `providers/llm.ts`, `api/settings/route.ts`) — a `"use client"` component reading it would have permanently baked in an empty value.
- Conclusions: Add one small `withCdn()` helper (`src/lib/cdn.ts`) that no-ops when `NEXT_PUBLIC_CDN_URL` is unset, and apply it at every place that builds a `/api/discover/*` cover/stream URL — never `/api/tracks/*` (private, `Cache-Control: private` as of the previous entry, no business going through a public CDN hostname). To make it actually work for the `"use client"` call sites (most of them), also wire `NEXT_PUBLIC_CDN_URL` through as a proper Docker **build arg** (distinct from the runtime `env_file`), sourced from the root `.env` (same file `DB_PASSWORD` already comes from for this compose file) — without that, the client-side half of this would have silently never worked once a CDN was actually configured.
- Actions:
  - `src/lib/cdn.ts` — new `withCdn(path)` helper, reads `NEXT_PUBLIC_CDN_URL` once at module scope, passes the path through unchanged when unset.
  - Applied `withCdn()` to the public discover cover/stream URL construction in: `src/components/player/playerUtils.tsx` (`mediaBase()`), `src/lib/stores/playerStore.ts` (`playTrackFromGesture`'s fallback base), `src/lib/songs.ts` and `src/app/api/discover/playlists/[id]/route.ts` (server-side `coverUrl` rewrite), and the client-side cover-URL derivations in `src/app/explore/page.tsx`, `src/app/discover/page.tsx`, `src/app/discover/track/[trackId]/page.tsx`, `src/app/discover/artist/[userId]/page.tsx` (track + hero cover), `src/app/discover/playlist/[id]/page.tsx`, `src/app/library/page.tsx`, and `src/components/tracks/TrackCard.tsx`. Left `/api/tracks/*` (private) and the JSON data-fetch calls (`/api/discover/{id}`, `/api/discover/playlists/{id}`, `/api/discover/artist/{id}`) untouched.
  - `Dockerfile` — added `ARG NEXT_PUBLIC_CDN_URL=""` + `ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL` in the builder stage, before `RUN npm run build`, so it's actually inlined into client bundles when set.
  - `docker-compose.yml` — `app.build` now `context: . / args: NEXT_PUBLIC_CDN_URL: ${NEXT_PUBLIC_CDN_URL:-}`, sourced from the root `.env` at `docker compose build` time (verified with `docker compose config`, resolves to `""` when unset — no behavior change).
  - `.env.example` — documented `NEXT_PUBLIC_CDN_URL` (optional, empty by default) with a note that it's a build arg, not a runtime var.
  - Build versie bijgewerkt naar 202608151432 in src/components/Sidebar.tsx.
  - Validated with `npx tsc --noEmit` (0 errors), `npm run build` (succeeded, unset CDN var → identical output to before), and `docker compose config` (build arg resolves correctly).

## 2026-08-15 za 15:22 (CDN hostname moves to Settings, matching the S3 config pattern; Docker build-arg plumbing reverted)

- Findings: The previous entry's Docker build-arg approach worked, but only because `NEXT_PUBLIC_CDN_URL` had to be baked in at `next build` time — every other piece of infra config in this app (S3 endpoint/keys, APP_URL) instead lives in the Settings page (DB-backed, env var as fallback, editable without a rebuild). Asked whether CDN could follow that same pattern instead.
- Conclusions: Split the CDN helper into three pieces so each side resolves the hostname the way it actually can: a pure `prefixCdn(cdnUrl, path)` with zero imports (safe anywhere), a server-only `getCdnUrl()` that reads the new `CDN_URL` DB setting with `NEXT_PUBLIC_CDN_URL` as fallback (`src/lib/cdn-server.ts`, mirrors `settings.ts`'s existing S3/APP_URL pattern), and a client-side cache (`src/lib/cdn-client.ts`) that fetches the value once from a new public `/api/config/public` endpoint (no auth — anonymous Discover visitors need it too, and a CDN hostname isn't sensitive) and serves it synchronously afterward from an in-memory cache, same call signature (`withCdn(path)`) as before so none of the ~10 call sites needed touching beyond their import line. This also let the Docker build-arg wiring from the previous entry be fully reverted — the env fallback is now only ever read server-side at runtime, sidestepping the build-time-inlining problem entirely instead of working around it.
- Actions:
  - `src/lib/cdn.ts` — reduced to the pure `prefixCdn(cdnUrl, path)` helper (no imports).
  - `src/lib/cdn-server.ts` (new) — `getCdnUrl()`: `getSetting("CDN_URL")` with `NEXT_PUBLIC_CDN_URL` env fallback.
  - `src/lib/cdn-client.ts` (new) — `loadCdnConfig()` (fire-and-forget fetch of `/api/config/public`, called once from `ClientLayout.tsx`) + `withCdn(path)` reading the cached value; no-op until loaded, same as no CDN configured.
  - `src/app/api/config/public/route.ts` (new) — public, no-auth endpoint returning `{ cdnUrl }`.
  - `src/lib/songs.ts` and `src/app/api/discover/playlists/[id]/route.ts` — now resolve `cdnUrl` once per request (`getCdnUrl()`) instead of a hidden per-track async call, then use the pure `prefixCdn()` in the row/track mapper.
  - The 9 client-side call sites (`playerUtils.tsx`, `playerStore.ts`, `explore/page.tsx`, the 4 `discover/*` pages, `library/page.tsx`, `TrackCard.tsx`) now import `withCdn` from `@/lib/cdn-client` instead of `@/lib/cdn` — no other changes needed.
  - `src/components/settings/S3Section.tsx` + `src/app/settings/page.tsx` (`TRACKED_SETTINGS_KEYS`) — added a "CDN URL (optional)" field, saved/loaded through the existing generic Settings key/value flow.
  - `Dockerfile` / `docker-compose.yml` — reverted the `NEXT_PUBLIC_CDN_URL` build-arg plumbing from the previous entry; no longer needed.
  - `.env.example` — `NEXT_PUBLIC_CDN_URL` now documented as the fallback-only env var (same framing as `S3_*`), not a build arg.
  - Build versie bijgewerkt naar 202608151522 in src/components/Sidebar.tsx.
  - Validated with `npx tsc --noEmit` (0 errors) and `npm run build` (succeeded, `/api/config/public` present in the route list, unset CDN → identical behavior to before).

## 2026-08-28 vr 01:01 (Geüploade tracks automatisch transcoderen naar Ogg Vorbis + directe OGG-upload support)

- Findings: Geüploade tracks (MP3 en WAV) werden opgeslagen als MP3 of FLAC/WAV, maar kregen bij het uploaden geen Ogg Vorbis-versie (`s3KeyOgg`). Daardoor moest de gebruiker handmatig per track op "Convert to OGG" klikken om de optimale streaming-codec en snelle buffering van MelodIQ te benutten. Ook accepteerden de upload-controllers nog geen directe `.ogg`-bestanden.
- Conclusions: Transcodeer bij elke upload (MP3, WAV, FLAC) de audio direct naar Ogg Vorbis via `transcodeToOgg`, upload dit naar `tracks/${trackId}/audio.ogg` en sla `s3KeyOgg` op in de database. Accepteer tevens direct `.ogg` (en `.oga` / `.flac`) bestanden in de file pickers en backend detectie. Voeg tevens een batch-endpoint `POST /api/tracks/convert-ogg` toe voor het converteren van bestaande geüploade tracks.
- Actions:
  - Modified `src/app/api/tracks/upload-helpers.ts` — `detectUploadFormat` uitgebreid met detectie voor `ogg` en `flac`; `getAudioOnlyBytesForHash` en `computeUploadAudioHash` ondersteunen nu alle audioformaten.
  - Modified `src/app/api/tracks/route.ts` — in `POST /api/tracks`: automatische transcodering naar OGG Vorbis (`tracks/${trackId}/audio.ogg`) via `transcodeToOgg` voor alle geüploade formaten; opslag van `s3KeyOgg` en `s3KeyMp3` op de `tracks`-tabel; directe OGG-bestanden worden zonder kwaliteitsverlies als OGG opgeslagen.
  - Created `src/app/api/tracks/convert-ogg/route.ts` — batch endpoint `POST /api/tracks/convert-ogg` om bestaande (geüploade) tracks die nog geen OGG hebben in bulk te transcoderen.
  - Modified `src/components/library/types.ts` — `LibraryTrack` type uitgebreid met `s3KeyOgg` en `s3KeyMp3`; `isSupportedAudioFile` ondersteunt nu ook `.ogg`, `.oga`, `.flac` en de bijbehorende MIME-types.
  - Modified `src/components/library/UploadPanel.tsx` — file picker `accept` en dropzone-labels uitgebreid met OGG en FLAC; validatiemelding geüpdatet.
  - Modified `src/components/tracks/TrackUpload.tsx` — file picker `accept` uitgebreid met OGG en FLAC.
  - Modified `src/lib/__tests__/audio-format.test.ts` — unit tests toegevoegd voor `detectUploadFormat` en audio hash berekeningen met OGG/FLAC.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608280101`.
  - Validated with `npm test` (39/39 tests geslaagd) en `npm run build` (succesvol afgerond met 0 errors).
