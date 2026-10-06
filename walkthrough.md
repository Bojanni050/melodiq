# MelodIQ — Walkthrough

## 2026-09-26 za (Reuse Prompt: submenu met scope + herstel van de dode knop in Slim Archief)

- Findings: Twee samenhangende bugs. (1) "Reuse Prompt werkt niet vanaf Slim Archive": in `TrackActionMenu` was de knop onvoorwaardelijk gerenderd en riep `onReusePrompt?.(track)` aan met een optionele call. Toen `TrackOptionsMenu` (Slim Archief, toegevoegd in de vorige taak) die prop niet doorgaf, was de handler `undefined`, deed de optional-chaining niets, en verscheen er een knop die stilzwijgend niets deed. Dat is precies de klasse fout die een afwezige handler verhult: geen crash, wel een dode knop. (2) De payload-constructie stond gekopieerd in vier pagina's (Library, Archive, Playlists, Releases) — drie met een eigen `ReuseConfirmDialog`, één met `window.confirm` — en geen van de kende een scope, dus "alleen lyrics" of "alleen stijl" was niet uitdrukkelijk te maken.
- Conclusions: De menu-entry voortaan conditioneel renderen op `onReusePrompt`, zodat een pagina zonder handler geen dode knop meer kan tonen — de enige duurzame fix, want de optional-chaining blijft als vangnet. Voor de scope een aparte `ReuseScope` in `lib/reuse-prompt.ts` in plaats van in `components/tracks/types.ts`, omdat het menu én de pagina's het type nodig hebben en het menu het anders uit het types-bestand zou moeten importeren terwijl dat bestand het type al her-exporteert: een cyclus. `buildReusePayload` levert altijd beide sleutels en zet de niet-gekozen helft op een lege string in plaats van weg te laten — dit is het niet-triviale deel: de Studio zet bij mount beide velden onvoorwaardelijk, dus een ontbrekende sleutel zou behouden wat er al stond en "Only Lyrics" stilletjes "lyrics plus je oude prompt" worden. De scope wordt meegenomen in de bevestigingsstate (`{ track, scope }` i.p.v. `track`), zodat het dialoog de keuze niet kan verruimen. "Both" staat bewust als laatste in het submenu: het is het historische gedrag en de meest voorkomende keuze, en zo kost het de gebruiker geen extra klik.
- Actions:
  - Created `src/lib/reuse-prompt.ts` — `ReuseScope` ("lyrics" | "style" | "both"), `REUSE_SCOPE_LABEL` en `buildReusePayload`. Inclusief commentaar waarom de niet-gekozen helft leeggemaakt en niet weggelaten wordt.
  - Created `src/lib/__tests__/reuse-prompt.test.ts` — 7 tests: "both" draagt beide velden, elke scope leegt de andere helft, beide sleutels zijn altijd aanwezig, null/missing velden geven geen `undefined`, en de volgorde van het submenu.
  - `src/components/tracks/TrackActionMenu.tsx` — `Reuse Prompt` omgezet van losse knop naar submenu volgens het bestaande `releaseSubmenuOpen`-patroom (zelfde pijltje, `aria-expanded`, inklapbare lijst), conditioneel op `onReusePrompt`; signatuur `(track, scope)`.
  - `src/components/tracks/types.ts` — `ReuseScope` her-exporteerd vanaf `@/lib/reuse-prompt` zodat pagina's het via hun bestaande types-import kunnen blijven nemen; `PlaylistOption` ongewijzigd gebleven.
  - `src/components/tracks/TrackCard.tsx`, `src/components/TrackList.tsx`, `src/components/tracks/TrackOptionsMenu.tsx` — `onReusePrompt`-signatuur en prop-doorgifte bijgewerkt. Dit is de fix voor punt (1): `TrackOptionsMenu` geeft de handler nu daadwerkelijk door.
  - `src/app/smart-archive/page.tsx` — `handleReusePrompt` toegevoegd met `window.confirm` wanneer de Studio al inhoud heeft, plus de import van `useStudioStore`; handler aan `TrackOptionsMenu` doorgegeven.
  - `src/app/library/page.tsx`, `src/app/archive/page.tsx`, `src/app/playlists/[playlistId]/page.tsx`, `src/app/releases/page.tsx` — `performReusePrompt`/`handleReusePrompt` nemen een `ReuseScope` en gebruiken `buildReusePayload`; de bevestigingsstate is `{ track, scope }` geworden zodat de dialog de gekozen scope bewaart.
  - Created `src/hooks/useReusePrompt.ts` — de flow voor toekomstige pagina's in één plek, inclusief de storage-key. Bewust nog niet door de vier bestaande pagina's gebruikt: twee daarvan hebben een eigen gestyled dialog die hier zou worden weggegooid, en die refactor hoort in een eigen taak.
  - Modified `melodiq-user.md` — het submenu en de herstelde knop beschreven, versie bijgewerkt naar `202609262250`.
  - Validated with `npx tsc --noEmit` (0 errors), `npm run test` (105 tests geslaagd, 12 bestanden) and `npm run build` (geslaagd, exitcode 0); ✅ gevalideerd

## 2026-09-26 za (Mislukte tracks opruimen in Library + Track Details-sidebar in Slim Archief + generator in details)

- Findings: Drie losse verzoeken, waarvan de eerste bij navragen een niet-triviale vooraanname had. (1) "Alle failed tracks verwijderen" in Slim Archief: onmogelijk daar. De groepering koppelt tracks alleen boven een scoringsdrempel op lyrics/prompt/audioDna/titel/taal, en een mislukte generatie heeft geen audioDna, terwijl een groep bovendien minimaal twee leden vereist (`groupBySimilarity`, `.filter(([, g]) => g.trackIds.size >= 2)`). Een failed track is dus vrijwel altijd een eenzame track die nergens verschijnt; de knop zou bijna altijd "0 gevonden" zeggen en suggereren dat ze daar wél stonden. Ze staan in de Library. Daarom in de Library geplaatst, en dit expliciet aan de gebruiker benoemd in plaats van stilzwijgend ergens anders neergezet. (2) Slim Archief had geen details-sidebar en dus geen plek om lyrics/prompt naast de groep te bekijken. (3) In de details-overlay stond de taal wel maar niet de herkomst, terwijl `provider` en `providerModel` wél in het schema staan en voor vrijwel elke track gevuld zijn.
- Conclusions: Drie keuzes. De failed-knop telt over de gehele bibliotheek in plaats van de zichtbare slice, want een failed track verschijnt per definitie niet in een zichtbare groep; hij hergebruikt de bestaande `DELETE /api/tracks/[id]` (soft delete naar de prullenbak) in plaats van een harde delete, en zegt dat expliciet in de bevestiging — "verwijder alles" die blijft hangen bij herstelbaarheid is een andere belofte dan "verwijder alles". De knop verdwijnt bij nul failed tracks in plaats van grijs uitgeschakeld te blijven staan. Voor de generator is het belangrijkste punt dat de ruwe kolommen niet bruikbaar zijn: `poyo` + `V5_5` betekent Suno 5.5 omdat PoYo hier de API vóór Suno is, en het modelveld bevat interne identificatoren ("V5_5", "minimax-music-2.6"). Een lookup met expliciete regels wanneer de providernaam wel of niet wordt voorafgevoegd: "poyo"+"V5_5" moet "Suno 5.5" zijn en niet "Suno Suno 5.5", maar "apimart"+"lyria-3" moet wél "APIMart Lyria 3" zijn omdat dat onderscheidend is. Die regel is als een feit over de data vastgelegd in een tabel, niet afgeleid uit stringvergelijking op het label — de eerste poging met `startsWith` was gecorrigeerd op precies dit punt. De details-sidebar gebruikt de bestaande `TrackDetail` + `ResizablePanel`, want dat is dezelfde combinatie die Library, Archief, Workspaces en Discover al gebruiken; de track-naar-detail-mapping is lokaal gehouden omdat `useTrackDetailsPanel` alleen `.id` leest en hier de groepen een eigen vorm hebben.
- Actions:
  - Created `src/lib/format-generator.ts` — `PROVIDER_LABEL` (poyo→Suno, upload→Uploaded, …), `MODEL_LABEL` per provider met genormaliseerde sleutels (scheiders weggegooid, dus "V5_5"/"v5.5"/"v5-5" vallen samen), `SELF_PROVIDERS` (provider ís het product: geen prefix) en `STANDALONE_MODEL` (gateway + model dat zelf een product noemt: geen prefix). Onbekend model wordt letterlijk getoond in plaats van weggelaten, en leeg levert null zodat de overlay geen lege bullet rendert.
  - Created `src/lib/__tests__/format-generator.test.ts` — 10 tests: gateway-provider, geen dubbeling van de productnaam, prefix-weglaten bij gateways die een echt product leveren, geen gateway-erkenning voor een passthrough-model, fallback op provider bij onbekend model, versiecode's met en zonder scheiders, uploads, null bij lege invoer, en onbekend model letterlijk tonen.
  - `src/components/TrackDetail.tsx` — `formatGenerator` geïmporteerd en `generatorLabel` ná de taal in de info-overlay over de cover gezet, met de ruwe `providerModel` als `title` voor de gevallen die de lookup niet kent.
  - `src/app/api/smart-archive/route.ts` — `language`, `provider`, `providerModel`, `createdAt`, `completedAt`, `error`, `artistName`, `composerName`, `writerName` aan de select en payload toegevoegd; `prompt` en `s3KeyCover` waren al aanwezig en werden niet dubbel toegevoegd.
  - `src/app/smart-archive/page.tsx` — `TrackDetail` + `ResizablePanel` geïmporteerd; `detailTrackId`/`showDetailPanel`-state plus een `detailTrack`-memo die de groeptrack naar `TrackDetailTrack` mapt; de titelknop is nu de aan/uit-toggle van het paneel en een kleine "Library"-knop ernaast behoudt de sprong naar de Library; `ResizablePanel` naast `<main>` geplaatst. De paneel-playknop roept dezelfde `togglePreview` aan als de rijen, zodat afspelen vanuit het paneel de rij ook markeert. De cast naar `TrackDetailTrack` loopt via `unknown` omdat de API snippets teruggeeft en niet alle velden van het paneel-model kent.
  - `src/components/TrackList.tsx` — `executePurgeFailed` voegt met een sequentiële lus `DELETE /api/tracks/[id]` uit voor elke failed track en roept `onDelete` bij succes, zodat de lijst meteen meebeweegt; een enkele niet-bereikbare track stopt de sweep niet. `ConfirmDialog` met de expliciete mededeling dat het naar de prullenbak gaat; props aan de header doorgegeven.
  - `src/components/tracks/TrackListHeader.tsx` — optionele props `failedTrackCount`/`purgingFailed`/`onPurgeFailed` en een rode knop die alleen rendert bij een telling groter dan nul.
  - Modified `melodiq-user.md` — de drie wijzigingen beschreven, versie bijgewerkt naar `202609262244`.
  - Validated with `npx tsc --noEmit` (0 errors), `npm run test` (98 tests geslaagd, 11 bestanden) and `npm run build` (geslaagd, exitcode 0); ✅ gevalideerd

## 2026-09-26 za (Track options-menu in Slim Archief)

- Findings: Slim Archief had geen trackacties op rijniveau: een track kon daar alleen worden geselecteerd en via de groepsknoppen verborgen of gearchiveerd. De Library heeft daarentegen een volwaardig ⋯-menu, maar dat zit inline in TrackCard — ongeveer 60 regels dialog-plumbing die elke tweede pagina zou moeten kopiëren. Bij het overnemen bleken de dialogen al zelfstandige componenten te zijn (CreatePlaylistDialog, PlaylistPickerDialog, ReleasePickerDialog, MoveToWorkspaceDialog, DuplicatePlaylistDialog, AlreadyInPlaylistDialog, MergeWorkspaceDialog) en levert useTrackCardActions alle handlers en state; alleen de compositie zat vastgeplakt in TrackCard.
- Conclusions: Een herbruikbare `TrackOptionsMenu` die het menu én alle dialogen bundelt, in plaats van de plumbing in de Slim Archief-pagina dupliceren of een tweede, afwijkende menu maken zoals bij EntryTrackActionsMenu. Zo gedraagt het menu zich identiek op beide plekken en komt een fix aan de gedeelde dialogen overal tegelijk aan. `onCreateWorkspace` wordt bewust aan de store onttrokken en aan `actions.handleCreateWorkspace` gekoppeld, net als in TrackCard: de hook doet daarna de move en de workspace-merge-guard, dus twee paden zouden die guard kunnen omzeilen. Losse verbergen/archiveren hergebruikt de bestaande `useHideTracks`/`useArchiveTracks`-hooks in plaats van eigen fetch-calls, zodat resultaatrapportage en bevestigingsvenster identiek blijven. Archiveren van één track preselecteert die track in de groep en opent het bestaande bevestigingsvenster, zodat de gebruiker dezelfde waarschuwingen en deletie-overzicht ziet als bij bulk archiveren.
- Actions:
  - Created `src/components/tracks/TrackOptionsMenu.tsx` — bundelt TrackActionMenu met de zeven dialogen en de workspace-optie-afleiding (kopie van TrackCard, want TrackList rekent die daar één keer voor de hele lijst). Neemt `onHideClick`/`onArchiveClick`/`onChanged` als props zodat de pagina de acties en een refetch kan beheren; `workspaceCoverById` vult nulls omdat `Workspace` geen coverveld heeft, alleen een `folderGradient`, en het dialog-formaat een cover-URL-map verwacht. `onChanged` hangt aan een `CoverRefreshSignal` die op `melodiq:cover-regenerated` luistert en alleen bij een eigen track-id de pagina laat refetten — de enige menuactie die de rij zichtbaar verandert, want de andere herschrijven alleen dialog-state.
  - `src/app/smart-archive/page.tsx` — `TrackOptionsMenu` naast de Track DNA-knop in elke afspeelbare rij; `handleHideSingle` en `handleArchiveSingle` toegevoegd; import bijgezet.
  - Modified `melodiq-user.md` — het ⋯-menu beschreven, versie bijgewerkt naar `202609262222`.
  - Validated with `npx tsc --noEmit` (0 errors), `npm run test` (88 tests geslaagd) and `npm run build` (geslaagd, exitcode 0); ✅ gevalideerd

## 2026-09-26 za (Lokale taaldetectie via franc + hartjes en playlists in Slim Archief)

- Findings: Twee dingen. 1) De lyric-taal werd indirect via de LLM bepaald (detectLanguageFromLyrics) en alleen vanuit de playback-hook getriggerd, waardoor een bibliotheek die je genereert maar niet afspeelt voor het grootste deel een NULL `language`-kolom hield en het taalsignaal in Slim Archief daar dus niets deed. Er zat bovendien een netwerkronde en een API-kostenpost onder iets wat offline te doen is. 2) In de tracklisting van Slim Archief stonden hartjes en playlist-lidmaatschap niet, terwijl juist die informatie bepaalt of je iets wilt archiveren: een favoriet of een track uit een zelfgemaakte playlist is precies wat je niet per ongeluk kwijt wilt.
- Conclusions: Voor taaldetectie is de LLM overbodig. Eerst zelf geïmplementeerd met stopwoordlijsten (7/8) en daarna met handgeschreven letter-n-gramprofielen (4/8) — beide falen structureel, niet door tuning: van de ~70 veelvoorkomende functiewoorden in deze acht talen komen er ~20 in meerdere talen voor (`que` in Spaans/Frans/Portugees, `in` in Nederlands/Engels/Duits/Italiaans, `lo` in Spaans/Italiaans), waardoor de winnaar bepaald werd door gedeelde woordvoorraad in plaats van door de tekst. Gewogen met IDF hielp dat, maar de koppeling bleef en elke fix brak een andere taal. Het `franc`-pakket lost dat structureel op: het profileert op character trigrams (lettervorm/spelling, niet woordenlijsten), dus er hoeft niets gedeeld of uniek te worden verklaard. MIT, pure JS, 272 KB, geen native build — belangrijk omdat de app in een Alpine-container bouwt. Op echte lyricfragmenten in alle 13 Lyric Studio-talen: 13/13. Het `only`-filter is daarbij load-bearing en geen optimalisatie: zonder filter noemt franc `nds` (Laags Duits) voor Nederlands en `bho` (Bhojpuri) voor Hindi, wat algemeen juist maar hier verkeerd is omdat Lyric Studio die talen niet aanbiedt. Voor de UI is besloten het hart als statische indicator te tonen en niet als tweede toggle: de rating wordt elders beheerd (TrackRating) en een knop hier zou de groep opnieuw moeten fetchen om synchroon te blijven.
- Actions:
  - `package.json` — `franc@^6.2.0` toegevoegd (dependency voorgelegd en goedgekeurd)
  - Created `src/lib/detect-lyrics-language.ts` — dunne wrapper over `franc`: `only`-filter op de 13 ondersteunde talen, `minLength` 10, mapping van franc's ISO 639-3-codes naar Lyric Studio-codes (`nld`→`nl`, `cmn`→`zh`) plus `detectedLanguageLabel`. Twee lokale bewakingen: `[Verse]`/`[Chorus]`-tags en `(parenthesen)` worden verwijderd voor de telling, en een herhalingsbewaking (één woord >60% van alle woorden) weigert aanroepen als "la la la la la la" — franc noemt dat Spaans, wat een track zonder woorden een taal zou geven. De herhalingsbewaking geldt alleen voor scripts met spaties, want Chinees en Japans schrijven zonder spaties en zouden anders altijd geweigerd worden.
  - `src/lib/language-detect.ts` — `detectAndSaveLanguageIfMissing` gebruikt nu de lokale detector i.p.v. `detectLanguageFromLyrics`; één centrale wijziging dekt alle 12 aanroepplekken (upload, elke provider-webhook, sync). De DB-write blijft geguard door `language IS NULL`, dus redundante aanroepen zijn veilig.
  - `src/app/api/tracks/[id]/route.ts` — de directe `detectLanguageFromLyrics`-aanroep in de PATCH-route (`detectLanguage: true`) vervangen door de lokale detector; import omgezet.
  - `src/components/player/hooks/useTrackBackgroundServices.ts` — `scheduleLanguageDetectionIfNeeded` blijft bestaan maar is nu uitsluitend een inhaalpad voor rijen die vóór deze wijziging zijn geschreven; commentaar aangepast om die rol vast te leggen, zodat niemand denkt dat detectie nog steeds bij afspelen gebeurt.
  - `src/app/api/smart-archive/route.ts` — `rating` toegevoegd aan de tracks-select en aan de payload, plus een vijfde query die `playlistTracks` inner-joint met `playlists`. De join is bewust via `playlists` heen zodat de `userId`-guard in de query zit in plaats van in de trust van de aanroeper; `isSystem: false` sluit `Favorieten` en `Master Tracks` uit, want die worden al afgedekt door het hartje en door de bestaande waarschuwing. Namen worden per track gegroepeerd zodat een track in drie playlists ze alle drie bewaart.
  - `src/app/smart-archive/page.tsx` — `rating` en `playlistNames` aan het tracktype; hartje (roze, `aria-label="Favoriet"`) en playlistnamen als chip naast de bestaande badges, met volledige namen in de `title` zodat de truncate niets verbergt.
  - Created `src/lib/__tests__/detect-lyrics-language.test.ts` — 12 tests: alle 13 talen op echte lyricfragmenten, de code-mapping (regressievang: franc geeft `nld`/`cmn`, de rest van de app opslaat `nl`/`zh`), de `only`-filter, `null` bij lege/korte invoer, de herhalingsbewaking, en het negeren van tags en parenthesen. Eén test documenteert bewust een grens: franc geeft ook een taal bij keyboard-garbage ("asdf qwer zxcv hjkl" → Duits). Dat is niet opgelost omdat het een echte text-vs-noise-vraag is die een eigen oplossing verdient; de test faalt daar niet op maar legt de beperking vast.
  - Modified `melodiq-user.md` — taalherkomst en de nieuwe hartjes/playlist-weergave beschreven.
  - Validated with `npx tsc --noEmit` (0 errors), `npm run test` (88 tests geslaagd, 10 bestanden) and `npm run build` (geslaagd, exitcode 0); ✅ gevalideerd

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

## 2026-08-28 vr 01:59 (Fix 400 Bad Request bij track upload: ontbrekende s3_key_mp3 kolom in runtime schema & audio duration detectie)

- Findings: Na de toevoeging van `s3KeyMp3` en `s3KeyOgg` kregen gebruikers bij het uploaden van een track een HTTP 400 (Bad Request). De runtime helper `ensureWorkspaceSchema()` in `src/lib/workspaces.ts` bevatte wel `ALTER TABLE tracks ADD COLUMN IF NOT EXISTS s3_key_ogg text`, maar niet `s3_key_mp3` en ontbrekende user/track alias kolommen. Als gevolg hiervan faalde de database insert query in PostgreSQL zodra `s3KeyMp3` werd weggeschreven, waardoor de upload in het catch-blok terechtkwam en werd afgewezen. Daarnaast forceerde `extractAudioDuration` hardcoded `audio/mpeg`, waardoor non-MP3 formaten (OGG, WAV, FLAC) geen duur konden bepalen.
- Conclusions: Breid `ensureWorkspaceSchema()` uit met `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` voor alle actuele kolommen van `tracks` en `users` (inclusief `s3_key_mp3`). Update `extractAudioDuration` om het audioformaat / de MIME-type te accepteren zodat `music-metadata` ook voor OGG, WAV en FLAC de juiste trackduur uitleest.
- Actions:
  - Modified `src/lib/workspaces.ts` — `ensureWorkspaceSchema()` uitgebreid met `s3_key_mp3`, licentie-, DNA-, alias- en collaboration-kolommen voor `tracks` en `users`.
  - Modified `src/lib/audio-duration.ts` — `extractAudioDuration` accepteert nu een optioneel `format` argument en selecteert de juiste MIME-type via `contentTypeForFormat`.
  - Modified `src/app/api/tracks/route.ts` — `format` meegegeven aan `extractAudioDuration(audioBuffer, format)`.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608280159`.
  - Validated with `npm test` (39/39 tests geslaagd) en `npm run build` (succesvol afgerond met 0 errors).

## 2026-08-28 vr 02:08 (Upload success confirmation UI & asynchrone Ogg Vorbis conversie na upload)

- Findings: Na een succesvolle track upload ontbrak een duidelijke succesbevestiging (het uploadpanel bleef open met lege queue en geen duidelijke melding in de library). Daarnaast werd Ogg Vorbis-transcoding synchroon tijdens het upload-request uitgevoerd, wat de upload vertraagde.
- Conclusions: Verplaats de OGG-transcoding naar een asynchrone achtergrondtaak die pas start nadat de track succesvol in de database en S3 is opgeslagen. Voeg een prominente succesbevestiging toe in het `UploadPanel` met overzicht van geüploade tracks, knoppen voor "Upload More" en "Done", en toon een zwevende succes-toast in `LibraryPage`.
- Actions:
  - Modified `src/app/api/tracks/route.ts` — synchrone transcodeToOgg verwijderd uit upload-loop; achtergrondtaak toegevoegd in `if (inserted[0])` die de audio pas na succesvolle upload naar Ogg Vorbis transcodeert en `s3KeyOgg` update.
  - Modified `src/components/library/UploadPanel.tsx` — `uploadedHistory` state toegevoegd; prominente succesbevestigingskaart toegevoegd met geüploade tracks en duidelijke actieknoppen; footerknop toont "Done / View in Library".
  - Modified `src/app/library/page.tsx` — `uploadToast` notificatietoast toegevoegd die direct na uploadbevestiging verschijnt en na 5 seconden automatisch verdwijnt.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608280208`.
  - Validated with `npm test` en `npm run build`.

## 2026-08-28 vr 02:17 (OGG formaat-label en downloadknop toegevoegd aan TrackCard)

- Findings: Op de track-rijen in de library en afspeellijsten ontbrak een specifiek OGG-formaatlabel (zoals MP3, WAV en FLAC die al hadden) wanneer er een Ogg Vorbis-versie (`s3KeyOgg`) van de track beschikbaar is.
- Conclusions: Voeg een "OGG"-label en downloadactie toe aan zowel de desktop-actierij als de mobiele downloadrij in `TrackCard.tsx`, zodat gebruikers direct de OGG-versie kunnen downloaden en zien dat OGG beschikbaar is.
- Actions:
  - Modified `src/components/tracks/useTrackCardActions.ts` — `handleDownload` uitgebreid met optionele `formatOverride` parameter.
  - Modified `src/components/tracks/TrackCard.tsx` — OGG-downloadknop en label toegevoegd aan de desktop- en mobiele actiebalk wanneer `track.s3KeyOgg` aanwezig is.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608280217`.
  - Validated with `npm test` en `npm run build`.

## 2026-08-28 vr 04:55 (MP3 verwijderen na succesvolle OGG conversie)

- Findings: Wanneer een track met een MP3-bestand succesvol wordt omgezet naar Ogg Vorbis (via upload achtergrondtaak, single convert of batch convert), bleef het originele MP3-bestand dubbel op S3 en in de database bewaard, wat onnodige opslagruimte innam.
- Conclusions: Controleer bij elke OGG-conversie of er een MP3-versie bestaat voor de track. Verwijder het MP3-bestand na een succesvolle OGG-upload van S3 en update het trackrecord zodat `s3KeyMp3` op `null` wordt gezet en `format` / `s3Key` naar het OGG-bestand wijzen.
- Actions:
  - Modified `src/app/api/tracks/[id]/convert-ogg/route.ts` — MP3-detectie en automatische S3-verwijdering + DB-update toegevoegd na succesvolle OGG-upload.
  - Modified `src/app/api/tracks/convert-ogg/route.ts` — MP3-detectie en automatische S3-verwijdering + DB-update toegevoegd in batch-conversie.
  - Modified `src/app/api/tracks/route.ts` — achtergrondtaak na MP3-upload verwijdert het MP3-bestand van S3 zodra de OGG-versie gereed is en update het database-record naar OGG.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608280455`.
  - Validated with `npm test` en `npm run build`.

## 2026-08-28 vr 13:06 (Beste audiobron selecteren bij OGG conversie: WAV > FLAC > MP3)

- Findings: Bij OGG-conversies werd direct het eerste beschikbare bronbestand (`s3KeyHd || s3Key || s3KeyMp3`) gepakt, wat kon betekenen dat een lagere kwaliteit MP3 werd gekozen terwijl er ook een lossless WAV of FLAC bestand beschikbaar was.
- Conclusions: Implementeer een strikte prioriteringsfunctie (`getBestSourceForOggConversion`) die altijd het beste audioformaat selecteert: ongecomprimeerd WAV eerst, daarna lossless FLAC, en pas daarna MP3 als fallback.
- Actions:
  - Modified `src/lib/audio-format.ts` — `getBestSourceForOggConversion` geïmplementeerd met prioriteit WAV > FLAC > MP3 > fallback.
  - Modified `src/app/api/tracks/[id]/convert-ogg/route.ts` — `getBestSourceForOggConversion` toegepast voor individuele OGG-conversie.
  - Modified `src/app/api/tracks/convert-ogg/route.ts` — `getBestSourceForOggConversion` toegepast voor batch OGG-conversie.
  - Modified `src/lib/__tests__/audio-format.test.ts` — unit tests toegevoegd voor `getBestSourceForOggConversion`.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608281306`.
  - Validated with `npm test` en `npm run build`.

## 2026-08-28 vr 13:50 (Fix track switching bij play op TrackCard in library)

- Findings: Wanneer er al een track speelde en de gebruiker op de play-knop van een andere trackcard klikte, switchte de audiospeler niet naar de nieuwe track. Dit werd veroorzaakt doordat `playTrackFromGesture` de download-URL (`/api/tracks/[id]/download`) in de audio element `src` laadde (die `Content-Disposition: attachment` headers terugstuurde waardoor streaming faalde), en in `TrackList.tsx` audiokeys zoals `s3Key`, `s3KeyMp3` en `s3KeyOgg` niet correct werden doorgegeven.
- Conclusions: Zorg dat `playTrackFromGesture` altijd het streaming endpoint (`/api/tracks/[id]/stream`) gebruikt in plaats van de download-route, en geef de volledige track-audiokeys door in `TrackList.tsx`, `library/page.tsx`, `useTrackPlayer.ts`, `playlists` en `workspaces`.
- Actions:
  - Modified `src/lib/stores/playerStore.ts` — streaming URL resolver gecorrigeerd zodat altijd `/api/tracks/[id]/stream` wordt gebruikt voor lokale streaming.
  - Modified `src/components/TrackList.tsx` — alle audiokeys (`s3Key`, `s3KeyHd`, `s3KeyMp3`, `s3KeyOgg`) en metadata behouden in `handlePlay`.
  - Modified `src/app/library/page.tsx` — alle audiokeys behouden in `handlePlayTrack`.
  - Modified `src/hooks/useTrackPlayer.ts` — alle audiokeys behouden in `handlePlayTrack`.
  - Modified `src/app/playlists/[playlistId]/page.tsx` — alle audiokeys behouden in `handlePlayTrack`.
  - Modified `src/app/workspaces/[workspaceId]/page.tsx` — alle audiokeys behouden in `handlePlayTrack`.
  - Modified `src/app/archive/page.tsx` — `s3Key: null` overwrite verwijderd.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608281537`.
  - Validated with `npm test` en `npm run build`.

## 2026-08-28 vr 16:11 (Go to track toegevoegd aan player track menu)

- Findings: In het menu met de 3 puntjes op de audiospeler onderaan ontbrak een optie om direct naar de huidige afspelende track in de bibliotheek te springen.
- Conclusions: Voeg de actie "Go to track" / "Naar track" toe bovenaan het actiemenu (3 puntjes) van `Player.tsx`, met direct scrollen en oplichten van de track in `TrackList`.
- Actions:
  - Modified `src/components/Player.tsx` — "Go to track" actieknop toegevoegd in het 3-dots dropdown menu dat `handleJumpToNowPlaying` aanroept.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608281611`.
  - Validated with `npm test` en `npm run build`.

## 2026-08-28 vr 16:28 (Direct OGG-label tonen op track card na succesvolle conversie)

- Findings: Na het succesvol converteren van een track naar Ogg Vorbis via het menu, werd het OGG-label op de trackcard pas zichtbaar na een handmatige pagina-refresh, omdat de kaart geen lokale state voor het formaat bijhield en het globale `tracks-changed` event niet direct werd afgevuurd.
- Conclusions: Voeg `localS3KeyOgg` en `localFormat` states toe aan `TrackCard.tsx` en update deze direct in `handleConvertOgg`. Vuur tevens `tracks-changed` af en gebruik `effectiveS3KeyOgg` / `effectiveFormat` voor de mobiele en desktop format-badges en de menuknop.
- Actions:
  - Modified `src/components/tracks/TrackCard.tsx` — reactieve lokale format en s3KeyOgg states geïmplementeerd; `handleConvertOgg` update de kaart direct en vuurt `tracks-changed` af.
  - Updated `src/components/Sidebar.tsx` — buildVersion naar `202608282125`.
  - Validated with `npm test` en `npm run build`.

## 2026-09-21 ma (TrackList scrolt automatisch naar spelende track)

- Findings: TrackList scrolde alleen eenmalig naar de gerestaureerde track bij laden (hasScrolledToRestoredTrack-flag); bij elke volgende trackwissel (klik op play, autoplay-next) gebeurde er niets, en de scroll-to-track handler deed slechts een enkele 100ms retry waardoor gepagineerde rijen soms nooit verschenen. De zichtbaarheidscheck telde een track boven de viewport ten onrechte als zichtbaar, en de observer werd nooit opnieuw aangemaakt als de lijst later laadde.
- Conclusions: Volg currentTrack op ID (niet object-identiteit) en scroll bij elke nieuwe ID met retry-loop tot ~800ms; alleen skippen als de track niet in deze lijst zit of weggefilterd is door zoeken. Zichtbaarheids-observer opnieuw koppelen bij paginatie en correct boven/onder de viewport detecteren, zodat de Huidige-track-knop klopt.
- Actions:
  - Modified src/components/TrackList.tsx � eenmalige restore-flag vervangen door autoScrolledTrackIdRef + currentTrackId-effect met paginatie-reveal en retry; visibility-observer deps uitgebreid naar paginatedTracks met correcte boven/onder-check; scroll-to-track handler met retry-loop en boolean-return.
  - Validated with 
px tsc --noEmit en 
pm run build � succesvol.

## 2026-09-21 ma (Auto-scroll TrackList uitgezet op verzoek)

- Findings: Gebruiker wil juist geen automatisch scrollen naar de spelende track.
- Conclusions: Auto-volg effect verwijderd; scrollen gebeurt alleen nog handmatig via Huidige-track-knop of scroll-to-track events.
- Actions:
  - Modified src/components/TrackList.tsx � auto-scroll effect en ref verwijderd.
  - Validated with `npx tsc --noEmit` en `npm run build` — succesvol.

## 2026-09-21 ma (Play-knop schakelt niet over: stale gesture-marker)

- Findings: Highlight versprong wel naar de geklikte track maar het geluid bleef het oude nummer spelen; pauze/play bedienden daarna ook het oude geluid. Oorzaak: non-gesture loads (autoplay playNext/next/previous) wisselen .src zonder dataset.gestureTrackId bij te werken, waardoor die marker stale achterbleef. Bij een latere klik op die stale track sloegen zowel de store-guard (isSameTrackAlreadyLoaded) als het Player-effect het laden over en deed play() gewoon het oude geluid hervatten.
- Conclusions: Skip-guard moet naast de marker ook de geladen src met de verwachte track-URL vergelijken; Player-effect moet de marker bij elke full-load bijwerken zodat hij de werkelijkheid blijft volgen.
- Actions:
  - Modified src/lib/stores/playerStore.ts � isSameTrackAlreadyLoaded vergelijkt nu currentSrc/src genormaliseerd met de berekende track-URL; stale marker laadt opnieuw, terecht geladen track slaat nog steeds over (ook na ?v= token-wissel herlaadt hij nu correct).
  - Modified src/components/Player.tsx � gestureTrackId wordt bijgewerkt na elke full-path load en in de already-playing early-return.
  - Added src/lib/stores/__tests__/player-switch.test.ts � 3 tests (normale wissel, stale-marker regressie, skip bij terecht geladen track); regressietest faalt aantoonbaar op oude code met exact het gemelde symptoom.
  - Validated with `npx vitest run` (64 passed), `npx tsc --noEmit` en `npm run build` — succesvol.

## 2026-09-22 di (Smart Archive: beschermde tracks nooit meer aanbieden)

- Findings: Smart Archive bood gepubliceerde tracks, Song Archive-master tracks en tracks die op playlists staan wél nog als kandidaat aan — alleen uitgegrijsd met een slotje (checkArchiveGuards zette `blocked`). De wens: deze tracks nooit meer tonen, ook niet als niet-selecteerbare rij.
- Conclusions: Filteren moet vóór het groeperen gebeuren, niet erna — anders kan een groep blijven bestaan die alleen nog matcht via de net verborgen track. De guards blijven als tweede net (tweede query-rondes) en als verdediging in /api/tracks/[id]/archive zelf.
- Actions:
  - Modified `src/lib/smart-archive.ts` — nieuwe pure `filterArchivableCandidates()` (releaseStatus `published`, master in song_archive zonder parentId, trackId in playlist = excluded); `findDuplicateCandidateGroups` haalt master- en playlist-ids in twee batch-queries op en filtert vóór `groupBySimilarity`.
  - Modified `src/app/api/smart-archive/route.ts` — tracks die alsnog als blocked uit de guards komen worden uit de groep gefilterd (default: ontbrekende guard = blokkeren) en groepen met minder dan 2 tracks verdwijnen.
  - Modified `src/lib/__tests__/smart-archive.test.ts` — 3 tests voor `filterArchivableCandidates` (19 tests totaal groen).
  - Validated with `npx vitest run` (alle 9 testbestanden groen), `npx tsc --noEmit` en `npm run build` — succesvol.

## 2026-09-22 di 18:14 (Settings > LLM: actieve provider zichtbaar + Retrieve Models voor Eden AI)

- Findings: Op Settings > Providers > LLM was niet te zien welke provider daadwerkelijk actief was — de drie accordions toonden alleen een Configured/Connected-badge, terwijl de routing (`*_LLM_PROVIDER`) pas in AI Routing staat. Ook ontbrak er een "Retrieve Models"-knop voor Eden AI: die knop was hardgecodeerd op `provider.id === "openrouter"`. Eden AI wordt wel automatisch geladen bij page-load, maar als dat fetchen faalt (502/timeout) bleven alle dropdowns op "Retrieve models to select" staan zonder enige manier om te retryen; de enige Retrieve-knop (in AI Routing) haalde bovendien altijd alleen OpenRouter op.
- Conclusions: Los de twee losse punten op zonder de routing-architectuur te veranderen: (1) een "Active"-chip direct op de provider-accordion, berekend uit de `*_LLM_PROVIDER`-settings, zodat het LLM-tab op zichzelf al het antwoord geeft; (2) Eden AI-knop als manual/retry-pad naast de eager load — geen aparte fetch-logica, dezelfde publieke endpoint. In AI Routing krijgt elke geroutete provider z'n eigen Retrieve-knop, zodat er nooit een OpenRouter-knop staat als alles naar Eden AI (of OpenAI) geroutet is.
- Actions:
  - Modified `src/components/settings/ProviderAccordion.tsx` — optionele `activePurposes?: string[]`-prop; groene "Active: …"-chip (met purposes + tooltip) of grijze "Not in use"-chip naast de statusbadge; wordt niet gerenderd als prop ontbreekt (music-providers ongewijzigd).
  - Modified `src/components/settings/ProviderSection.tsx` — `activePurposes` doorgeven; "Retrieve Models"-knop toonen zodra `onGetModels` bestaat (id-check `openrouter` verwijderd).
  - Modified `src/app/settings/page.tsx` — module-level `LLM_ROUTING_PURPOSES` (6 doelen; Timecoded volgt Lyrics en staat er niet los in), `purposesFor(providerId)`-helper, gedeelde `fetchEdenAiModels()`, nieuwe state `retrievingEdenAiModels` + `getEdenAiModels()` (manual retry), Eden AI ProviderSection krijgt `onGetModels`/`activePurposes`, AI Routing-sectie krijgt `onGetEdenAiModels`/`testingEdenAiModels`.
  - Modified `src/components/settings/AiRoutingSection.tsx` — header toont nu "Retrieve OpenRouter Models" en/of "Retrieve Eden AI Models" afhankelijk van welke providers de doelen daadwerkelijk gebruiken; verouderde Models-omschrijving en componentcomment gecorrigeerd (Eden AI heeft óók een picker, geen plain text field).
  - Validated with `npm run build` — succesvol (build number 202609221814 automatisch via next.config.mjs).

## 2026-09-26 za 17:31 (Cleanup losse debug-scripts + shift-select voor tracks)

- Findings: De projectroot bevatte 12 losse debug-scripts uit eerdere incidenten (PoYo WAV-problemen, ontbrekende DB-kolommen, track-healing). Ze waren nergens meer door code, CI of documentatie van de productie-kant in gebruik, en de databasekolommen die ze toevoegden (audio_url_hd, s3_key_hd, format_hd, rating, wav_job_id) staan inmiddels al in src/db/init.ts en de Drizzle-migraties. Daarnaast had de selectie in de tracklijsten een asymmetrie: Shift-klik werkte wel op TrackCard, maar Ctrl/Cmd+klik op de kaart-body opende het track-detail in plaats van los te selecteren, en Slim Archief kende helemaal geen range-selectie.
- Conclusions: Debug-scripts die een al opgelost incident vastleggen horen niet in de root van een productie-repo; de codebase wordt lastiger te doorzien en ze geven het risico dat iemand ze nog draait. Voor de selectie is de gebruikelijke file-manager-conventie de juiste keuze: gewone klik = los togglen, Ctrl/Cmd = los toevoegen zonder de anchor te verplaatsen, Shift = bereik vanaf de anchor. De bestaande useSelectionStore had al een anchor en een range-modus, maar de additive modus ontbrak en elke lijsten interpreteerde modifier-keys op zijn eigen manier.
- Actions: 12 debug-scripts verwijderd via git rm (add-wav-job-id-column.sh, check-columns.sh, check-db-scratch.ts, check-tracks-api.js, check-tracks-browser.js, check-wav-status-browser.js, check-wav-status-db.sh, fix-columns.sh, fix-db-schema.sh, heal-track-manual.ts, retry-wav-browser.js, test_parse.ts); operationele scripts (migrate.sh, deploy-to-vps.ps1, migrate-vps.ps1, check-vps-logs.ps1, check-vps-lyrics.ps1) bewust behouden. src/lib/stores/uiStores.ts: SelectionMode-type toegevoegd (toggle | range | additive), selectionModeFromEvent() als gedeelde helper ge�xporteerd, en additive modus toegevoegd die de anchor bewust niet verplaatst zodat Ctrl-klik + Shift-klik nog vanaf de oorspronkelijke rij spant. src/lib/store.ts: SelectionMode en selectionModeFromEvent ge�xporteerd. src/components/tracks/TrackCard.tsx: onToggleSelection prop gewijzigd van shiftKey-boolean naar SelectionMode, kaart-body gebruikt nu selectionModeFromEvent zodat Ctrl/Cmd+klik niet meer navigeert, selectie-dot en tooltip bijgewerkt. src/components/TrackList.tsx: handleToggleSelection geeft de modus door. src/app/smart-archive/page.tsx: per-groep anchors in een ref (checkedAnchorRef) plus een selectableTrackIdsByGroup-memo zodat blocked tracks nooit via een range worden aangevinkt, checkbox afgehandeld via onClick (Reacts onChange draagt geen modifier-keys), stale group-anchors opgeruimd in fetchGroups. Validated met npx tsc --noEmit (0 errors), npm run test (67 tests geslaagd) en npm run build (geslaagd, bestaande Turbopack NFT-warning).


## 2026-09-26 za 18:39 (Select all per groep in Slim Archief)

- Findings: Slim Archief bood wel losse checkboxes en (na de vorige wijziging) shift-range-selectie, maar geen manier om een hele groep in een keer aan te vinken. Bij een groep van vijf vrijwel identieke duplicaten kostte dat vijf losse klikken voor de gebruikelijke workflow "deze hele groep is afval, archiveer hem".
- Conclusions: De knop hoort in de groepskop rechts van de match-labels, omdat de actie groep-breed is en niet track-breed. De bestaande selectableTrackIdsByGroup-memo wordt hergebruikt zodat geblokkeerde tracks (published, Master Track of in een playlist) consistent met de rest van de pagina nooit worden geselecteerd. De drie-staps statusindicator is gekopieerd van de select-all-knop in TrackListHeader zodat beide pagina's dezelfde visuele taal delen.


## 2026-09-26 za 19:58 (Verborgen tracks: niet-destructief verbergen naast archiveren)

- Findings: De bestaande "Archive selected"-knop op Slim Archief doet al wat de gebruiker wilde (tracks verdwijnen uit de Library en komen in het Archief-tabblad), maar is destructief: POST /api/tracks/[id]/archive verwijdert HD/WAV, stems en masters echt uit S3, en herstellen levert die bestanden niet terug. "Alleen zichtbaar op de archief-pagina zonder iets kwijt te raken" bestond dus nog niet. Eerder was al vastgesteld dat `archivedAt` overal consequent in lijstqueries wordt gefilterd, dus dat patroon kon rechtstreeks worden gekopieerd.
- Conclusions: Nieuwe state `hiddenAt` als losse timestamp naast `archivedAt`, niet een boolean `isVisible`. Reden: het project gebruikt al exact dit patroon voor archivedAt en deletedAt, dus een aanpak voor alle drie in plaats van twee mechanismen. Een timestamp levert bovendien gratis de datum op in het Archief-tabblad, en `IS NULL` op een geindexeerde kolom kost hetzelfde als `= false`. Een boolean zou defaulten op `true`, waardoor de niet-gefilterde toestand de default is en bestaande rijen stilletjes afwijken. De index is bewust partieel (`WHERE hidden_at IS NULL`): zolang vrijwel alle tracks zichtbaar zijn is dat een veel kleinere index, en de filterende queries zijn de drukste. Verbergen krijgt geen archive-guards: er wordt niets verwijderd, dus een verborgen published of Master Track blijft gewoon geldig staan waar hij stond. De twee states zijn bewust onafhankelijk: een track kan verborgen én gearchiveerd zijn en elk apart worden teruggedraaid.
- Actions: `src/db/schema.ts` — `hiddenAt: timestamp("hidden_at")` plus partieel index `tracks_user_id_created_at_hidden_idx` op (userId, createdAt) met `WHERE hidden_at IS NULL`, en `sql` toegevoegd aan de drizzle-orm import. `drizzle/0007_hidden_tracks.sql` gegenereerd via `drizzle-kit generate`. `src/db/init.ts` — `hidden_at` toegevoegd aan createTablesSql en aan alterTracksSql (inclusief de index, zodat bestaande installaties hem ook krijgen). `src/app/api/tracks/[id]/hide/route.ts` — nieuwe route: POST zet hiddenAt (409 als de track in de prullenbak staat, want dan zou hij onvindbaar worden zonder de optie om hem permanent te verwijderen), DELETE leegt hiddenAt en raakt archivedAt niet aan. `src/app/api/tracks/route.ts` — `hiddenAt` in trackListSelect, nieuwe `?hidden=true` param, `archiveOnly` vervangt `archivedOnly` en haalt verborgen én gearchiveerde tracks op (ze zitten in hetzelfde tabblad), en de status- en default-queries plus de timeout- en active-poll-queries filteren nu op hiddenAt. `src/lib/smart-archive.ts`, `src/lib/songs.ts` (beide published-gates), `src/lib/apimart-wav.ts`, `src/lib/apimart-lyrics.ts`, `src/app/api/discover/artist/[userId]/route.ts` — hiddenAt-filter toegevoegd. `src/lib/stores/playerStore.ts` — beide queue-filters sluiten nu `!t.hiddenAt` in zodat een verborgen track niet in de afspeelwachtrij belandt. `src/lib/hooks/use-archive-tracks.ts` — `useHideTracks()` naast `useArchiveTracks()`, zelfde sequentiele conventie. `src/components/tracks/SelectionActionPill.tsx` — verberg-icoon naast het prullenbak-icoon. `src/components/TrackList.tsx` — `handleMassHide` + `executeMassHide` met bevestigingsvenster en resultatenmelding, en de pill krijgt `hiding`/`onMassHide`. `src/components/tracks/TrackActionMenu.tsx` — "Verbergen"-knop (sky-blauw, naast het amberkleurige "Archiveren"), bewust in een eigen blok zodat hij niet aan `onArchiveClick` gekoppeld is. `src/components/tracks/useTrackCardActions.ts` — `handleHide` voor losse tracks, bewust niet multi-select-aware omdat de pill die rol al heeft. `src/components/tracks/TrackCard.tsx` — bedrading van `onHideClick` zonder de `status === "done"`-voorwaarde die archiveren heeft. `src/app/library/page.tsx` — `fetchArchived` gebruikt nu `?hidden=true` en `handleRestoreArchivedTrack` roept per aanwezige status de bijbehorende endpoint aan, gevolgd door een refetch. `src/components/library/ArchivePanel.tsx` — onderscheid tussen verborgen, gearchiveerd en beide. `src/lib/i18n/messages/nl.ts` + `en.ts` — nieuwe keys en bijgewerkte `archiveDesc`. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (67 tests geslaagd), `npm run build` (geslaagd) en `npm run db:check-drift` (geen drift tussen init.ts en de migratieketen).

- Actions: `src/app/smart-archive/page.tsx` - `toggleSelectAllGroup()` toegevoegd die alle selecteerbare ids in een groep aanzinkt of juist weghaalt (afhankelijk van of alles al geselecteerd is), en de groep-anchor op de eerste selecteerbare rij zet zodat een volgende Shift-klik vanaf het begin van de groep spant in plaats van vanaf een verouderde positie; in de `groups.map` per groep `selectableCount` en `selectedSelectableCount` berekend voor een allSelected/someSelected-status, en een Select all / Deselect all-knop toegevoegd die alleen verschijnt wanneer de groep minstens een selecteerbare track bevat; `melodiq-user.md` versie bijgewerkt naar `202609261839` met een nieuw koppelje "Select all per groep (Slim Archief)"; gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (67 tests geslaagd) en `npm run build` (geslaagd).

## 2026-09-26 za 20:17 (Archiveren: harde blokkades vervangen door soft waarschuwingen)

- Findings: `checkArchiveGuards` blokkeerde archiveren hard voor published tracks, Master Tracks en playlist-leden (HTTP 409). Daarnaast weigerde de Slim Archief-pagina die tracks twee keer te tonen: `filterArchivableCandidates` in smart-archive.ts filterde ze voor de groepering, en de API-route filterde ze nog eens achteraf. De gebruiker wil ze juist wel kunnen archiveren, mits hij geinformeerd kiest. Twee losse problemen tegelijk gevonden: `deploy-to-vps.ps1` riep `./deploy.sh` aan dat nergens in de repo bestaat (waardoor de `&&`-keten na `git pull` stopte en de container nooit herstart werd), en drie van de vier ps1-scripts wezen naar `.../melodiq.nl` terwijl commit 7de5a64 ze bewust op `.../melodiq` had gezet om overeen te komen met de workflow.
- Conclusions: Blokkeren en waarschuwen zijn niet hetzelfde. De gebruiker wil een geinformeerde keuze, dus de status wordt een gedocumenteerde soft warning die de client vooraf toont, terwijl de server niet meer weigert. Belangrijk detail: `window.confirm` is synchroon en kan niet midden in het dialog awaiten, dus de waarschuwingen moeten vooraf worden opgehaald — vandaar een read-only GET op dezelfde route. Bij bulk-archiveren bestaat geen batch-endpoint, dus de waarschuwingen worden per track opgehaald maar in parallel zodat het een round trip is in plaats van N. De waarschuwingsteksten noemen de consequentie (een published track verdwijnt uit zijn release, een Master Track is de lyrics/prompt-bron van een Song Archive-item) in plaats van alleen het label, zodat het keuze-informatie is en geen afschrikkreet.
- Actions: `src/lib/archive-guards.ts` — `checkArchiveGuards` vervangen door `collectArchiveWarnings(trackId, userId)`: verzamelt alle waarschuwingen (published, master_track, in_playlist met het aantal) in plaats van bij de eerste te stoppen, en retourneert `notFound` apart. `src/app/api/tracks/[id]/archive/route.ts` — nieuwe read-only GET die de warnings teruggeeft zodat de client ze vooraf kan ophalen; POST stuurt de warnings mee in de response en geeft geen 409 meer. `src/app/api/smart-archive/route.ts` — `blocked`/`reasons` vervangen door `warnings`, het filteren achteraf geschrapt zodat deze tracks nu aangeboden worden. `src/lib/smart-archive.ts` — `filterArchivableCandidates` verwijderd en de twee beschermende queries (songArchive master / playlistTracks) plus de bijbehorende imports weg; de pre-grouping filter is dood omdat er niets meer uit te filteren valt. `src/lib/hooks/use-archive-tracks.ts` — de 409-afhandeling en de `blocked`-verzameling geschrapt; `blocked` blijft in het type staan zodat de resultaatvorm stabiel blijft. `src/app/smart-archive/page.tsx` — type, checkbox (niet meer disabled), waarschuwingsregel per track, waarschuwingen in het bevestigingsvenster naast de verwijderingen, en de "N blocked"-tekst geschrapt. `src/components/tracks/TrackCard.tsx` — `handleArchive` haalt de warnings op voor het bevestigingsvenster en plakt ze erin; de 409-alert weg; de dubbele `archiveDisabled`-prop opgeruimd. `src/components/TrackList.tsx` — `handleMassArchive` haalt de warnings parallel op en noemt de betreffende tracks in het bevestigingsvenster; de blocked-tak in de resultaatmelding weg. `src/lib/__tests__/smart-archive.test.ts` — de drie tests van de verwijderde `filterArchivableCandidates` vervangen door twee tests die vastleggen dat de functie niet meer bestaat en dat de groepering alle kandidaten meeneemt. `deploy-to-vps.ps1` — `./deploy.sh` vervangen door dezelfde stappen als de workflow (`git pull` + `docker compose up -d --build` + `docker image prune` + `docker compose ps`); geen migratiestap meer nodig want de container-CMD draait `drizzle-kit push --force` bij elke start. `check-vps-logs.ps1`, `check-vps-lyrics.ps1`, `migrate-vps.ps1` — VPS-pad gelijkgetrokken op `/var/www/vhosts/melodiq.nl/melodiq`. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (66 tests geslaagd), `npm run build` (geslaagd) en `npm run db:check-drift` (geen drift).

## 2026-09-26 za 21:07 (Playknop van een release naar het midden van de cover)
- Findings: Op de Releases-pagina stond de playknop van een release als losse ronde knop rechts van de metadatablok, terwijl de cover links een lege, niet-klikbare afbeelding was. Er stond ook geen playing-status op: de knop rendorde altijd een play-driehoek, ook wanneer de release al speelde. TrackCard heeft dat gedrag al wel (TrackPlayButton toont een pauze-glyph zodra de track daadwerkelijk speelt).
- Conclusions: De knop hoort op de cover, want dat is het natuurlijke affordance en het scheelt de lege cover op. Het hover-patroon van TrackPlayButton is gekopieerd: wit glyph, gedimde scrim die pas op hover verschijnt, en vastgezet met een pauze-glyph zolang de release speelt. De cover werd een `relative` container met een named group (`group/cover`) zodat de hover-state de hele cover beslaat in plaats van de hele section. Belangrijk detail: de cover zelf blijft een aparte button die de release opent, en de playknop ligt erbovenop met een hogere laag. Anders zou de knop de cover-overliggende navigatie blokkeren. De klik op de knop toggelt playback wanneer de eerste track van de release al geladen is, anders start hij de release — anders zou een tweede klik de release steeds opnieuw afspelen in plaats van te pauzeren.
- Actions: `src/app/releases/page.tsx` — cover herstructureerd van losse button naar `group/cover relative`-container met de playknop als absoluut gelegde overlay erin; de oude knop rechts uit de metadatablok verwijderd; `isPlaying` en `setIsPlaying` aan de bestaande `currentTrack`-regel toegevoegd (die stond er al, dus geen duplicaat); `t("releases.pause")` toegevoegd aan aria-label en title, conditioneel op dezelfde state als het glyph. `src/lib/i18n/messages/nl.ts` + `en.ts` — `pause` toegevoegd aan de `releases`-namespace (er bestond al een `pause` onder de discover-namespace, dus de type-gedefinieerde `TranslationKey` dwong een eigen key af). Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (66 tests geslaagd) en `npm run build` (geslaagd).

## 2026-09-26 za 21:48 (Slim Archief: groepeer ook op de taal van de lyrics)

- Findings: De similariteit in Slim Archief telde alleen lyrics, prompt, Audio DNA en titel. Twee tracks in verschillende talen die alleen een stijlbeschrijving delen scoorden daarom een perfecte 1.0 op de prompt en werden als duplicaat voorgesteld, terwijl het juist de interessantste false positives zijn: veel songs delen een prompt. Cruciaal: de `tracks.language`-kolom bestaat al, maar wordt alleen gevuld wanneer de gebruiker een track daadwerkelijk afspeelt (language-detect.ts, getriggerd vanuit useTrackBackgroundServices.ts). Op een koude bibliotheek is die kolom dus grotendeels NULL, wat een harde taalscheiding volledig zou stukmaken.
- Conclusions: Taal is een gescoord signaal geworden, geen harde scheiding, omdat de dekking onvolledig is. Een onbekende taal telt helemaal niet mee, zodat zulke paren exact zo scoren als voor deze wijziging; alleen wanneer beide kanten een taal hebben draagt het signaal gewicht. Een mismatch scoort 0 en geen fractie: het is een tegenspraak, geen gedeeltelijke overeenkomst. Een fractie bleek onmogelijk af te stemmen — elke penalty die een gedeelde stijlprompt onder de drempel kreeg, sloopte ook een paar met vrijwel identieke lyrics, en dat is precies het paar dat je wilt zien. Met 0 bij gewicht 0.3 vallen beide uit elkaar: gedeelde prompt + andere taal komt op ~0.50 (onder de 0.55-drempel) terwijl vrijwel identieke lyrics op ~0.57 eindigen en dus blijven groeperen. De overige gewichten zijn verschoven om de som van de gewichten te behouden: prompt 0.35 -> 0.30 en titel 0.10 -> 0.05, want de titel is het zwakste signaal en de prompt moest ruimte maken voor de taal.
- Actions: `src/lib/smart-archive.ts` — `WEIGHTS` uitgebreid met `language: 0.3` en prompt/titel hergewogen; `normalizeLanguage()` en `languageLabel()` toegevoegd, de eerste mapt aliases (Dutch/dutch/Nederlands/nl) op een canonieke sleutel en retourneert null voor "" en "unknown" (wat de detector geeft als hij het niet weet) zodat zulke paren ongemoeid blijven; `language` toegevoegd aan `TrackForSimilarity`, aan het signaal in `computePairScore` (alleen als beide kanten bekend zijn) en aan de tracks.select; `groupBySimilarity` bepaalt nu een dominantie-taal per groep, die null blijft zodra één lid afwijkt in plaats van iets te claimen dat niet klopt. `src/app/api/smart-archive/route.ts` — `languageLabel(group.language)` in de payload. `src/app/smart-archive/page.tsx` — `language` in het groepstype, `language` toegevoegd aan `MATCH_LABELS`, en een grijs taallabel in de groepskop naast de match-signalen. `src/lib/__tests__/smart-archive.test.ts` — 10 tests toegevoegd: alias-normalisatie, het gedrag bij onbekende taal, mismatch-score, het gedrag dat een cross-language paar met alleen een prompt verdwijnt terwijl hetzelfde paar zonder taaldata blijft groeperen, en de drie gevallen voor het groepslabel. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (76 tests geslaagd) en `npm run build` (geslaagd).

## 2026-09-27 zo 13:00 (Zelfde hover-playknop ook op de publieke Releases-pagina)

- Findings: Er bestaan twee releases-pagina's. Commit 947ba50 zette de hover-playknop alleen op `/releases` (Mijn Releases, `src/app/releases/page.tsx`). De publieke browse-pagina `/discover/releases` (`src/app/discover/releases/page.tsx`) was vergeten: daar stond nog de oude losse ronde knop rechts van de metadatablok, met `bg-gradient-to-br from-primary-400 to-primary-600` (het oranje/rode accent) en `hover:scale-105`. Die knop was altijd zichtbaar en had geen playing-status — hij rendorde altijd een play-driehoek, ook als de release al speelde. Vandaar dat het patroon "niet gedaan" leek na een harde refresh: het was op de andere pagina wél gedaan, niet op deze.
- Conclusions: Zelfde aanpak als op Mijn Releases, zodat beide pagina's identiek gedragen. De cover werd een `group/cover relative`-container; de cover zelf blijft een `Link` die de release opent en de playknop ligt als absolute overlay erbovenop, anders zou de knop de navigatie blokkeren. De `isThisReleasePlaying`-conditie staat in een IIFE gedefinieerd als lokale const, omdat dezelfde vergelijking drie keer nodig is: in `aria-label`, in `title` en in de glyph-keuze. De knop toggelt playback wanneer de eerste track van de release al geladen is, anders start hij de release — anders zou een tweede klik steeds opnieuw afspelen in plaats van pauzeren. De "Play all"-knop naast de paginatitel is bewust ongemoeid gelaten: dat is een headeractie voor de hele lijst, geen per-release affordance.
- Actions: `src/app/discover/releases/page.tsx` — `isPlaying` en `setIsPlaying` toegevoegd aan de bestaande `usePlayerStore`-selectors naast `currentTrack`; cover herstructureerd van losse `Link` naar `group/cover relative`-container met de playknop als absoluut gelegde overlay erin (wit glyph, `bg-white/10 backdrop-blur-sm`, `opacity-0 group-hover/cover:opacity-100`, scrim `group-hover/cover:bg-black/45`); de oude oranje knop rechts uit de metadatablok verwijderd. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (105 tests geslaagd) en `npm run build` (geslaagd).


## 2026-09-29 di (Release stemming: poll met max 3 versies + einddatum)

- Findings: Aan een release kon geen poll worden gekoppeld; bezoekers konden niet stemmen op hun favoriete versie. Publiek stemmen moet zonder login kunnen, met lichte misbruikremming via cookie.
- Conclusions: 1 poll per release (unique op releaseId), max 3 tracks als optie (validatie in `validatePollTrackIds`), 1 stem per `poll_voter` cookie (httpOnly, 1 jaar) + IP/UA-hash als signaal, wijzigen mag via upsert. Einddatum via `closesAt`: poll is dicht als `isOpen=false` of `closesAt <= now` (410 op stemmen). Track uit release halen ruimt ook de poll-optie op (votes cascaden via FK).
- Actions: `src/db/schema.ts` — `releasePolls`/`releasePollOptions`/`releasePollVotes` + relaties. `drizzle/0008_release_polls.sql` gegenereerd via `drizzle-kit generate`. `src/db/init.ts` — zelfde tabellen + FK's + indexen in createTablesSql voor bestaande installs. `src/lib/release-poll.ts` (+ `release-poll-constants.ts` zodat de client-component geen `postgres`-import meesleept) — `getReleasePollResult`, `validatePollTrackIds`, `ensureVoterId`, `hashVoter`, `isPollClosed`, `parseClosesAt`. `src/app/api/releases/[id]/poll/route.ts` — eigenaar GET/POST/PATCH/DELETE (auth + eigen release). `src/app/api/discover/releases/[id]/poll/route.ts` — publieke GET (geen auth, deelt voter-cookie uit, geeft `myOptionId`). `src/app/api/discover/releases/[id]/poll/vote/route.ts` — publieke POST met rate-limit, upsert per voterId. `src/app/api/releases/[id]/route.ts` — `remove-track` verwijdert ook poll-optie. `src/components/releases/ReleasePollManager.tsx` — eigenaar-UI op `/releases/[releaseId]`: max 3 tracks aanvinken, datetime-local einddatum, open/dicht, verwijderen, live uitslag. `src/components/releases/ReleasePollVote.tsx` — publieke stem-card op `/discover/release/[releaseId]`: stem/wijzig, %-balken, totaal, sluitdatum, gesloten-status. `melodiq-user.md` — Releases-sectie uitgebreid met Stemming; validated met `npm run build` (geslaagd).

## 2026-09-29 di (Poll: IP-tracking verwijderd om privacy-redenen)

- Findings: De vote-route las `x-forwarded-for`/`x-real-ip` + user-agent uit en sloeg een SHA256-hash daarvan op als `voterHash` — privacy-gevoelig en onnodig naast de voterId-cookie.
- Conclusions: Alleen de random `poll_voter`-cookie telt als identiteit; rate-limit is nu per voterId (alleen servergeheugen, reset bij herstart) in plaats van per IP. `voterHash` wordt altijd als null geschreven (kolom blijft nullable bestaan, dus geen migratie nodig). `hashVoter` + `crypto.createHash` verwijderd uit `lib/release-poll.ts`.
- Actions: `src/app/api/discover/releases/[id]/poll/vote/route.ts` — IP-headers en `hashVoter` eruit, cookie eerst lezen, rate-limit op voterId. `src/lib/release-poll.ts` — `hashVoter` verwijderd. Gevalideerd met `npx tsc --noEmit` (0 errors) en `npm run build` (geslaagd).

## 2026-09-29 di (Poll-maximum 3 → 5 versies)

- Findings: Poll-maximum van 3 versies bleek te krap; Bo wil max 5 tracks per poll.
- Conclusions: Alle validatie en UI lopen al via de centrale `MAX_POLL_OPTIONS`-constante, dus alleen die hoeft omhoog — geen migratie of API-wijziging nodig.
- Actions: `src/lib/release-poll-constants.ts` — `MAX_POLL_OPTIONS` 3 → 5. `src/db/schema.ts` — comment bijgewerkt. `melodiq-user.md` — "max 3" → "max 5". Gevalideerd met `npm run build` (geslaagd).

## 2026-09-29 di (Multi-select Add to Release: slechts 1 track kwam aan)

- Findings: Bij meerdere geselecteerde tracks in de Library riep `handleAddToReleaseClick` per track `addTrackToRelease` aan, dus N parallelle PATCH `add-track` requests. Elke request doet apart `max(position)+1` en insert — ze lazen dezelfde max, kregen dezelfde positie en botsten op de unique index `(release_id, position)`, waardoor er maar 1 overbleef.
- Conclusions: Eén bulk-actie `add-tracks` met één `max()`-lookup en sequentiële inserts voor de hele batch, zelfde patroon als `reorder-tracks`. Bestaande single `add-track` blijft voor de single-track flows (archief, losse track).
- Actions: `src/app/api/releases/[id]/route.ts` — nieuwe `add-tracks`-actie (trackIds-array, volgorde behouden, eigendom check, dupes overslaan tenzij allowDuplicate, cover-gen als de release leeg was). `src/lib/stores/releaseStore.ts` — `addTracksToRelease` (optimistisch + één PATCH + hydrate). `src/components/tracks/useTrackCardActions.ts` — multi-select tak gebruikt nu `addTracksToRelease`. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (105 geslaagd) en `npm run build` (geslaagd).

## 2026-09-29 di (TCL na genereren: Always open / Always ask / Never + popup)

- Findings: Na het genereren van Time-Coded Lyrics sprong de app altijd (default) of nooit naar de editor, via de boolean-setting `TCL_AUTO_JUMP_EDITOR`. Er was geen "vraag het mij"-optie met popup.
- Conclusions: Setting wordt drie standen (`always`/`ask`/`never`) met legacy-migratie in de normalisatie (`"false"` → never, `"true"`/leeg → always, oude default behouden). Bij `ask` verschijnt een neutrale modal met tracktitel en de keuze Open in editor / Stay here. De boolean-toggle in AI Routing is vervangen door een 3-weg segmented control; opslaan blijft direct (niet via save-all), zoals de toggle deed.
- Actions: `src/lib/tcl/editor-behavior.ts` — nieuw, `TclEditorBehavior` + `normalizeTclEditorBehavior`. `src/components/settings/AiRoutingSection.tsx` — toggle vervangen door radiogroup met Always open/Always ask/Never. `src/app/settings/page.tsx` — `toggleTclAutoJumpToEditor` vervangen door `setTclEditorBehavior`. `src/components/tracks/TrackCard.tsx` — done-handler vertakt op behavior, nieuwe `showTclDoneDialog`-modal. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (105 geslaagd) en `npm run build` (geslaagd).

## 2026-09-29 di (Trackpagina + releases-lijst stuk bij smalle hoofdkolom)

- Findings: Met een breed opengezet Track Details-paneel blijft er weinig over voor de hoofdkolom. Twee plekken konden daar niet mee omgaan, anders dan alle andere pagina's: de releases-lijst toolbar (`justify-end` zonder `flex-wrap` — overflow snijdt links af, onder de sidebar) en de trackpagina-hero/DNA-grid (`sm:`-breakpoints kijken naar de viewport, dus bij een platgedrukte kolom bleef de rij-layout staan). Een paneel-breedtecap was afgewezen: de andere pagina's hebben er geen last van, dus de pagina's zelf moesten het opvangen.
- Conclusions: Toolbar laten wrappen zoals Library/Discover al doen. Trackpagina omgezet op container queries (`@container` op main, `@sm:`-varianten voor hero/grid/plays-kolom): een smalle hoofdkolom degradeert nu exact zoals een smal venster (gestapelde hero, 2-koloms DNA, geen plays-kolom), ongeacht de viewport. Geverifieerd in de gebouwde CSS: `container-type:inline-size` plus `@container (min-width:24rem)` met precies deze varianten erin.
- Actions: `src/app/discover/releases/page.tsx` — `flex-wrap` op de filter-toolbar. `src/app/discover/track/[trackId]/page.tsx` — `@container` op main, `sm:` → `@sm:` voor hero-layout/padding/cover/titel/plays-kolom/DNA-padding/DNA-grid. Teruggedraaide paneel-clamp uit ResizablePanel verwijderd en de walkthrough-regel daarover ook weer weggehaald. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (105 geslaagd) en `npm run build` (geslaagd).

## 2026-09-29 di (Trackpagina: smalle links uitgelijnde kolom → breed gecentreerd)

- Findings: Alle pagina's (Library, Releases, release-detail) gebruiken `max-w-400 mx-auto` voor de contentkolom, maar de trackpagina gebruikte `max-w-3xl` zonder centrering. Met het (op deze pagina automatisch openende) details-paneel bleef er een smalle links plakkende kolom met een grote lege ruimte over — oogde kapot, bij alle releases/tracks.
- Conclusions: Zelfde kolom als alle andere pagina's; container queries uit de vorige ronde blijven als vangnet voor smalle situaties.
- Actions: `src/app/discover/track/[trackId]/page.tsx` — `max-w-3xl` → `max-w-400 mx-auto`. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (105 geslaagd) en `npm run build` (geslaagd).

## 2026-09-30 wo (Account: artiestenaliassen 5 → 10)

- Findings: De accountpagina limiteerde de artiestenaliassen tot 5 velden, en had daarvoor een eigen lokale `const MAX_ARTIST_ALIASES = 5` naast de canonieke constante in `src/lib/artist-aliases.ts`. Die duplicatie betekent dat de UI-limiet en de server-validatie (`validateArtistAliases` in de update-route) stil konden uit elkaar lopen.
- Conclusions: Eén bron van waarheid: de pagina importeert de constante uit de lib, en de limiet staat nu op 15 (was 10, verhoogd op 2026-10-06 op verzoek van Bo — "nog 5 artiestenaliassen nodig" — en daarna bij de 5→10-migratie). De server blijft de echte grens (via dezelfde constante), dus een handmatig request met meer aliassen wordt nog steeds geweigerd. De grid (`sm:grid-cols-2`) vult zich nu simpelweg met extra rijen.
- Actions: `src/lib/artist-aliases.ts` — `MAX_ARTIST_ALIASES` 5 → 10. `src/app/account/page.tsx` — lokale constante verwijderd, import toegevoegd. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (105 geslaagd) en `npm run build` (geslaagd).

## 2026-10-06 di (MAX_ARTIST_ALIASES 10 → 15)

- Findings: Terugloop — Bo had de 10 sloten gevuld en vroeg "nog 5 artiestenaliassen".
- Conclusions: Alleen de constante verhogen volstaat: de opslag is een JSON-array op de user-row (geen migratie of drift), en UI (accountpagina-grid met `Array(MAX_ARTIST_ALIASES)` slots), parse/serialize/validatie en de server-grens lezen dezelfde constante. Composer/writer blijven bewust op 5.
- Actions: `src/lib/artist-aliases.ts` — `MAX_ARTIST_ALIASES` 10 → 15. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-09-30 wo 23:30 (Artiestenpagina's: een publieke pagina per artiestennaam)

- Findings: De app had één publieke artiestenpagina, `/discover/artist/[userId]`, per *account*: naam = eerste alias, bio = account-bio, en alle gepubliceerde tracks van dat account. Er was geen entiteit "artiestenpagina" — aliassen waren alleen strings in `users.artist_aliases` (nu 10 slots). Wie onder meerdere namen werkt kon dus geen eigen pagina per naam hebben. Twee losse eindpunten kwamen daar nog bij: `users.profileImageUrl` wijst naar `/api/account/...`, en daar bestaat géén route die die key serveert, dus het account-portret 404't al sinds de uploadfeature.
- Conclusions: De trackset van een pagina wordt **afgeleid, niet opgeslagen**: de pagina matcht `tracks.artist_name` tegen de alias, precies de string die je bij upload uit je alias-dropdown kiest. Zo kan er geen tweede, handmatig onderhouden tracklijst naast de artiestennaam ontstaan, en hernoemen van een track's artiestennaam verplaatst hem meteen. De alias is daarom immutable op een pagina (anders zou de pagina stil leeg worden) en de slug wel wijzigbaar, want die staat los van de match. Bio en afbeelding zijn nullable met fallback naar het account, zodat een in één klik aangemaakte pagina er direct afgewezen uitziet. Alias moet al op het accountprofiel staan, anders zou je een pagina kunnen maken die nooit tracks kan krijgen. De publieke component is uit `/discover/artist/[userId]` getrokken zodat beide pagina's dezelfde markup delen en niet uit elkaar kunnen lopen.
- Actions: `src/db/schema.ts` — tabel `artist_pages` + `usersRelations`; `src/db/init.ts` en `src/lib/workspaces.ts` — idem in runtime-schema-ensure (draait bij elke startup); `drizzle/0009_artist_pages.sql` + snapshot (gegenereerd via `drizzle-kit generate`, daarna leesbaar hernoemd) + journal-entry. `src/lib/artist-pages.ts` — slugify/unieke slug/slug-validatie/bio-normalisatie/alias-check plus `publishedArtistTracksFilter` (de kernregel, apart zodat hij unit-getest kan worden). API: `src/app/api/artist-pages/route.ts` (lijst + aanmaken), `[id]/route.ts` (PATCH/DELETE), `[id]/image/route.ts` (upload profiel/hero, avif, eigen S3-key per variant), `src/app/api/artist/[slug]/route.ts` (publiek, geen auth) en `[slug]/image/route.ts` (publiek, serveert via cover-cache). UI: `src/components/artist/ArtistPublicPage.tsx` (getrokken uit de discover-pagina), `src/app/artist/[slug]/page.tsx`, `src/app/artist-pages/page.tsx` (beheer), `src/components/Sidebar.tsx` (menu-item onder Account + icoon), `src/middleware.ts` (`/artist/` publiek, met de slash zodat `/artist-pages` wél achter de login blijft), i18n-sectie `artistPages` in `en.ts` en `nl.ts`. `src/app/api/discover/artist/[userId]/route.ts` levert nu `imageUrl`/`heroUrl` i.p.v. drie losse hero-velden, en zet `imageUrl` op null met uitleg waarom. Validatie: `npx tsc --noEmit` (0 errors), `npm run test` (127 geslaagd, waarvan 22 nieuw in `src/lib/__tests__/artist-pages.test.ts`), `npm run build` (geslaagd), `npm run db:check-drift` ("No drift"), `drizzle-kit generate` ("No schema changes"). Handmatig end-to-end getest tegen een tijdelijke postgres (db + seed met gepubliceerde/verborgen/gearchiveerde/concept-tracks op twee aliassen): alias-validatie, aanmaken, dubbel (409), slug-conflict (409) en slug-formaat (400), IDOR (ander account krijgt 404 op PATCH en DELETE), bio-trim + fallback, hernoemen van slug (nieuw adres werkt, oude 404), verwijderen, en de publieke pagina per alias. Ook in de browser gedaan: aanmaken, bio opslaen en de publieke pagina bekijken. Gevonden en gefixt: `artistPages.tagline` stond in `en.ts` in het Nederlands — alleen zichtbaar door de pagina visueel te controleren.
- Open: het account-portret (`/api/account/{key}`) heeft nog steeds geen serveerroute en 404't. Buiten scope gelaten; de publieke artiestenpagina's hebben eigen afbeeldingen en vallen niet terug op die kapotte URL.

## 2026-10-01 do (Account-portret: serveerroute toegevoegd)

- Findings: `/api/account/upload-image` schreef S3-keys (`users/{userId}/{profile|hero}.{ext}`) en DB-URL's (`/api/account/{key}`), maar geen enkele route serveerde die URL's — elk account-portret en elke hero-afbeelding 404'te, op de Account-pagina én (na de vorige ronde) bewust weggelaten op de publieke artiestenpagina. Open punt uit de entry hierboven, nu opgelost.
- Conclusions: Nieuwe catch-all `src/app/api/account/[...key]/route.ts` (publiek, geen auth — portretten staan op publieke pagina's), die serveert via dezelfde cover-cache als de artiestenpagina-afbeeldingen. De echte grens zit in `src/lib/account-images.ts`: `parseAccountImageKey` laat alleen exact de vorm door die de upload schrijft (`users/` + uuid + `profile|hero` + image-extensie). Een blote catch-all zou ook `tracks/{id}/audio.mp3` uit S3 kunnen serveren, dus die strictheid is geen overdrijving maar het hele punt. De statische sibling `upload-image` blijft winnen van de catch-all (Next-voorkeur voor exacte segmenten). De discover-artiestenroute selecteert nu `profileImageUrl` en geeft hem als `imageUrl` mee (met CDN-prefix, net als covers) in plaats van hardcoded null.
- Actions: `src/lib/account-images.ts` (nieuw), `src/app/api/account/[...key]/route.ts` (nieuw), `src/app/api/discover/artist/[userId]/route.ts` (select + imageUrl + commentaar bijgewerkt), `src/lib/__tests__/account-images.test.ts` (6 tests: geldige vorm, lege segmenten, traversal, keys buiten `users/`, verkeerde types/extensies/id's, geneste segmenten). Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (133 geslaagd), `npm run build` (geslaagd, beide account-routes naast elkaar) en live tegen de dev server: traversal-key → 404 vóór S3, geldige-maar-niet-bestaande key → 404, GET op `upload-image` → 405 (catch-all slokt hem niet op).
- Open: de volledige happy path (echte bytes uit S3) is lokaal niet te testen — er is hier geen S3 geconfigureerd, dus de 404 na een geldige key is lokaal verwacht gedrag. Op de VPS met S3 moet een geüpload portret direct renderen; even controleren na deploy.

## 2026-10-02 vr 04:12 (Cover-404: geen optimistische coverUrl + onError-fallback)

- Findings: `/api/tracks/{id}/cover?t=...` 404'te drie keer parallel voor één track. Oorzaak: `scheduleAutoCoverGenerationIfNeeded` zette direct na de `202` van `PATCH regenerateCoverArt` een `coverUrl` op een cover die nog niet bestond (fire-and-forget), en spreadde bovendien `{accepted, requestedAt}` in het Track-object. Elke consumer (card, player, fullscreen) vroeg die URL meteen op.
- Conclusions: Zelfde patroon als `handleRegenerateCover` in `useTrackCardActions.ts`: pas een `coverUrl` exposen en `melodiq:cover-regenerated` dispatchen nadat `GET /api/tracks/{id}` een `s3KeyCover` met `updatedAt >= requestedAt` teruggeeft (poll max 2 min). Daarnaast verbergt `TrackPlayButton` een alsnog falende cover via `onError` en toont de placeholder, zodat een stale URL of missend S3-object geen kapotte `<img>` en 404-loop meer geeft.
- Actions: `src/components/player/hooks/useTrackBackgroundServices.ts` — optimistische setState vervangen door poll-loop, alleen `s3KeyCover`/`s3KeyCoverThumb`/`coverUrl` overnemen; `src/components/tracks/TrackPlayButton.tsx` — `coverFailed`-state met reset op URL-wissel en `onError`-fallback naar placeholder. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (137 geslaagd) en `npm run build` (geslaagd); validated.

## 2026-10-02 vr 04:18 (Inspiratie leeg = normale generatie, geen foutmelding)

- Findings: Genereren zonder inspiratietracks gaf `400 Select 1–4 inspiration tracks`. Twee lagen veroorzaakten dit samen: de client stuurde bij een lege kaart `inspirationTrackIds: []` mee (`useStudioActions.ts:187`), en de server zag een gedefinieerde-maar-lege lijst als fout (`generate/route.ts:97-99`).
- Conclusions: Geen aan/uit-vinkje nodig — een lege inspiratiekaart betekent vanzelf "uit" en is de simpelste UX. Client laat het veld weg bij 0 tracks, server behandelt ontbrekend/leeg als normale generatie en valideert alleen een niet-lege lijst (APIMart v6-eis blijft). `dispatchApimartInspo` wordt alleen bij `length > 0` aangeroepen, dus die defensieve guard daar kan blijven.
- Actions: `src/hooks/useStudioActions.ts` — `inspirationTrackIds` alleen meesturen als `inspiration.length > 0`; `src/app/api/generate/route.ts` — `400`-guard voor lege lijst verwijderd. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (137 geslaagd) en `npm run build` (geslaagd); validated.

## 2026-10-02 vr 04:22 (Inspiratie aan/uit-toggle)

- Findings: Vervolg op hierboven — Bo wil inspiratietracks kunnen parkeren maar per generatie kiezen of ze meegaan, zonder ze telkens te verwijderen en opnieuw toe te voegen.
- Conclusions: `inspirationEnabled`-vlag in de studio-store (persisted, default aan zodat bestaand gedrag behouden blijft). Uit = veld wordt niet meegestuurd en de v6-blokkade geldt niet → normale generatie, lijst blijft staan (gedimd). Een nieuwe track toevoegen (menu of drag) schakelt automatisch weer in, want dat is dan duidelijk de bedoeling.
- Actions: `src/lib/stores/studioStore.ts` — `inspirationEnabled` + setter, merge-guard, auto-enable bij toevoegen; `src/components/StudioForm.tsx` — switch naast de teller, dim + hint bij uit, v6-waarschuwing alleen bij aan; `src/hooks/useStudioActions.ts` — v6-blokkade en ids alleen bij aan + niet-leeg; i18n `inspirationToggleLabel`/`inspirationDisabledHint` in `nl.ts` + `en.ts`; `melodiq-user.md` Inspiration-sectie uitgebreid. Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run test` (137 geslaagd) en `npm run build` (geslaagd); validated.

## 2026-10-02 vr (Back-knop artist page)

- Findings: Artist page (/artist/[slug] en /discover/artist/[userId]) had geen manier om terug te gaan.
- Conclusions: Witte terug-pijl linksboven in de nav, passend bij de donkere hero. router.back() met fallback naar /discover als er geen history is. In gedeelde ArtistPublicPage gezet zodat beide routes het krijgen.
- Actions: `src/components/artist/ArtistPublicPage.tsx` — useRouter + handleBack + ronde witte pijl-knop linksboven naast "Official". Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-03 za (Artiest op My releases + overal klikbaar)

- Findings: Op de My releases-pagina (/releases list-weergave, de "grote cover"-hero) stond geen artiest onder de titel; release-detail (/releases/[releaseId]) toonde evenmin een artiest. Artiestnamen waren bovendien lang niet overal klikbaar (TrackCard linkte altijd naar de eigen /discover/artist-pagina, ook voor tracks van anderen of zonder pagina).
- Conclusions: Herbruikbare `ArtistLink`-component (link naar /artist/[slug] als er een artiestenpagina bestaat, anders fallback of platte tekst) met `useArtistSlugMap`-hook (één publieke fetch naar nieuwe GET /api/artists met alias+slug). Artiest onder de titel op list-hero (release.artistName, fallback eerste track), grid-card en detail-header; TrackCard, Discover-releases, Discover-release-detail en Explore gebruiken dezelfde link met fallback naar /discover/artist/[id].
- Actions: nieuw `src/app/api/artists/route.ts`, `src/hooks/useArtistSlugMap.ts`, `src/components/artist/ArtistLink.tsx`; aangepast `src/app/releases/page.tsx`, `src/app/releases/[releaseId]/page.tsx`, `src/components/tracks/TrackCard.tsx`, `src/app/discover/releases/page.tsx`, `src/app/discover/release/[releaseId]/page.tsx`, `src/app/explore/page.tsx`. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-03 za ("Go to artist" negeerde artiestenpagina)

- Findings: Vervolg op klikbare artiesten — het ⋮-menu-item "Go to artist" in TrackCard navigeerde altijd naar /discover/artist/[ownerId], ook als de artiest een eigen /artist/[slug]-pagina heeft. Voor aliassen van hetzelfde account (bv. Zora Zirkonia onder Bojans account) land je dan op de verkeerde pagina, want artistId is altijd de owner-user-id.
- Conclusions: Zelfde slug-resolutie (useArtistSlugMap) hergebruiken voor het menu-item: slug bekend → /artist/[slug], anders fallback naar /discover/artist/[artistId] zoals voorheen.
- Actions: `src/components/tracks/TrackCard.tsx` — artistPageSlug via resolveArtistSlug(track.artistName || artistAlias), onGoToArtist prefereert slug. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-03 za (Inspiratie-invloed slider, default 20%)

- Findings: Bij inspo-generatie ging altijd de generieke `audioWeight` (default 50) mee als `audio_weight` — die slider is alleen zichtbaar bij voice-clone en dus onvindbaar/onlogisch voor inspo, en 50% is te zwaar als default voor een referentie.
- Conclusions: Aparte `inspoAudioWeight` in de studio-store (persisted, 0–100, default 20 → 0.20 `audio_weight` per APIMart inspo-docs). Slider staat ín de Inspiratie-kaart en alleen bij aan + ≥1 track; server normaliseert/clamped en valt terug op 20 bij ontbreken. Generieke voice-`audioWeight` blijft ongewijzigd voor normale generatie.
- Actions: `src/lib/stores/studioStore.ts` — `inspoAudioWeight` + `setInspoAudioWeight` (clamp), merge-default 20, reset; `src/components/StudioForm.tsx` — slider in Inspiratie-sectie (%, 0.00-waarde + hint) conditioneel op `inspirationEnabled && inspiration.length > 0`; `src/hooks/useStudioActions.ts` — `inspirationAudioWeight` meesturen bij inspo; `src/app/api/generate/route.ts` — parsen/normaliseren (default 20) → `GenerationContext.inspoAudioWeight`; `src/lib/services/generationService.ts` — `dispatchApimartInspo` gebruikt `inspoAudioWeight/100` (default 0.2) als `audio_weight` + logging; i18n `inspirationAudioWeightLabel`/`Hint` in `en.ts` + `nl.ts`; `melodiq-user.md` Inspiration-sectie + versie `202610031509`. Gevalideerd met `npm run build` (geslaagd) en `vitest inspiration.test.ts` (2 geslaagd); validated.

## 2026-10-03 za (Track details-sidebar slide in/out animatie)

- Findings: De rechter Track Details-sidebar (`ResizablePanel`) deed `if (!show) return null` — openen/sluiten was een harde mount/unmount zonder transitie, op alle ~15 pagina's die het component gebruiken.
- Conclusions: Centraal in `ResizablePanel` opgelost zodat elke pagina het gratis krijgt: `mounted`-state stelt de unmount 300ms uit (slide-out kan afspelen), `open`-state drijft de transitie via dubbele rAF na mount. Buiten-`aside` animeert `width` (0↔breedte, overflow-hidden clipt), binnen-wrapper met vaste breedte animeert `translate-x` + `opacity` voor het echte slide-gevoel zonder content-squeeze. Resize-schrijft nu naar beide lagen (direct DOM, geen re-renders), resize-greep fade mee, `motion-reduce` respecteert verminderde beweging, `aria-hidden` bij dicht.
- Actions: `src/components/studio/ResizablePanel.tsx` — mounted/open-state + close-timer, width- en slide-transities (300ms ease-out), contentRef voor vaste binnenbreedte, width-sync effect; `melodiq-user.md` versie `202610031515`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (137 geslaagd, 15 bestanden); validated.

## 2026-10-03 za (Studio-formulierkolom resizable)

- Findings: De Studio-formulierkolom (lyrics + prompt) had een vaste `xl:w-[500px]` — op brede schermen geen manier om hem breder/smaller te zetten, terwijl de rechter details-sidebar al wel een sleepgreep heeft.
- Conclusions: Sleepgreep op de rechterrand van de formulierkolom (absoluut gepositioneerd in de bestaande gap, dus geen layout-wijziging), zelfde zero-re-render DOM-pattern als `ResizablePanel`: live breedte via ref tijdens slepen, één state-commit + localStorage-persist bij mouseup. Breedte 360–820px, default 500 (oude vaste breedte). Alleen op xl — daaronder stapelen de kolommen full-width en is er geen greep. Tracklijst-kolom (`flex-1`) vangt de restruimte op.
- Actions: `src/app/studio/page.tsx` — `useXlBreakpoint` (matchMedia 1280px), `formWidth`-state + `STUDIO_FORM_WIDTH_KEY`-persist, `startFormResize`, absolute greep met `role="separator"`; i18n `resizeFormColumn` in `en.ts` + `nl.ts`; `melodiq-user.md` versie `202610031518`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (137 geslaagd); validated.

## 2026-10-03 za (Studio-kolommen: min 35rem + 1rem gap)

- Findings: Vervolg op resizable formulierkolom — Bo wil de formulierkolom minimaal 35rem breed en 1rem gap tussen alle kolommen.
- Conclusions: `xl:min-w-[35rem]` op de formulierkolom + resize-clamp en default meegetrokken naar 560px (35rem), zodat slepen nooit onder het minimum kan (oude localStorage-waarden worden bij laden geclamped). Row-gap `xl:gap-8` → `xl:gap-4` (1rem); sleepgreep gecentreerd in de smallere gap (`-right-3`).
- Actions: `src/app/studio/page.tsx` — min/default/clamp 560, `xl:min-w-[35rem]`, `xl:gap-4`, greep `-right-3`; `melodiq-user.md` versie `202610031525`. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-03 za (Reuse Prompt neemt titel + vocal gender mee)

- Findings: Reuse Prompt zette alleen songIdea + lyrics terug in de Studio; titel en vocal gender moest Bo handmatig overnemen. Titel bestond wel op de track, maar vocal gender werd nergens bewaard (alleen Studio-store → provider bij generatie), dus er viel niets "mee te nemen".
- Conclusions: Gender wordt voortaan bij generatie opgeslagen in een nieuwe nullable `tracks.vocal_gender` ("female"|"male"; "auto" → null = onbekend) via migratie `0010_graceful_harpoon.sql` — lokaal toegepast, VPS volgt via de normale deploy-migratie. Alle insert-paden schrijven hem (route-insert + tweede tracks in PoYo/MusicGPT/Mureka/APIframe/APIMart/inspo/Tempolor); de tracklijst-API geeft hem terug. Payload draagt titel + gender in alle scopes (metadata, geen scope-inhoud); ontbrekende sleutel laat de Studio-waarde staan — belangrijk voor pre-migratie tracks zonder gender. Lege tracktitel wist de Studio-titel niet.
- Actions: `src/db/schema.ts` + `drizzle/0010_graceful_harpoon.sql` — kolom; `src/lib/services/trackService.ts` — `normalizeVocalGender` + insert-param; `src/app/api/generate/route.ts` + `src/lib/services/generationService.ts` — gender op alle inserts; `src/app/api/tracks/route.ts` — in lijstselect; `Track`/`TrackItem`-types uitgebreid; `src/lib/reuse-prompt.ts` — `ReuseTrack`/`ReusePayload`, titel- + gender-plumbing; `src/app/studio/page.tsx` + `useStudioActions.handleReusePrompt` — toepassen bij hergebruik; `useReusePrompt` types; tests +2; `melodiq-user.md` Reuse-sectie + versie `202610031531`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-03 za (Move to Workspace: direct zichtbaar + ga naar workspace)

- Findings: Na Move to Workspace veranderde er zichtbaar niets: de workspace-chip op de rij (`TrackCard:903`, via `track.workspaceId`) bleef uit omdat de store-move alleen `workspaces[].trackIds` bijwerkt en de pagina-trackobjecten pas bij de volgende refetch hun `workspaceId` leren. En er vond geen navigatie plaats (Library gaf geen callback mee; Studio selecteerde alleen).
- Conclusions: Centraal in `TrackList.handleMoveToWorkspace` (de enige funnel voor single-track moves) opgelost: na de store-move + page-callback wordt de workspace geselecteerd en naar `/workspaces/[id]` genavigeerd, zodat de verhuisde track daar direct staat. Voor de chip een optimistische overlay-map (`trackId → workspaceId` uit store-membership, default-workspace uitgezonderd) die alleen tracks zonder `workspaceId` aanvult — `TrackCard` blijft strikt op `track.workspaceId` matchen en server-truth wint bij refetch. Identiteitsstabiel via memo-map, dus `memo(TrackCard)` blijft werken.
- Actions: `src/components/TrackList.tsx` — `optimisticWorkspaceOverlayById`, `router.push` + `setSelectedWorkspaceId` in `handleMoveToWorkspace`, overlay bij `TrackCard`-prop; `melodiq-user.md` workspace-bullet + versie `202610031541`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Artiestenpagina-look — fase 1-2: fundament + app-schil + player)

- Findings: De publieke artiestenpagina (`ArtistPublicPage`) is een losstaand editorial ontwerp (warm bijna-zwart `#080807`, Roboto Slab/Outfit/DM Mono, terracotta `#d4500a`, scherpe randen) terwijl de rest van de app een ander systeem gebruikt (koel `#0a0a0f`, fuchsia primary, `rounded-*`, neumorphic knoppen). Daarbij stonden er twee tegenstrijdige `primary`-definities: `globals.css` `@theme` (fuchsia) én `tailwind.config.ts` (oranje `#ff530c`) — terwijl dat JS-config door Tailwind 4 niet geladen wordt (er is geen `@config`-directief) en dus dood is.
- Conclusions: Eén ontwerpsysteem met de CSS-variabelen als enige bron van waarheid, in plaats van twee syntaxen die uit elkaar kunnen lopen. Nieuwe `--mq-*`-tokens in `:root`, gemapt via `@theme inline` naar Tailwind-utilities (`bg-canvas`, `text-ink`, `border-line`, `bg-accent`, `font-display/body/mono`, met werkende opacity-varianten) plus `.mq-*`-primitieven (`.mq-card`, `.mq-btn(-primary/-ghost)`, `.mq-input`, `.mq-label`, `.mq-divider`). Fonts app-breed vervangen; de volledige look voorlopig alleen op de schil en (fase 3) de publieke pagina's, zodat interne toolpagina's hun vertrouwde look houden. De artiestenpagina wordt in fase 3 op dezelfde tokens gezet, zodat er letterlijk één implementatie is.
- Actions:
  - `src/app/layout.tsx` — `Instrument_Sans` + `Chivo` → `Roboto_Slab` + `Outfit` + `DM_Mono` (vars `--font-roboto-slab` / `--font-outfit` / `--font-dm-mono`).
  - `src/app/globals.css` — `--mq-*`-tokens in `:root`, `@theme inline`-mapping (kleur + fonts), `.mq-*`-primitieven, `body`/`h1..h6` naar de nieuwe fontvars.
  - `src/app/timecoded-editor/timecoded-editor.css` — `var(--font-body)` → `var(--font-outfit)` (de oude var bestaat niet meer).
  - `tailwind.config.ts` — dode oranje `primary`-scale verwijderd met een notitie dat `globals.css` de bron is.
  - `src/components/Sidebar.tsx` — volledig editorial: `bg-canvas`, hairline-dividers, terracotta active state, mono uppercase group-labels, scherpe randen, Roboto Slab-logo.
  - `src/components/NonAdminHeader.tsx` — idem voor de mobiele header.
  - `src/components/Player.tsx`, `src/components/player/FullscreenPlayer.tsx`, `src/app/player-window/page.tsx` — accent → terracotta (`text-accent`/`bg-accent`, `accent-accent` voor de sliders), playerbalk → `bg-canvas` + `border-line`, menu-panelen en albumhoezen scherp, placeholder-cover `bg-surface-2`, actieve lyric terracotta.
  - Opgemerkt maar gelaten: `src/components/Header.tsx` en `src/components/CollapsibleSidebar.tsx` worden nergens geïmporteerd (dode componenten).
  - Gevalideerd met `npx tsc --noEmit` (0 errors), `npm run build` (geslaagd) en `npm run test` (139 geslaagd, 15 bestanden); de nieuwe utilities (`bg-canvas`, `bg-accent`, `text-ink`, `accent-accent`, opacity-varianten) zijn in de output-CSS gecontroleerd; validated.

## 2026-10-05 zo (Accent blijft MelodIQ-roze, niet het terracotta van de artiestenpagina)

- Findings: De artiestenpagina gebruikt terracotta `#d4500a`, maar Bo wil de editorial look overnemen met het eigen MelodIQ-roze als accent.
- Conclusions: Dit is precies waar de tokenlaag voor bedoeld is: alleen `--mq-accent` aanpassen (`#d4500a` → `#ec4899`, hover `#b8430a` → `#db2777`), waarna schil en player automatisch volgen. De artiestenpagina zelf gebruikte nog hardcoded terracotta en is op `var(--mq-accent)` gezet, zodat ook die niet meer kan afwijken; de fullscreen/pop-out lyric-glow is teruggezet naar roze `rgba(236,72,153,0.5)`.
- Actions: `src/app/globals.css` — `--mq-accent`/`--mq-accent-strong`; `src/components/artist/ArtistPublicPage.tsx` — 6× `#d4500a` → `var(--mq-accent)`; `src/components/player/FullscreenPlayer.tsx` + `src/app/player-window/page.tsx` — lyric drop-shadow roze. Verder `.next` geleegd, omdat een stale `.next/dev/types/validator.ts` na de route-merge nog naar het oude `src/app/artist/[slug]`-pad verwees en de build liet falen. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Artiestenpagina-look — fase 3: publieke pagina's, login, playlists, artist-pages)

- Findings: Na de route-merge zitten de publieke pagina's in de `(public)`-routegroep en is er een nieuwe `PublicNav` voor uitgelogde bezoekers. De inhoud stond nog in de oude stijl (fuchsia, `rounded-*`, koele surfaces) tegenover de al editorial schil, dus de site oogde half omgebouwd.
- Conclusions: Dezelfde tokens in één keer toegepast i.p.v. pagina voor pagina handmatig: accent → `--mq-accent` (roze), tekst → ink-tokens, randen → hairlines, placeholder-covers → `bg-surface-2`, hex-surfaces → `bg-canvas`/`bg-surface`, en `rounded-lg/xl/2xl/3xl/md` weg (scherp) — met `rounded-full` bewust behouden voor avatars, play-knoppen en toggle-switches, want die horen rond te blijven. Login is op de editorial primitieven gezet (`mq-card`, `mq-input`, `mq-btn`) en de `aurora`- en soundwave-decoratie is verwijderd; `PublicNav` kreeg het accent op de actieve link en de Sign in-knop.
- Actions: `src/components/PublicNav.tsx`; `src/app/(public)/discover/page.tsx`, `(public)/discover/releases/page.tsx`, `(public)/discover/release/[releaseId]/page.tsx`, `(public)/discover/playlist/[id]/page.tsx`, `(public)/discover/track/[trackId]/page.tsx`, `(public)/explore/page.tsx`; `src/app/login/page.tsx`; `src/app/playlists/page.tsx`, `src/app/playlists/[playlistId]/page.tsx`; `src/app/artist-pages/page.tsx`. Nog te doen: `ArtistPublicPage` van inline styles naar dezelfde Tailwind-tokens (nu al wel op `var(--mq-accent)`), en de privé-toolpagina's (o.a. `/releases`, library, studio) volgen in een latere fase. Visueel gecontroleerd via de browser op `/discover` en `/login` (roze accent, serif koppen, mono eyebrow, scherpe randen, roze Sign in). Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (ArtistPublicPage naar de gedeelde tokenlaag)

- Findings: De artiestenpagina was de referentie voor de look, maar gebruikte nog inline styles en eigen next/font-variabelen (`--font-artist-*`), waardoor er feitelijk twee systemen naast elkaar bestonden en de accentkleur apart op `var(--mq-accent)` moest worden gezet.
- Conclusions: De pagina is omgezet naar exact dezelfde Tailwind-tokens/utilities als de rest (`bg-canvas`, `text-ink`/`-muted`/`-dim`, `border-line`, `bg-accent`, `font-display`/`font-body`/`font-mono`) en hergebruikt de `.mq-btn`-primitieven voor "Stream Now"/"About". De lokale fonts zijn verwijderd (fonts zijn nu app-breed). Alleen de hero-overlay-gradient en de `clamp()`-groottes blijven inline/arbitrary als echte pagina-eigen art-direction — de gradient gebruikt wel `var(--mq-canvas)` in plaats van een hardcoded kleur, zodat het canvas-token de bron blijft. De bio-grid gebruikt nu `md:grid-cols-[1fr_1.6fr]` in plaats van het ingebedde `<style>`-blok met `!important`.
- Actions: `src/components/artist/ArtistPublicPage.tsx` — volledige restyle; logica, state en de play-flow (`playTrackFromGesture`) onveranderd. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); niet met data visueel gecontroleerd omdat de lokale database geen artiesten/tracks bevat; validated.

## 2026-10-05 zo (Artiestenpagina-look — fase 4: privé-toolpagina's via globale klassen + codemod)

- Findings: De interne toolpagina's (library, archive, admin, settings, lyrics-studio, melody, releases, workspaces, smart-archive, timecoded-editor, track-detail, …) hadden nog de oude look: koele achtergrond, neumorphic/fuchsia knoppen, ronde kaarten en `text-white`. Een groot deel daarvan zit in een klein aantal globale componentklassen.
- Conclusions: Eerst de hefboom: de globale klassen in `globals.css` (`btn-primary`, `btn-secondary`, `btn-ghost`, `input-field`, `select-field`, `section-card`, `card`, `track-card`, `bg-primary-gradient`) zijn plat/scherp/warm/roze gemaakt, en `--background`/`--foreground` staan nu op het warme canvas resp. de warme ink, zodat elke pagina die de basis erft meebeweegt. Daarna een gecontroleerde codemod over `src/app`, `src/components` en `src/hooks`: accent → roze token, tekst → ink-tonen, randen → hairlines, hex-surfaces → `bg-canvas`/`bg-surface`, en `rounded-lg/xl/2xl/3xl/md` → scherp — met `rounded-full` behouden voor avatars/play-knoppen/toggles, en de amber-waarschuwing (`#2b1f10`) plus het workspace-kleurenpalet ontzien. Tot slot de fuchsia-meldingen (`NoticeBar`, `LyricsNotice`, de poll-componenten) naar het accent.
- Actions: `src/app/globals.css` — globale componentklassen + basiskleuren; ~120 `.tsx`-bestanden aangepast. Twee bestanden met openstaand eigen werk (vocal-gender/Reuse) zijn **bewust overgeslagen** — `src/app/studio/page.tsx` en `src/components/TrackList.tsx` — zodat dat werk niet met de restyle vermengd raakt en apart te committen blijft. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); de publieke kant is visueel op regressie gecontroleerd (`/discover` ongewijzigd). De interne pagina's zijn niet visueel gecontroleerd omdat de lokale database geen gebruikers/login heeft; validated.

## 2026-10-05 zo (Now-playing-rij + Discover-kaarten)

- Findings: De "now playing"-rij toonde een dikke roze balk (`border-l-4`) met roze achtergrond, roze rand en een indigo-ringschaduw; en op Discover was de hele cover een play-knop met het play-glyph gecentreerd en de duur/plays in een rij onder de kaart.
- Conclusions: Editorial betekent hairline: de now-playing-rij kreeg een dunne accent-`border-left` (2px) zonder balk/achtergrond/schaduw. De Discover-trackkaarten (publiek én de owner-"Your Tracks"-kaarten) kregen dezelfde opbouw: cover = weergave, play-knop rechtsonder bij hover, en duur + plays in de overlay linksonder onder titel/artiest. Bij de publieke kaart linkt de cover naar `/discover/track/[id]`; bij de owner-kaart opent de cover het detailpaneel, omdat de publieke trackpagina voor niet-gepubliceerde tracks zou 404'en.
- Actions: `src/components/tracks/TrackCard.tsx`; `src/app/(public)/discover/page.tsx` (`TrackCard` + `MyTrackCard`). Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); niet met data visueel gecontroleerd (lokale DB zonder gepubliceerde tracks); validated.

## 2026-10-05 zo (Uitgelogde bezoekers: linker Sidebar, topnavigatie weg)

- Findings: Uitgelogde bezoekers zagen een aparte topnavigatie (`PublicNav`) op de publieke pagina's, terwijl ingelogde gebruikers de linker Sidebar hebben — inconsistent.
- Conclusions: De Sidebar wordt nu altijd gerenderd op de publieke pagina's en `PublicNav` is verwijderd. De Sidebar is geschikt gemaakt voor de uitgelogde staat: geen credits en geen logout, geen accountgroep, en in plaats daarvan een Sign in-knop naar `/login`; de "Hi {naam}"-regel blijft alleen bij een ingelogde user. Explore is aan de Browse-groep toegevoegd zodat die pagina bereikbaar blijft nu `PublicNav` (die de enige link ernaartoe had) weg is. De publieke pagina's gebruiken nu dezelfde layout als de ingelogde variant (altijd ruimte voor de sidebar; `pt-18.25` op mobiel om de vaste mobiele header te ontwijken).
- Actions: `src/components/Sidebar.tsx`; `(public)/discover/page.tsx`, `(public)/discover/track/[trackId]/page.tsx`, `(public)/discover/releases/page.tsx`, `(public)/discover/release/[releaseId]/page.tsx`, `(public)/discover/playlist/[id]/page.tsx`, `(public)/explore/page.tsx`; `src/components/PublicNav.tsx` verwijderd. Visueel gecontroleerd: `/discover` uitgelogd toont de linker Sidebar met Sign in, topnav weg. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Alleen artiesten met een artiestenpagina krijgen een klikbare naam)

- Findings: `ArtistLink` viel bij een ontbrekende aliaspagina terug op `/discover/artist/[userId]` (via `fallbackHref`), waardoor artiestennamen zonder eigen artiestenpagina alsnog klikbaar waren.
- Conclusions: De fallback is verwijderd: `ArtistLink` linkt alleen nog naar `/artist/[slug]` als die pagina bestaat, en rendert anders platte tekst. De `fallbackHref`-prop is uit de component en alle aanroepen gehaald (explore, `TrackCard`), en de "Go to artist"-menuoptie in `TrackCard` verschijnt alleen nog bij een bestaande pagina. De artist-wrapper op de trackkaart toont geen `cursor-pointer`/"click to view artist page" meer als er geen pagina is.
- Actions: `src/components/artist/ArtistLink.tsx`, `src/app/(public)/explore/page.tsx`, `src/components/tracks/TrackCard.tsx`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Trackhero: geblurde cover i.p.v. gradient)

- Findings: De hero-kaart op de publieke trackpagina gebruikte een blauw/roze gradient (`from-sky-900/60 via-accent-strong/30`).
- Conclusions: Dezelfde opzet als de linker Sidebar: een geblurde, verzadigde cover (`blur-[60px] opacity-20 saturate-200 scale-110`) over `bg-canvas`, met een fade naar `var(--mq-canvas)` zodat de tekst leesbaar blijft; zonder cover valt het terug op een effen canvas.
- Actions: `src/app/(public)/discover/track/[trackId]/page.tsx`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Play-knop consequent rechtsonder op de cover)

- Findings: Cover-play-knoppen stonden op sommige plekken gecentreerd (Explore, de track-hero, de release-kaarten) terwijl de Discover-kaarten al rechtsonder stonden.
- Conclusions: Overal gelijkgetrokken: de donkere hover-laag blijft de hele cover, maar het play/pause-cirkeltje staat nu `absolute bottom-3 right-3`. Geldt voor de publieke covers (explore, de track-hero, de discover/releases-kaarten) en de privé release-kaarten. De kleine bibliotheek-thumbnail (`TrackPlayButton`) is bewust gelaten: daar zit de duur al onderin, dus een play rechtsonder zou overlappen.
- Actions: `src/app/(public)/explore/page.tsx`, `src/app/(public)/discover/track/[trackId]/page.tsx`, `src/app/(public)/discover/releases/page.tsx`, `src/app/releases/page.tsx`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); niet visueel gecontroleerd (lokale DB zonder gepubliceerde tracks); validated.

## 2026-10-05 zo (Groene play-knop op de trackpagina verwijderd)

- Findings: Naast de cover-play stond er op de trackpagina nog een grote groene play-knop in de actierij.
- Conclusions: Die is verwijderd; de cover-play (rechtsonder) en de trackrij blijven de speelacties. De "n plays"-tekst blijft staan.
- Actions: `src/app/(public)/discover/track/[trackId]/page.tsx`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Sidebar-offset gelijk aan de echte sidebarbreedte — geen overlap)

- Findings: Na het terugzetten van de linker Sidebar op de publieke pagina's overlapte die de content (~15px). Oorzaak: `html { font-size: 17px }`, dus Tailwind `w-60` is 15rem = **255px**, terwijl de content-offset overal hardcoded **240px** was (en `w-15`/`w-75` idem 63,75px / 318,75px).
- Conclusions: Sidebarbreedte en content-offset gebruiken nu dezelfde CSS-variabelen (`--sidebar-width` 240px, `--sidebar-collapsed` 60px, nieuw `--sidebar-width-qhd` 300px). De Sidebar krijgt de breedte via `style` (geen `w-60`-klasse meer) en alle pagina-offsets verwijzen naar dezelfde var, zodat ze per definitie niet meer kunnen afwijken. De collapse-knop gebruikt de var ook.
- Actions: `src/app/globals.css` (`--sidebar-width-qhd`), `src/components/Sidebar.tsx`, plus 25 pagina's en `TimecodedEditorLayout` waarin `sidebarCollapsed ? 60 : isQHD ? 300 : 240` (en de melody-variant met `: 0`) naar de var is omgezet. Visueel gecontroleerd op `/discover/track/[id]`: sidebar 240px, content start op 240px. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Plays-teller boven de tracklijst verwijderd)

- Findings: Op de trackpagina stond nog een losse "n plays"-regel boven de tracklijst, overgebleven na het verwijderen van de groene play-knop.
- Conclusions: De actierij (die alleen nog de plays-teller bevatte) is verwijderd; de speelacties zitten op de cover (rechtsonder) en in de trackrij.
- Actions: `src/app/(public)/discover/track/[trackId]/page.tsx`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Library/Playlists verborgen voor uitgelogde bezoekers)

- Findings: De linker Sidebar toonde Library en Playlists ook voor uitgelogde bezoekers; die linkten door naar /login.
- Conclusions: Library en Playlists verschijnen alleen nog bij een ingelogde gebruiker (`user`); uitgelogd blijft Browse beperkt tot Discover, Explore en Releases, met daaronder de Sign in-knop. Geldt voor zowel desktop als de mobiele drawer (één `navGroups`-bron).
- Actions: `src/components/Sidebar.tsx`. Visueel gecontroleerd: /discover uitgelogd toont alleen Discover/Explore/Releases + Sign in. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Library/Playlists tonen gepubliceerde inhoud voor uitgelogde bezoekers)

- Findings: Library en Playlists waren login-only (redirect naar /login), terwijl de infrastructuur voor een publieke weergave al bestond: Library had een listener-pad via `/api/discover` en Playlists haalde al `/api/discover/playlists` op.
- Conclusions: `/library` en `/playlists` zijn nu publiek (alleen de exacte paden; de detailpagina's blijven achter login). Uitgelogde bezoekers volgen het listener-pad: Library toont de gepubliceerde tracks (upload, Recycle Bin en Archive verborgen), Playlists toont de "Curated by MelodiQ"-sectie met de eigen-playlists/create-sectie verborgen. Auth wordt via `useAuthStatus` bepaald zodat ingelogde gebruikers niet kort de publieke weergave zien. De Sidebar toont Library en Playlists weer voor uitgelogden (de eerdere verberging is teruggedraaid).
- Actions: `src/middleware.ts` (`isPublicLibrary`/`isPublicPlaylists`), `src/components/Sidebar.tsx`, `src/app/library/page.tsx` (`isPublicViewer`, tab-/upload-gating), `src/app/playlists/page.tsx` (`isPublicViewer`, owner-sectie gegate). Visueel gecontroleerd: uitgelogd laden `/library` en `/playlists` zonder redirect (HTTP 200) en zonder owner-UI. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Relax-modus op Library/Tracks)

- Findings: De Library-trackrijen tonen veel (badges, datums, downloads, actiemenu). Bo wilde een rustiger weergave.
- Conclusions: Een "Relax"-toggle in de Library-header (gepersisteerd in localStorage) schakelt `TrackList`/`TrackCard` naar een minimale rij: alleen cover (met play), titel, artiest, hartje (`TrackRating`), playtime en een DNA-knop die het DNA-paneel opent. De toggle is ook zichtbaar voor uitgelogde bezoekers; de upload-knop blijft owner-only. `TrackCard` kreeg een `relaxed`-prop met een vroege return (na alle hooks) die de bestaande `TrackPlayButton`/`TrackRating`/`TrackDnaPanel` hergebruikt; de memo-vergelijking neemt `relaxed` mee.
- Actions: `src/components/tracks/TrackCard.tsx`, `src/components/TrackList.tsx`, `src/app/library/page.tsx`, i18n-key `library.relaxMode` in `nl.ts`/`en.ts`. Visueel gecontroleerd: de Relax-knop verschijnt op `/library`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); de relax-rijen zelf niet met data gecontroleerd (lokale DB zonder tracks); validated.

## 2026-10-05 zo (NL-bio per artiestenpagina + schema-uitbreidingen)

- Findings: De artiestenpagina had één bio-veld (ENG); Bo wil per artiestenpagina ook een NL-bio. Daarnaast waren er al kolommen voor de Suno-v6 upload-opties toegevoegd, en de drift-check onthulde dat `vocal_gender` alleen in de migraties zat en niet in `init.ts` (pre-existing drift).
- Conclusions: Nieuwe kolom `artist_pages.bio_nl`; de publieke pagina kiest de bio op basis van de bezoekerstaal (`useLocaleStore`), met terugval op de andere taal als één leeg is. De beheerpagina krijgt een tweede bio-veld. De v6-uploadkolommen (`suno_variety`, `suno_max_mode`, `suno_audio_format`) en de `vocal_gender`-fix zijn meegenomen; `db:check-drift` is weer schoon. De upload-UI voor de Suno/Mureka-versies (bronkeuze + v6-opties) volgt nog als aparte stap.
- Actions: `src/db/schema.ts`, `src/db/init.ts`, `drizzle/0011_powerful_puppet_master.sql`, `drizzle/0012_naive_martin_li.sql` (+ `_journal.json`/snapshots), API `artist-pages` (GET/PATCH) en `artist/[slug]` (bioNl), `ArtistPublicPage.tsx`, `artist-pages/page.tsx`, i18n `artistPages.bioNl`/`bioNlFallbackHint`. Gevalideerd met `npm run db:check-drift` (geen drift), `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Upload: Suno/Mureka-versiekeuze + v6-opties)

- Findings: De upload kon alleen een bron taggen en de Suno style/weirdness-sliders tonen; er was geen versiekeuze en de v6-opties ontbraken.
- Conclusions: Per upload-item is er nu een Version-select bij bronnen met versies (Suno: v3.5 … v6 incl. v6-mini/v6-wild; Mureka: V6 … V9.5). Bij Suno v6 verschijnen de v6-opties (Style Variety, Max Mode, Audio Format — dezelfde UI als de Studio). De versie gaat in `provider_model`; de v6-opties worden opgeslagen in de eerder toegevoegde kolommen (`suno_variety`, `suno_max_mode`, `suno_audio_format`).
- Actions: `src/components/library/types.ts` (versielijsten + `isSunoV6Model` + velden), `src/components/library/UploadPanel.tsx` (Version-select + v6-opties + payload), `src/app/api/tracks/upload-helpers.ts` + `src/app/api/tracks/route.ts` (velden lezen/opslaan). Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); de UI niet met een echte upload gecontroleerd; validated.

## 2026-10-05 zo (Componist- en schrijversalias: 5 slots elk)

- Findings: Componist en schrijver hadden elk één alias-veld, terwijl artiest al een lijst had (`artistAliases`).
- Conclusions: Net als `artistAliases` zijn er nu JSON-arrays `composer_aliases` en `writer_aliases` met 5 slots elk (primaire + 4 extra). De scalaire `composer_alias`/`writer_alias` blijven de eerste slot spiegelen, zodat bestaande fallbacks onveranderd blijven. De accountpagina toont 5 velden per kolom; de update-API valideert/serialiseert de arrays, en de archive-pagina neemt alle aliassen mee in de suggestielijsten.
- Actions: `src/db/schema.ts`, `src/db/init.ts`, `drizzle/0013_dusty_toad.sql` (+ journal/snapshot), `src/lib/artist-aliases.ts` (generieke `parseAliasList`/`serializeAliasList`/`validateAliasList` + maxima), `src/app/api/auth/update/route.ts` + `src/app/api/auth/me/route.ts`, `src/app/account/page.tsx`, `src/lib/stores/userStore.ts`, `src/app/archive/page.tsx`. Gevalideerd met `npm run db:check-drift` (geen drift), `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-05 zo (Upload: lyrics- en promptveld omgewisseld)

- Findings: In het uploadformulier stond het globale promptveld links en lyrics rechts; Bo wil ze omgewisseld.
- Conclusions: De globale velden staan nu lyrics-links, prompt-rechts. De conditionele weergave bij instrumental blijft (dan alleen prompt).
- Actions: `src/components/library/UploadPanel.tsx`. Gevalideerd met `npm run build` (geslaagd) en `npm run test` (139 geslaagd); validated.

## 2026-10-06 di (Accountpagina: succesmeldingen in het rood)

- Findings: De melding "Profiel succesvol bijgewerkt" verscheen in het rood. De kleur werd bepaald met `message.includes("successfully")` — dat snuift op de Engelse tekst en matcht het Nederlandse "succesvol" niet, dus de groene tak werd alleen in het Engels bereikt. Dezelfde fragiele tekst-matching stond ook bij de security-melding, en de image-upload-meldingen (heroini-grootte, uploadresultaat) zetten nooit iets explicits.
- Conclusions: Kleur bepalen op de inhoud van een i18n-tekenreeks is verkeerd op elke taal behalve één. De succes/fout-status is al bekend op het moment van instellen (`res.ok` vs. else) en hoort daar als booleaanse vlag bewaard te blijven: twee nieuwe states `profileMessageError`/`securityMessageError`, gereset bij elke nieuwe poging om valse kleuren te voorkomen.
- Actions: `src/app/account/page.tsx` — error-vlaggen toegevoegd voor elk pad dat een melding zet (profiel opslaan, wachtwoord opslaan incl. validatie, hero-afmeting, image-upload incl. catch); de twee JSX-kleuren omgezet van `includes("successfully")`-snuiven naar de vlag. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-06 di (Nieuwe artiestalias pas zichtbaar na herladen)

- Findings: Na "Profiel opslaan" verscheen een nieuw aangemaakte alias niet in de dropdowns van Studio/Releases/Playlists; pas na F5. Oorzaak: de accountpagina schreef het opgeslagen profiel alleen naar lokale state, niet naar de zustand `useUserStore`, en `loadUser` daar cached hard (`if (get().user) return`) — andere pagina's bleven dus de oude aliaslijst zien tot een volledige herlaad.
- Conclusions: De store bijwerken op de plek waar de update gebeurt is de juiste fix; de cache in `loadUser` bewust laten ( Scheelt een fetch op elke paginaload) en alleen dit ene pad bijwerken volgt het bestaande `handleLanguageChange`-patroon op dezelfde pagina, dat `setAuthUser({ ...authUser, ...data.user })` al deed.
- Actions: `src/app/account/page.tsx` — na succesvolle profielopslag nu ook `setAuthUser({ ...authUser, ...data.user })`, met commentaar waarom. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-06 di (Track-cards toonden oude artiest tot herlaad)

- Findings: Na "Release bewerken → artiestalias → toepassen op release én tracks" zag je de nieuwe naam meteen op de release, maar de trackrijen bleven de oude tonen tot een herlaad. De optimistische update-keten was er wel: de releases-list pagina zet de trackrijen bij in `tracksById` (regel ~322) en releases/[releaseId] via `setTracks` (regel ~511).
- Conclusions: `TrackCard` is `React.memo` met een custom comparator; `artistName` stond niet in de veldlijst, dus het nieuwe track-object met de nieuwe naam slaagde voor de gelijkheidscheck en de kaart re-renderde nooit. `artistName` is een direct gerenderd veld en hoort in de comparator; alleen dat veld bijwerken houdt de memo-optimisatie in stand voor alle andere renders.
- Actions: `src/components/tracks/TrackCard.tsx` — `prevProps.track.artistName === nextProps.track.artistName` toegevoegd aan de memo-comparator. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-06 di (Timecoded Lyrics Editor: terugknop)

- Findings: De TCE-route (`/timecoded-editor/[trackId]`, zowel de editor zelf als de "generate first"-shell) had geen terugknop; je kon alleen via de browserhistorie of de sidebar weg. De artiestenpagina heeft al het ronde terugknop-concept.
- Conclusions: Dezelfde knop hergebruiken in plaats van opnieuw iets te tekenen: een kleine client-component `TceBackButton` met het "router.back() als er historie is, anders fallback"-patroon van de artiestpagina, gestyled als `tce-back-btn` (40px ronde, zelfde pijl-SVG, aangepast op het TCE-donkere palet). De fallback is `/library`, want de route wordt vanaf TrackCard geopend.
- Actions: New `src/components/timecoded-editor/TceBackButton.tsx`; `src/components/timecoded-editor/TimecodedLyricsEditor.tsx` — knop linksboven in de topbar vóór de titel; `src/app/timecoded-editor/[trackId]/page.tsx` — knop in de generate-shell; `src/app/timecoded-editor/timecoded-editor.css` — `.tce-back-btn` + `.tce-generate-shell__top`. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-06 di (Onderzoek: afspelen stopt bij Releases → Account)

- Findings: Terwijl een track speelt stopt het geluid op het exacte overgangsmoment Mijn Releases → Account (desktop). Andere pagina's (Discover, Library) laten het afspelen doorlopen, dus geen navigatie-breed probleem. Statische doorgang door Player.tsx, playerStore, hotkeys, mediaSession, D-pad, stream-route en beide pagina's leverde géén code-pad op dat bij navigatie pauzeert: het gedeelde audio-element leeft op `window.__melodiqSharedAudioElement` en overleeft routes, en Player remount niet bij paginawissel.
- Conclusions: Niet blind patchen — om de dader te kunnen aanwijzen is één geïnstrumenteerde reproductie nodig. Checks die al in de codebethel zitten (stream-stall reconnect, gesture-marker, unexpected-pause-resume) kunnen de stop óók veroorzaken; de stacktrace onthult de code-gebruik.
- Actions: `src/components/Player.tsx` — `debugAudioEvent`-listeners op het gedeelde audio-element (incl. cleanup in de unmount-branch). Gevalideerd: `npm run build`; validated.

## 2026-10-06 di (Queue zichtbaar in het Track Details-paneel)

- Findings: De queue bestond alleen in de store: TrackActionMenu heeft "Add to queue", de playerbar toont op md+ een teller-badge, maar nergens was de lijst zelf te zien.
- Conclusions: De queue horen bij de track die nu speelt, dus in het Track Details-paneel (knop "Show song details" in de playerbar) — dat volgt de now-playing track al en is op elke route open. Alleen in sidebar-modus en alleen als het paneel de nu-spelende track toont, zodat de overlay op een willekeurige track geen betekenisloze queue toont. Rows: nummer, cover-thumb, titel/artiest; klik speelt direct (nieuwe store-actie `playQueueItem` springt midden in de queue en zet wat overslaat weg, standaard queue-UX; Player pakt het via het normale trackwissel-effect), X verwijdert één item, Clear leegt de queue (huidige track blijft doorspelen).
- Actions: `src/lib/stores/playerStore.ts` — `playQueueItem(trackId)`-actie; `src/components/TrackDetail.tsx` — queue-sectie bovenin de Details Container. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-07 wo (Details-paneel: tabs Lyrics ↔ Queue)

- Findings: De gisteren toegevoegde queue-sectie schoof de lyrics weg; Bo wil gewoon kunnen wisselen tussen beide weergaven.
- Conclusions: Twee tabs in het now-playing sidebar-paneel (nav zoals de accountpagina-tabs: uppercase labels, accent-ondertstreep): "Lyrics" toont het bestaande lyrics+prompt-blok ongewijzigd, "Queue" neemt het hele paneel in met scrolbare lijst en lege-state ("Nothing queued yet"). De condities `isNowPlayingPanel`/`showQueueTab` zijn bewust éénmalig bovenin gedefinieerd omdat de ternary ze op twee scheide punten nodig heeft.
- Actions: `src/components/TrackDetail.tsx` — `detailTab`-state + tab-nav; queue- en lyrics/prompt-blokken via ternary gewisseld. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-07 wo (Queue drag & drop)

- Findings: De queue zat vast in de volgorde waarin tracks zijn toegevoegd.
- Conclusions: HTML5-drag op de queue-rijen, net als de rijen in TrackList die dat patroon al gebruiken. De drop-indicator wordt een 2px accentregel via inset-shadow (geen layout-shift): boven = vóór de rij, onder = na de rij. In de store is dat `reorderQueueItem(trackId, insertAtIndex)` met gap-index-semantiek: eerst de gesleepte entry verwijderen, daarna de insertie-index met één corrigeren als de doelpositie onder de oorspronkelijke positie lag; terugleggen op de eigen plek is expliciet een no-op. Track-id's zijn uniek in de queue (enqueueTrack dedupet), dus trackId is een betrouwbare drag-key. Klik-om-af-te-spelen blijft werken: een drag vuurt geen click, en `setData("text/plain")` voorkomt dat Firefox de drop weigert.
- Actions: `src/lib/stores/playerStore.ts` — `reorderQueueItem`; `src/components/TrackDetail.tsx` — draggable rows met `queueDragIdRef` (ref voor de gesleepte id zodat her-renders hem houden) en `queueDropTarget`-state voor de indicator. Gevalideerd met `npm run build` (geslaagd); validated.

## 2026-10-07 wo (Artiestenpagina-afbeelding niet vervangbaar bij herupload)

- Findings: Heruploaden van een pagina-profiel/hero deed S3 wél overschrijven (bewust vaste key `artist-pages/<user>/<page>/<type>.<ext>`), maar de afbeelding veranderde nergens zichtbaar. Twee cachinglagen bleven oude bytes dienen: (1) de diskcache in `cover-cache.ts` cachet op s3Key en had alleen een alles-of-niets `clearCoverCache`, geen per-key invalidatie — de oude bytes werden eeuwig geserveerd, zelfs over restarts heen; (2) de serveerweg zet `Cache-Control: immutable, max-age=86400` en de URL had geen versie, dus de browser vroeg na de upload niet eens opnieuw.
- Conclusions: Per-key invalidatie in de servercache en een URL-versie die meebeweegt met de row: `imageUrl(...)?variant=...&v=<updatedAt-base36>`. `updatedAt` werd alleen bij hero-uploads gezet — nu in beide takken, met commentaar waarom. De diskinvalidatie ruimt oude én nieuwe key op (de key kan van ext wisselen, webp→avif); de eerste herupload na deze fix ruimt ook de historisch-stale entry op. Een bio-edit bumpt updatedAt mee en bust daarmee beide afbeeldingen — onschadelijk, dezelfde bytes worden dan enkel opnieuw opgehaald.
- Actions: `src/lib/cover-cache.ts` — `invalidateCachedCover(s3Key)`; `src/app/api/artist-pages/[id]/image/route.ts` — oude key geselecteerd, invalidatie na S3-overwrite, updatedAt in beide takken; `src/app/api/artist/[slug]/route.ts` — `v`-param op `imageUrl`; `src/app/artist-pages/page.tsx` — `imageVersion()`-helper, `v` op het profiel-miniatuur. Gevalideerd met `npm run build` (geslaagd); validated.
