## 2026-05-26 (Refactor grote bestanden in losse modules)

- Findings: Lyrics Studio, TrackList en Home page bevatten nog veel inline UI- en helperlogica waardoor onderhoud en hergebruik lastig waren.
- Conclusions: Helpers verplaatsen naar `src/lib` en UI-secties naar gerichte componentbestanden verlaagt complexiteit zonder business-flow te wijzigen.
- Actions: Aangemaakt `src/lib/lyrics-utils.ts` en `src/lib/track-utils.ts`; toegevoegd `src/components/lyrics-studio/LyricBlockEditor.tsx`, `src/components/lyrics-studio/PresetSelector.tsx`, `src/components/lyrics-studio/BlockToolbar.tsx`; toegevoegd `src/components/tracks/types.ts`, `src/components/tracks/WaveformBars.tsx`, `src/components/tracks/ConfirmDialog.tsx`, `src/components/tracks/GeneratingRow.tsx`, `src/components/tracks/TrackCard.tsx`; toegevoegd `src/components/studio/GenerateButton.tsx`, `src/components/studio/NoticeBar.tsx`, `src/components/studio/CreateWorkspaceDialog.tsx`, `src/components/studio/ResizablePanel.tsx`; gerefactord `src/components/TrackList.tsx`, `src/app/lyrics-studio/page.tsx`, `src/app/page.tsx` naar imports van nieuwe modules; build uitgevoerd met `npm run build` (compile ok, faalt bij page data door ongeldige `postgres` URL in env voor `/api/auth/register`), validated.

## 2026-06-01 (Timed lyrics highlight compatibiliteit hersteld)

- Findings: Tracks met `lyricsTimestamps` JSON highlightten de actieve lyric-regel niet betrouwbaar, omdat de parser te strikt was op tijdnotaties en enkele geneste payloadvormen (zoals embedded `lyrics_timestamped`/LRC strings) niet oppakte.
- Conclusions: De timed-lyrics parser moet meerdere timestampformaten accepteren (`seconds`, `mm:ss`, `hh:mm:ss`) en ook geneste payloadvelden met embedded LRC kunnen uitlezen voordat wordt teruggevallen naar untimed lyrics.
- Actions: `src/lib/parse-lyrics.ts` uitgebreid met robuuste tijdparser, herbruikbare LRC-parser en ondersteuning voor extra velden (`timestamp`, `ts`, `start_ms`, `lyrics_timestamped`, `timestamped_lyrics` in nested data/result/output vormen); fallback-LRC parsing gecentraliseerd; toegevoegd `src/lib/__tests__/parse-lyrics.test.ts` met regressietests voor `mm:ss`, embedded nested LRC en task-submission fallback; `src/components/Sidebar.tsx` buildversie bijgewerkt naar `202606011926`; `melodiq-user.md` versie en timed-lyrics gedrag bijgewerkt; gevalideerd met `npm run test -- src/lib/__tests__/parse-lyrics.test.ts` en `npm run build`.

## 2026-05-26 (Build-fix voor ongeldige DATABASE_URL)

- Findings: Productiebuild viel uit tijdens page-data collectie door een ongeldige `DATABASE_URL` (`ERR_INVALID_URL`) die al bij module-import van de DB-client crashte.
- Conclusions: DB-initialisatie moet defensief omgaan met ontbrekende/ongeldige env-waarden en `/api/settings` moet geforceerd dynamisch blijven om build-time evaluatie te vermijden.
- Actions: Aangepast `src/db/index.ts` met URL-validatie en veilige fallback connectiestring om import-crashes te voorkomen; `src/app/api/settings/route.ts` gemarkeerd met `export const dynamic = "force-dynamic"`; build opnieuw uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (GenerateButton gekoppeld in StudioForm)

- Findings: De nieuwe component `GenerateButton` bestond al, maar de hoofdactieknop in de studio gebruikte nog een inline knopimplementatie.
- Conclusions: De knop centraliseren via `GenerateButton` houdt de UI-consistentie en loading-state op Ã©Ã©n plek beheersbaar.
- Actions: `src/components/studio/GenerateButton.tsx` uitgebreid met optionele `className`; `src/components/StudioForm.tsx` aangepast om `GenerateButton` te gebruiken en `isGenerating` als prop te accepteren; `src/app/page.tsx` aangepast om `generating` door te geven aan `StudioForm`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Lyrics Studio linkerpanelen opgesplitst)

- Findings: De linker configuratiekolom in de Lyrics Studio pagina bleef een groot inline JSX-blok en hield de page-component onnodig lang.
- Conclusions: Extractie naar een dedicated control-panel component houdt state/orchestratie in de pagina en verplaatst presentatielogica naar een herbruikbare module zonder gedrag te wijzigen.
- Actions: Toegevoegd `src/components/lyrics-studio/LyricsControlPanel.tsx` met metadata-, structuur-, preset-, slider- en toolbar-secties; `src/app/lyrics-studio/page.tsx` opgeschoond en gekoppeld aan `LyricsControlPanel`; a11y verbeterd met labels op range-inputs; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Lyrics Studio rechterkolom verder uitgedund)

- Findings: De pagina bevatte nog een grote inline rechterkolom voor Song Flow en Style Suggestion, wat de page-component onnodig groot hield.
- Conclusions: De bestaande `LyricsStudioSidePanel` component in de pagina gebruiken verlaagt de JSX-omvang en houdt dezelfde UX-flow intact.
- Actions: `src/app/lyrics-studio/page.tsx` aangepast om de inline rechterkolom te vervangen door `LyricsStudioSidePanel`-props; tijdelijke import-regressie (`Flowchart`) gecorrigeerd; build opnieuw uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Settings constants en model-modal geÃ«xtraheerd)

- Findings: `src/app/settings/page.tsx` bevatte nog veel statische provider/webhook-configuratie en een grote inline model-detail modal, waardoor het bestand onnodig lang bleef.
- Conclusions: Statische configuratie verplaatsen naar een dedicated constants-module en de modal naar een losse component verlaagt complexiteit en houdt de pagina meer op orchestratie.
- Actions: Toegevoegd `src/lib/settings-constants.ts` met `ProviderConfig`, `PROVIDERS` en `WEBHOOK_DEFAULTS`; toegevoegd `src/components/settings/ModelDetailModal.tsx`; `src/app/settings/page.tsx` gerefactord naar imports uit deze modules en inline modal vervangen door `ModelDetailModal`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Settings API logging kaart uitgepakt)

- Findings: De API logging-sectie stond nog inline in `src/app/settings/page.tsx`, wat de pagina verder ophoogde en hergebruik van de toggle/save UI lastig maakte.
- Conclusions: Een dedicated component voor API logging houdt `settings/page` compacter en maakt deze sectie makkelijker los te beheren en te testen.
- Actions: Toegevoegd `src/components/settings/ApiLoggingCard.tsx`; `src/app/settings/page.tsx` aangepast om `ApiLoggingCard` te gebruiken met bestaande `values`, `saving` en handlers; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Homepage opgedeeld met bestaande studio componenten)

- Findings: `src/app/page.tsx` had nog inline notificatie-, workspace-create- en resizable panel-UI plus dubbele workspace-helperfuncties.
- Conclusions: Bestaande studio-componenten (`NoticeBar`, `CreateWorkspaceDialog`, `ResizablePanel`) direct gebruiken en helper-duplicatie vervangen door `track-utils` houdt de pagina slanker en consistenter.
- Actions: `src/app/page.tsx` gerefactord om `NoticeBar`, `CreateWorkspaceDialog` en `ResizablePanel` te gebruiken; lokale `hash/pick/getCover/getGradient` helpers verwijderd en vervangen door `getWorkspaceCoverCollage` en `getWorkspaceGradient` uit `src/lib/track-utils.ts`; workspace list className-bug met `$selectedWorkspaceId` gecorrigeerd; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Studio kolom scroll + sticky generate hersteld)

- Findings: Op de homepage scrollde de linker Studio-kolom niet meer en de generate-sectie verdween uit beeld; sticky-positionering werkte niet betrouwbaar.
- Conclusions: Ongeldige Tailwind arbitrary value syntaxis in `top`/`h-[calc(...)]` classes brak de hoogte- en sticky-layout. Door deze classes te corrigeren en de generate-sectie sticky onderin te maken blijft de knop zichtbaar boven de player.
- Actions: `src/app/page.tsx` aangepast met geldige `top-[var(--studio-top-offset)]` en correcte `h-[calc(...)]` sluiting voor beide kolommen; `src/components/StudioForm.tsx` generate-paneel aangepast naar `sticky bottom-0 z-10`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Move To Workspace menu als dedicated overlay)

- Findings: Het vorige Move To Workspace submenu was compact en nested, maar sloot visueel/functioneel niet aan op de gewenste grote overlay met lijstweergave.
- Conclusions: Een dedicated modal-overlay met duidelijke titel, scrollbare workspace-rijen en inline create-acties onderaan geeft dezelfde interactie als het gewenste referentie-ontwerp en werkt beter voor lange workspace-lijsten.
- Actions: `src/components/tracks/TrackCard.tsx` aangepast: nested submenu vervangen door gecentreerde overlay â€œMove to Workspaceâ€, lijst met workspace-rows + clip-count, onderaan input met teller en `Create Workspace` knop; bestaande move/create-logica behouden; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Workspaces pagina aligned met Library workspace UX)

- Findings: De dedicated Workspaces-pagina week qua layout en gedrag af van het Workspaces-gedeelte op de Library-pagina.
- Conclusions: EÃ©n consistente workspace-ervaring (zelfde headerstijl, view-toggle, create-flow, cards/list en open-workspace gedrag) verlaagt cognitieve load en maakt beheer voorspelbaarder.
- Actions: `src/app/workspaces/page.tsx` volledig herwerkt naar dezelfde structuur als Library-workspaces: hero-header, grid/list toggle, create-workspace pill, workspace cards/list met open/delete actions en een songs-sectie met back-actie en `TrackList`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Library rechter detail-sidebar toegevoegd)

- Findings: De Library had nog geen rechter detailpaneel zoals de homepage, waardoor trackdetails minder snel beschikbaar waren.
- Conclusions: De bestaande `TrackDetail` + `ResizablePanel` hergebruiken op Library houdt UX consistent tussen pagina's en voorkomt dubbele componentlogica.
- Actions: `src/app/library/page.tsx` uitgebreid met trackselectie-state, `usePlayerStore` panel-state, desktop `ResizablePanel`, mobiele `TrackDetail` overlay, en play/download handlers op basis van de zichtbare trackcontext; typefout op optional covervelden bij selectie opgelost; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Lyric Studio AI style advice uitgebreider gemaakt)

- Findings: De AI style suggestion op Lyric Studio was te kort en te algemeen, waardoor de output minder bruikbaar was als directe productierichting.
- Conclusions: Een gestructureerd outputformat met expliciete secties (genre/feel, instrumentation, production/mix, vocal direction) levert concreter en direct toepasbaar style-advies op.
- Actions: `src/app/api/lyric-studio/style-suggestion/route.ts` promptregels aangepast voor uitgebreidere output (80-140 woorden, 4 secties) en whitespace-collapsing verwijderd om structuur te behouden; `src/components/lyrics-studio/LyricsStudioSidePanel.tsx` placeholder, helpertekst en textarea-hoogte aangepast voor langere adviezen; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Lyria WAV response format payload gefixt)

- Findings: Lyria gaf een payload error op `generation_config_response_format` omdat de request een ongeldige nested vorm gebruikte (`mimeType`/`audioType`).
- Conclusions: De Gemini/Lyria REST payload verwacht een audio response-format object met `audio.mime_type`, dus alleen die nested keys moesten worden aangepast.
- Actions: `src/lib/providers/lyria.ts` bijgewerkt zodat WAV requests `responseFormat: { audio: { mime_type: "audio/wav" } }` sturen; bijbehorende typehint aangepast; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Workspace subfolders tot 1 niveau diep)

- Findings: Workspace-organisatie was volledig vlak, terwijl gewenst gedrag is: hoofdfolder met eigen tracks plus optionele subfolders met eigen tracks.
- Conclusions: Met een parent-link op workspaces en een harde 1-level guard in de store blijft de datastructuur eenvoudig en voorspelbaar zonder recursieve UI-complexiteit.
- Actions: `src/lib/store.ts` uitgebreid met `parentWorkspaceId` en `createWorkspaceFolder(parentWorkspaceId, name)` plus cascade-delete van directe subfolders; `src/app/workspaces/page.tsx` aangepast naar root-overzicht + subfolder-sectie en subfolder-create in geopende hoofdfolder; `src/components/tracks/TrackCard.tsx` Move To Workspace dialog hiÃ«rarchisch gemaakt (hoofdfolder/subfolder labels en toewijzing); build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Studio workspace-subfolders + harde 1-level normalisatie)

- Findings: In Studio was subfolder-aanmaak nog niet beschikbaar in de workspace panel-flow, terwijl de gewenste structuur expliciet `workspace -> folder` is zonder extra nesting.
- Conclusions: Subfolder-creatie moet ook in Studio kunnen op geopende hoofdfolders, en de persisted workspace-data moet defensief genormaliseerd worden zodat oude of handmatig ingevoerde nested data automatisch naar maximaal 1 niveau wordt teruggebracht.
- Actions: `src/app/page.tsx` aangepast met subfolder create-flow (`+ Add Subfolder`) alleen voor geopende hoofdfolders, root-only workspace-overzicht, parent-terugknop bij child-weergave en subfolderlijst in de geopende hoofdfolder; `src/lib/store.ts` normalisatie in `withDefaultWorkspace` aangescherpt zodat alleen kinderen van root-workspaces een `parentWorkspaceId` behouden; `melodiq-user.md` bijgewerkt met Studio-subfolder gedrag en versie; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Library upload van MP3/WAV met workspace-keuze en batch)

- Findings: De Library had nog geen directe importflow voor bestaande audiobestanden, waardoor users losse uploads extern moesten regelen en tracks daarna handmatig organiseren.
- Conclusions: Voeg een dedicated uploadflow toe op Library Songs view met multi-file support en workspace-selectie, plus een backend endpoint dat meerdere MP3/WAV-bestanden in Ã©Ã©n request accepteert.
- Actions: `src/app/api/tracks/route.ts` uitgebreid met `POST` multipart upload voor maximaal 20 bestanden tegelijk (MP3/WAV-validatie, S3-upload, track insert met `provider=upload`); `src/app/library/page.tsx` uitgebreid met uploadkaart (`Select MP3/WAV Files`), workspace-dropdown, upload statusmelding en directe workspace-toewijzing van nieuwe track IDs via store; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:18`; `melodiq-user.md` bijgewerkt met uploadgebruik; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Uploaded-bestanden expliciet gemarkeerd in UI)

- Findings: Na toevoegen van Library upload was niet direct zichtbaar welke tracks lokaal geupload zijn versus AI-gegenereerd.
- Conclusions: Toon een expliciete visuele indicator op lijst- en detailniveau voor tracks met `provider=upload`, zodat herkomst direct duidelijk is.
- Actions: `src/components/tracks/TrackCard.tsx` uitgebreid met `Uploaded` badge naast status voor geuploade tracks; `src/components/TrackDetail.tsx` uitgebreid met `Uploaded file` label en leesbare bronlabels (`Upload â€¢ Local file`) voor geuploade tracks; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:21`; `melodiq-user.md` bijgewerkt met indicator-uitleg; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Workspace folder opent nu op eigen detailpagina)

- Findings: De Workspaces-pagina toonde na folderselectie de tracklisting onder hetzelfde folderoverzicht, waardoor de focus op Ã©Ã©n folder minder duidelijk was.
- Conclusions: Splits de flow in overzicht en detailroute, zodat folderklikken naar een dedicated pagina met tracklisting gaat en terugnavigatie expliciet wordt.
- Actions: `src/app/workspaces/page.tsx` omgezet naar puur folderoverzicht met kliknavigatie naar `/workspaces/{id}`; nieuwe route toegevoegd in `src/app/workspaces/[workspaceId]/page.tsx` met folder-specifieke tracklisting, subfoldernavigatie en `Back to folders` knop; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:24`; `melodiq-user.md` bijgewerkt met nieuwe navigatie; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Duplicate upload preventie via unieke audio-hash)

- Findings: Het uploaden van hetzelfde MP3/WAV-bestand meerdere keren maakte dubbele tracks aan in de library.
- Conclusions: Gebruik een content-gebaseerde SHA-256 hash per upload en weiger uploads waarvan dezelfde hash al bestaat voor dezelfde gebruiker.
- Actions: `src/app/api/tracks/route.ts` uitgebreid met `createHash("sha256")` op de audiobuffer, duplicate-check op bestaande `provider="upload"` tracks met dezelfde hash (`audioId`) en opslag van de hash op nieuwe uploadrecords; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:27`; `melodiq-user.md` bijgewerkt met dedupe-gedrag; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Play-count tracking + new-dot indicator)

- Findings: Tracks hadden nog geen afspeelstatistiek en er was geen visuele markering voor nieuwe, nog niet afgespeelde songs.
- Conclusions: Een persistente `play_count` in de database, een dedicated play increment endpoint en een directe UI-event zorgen voor zowel betrouwbare telling als onmiddellijke feedback in de lijst.
- Actions: `src/db/schema.ts` uitgebreid met `play_count`; `src/db/init.ts` bijgewerkt voor create/alter compatibiliteit; toegevoegd `src/app/api/tracks/[id]/play/route.ts` voor auth-safe increment; `src/components/Player.tsx` laat nu bij start playback een increment-call lopen en dispatcht `melodiq:track-played`; `src/components/tracks/TrackCard.tsx` toont play count onder beschrijving, rendert een gele glow-dot bij ongespeelde tracks en verwijdert die direct na play via event-listener; `src/components/tracks/types.ts` en `src/lib/store.ts` tracktypes uitgebreid met `playCount`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:35`; `melodiq-user.md` bijgewerkt met play-count gedrag; validated.

## 2026-05-27 (Cover art regenerate actie + grid-size controls op Library/Workspaces)

- Findings: Er ontbrak een directe trackactie om cover art opnieuw te genereren, de cover prompt voelde te generiek, en de 4/8/12/16 gridselector bestond nog niet op Library Workspaces en de dedicated Workspaces-pagina.
- Conclusions: Een expliciete `Regenerate Cover Art` trackactie met force-new generatie voorkomt hergebruik van dezelfde cover; een artistiekere prompt geeft visueel rijkere covers; dezelfde grid-size controls op alle workspace-overzichten houdt UX consistent.
- Actions: `src/components/tracks/TrackCard.tsx` uitgebreid met menu-actie `Regenerate Cover Art`, loading-state en lokale cover refresh; `src/app/api/tracks/[id]/route.ts` PATCH ondersteunt nu `regenerateCoverArt`; `src/lib/generate-cover.ts` ondersteunt `forceNew` om prompt-based reuse te skippen bij regenereren; `src/lib/providers/cover-art.ts` promptrichting aangepast naar uitgesproken artsy/editorial stijl; `src/app/library/page.tsx` en `src/app/workspaces/page.tsx` uitgebreid met persistente 4/8/12/16 workspace-grid selector in grid mode; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:41`; `melodiq-user.md` bijgewerkt; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Play count pas na 10 seconden playback)

- Findings: De play counter verhoogde direct bij start van afspelen, waardoor korte starts/skips ook als play werden geteld.
- Conclusions: Een 10-seconden playbackdrempel met timer en cleanup op pauze/trackwissel telt alleen betekenisvolle listens en voorkomt inflatie van plays.
- Actions: `src/components/Player.tsx` aangepast met 10s timer-gebaseerde play tracking (`/api/tracks/[id]/play` pas na 10 seconden actieve playback), timer cleanup bij pauze/trackwissel/einde en reset per tracksessie; bestaande UI-event `melodiq:track-played` blijft gebruikt zodat de new-dot pas na echte play verdwijnt; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:45`; `melodiq-user.md` bijgewerkt met 10s-regel; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Lyric Studio markerblokken + AI titelgeneratie)

- Findings: In Lyric Studio ontbraken speciale lege sectiemarkers voor instrumentale passages, en er was geen directe titelworkflow vanuit de lyric-blokken.
- Conclusions: Voeg twee expliciete markerblokken toe (`[intrumental]`, `[instrumetal drop]`) die geen lyrics bevatten maar wel als sectietag exporteren, en voeg een titelveld met AI-generate knop toe op basis van de samengestelde lyrics.
- Actions: `src/lib/lyrics-utils.ts` uitgebreid met nieuwe blocktypes, labels, structure-parser ondersteuning en combine-logica voor lege markersecties; `src/lib/lyrics-studio-constants.ts` uitgebreid met markerblokken in toolbar en kleurmapping; `src/components/lyrics-studio/LyricBlockEditor.tsx` aangepast zodat markerblokken geen lyrics/translate/generate toelaten; `src/app/api/lyric-studio/generate-block/route.ts` en `src/app/api/lyric-studio/translate/route.ts` typeguards uitgebreid voor de nieuwe blocktypes; `src/components/lyrics-studio/LyricsControlPanel.tsx` uitgebreid met title input en `Generate title` knop; `src/app/lyrics-studio/page.tsx` gekoppeld met `/api/generate-title`, title-state wiring en overdracht van title naar Studio; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 14:31`; `melodiq-user.md` bijgewerkt; validated.

## 2026-05-27 (Library upload hint + robuuste non-JSON foutafhandeling)

- Findings: Bij uploadfouten met HTML-responses (zoals te grote request) kon de frontend falen met `Unexpected token '<'` en was voor users onduidelijk wat de limiet was.
- Conclusions: Maak upload-response parsing tolerant voor non-JSON en toon in de UI expliciet de uploadlimiet en foutverwachting.
- Actions: `src/app/library/page.tsx` uitgebreid met veilige `readApiPayload` parser, duidelijke fallback foutmelding bij non-JSON responses en specifieke 413 melding; uploadkaart helpertekst aangevuld met limiet van 20 bestanden per upload; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 14:48`; `melodiq-user.md` bijgewerkt met limiet/foutmelding; validated.

## 2026-05-27 (Library upload workspace-dropdown gevuld met bestaande workspaces)

- Findings: In Library upload liet de workspace-dropdown soms alleen `Default Workspace` zien, ondanks bestaande workspaces in persistente state.
- Conclusions: Forceer eerst workspace-store rehydratie en voer daarna pas de default-workspace normalisatie uit; zo blijven bestaande persisted workspaces zichtbaar in de dropdown.
- Actions: `src/app/library/page.tsx` aangepast met expliciete `useWorkspaceStore.persist.rehydrate()` en `onFinishHydration`-flow vóór `ensureDefaultWorkspace`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 15:10`; `melodiq-user.md` bijgewerkt met workspace-dropdown gedrag; validated.

## 2026-05-27 (Docker build-fix: ontbrekende setVolume in Player)

- Findings: De Docker/Next build faalde met TypeScript-fout `Cannot find name 'setVolume'` in de player volume-handler.
- Conclusions: De `Player` component gebruikte `setVolume` in `handleVolume`, maar haalde de action niet uit de Zustand store-destructuring; toevoeging van de ontbrekende action herstelt compile.
- Actions: `src/components/Player.tsx` bijgewerkt door `setVolume` toe te voegen aan `usePlayerStore()` destructuring in de `Player` component; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 15:17`; `melodiq-user.md` versie bijgewerkt naar `wo 15:17`; build uitgevoerd met `npm run build` en volledig geslaagd (met bestaande Turbopack-warning over NFT trace), validated.

## 2026-05-27 (Herstel: tracks verdwenen door workspace-schema mismatch)

- Findings: Na introductie van DB-workspaces konden track-overzichten leeg lijken wanneer `tracks.workspace_id`/`workspaces` nog niet in de database aanwezig waren op runtime.
- Conclusions: Voeg een runtime schema-guard + fallback toe zodat track-API nooit hard faalt op ontbrekende migratie en de bestaande tracks direct zichtbaar blijven.
- Actions: `src/lib/workspaces.ts` uitgebreid met `ensureWorkspaceSchema()` (idempotente `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS`) en fallback payload; `src/app/api/tracks/route.ts` en `src/app/api/tracks/[id]/route.ts` laten schema-guard eerst draaien; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 16:05`; `melodiq-user.md` versie bijgewerkt naar `wo 16:05`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Playback fix: /stream 502 fallback naar direct S3)

- Findings: Sommige tracks speelden niet af doordat `/api/tracks/[id]/stream` met 502 kon falen wanneer de disk-cache laag een fout gaf (bijv. cache write/read of cache path issues).
- Conclusions: Voeg een robuuste fallback toe: als cache-stream faalt, stream direct vanaf S3 (met Range-header doorgezet) zodat playback blijft werken.
- Actions: `src/app/api/tracks/[id]/stream/route.ts` uitgebreid met fallback pad naar `getPresignedUrl` + `fetch` proxy inclusief Range/Content-Range handling; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 16:11`; `melodiq-user.md` versie bijgewerkt naar `wo 16:11`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Autoplay fix: next track startte op eindpositie)

- Findings: Bij automatisch door afspelen naar de volgende track nam de player soms de oude `currentTime` mee, waardoor de nieuwe track in de laatste seconden begon.
- Conclusions: Playback-positie alleen hervatten als exact dezelfde track opnieuw geladen wordt; bij trackwissel altijd vanaf 0 starten.
- Actions: `src/components/Player.tsx` uitgebreid met `lastLoadedTrackIdRef` en conditionele resume-logica zodat `resumeTime` alleen geldt voor dezelfde track-id; reset toegevoegd bij `!currentTrack`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 16:33`; `melodiq-user.md` versie bijgewerkt naar `wo 16:33`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Lyric Studio style suggestion max 1000 chars)

- Findings: De AI style suggestion in Lyric Studio had nog geen harde outputlimiet in tekens.
- Conclusions: Een server-side cap op sanitize-niveau voorkomt te lange output ongeacht providergedrag en houdt de UI-respons consistent.
- Actions: `src/lib/lyrics-style-suggestion.ts` aangepast met expliciete promptregel `maximum 1000 characters` en harde truncatie naar 1000 tekens in `sanitizeStyleSuggestionResponse`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 15:51`; `melodiq-user.md` bijgewerkt met de 1000-char limiet; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-28 (App-naam hernoemd naar MelodIQ)

- Findings: De app-branding stond op meerdere plekken nog hardcoded als `MelodIQ` (UI labels, metadata, player status, settings placeholders en documentatie), waardoor de naamswijziging niet consistent was.
- Conclusions: Een gerichte hernoeming van zichtbare branding en package metadata naar `MelodIQ` geeft een consistente gebruikerservaring zonder technische storage-keys of eventnamen te migreren.
- Actions: `src/app/layout.tsx`, `src/app/manifest.ts`, `src/components/Header.tsx`, `src/components/Sidebar.tsx`, `src/app/login/page.tsx`, `src/components/Player.tsx`, `src/components/settings/WebhooksSection.tsx`, `src/components/settings/S3Section.tsx`, `package.json`, `package-lock.json`, `README.md` en `melodiq-user.md` bijgewerkt met `MelodIQ` naming; versiestempel bijgewerkt naar `do 13:17` in `src/components/Sidebar.tsx` en `melodiq-user.md`; build uitgevoerd met `npm run build` en volledig geslaagd (met bestaande Turbopack-warning over NFT trace), validated.

## 2026-05-28 (Cache state zichtbaar gemaakt in player)

- Findings: De player toonde alleen `cache` of `s3`, waardoor een cache-warmup of S3 fallback er hetzelfde uitzag als een gewone cache-hit.
- Conclusions: Door de stream-route een expliciete cache-state header te laten sturen en de player-badge die status te tonen, wordt direct duidelijk of audio uit cache kwam, nog aan het warmen was, of terugviel op S3.
- Actions: `src/lib/audio-cache.ts` uitgebreid met `cached` returndata; `src/app/api/tracks/[id]/stream/route.ts` stuurt nu `x-melodiq-audio-cache-state` met `hit`, `miss` of `fallback`; `src/components/Player.tsx` toont cache-state in badge-title en fullscreen/player UI; `src/components/Sidebar.tsx` versie bijgewerkt naar `do 16:15`; `melodiq-user.md` bijgewerkt met de cache-badge uitleg; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-30 (Correctie Default Workspace duplicatie en track synchronisatie)

- Findings: De client-side Zustand store gebruikte de hardcoded string `"workspace-default"` als ID voor de default workspace, terwijl de database de default workspace aanmaakt met een willekeurige UUID. Dit leidde tot dubbele default workspace mappen in de UI na database hydratatie en zorgde ervoor dat alle nummers uit de default workspace onterecht als "buiten de default workspace toegewezen" werden gezien, waardoor de tracklijsten leeg konden raken.
- Conclusions: De Zustand store moet de default workspace filteren en track synchronisatie dynamisch sturen op basis van de `isDefault` vlag of de daadwerkelijk actieve UUID van de default workspace, in plaats van een hardcoded string ID te verwachten.
- Actions: `src/lib/store.ts` aangepast: `withDefaultWorkspace` sluit nu de redundant hardcoded `DEFAULT_WORKSPACE_ID` uit in `otherWorkspaces` filter om duplicaten te voorkomen; `syncTracksToDefaultWorkspace` zoekt nu dynamisch de actieve default workspace via `isDefault` vlag op en gebruikt die dynamic ID voor track filtering en opslag; gevalideerd.

## 2026-05-31 (Studio track title update performance optimization)

- Findings: Editing or saving a track title on the Studio page caused severe browser lag/freezing when the list contained many tracks.
- Conclusions: Unstable callbacks (`onPlay`, `toggleSelection` dependent on transient `displayedTracks` reference) and passing `allTracks` to all cards caused the entire list of cards to re-render. Inside each card, a heavy $O(N)$ workspace cover mapping was computed on every render, resulting in massive CPU lockups.
- Actions: Removed `allTracks` prop from `TrackCard`. Stabilized the selection callback by introducing `displayedTracksRef` and passing `onToggleSelection` callback to `TrackCard`. Memoized `workspaceCoverById` once in `TrackList` using a stable cover key (`tracks.map((t) => `${t.id}:${t.coverUrl ?? ""}`).join("|")`) that does not change on title updates, making its reference 100% stable. Updated the sidebar build version stamp in `src/components/Sidebar.tsx` to `zo 07:50`. Verified typescript safety with `npx tsc --noEmit` returning 0 errors.

## 2026-05-31 (Tracklist performance optimalisatie)

- Findings: Het dubbelklikken op een tracktitel om deze te bewerken veroorzaakte stotteringen doordat click-events doorborrelden naar de container en ongewild de zware zijbalk activeerden. Het slepen van tracks stotterde hevig door continue React state updates tijdens `dragover`. Grote lijsten (500+ items) vertraagden React rendering, en synchrone status polling in `/api/tracks` (GET) blokkeerde de API response.
- Conclusions: Stop propagatie van de titel click-events, vervang React dragover-state door directe DOM class manipulatie, voeg infinite scroll (lazy rendering) toe via IntersectionObserver, en haal synchrone status polling uit de GET endpoint.
- Actions:
  - Aangepast `src/components/tracks/TrackCard.tsx`: click-propagatie gestopt met `onClick={(e) => e.stopPropagation()}` op de titel `<h3>` element.
  - Aangepast `src/components/TrackList.tsx`: React state `dragOverTrackId` en `draggedTrackId` verwijderd en vervangen door `draggedTrackIdRef` (useRef); drag event handlers herschreven naar pure DOM manipulatie met HTML5 dragEnter/dragLeave; `visibleCount` en IntersectionObserver infinite scroll sentinel toegevoegd om per 30 items te pagineren.
  - Aangepast `src/app/api/tracks/route.ts`: synchrone Suno/PoYo status polling uit GET route verwijderd; database timeout checks uitgevoerd vòòr de tracks SELECT query om query performance te optimaliseren.
  - Aangepast `src/components/Sidebar.tsx`: buildVersion bijgewerkt naar `zo 08:15`; validated met `npm run build` (succesvol geslaagd, compile OK).

## 2026-05-31 (Bulkdelete, selectie-bar cleanup en status polling fix)

- Findings: De blauwe selectiebalk bovenaan de tracklist was redundant omdat de selectieteller al in de header wordt getoond. Daarnaast wilden gebruikers meerdere nummers tegelijk kunnen verwijderen door simpelweg op het prullenbak-icoon van een van de geselecteerde tracks te klikken, en was er een issue waarbij nieuw gegenereerde nummers in de tracklist soms pas na een handmatige paginarefresh als "complete" (done/failed) werden getoond door SWR-caching/deduplicatie.
- Conclusions: De blauwe `SelectionActionPill` kan volledig worden weggelaten. Door `handleDelete` in `TrackCard` de actieve selectie te laten checken kunnen we bulkverwijdering en een enkele bevestigingsmodal triggeren vanaf elk geselecteerd prullenbak-icoon. Door `fetchTracks` op de homepage via een directe fetch call met `cache: "no-store"` uit te voeren en de SWR cache handmatig bij te werken, omzeilen we de caching- en deduping-problemen volledig, wat zorgt voor een realtime status-update in de UI.
- Actions:
  - Aangepast `src/components/TrackList.tsx`: De render-invocatie van `<SelectionActionPill>` verwijderd uit de JSX.
  - Aangepast `src/components/tracks/TrackCard.tsx`: `handleDelete` en `executeDelete` aangepast zodat ze de Zustand selection store checken; als de huidige track geselecteerd is, wordt bulkverwijdering voor alle geselecteerde tracks in gang gezet via een eenduidige bevestigingsmodal en `onDeleteTracks` callback.
  - Aangepast `src/app/page.tsx`: De polling-functie `fetchTracks` herschreven om een directe fetch call met een cache-busting timestamp (`/api/tracks?t=Date.now()`, `cache: "no-store"`) te doen naar `/api/tracks`, de SWR-cache handmatig bij te werken via `mutateTracksResponse(payload, { revalidate: false })` en `applyTracksResponse` aan te roepen.
  - Aangepast `src/components/Sidebar.tsx`: buildVersion bijgewerkt naar `zo 10:00`; validated met `npm run build` (succesvol geslaagd, compile OK).

## 2026-06-02 (Rechter details-sidebar hoogte gelijkgetrokken)

- Findings: De rechter details-sidebar op Library/Workspaces forceerde een eigen viewporthoogte en week daardoor visueel af van de hoofdcontenthoogte.
- Conclusions: De detailcontainer moet de hoogte van het resizable panel volgen (`h-full`) in plaats van opnieuw `100vh - player` te berekenen.
- Actions: `src/app/library/page.tsx`, `src/app/workspaces/page.tsx` en `src/app/workspaces/[workspaceId]/page.tsx` aangepast van `sticky top-0 h-[calc(100vh-var(--player-height))] overflow-y-auto` naar `h-full overflow-y-auto`; `src/components/Sidebar.tsx` buildVersion bijgewerkt naar `202606021150`; gevalideerd met `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.

## 2026-06-02 (Timed lyrics parsing bij lange tracks gefixt)

- Findings: Timed lyrics konden uitvallen bij sommige tracks omdat de parser elke timeline met `maxStart > 300` als milliseconden interpreteerde en door `1000` deelde. Geldige seconde-timings boven 5 minuten werden daardoor fout geschaald.
- Conclusions: Milliseconde-detectie moet conservatief en veldbewust zijn: expliciete `_ms` velden direct converteren, en alleen een globale fallback doen voor echt grote numerieke waarden.
- Actions: `src/lib/parse-lyrics.ts` aangepast met expliciete handling voor `start_ms`/`startMs` en `end_ms`/`endMs`/`duration_ms`, plus conservatieve fallback (`maxStart >= 1000`) in plaats van `> 300`; `src/lib/__tests__/parse-lyrics.test.ts` uitgebreid met regressietests voor lange seconde-timings en ms-conversie; `src/components/Sidebar.tsx` buildVersion bijgewerkt naar `202606021157`; gevalideerd met `npm run test -- src/lib/__tests__/parse-lyrics.test.ts` en `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.

## 2026-06-02 (Track-id lyrics parsing debug endpoint toegevoegd)

- Findings: Voor productie-issues met timed lyrics per specifieke track-id ontbrak snelle, auth-veilige inspectie van parser-input en parser-output in dezelfde response.
- Conclusions: Een dedicated endpoint onder de bestaande tracks-route maakt vergelijking van payload-shape en parse-resultaten direct mogelijk zonder handmatige DB-shell of losse scripts.
- Actions: Toegevoegd `src/app/api/tracks/[id]/lyrics-debug/route.ts` met auth + user-scope check (`requireAuth` + `userId` filter), parserdiagnostiek (`parseLyrics`, `isLyricsTaskSubmission`), payload-shape analyse (velden/arrays/start-field usage), en hints voor veelvoorkomende parseproblemen; buildVersion bijgewerkt naar `202606021626` in `src/components/Sidebar.tsx`; gevalideerd met `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.

## 2026-06-02 (Prompt preview toegevoegd in track overlay)

- Findings: In de track-overlay ontbrak een snelle prompt-weergave direct onder titel/metadata, waardoor promptcontext pas lager in de panel-content zichtbaar was.
- Conclusions: Een compacte prompt-preview in de artwork-overlay met alleen de eerste niet-lege regel sluit beter aan op de gewenste UX en houdt de header-informatie direct bruikbaar.
- Actions: `src/components/TrackDetail.tsx` aangepast met `promptFirstLine` afleiding en een nieuwe overlay-sectie onder titel/metadata (label + copy-knop + single-line truncation) voor `mode === "overlay"`; `src/components/Sidebar.tsx` buildVersion bijgewerkt naar `202606021912`; gevalideerd met `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.

## 2026-06-02 (Rechter lyrics-sidebar begrensd met fade)

- Findings: De rechter Track Details sidebar liet de lyrics-sectie als onderdeel van de volledige kolom meelopen, waardoor de detailsweergave visueel langer werd dan de naastliggende trackkolom.
- Conclusions: De sidebar moet zelf een vaste paneelhoogte houden, met alleen een intern scrollbaar lyrics-vak en een fade-overlay onderaan om doorlopende content visueel af te kappen.
- Actions: `src/components/TrackDetail.tsx` aangepast zodat de sidebar-mode `overflow-hidden` gebruikt, de detailscontainer `min-h-0`/`overflow-hidden` afdwingt, en het lyrics-gedeelte een eigen scrollcontainer met zwarte bottom-fade krijgt voor timed en untimed lyrics; `melodiq-user.md` versie en beschrijving bijgewerkt; buildVersion bijgewerkt naar `202606021626`; validatie volgt via `npm run build`.

## 2026-06-03 wo 01:27 (PoYo failure reason extraction + backend failure logging)

- Findings: Bij PoYo-fails kwam de echte reden niet altijd door omdat alleen een beperkt setje foutvelden werd gelezen; daarnaast werd een fail-status niet overal expliciet gelogd met task-id en reden.
- Conclusions: Centraliseer PoYo error parsing in de providerlaag met brede veldsupport en gebruik die in zowel webhook als polling routes; log bij elke fail-overgang expliciet in backendlogs en API-log records.
- Actions: `src/lib/providers/poyo.ts` uitgebreid met `extractPoYoErrorMessage()` voor meerdere nested error/message/reason/status_msg velden; `src/app/api/tracks/route.ts` en `src/app/api/tracks/[id]/route.ts` omgezet naar de centrale helper + expliciete `console.error` logging met task-id/track-id/error; `src/app/api/webhooks/poyo/route.ts` omgezet naar centrale helper en uitgebreid met failure `logApi(...)` writes voor `status=failed/error` en no-variant sync-fail; `src/components/Sidebar.tsx` buildVersion bijgewerkt naar `202606030127`; `melodiq-user.md` versie + fail-reason gedrag bijgewerkt; gevalideerd met `npm run build` (geslaagd).

## 2026-06-03 wo 04:53 (PoYo WAV recovery voor nieuwe generaties gefixt)

- Findings: Nieuwe PoYo tracks kregen soms geen WAV omdat de webhook-flow WAV-conversie vooral triggert op `file.audio_id`; als PoYo een andere key-vorm terugstuurt, werd de conversie overgeslagen.
- Conclusions: WAV-conversie moet niet afhankelijk zijn van één specifiek webhook-field, maar op de gesyncte trackrecords draaien nadat audioId-updates zijn toegepast.
- Actions: `src/app/api/webhooks/poyo/route.ts` aangepast met bredere audio-id parsing (`audio_id`, `audioId`, `file_id`, `song_id`, `id`), daarna gesyncte tracks opnieuw ophalen en `requestMissingWavConversion(...)` uitvoeren op alle gesyncte tracks; cover-batch gebruikt nu de refreshed trackset; `src/components/Sidebar.tsx` buildVersion bijgewerkt naar `202606030453`; gevalideerd met `npm run build` (geslaagd).

## 2026-06-06 (Grote WAV uploadlimiet verhoogd + 413 feedback verbeterd)

- Findings: Uploads van grote WAV-bestanden (zoals 73,9MB) faalden al bij multipart parsing met `Failed to parse body as FormData`, omdat de Next proxy-bodylimiet op 50MB stond.
- Conclusions: De uploadproxylimiet moet ruim boven de gewenste WAV-grootte staan en de API moet expliciet 413 teruggeven met een heldere limietmelding bij te grote requests.
- Actions: `next.config.mjs` aangepast met configureerbare `UPLOAD_PROXY_MAX_BODY_MB` (default 200MB) voor `experimental.proxyClientMaxBodySize`; `src/app/api/tracks/route.ts` uitgebreid met pre-check op `content-length` en consistente 413-foutmelding met limiet in MB; gevalideerd met `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.

## 2026-06-06 za 18:02 (Library lyrics bewerken + LRC sidecar upload)

- Findings: In Library ontbrak een directe optie om lyrics toe te voegen aan tracks zonder lyrics en om bestaande lyrics in-place te corrigeren. Daarnaast kon uploadmetadata alleen als TXT, terwijl gebruikers ook LRC-timestampbestanden willen koppelen.
- Conclusions: Voeg lyrics-editing toe in `TrackDetail` (Library-context), breid `PATCH /api/tracks/[id]` uit met veilige lyrics-updates, en accepteer `.lrc` sidecars bij upload zodat `lyricsTimestamps` direct wordt gevuld.
- Actions: `src/components/TrackDetail.tsx` uitgebreid met `allowLyricsEdit`, add/edit/save/cancel UX en `onTrackUpdated` callback; `src/app/library/page.tsx` gekoppeld met `allowLyricsEdit`, lokale track-sync na save en metadata-selector uitgebreid naar TXT/LRC; `src/app/api/tracks/[id]/route.ts` uitgebreid met `lyrics` update-validatie (max 20000) en reset van `lyricsTimestamps` bij handmatige lyricswijziging; `src/app/api/tracks/route.ts` uitgebreid met LRC-sidecar parsing, automatische lyric-extractie en opslag van `lyricsTimestamps`; `src/components/Sidebar.tsx` buildVersion bijgewerkt naar `202606061802`; `melodiq-user.md` versie + Library-documentatie bijgewerkt; gevalideerd met `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.

## 2026-06-06 za 18:30 (Library playlists-tab met folder covers + cover picker)

- Findings: In Library ontbrak een aparte Playlists-tab met mapachtige cards; playlists hadden geen duidelijke coverpresentatie en gebruikers konden de folder-cover niet handmatig aanpassen.
- Conclusions: Voeg een eigen `playlists` view toe in Library met klikbare playlist-folders, kies standaard automatisch een random cover uit playlist-tracks, en bied een cover-picker om de cover per playlist te overschrijven of terug te zetten naar auto.
- Actions: `src/app/library/page.tsx` uitgebreid met `LibraryView = "songs" | "playlists" | "workspaces"`, header-tabs, playlist-folder grid cards, open-flow naar Songs-view per playlist, en cover-picker modal; playlist-covers worden persistent opgeslagen via `localStorage` key `melodiq.playlist-covers`; playback context gebruikt nu de actieve songset (`activeSongs`) zodat queue/autoplay ook klopt binnen geselecteerde playlists; `src/components/Sidebar.tsx` buildVersion bijgewerkt naar `202606061830`; `melodiq-user.md` geüpdatet met playlists-tab en handmatige coverkeuze; gevalideerd met `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.

## 2026-06-07 zo 05:08 (Song toevoegen aan bestaande playlist hersteld in Library)

- Findings: In de Library songs-view werkte "Add to playlist" niet voor bestaande playlists, omdat `TrackList` een no-op callback (`onAddToPlaylist={() => undefined}`) kreeg in plaats van de echte store-actie.
- Conclusions: Koppel de callback direct aan `usePlaylistStore().addTrackToPlaylist` met correcte argumentvolgorde (`playlistId`, `trackId`, `options`) zodat dezelfde flow als in workspaces/home wordt gebruikt.
- Actions: `src/app/library/page.tsx` aangepast: `addTrackToPlaylist` uit de playlist-store gedestructured en `TrackList` nu gekoppeld met `onAddToPlaylist={(trackId, playlistId, options) => addTrackToPlaylist(playlistId, trackId, options)}`; gevalideerd met `npm run build` (geslaagd, met bestaande Turbopack NFT warning), validated.
