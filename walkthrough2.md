## 2026-05-26 (Refactor grote bestanden in losse modules)

- Findings: Lyrics Studio, TrackList en Home page bevatten nog veel inline UI- en helperlogica waardoor onderhoud en hergebruik lastig waren.
- Conclusions: Helpers verplaatsen naar `src/lib` en UI-secties naar gerichte componentbestanden verlaagt complexiteit zonder business-flow te wijzigen.
- Actions: Aangemaakt `src/lib/lyrics-utils.ts` en `src/lib/track-utils.ts`; toegevoegd `src/components/lyrics-studio/LyricBlockEditor.tsx`, `src/components/lyrics-studio/PresetSelector.tsx`, `src/components/lyrics-studio/BlockToolbar.tsx`; toegevoegd `src/components/tracks/types.ts`, `src/components/tracks/WaveformBars.tsx`, `src/components/tracks/ConfirmDialog.tsx`, `src/components/tracks/GeneratingRow.tsx`, `src/components/tracks/TrackCard.tsx`; toegevoegd `src/components/studio/GenerateButton.tsx`, `src/components/studio/NoticeBar.tsx`, `src/components/studio/CreateWorkspaceDialog.tsx`, `src/components/studio/ResizablePanel.tsx`; gerefactord `src/components/TrackList.tsx`, `src/app/lyrics-studio/page.tsx`, `src/app/page.tsx` naar imports van nieuwe modules; build uitgevoerd met `npm run build` (compile ok, faalt bij page data door ongeldige `postgres` URL in env voor `/api/auth/register`), validated.

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
- Actions: `src/app/page.tsx` aangepast met subfolder create-flow (`+ Add Subfolder`) alleen voor geopende hoofdfolders, root-only workspace-overzicht, parent-terugknop bij child-weergave en subfolderlijst in de geopende hoofdfolder; `src/lib/store.ts` normalisatie in `withDefaultWorkspace` aangescherpt zodat alleen kinderen van root-workspaces een `parentWorkspaceId` behouden; `musiq-user.md` bijgewerkt met Studio-subfolder gedrag en versie; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Library upload van MP3/WAV met workspace-keuze en batch)

- Findings: De Library had nog geen directe importflow voor bestaande audiobestanden, waardoor users losse uploads extern moesten regelen en tracks daarna handmatig organiseren.
- Conclusions: Voeg een dedicated uploadflow toe op Library Songs view met multi-file support en workspace-selectie, plus een backend endpoint dat meerdere MP3/WAV-bestanden in Ã©Ã©n request accepteert.
- Actions: `src/app/api/tracks/route.ts` uitgebreid met `POST` multipart upload voor maximaal 20 bestanden tegelijk (MP3/WAV-validatie, S3-upload, track insert met `provider=upload`); `src/app/library/page.tsx` uitgebreid met uploadkaart (`Select MP3/WAV Files`), workspace-dropdown, upload statusmelding en directe workspace-toewijzing van nieuwe track IDs via store; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:18`; `musiq-user.md` bijgewerkt met uploadgebruik; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Uploaded-bestanden expliciet gemarkeerd in UI)

- Findings: Na toevoegen van Library upload was niet direct zichtbaar welke tracks lokaal geupload zijn versus AI-gegenereerd.
- Conclusions: Toon een expliciete visuele indicator op lijst- en detailniveau voor tracks met `provider=upload`, zodat herkomst direct duidelijk is.
- Actions: `src/components/tracks/TrackCard.tsx` uitgebreid met `Uploaded` badge naast status voor geuploade tracks; `src/components/TrackDetail.tsx` uitgebreid met `Uploaded file` label en leesbare bronlabels (`Upload â€¢ Local file`) voor geuploade tracks; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:21`; `musiq-user.md` bijgewerkt met indicator-uitleg; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Workspace folder opent nu op eigen detailpagina)

- Findings: De Workspaces-pagina toonde na folderselectie de tracklisting onder hetzelfde folderoverzicht, waardoor de focus op Ã©Ã©n folder minder duidelijk was.
- Conclusions: Splits de flow in overzicht en detailroute, zodat folderklikken naar een dedicated pagina met tracklisting gaat en terugnavigatie expliciet wordt.
- Actions: `src/app/workspaces/page.tsx` omgezet naar puur folderoverzicht met kliknavigatie naar `/workspaces/{id}`; nieuwe route toegevoegd in `src/app/workspaces/[workspaceId]/page.tsx` met folder-specifieke tracklisting, subfoldernavigatie en `Back to folders` knop; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:24`; `musiq-user.md` bijgewerkt met nieuwe navigatie; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Duplicate upload preventie via unieke audio-hash)

- Findings: Het uploaden van hetzelfde MP3/WAV-bestand meerdere keren maakte dubbele tracks aan in de library.
- Conclusions: Gebruik een content-gebaseerde SHA-256 hash per upload en weiger uploads waarvan dezelfde hash al bestaat voor dezelfde gebruiker.
- Actions: `src/app/api/tracks/route.ts` uitgebreid met `createHash("sha256")` op de audiobuffer, duplicate-check op bestaande `provider="upload"` tracks met dezelfde hash (`audioId`) en opslag van de hash op nieuwe uploadrecords; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:27`; `musiq-user.md` bijgewerkt met dedupe-gedrag; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Play-count tracking + new-dot indicator)

- Findings: Tracks hadden nog geen afspeelstatistiek en er was geen visuele markering voor nieuwe, nog niet afgespeelde songs.
- Conclusions: Een persistente `play_count` in de database, een dedicated play increment endpoint en een directe UI-event zorgen voor zowel betrouwbare telling als onmiddellijke feedback in de lijst.
- Actions: `src/db/schema.ts` uitgebreid met `play_count`; `src/db/init.ts` bijgewerkt voor create/alter compatibiliteit; toegevoegd `src/app/api/tracks/[id]/play/route.ts` voor auth-safe increment; `src/components/Player.tsx` laat nu bij start playback een increment-call lopen en dispatcht `musiq:track-played`; `src/components/tracks/TrackCard.tsx` toont play count onder beschrijving, rendert een gele glow-dot bij ongespeelde tracks en verwijdert die direct na play via event-listener; `src/components/tracks/types.ts` en `src/lib/store.ts` tracktypes uitgebreid met `playCount`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:35`; `musiq-user.md` bijgewerkt met play-count gedrag; validated.

## 2026-05-27 (Cover art regenerate actie + grid-size controls op Library/Workspaces)

- Findings: Er ontbrak een directe trackactie om cover art opnieuw te genereren, de cover prompt voelde te generiek, en de 4/8/12/16 gridselector bestond nog niet op Library Workspaces en de dedicated Workspaces-pagina.
- Conclusions: Een expliciete `Regenerate Cover Art` trackactie met force-new generatie voorkomt hergebruik van dezelfde cover; een artistiekere prompt geeft visueel rijkere covers; dezelfde grid-size controls op alle workspace-overzichten houdt UX consistent.
- Actions: `src/components/tracks/TrackCard.tsx` uitgebreid met menu-actie `Regenerate Cover Art`, loading-state en lokale cover refresh; `src/app/api/tracks/[id]/route.ts` PATCH ondersteunt nu `regenerateCoverArt`; `src/lib/generate-cover.ts` ondersteunt `forceNew` om prompt-based reuse te skippen bij regenereren; `src/lib/providers/cover-art.ts` promptrichting aangepast naar uitgesproken artsy/editorial stijl; `src/app/library/page.tsx` en `src/app/workspaces/page.tsx` uitgebreid met persistente 4/8/12/16 workspace-grid selector in grid mode; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:41`; `musiq-user.md` bijgewerkt; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Play count pas na 10 seconden playback)

- Findings: De play counter verhoogde direct bij start van afspelen, waardoor korte starts/skips ook als play werden geteld.
- Conclusions: Een 10-seconden playbackdrempel met timer en cleanup op pauze/trackwissel telt alleen betekenisvolle listens en voorkomt inflatie van plays.
- Actions: `src/components/Player.tsx` aangepast met 10s timer-gebaseerde play tracking (`/api/tracks/[id]/play` pas na 10 seconden actieve playback), timer cleanup bij pauze/trackwissel/einde en reset per tracksessie; bestaande UI-event `musiq:track-played` blijft gebruikt zodat de new-dot pas na echte play verdwijnt; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:45`; `musiq-user.md` bijgewerkt met 10s-regel; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Lyric Studio markerblokken + AI titelgeneratie)

- Findings: In Lyric Studio ontbraken speciale lege sectiemarkers voor instrumentale passages, en er was geen directe titelworkflow vanuit de lyric-blokken.
- Conclusions: Voeg twee expliciete markerblokken toe (`[intrumental]`, `[instrumetal drop]`) die geen lyrics bevatten maar wel als sectietag exporteren, en voeg een titelveld met AI-generate knop toe op basis van de samengestelde lyrics.
- Actions: `src/lib/lyrics-utils.ts` uitgebreid met nieuwe blocktypes, labels, structure-parser ondersteuning en combine-logica voor lege markersecties; `src/lib/lyrics-studio-constants.ts` uitgebreid met markerblokken in toolbar en kleurmapping; `src/components/lyrics-studio/LyricBlockEditor.tsx` aangepast zodat markerblokken geen lyrics/translate/generate toelaten; `src/app/api/lyric-studio/generate-block/route.ts` en `src/app/api/lyric-studio/translate/route.ts` typeguards uitgebreid voor de nieuwe blocktypes; `src/components/lyrics-studio/LyricsControlPanel.tsx` uitgebreid met title input en `Generate title` knop; `src/app/lyrics-studio/page.tsx` gekoppeld met `/api/generate-title`, title-state wiring en overdracht van title naar Studio; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 14:31`; `musiq-user.md` bijgewerkt; validated.

## 2026-05-27 (Library upload hint + robuuste non-JSON foutafhandeling)

- Findings: Bij uploadfouten met HTML-responses (zoals te grote request) kon de frontend falen met `Unexpected token '<'` en was voor users onduidelijk wat de limiet was.
- Conclusions: Maak upload-response parsing tolerant voor non-JSON en toon in de UI expliciet de uploadlimiet en foutverwachting.
- Actions: `src/app/library/page.tsx` uitgebreid met veilige `readApiPayload` parser, duidelijke fallback foutmelding bij non-JSON responses en specifieke 413 melding; uploadkaart helpertekst aangevuld met limiet van 20 bestanden per upload; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 14:48`; `musiq-user.md` bijgewerkt met limiet/foutmelding; validated.

## 2026-05-27 (Library upload workspace-dropdown gevuld met bestaande workspaces)

- Findings: In Library upload liet de workspace-dropdown soms alleen `Default Workspace` zien, ondanks bestaande workspaces in persistente state.
- Conclusions: Forceer eerst workspace-store rehydratie en voer daarna pas de default-workspace normalisatie uit; zo blijven bestaande persisted workspaces zichtbaar in de dropdown.
- Actions: `src/app/library/page.tsx` aangepast met expliciete `useWorkspaceStore.persist.rehydrate()` en `onFinishHydration`-flow vóór `ensureDefaultWorkspace`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 15:10`; `musiq-user.md` bijgewerkt met workspace-dropdown gedrag; validated.

## 2026-05-27 (Docker build-fix: ontbrekende setVolume in Player)

- Findings: De Docker/Next build faalde met TypeScript-fout `Cannot find name 'setVolume'` in de player volume-handler.
- Conclusions: De `Player` component gebruikte `setVolume` in `handleVolume`, maar haalde de action niet uit de Zustand store-destructuring; toevoeging van de ontbrekende action herstelt compile.
- Actions: `src/components/Player.tsx` bijgewerkt door `setVolume` toe te voegen aan `usePlayerStore()` destructuring in de `Player` component; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 15:17`; `musiq-user.md` versie bijgewerkt naar `wo 15:17`; build uitgevoerd met `npm run build` en volledig geslaagd (met bestaande Turbopack-warning over NFT trace), validated.

## 2026-05-27 (Herstel: tracks verdwenen door workspace-schema mismatch)

- Findings: Na introductie van DB-workspaces konden track-overzichten leeg lijken wanneer `tracks.workspace_id`/`workspaces` nog niet in de database aanwezig waren op runtime.
- Conclusions: Voeg een runtime schema-guard + fallback toe zodat track-API nooit hard faalt op ontbrekende migratie en de bestaande tracks direct zichtbaar blijven.
- Actions: `src/lib/workspaces.ts` uitgebreid met `ensureWorkspaceSchema()` (idempotente `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS`) en fallback payload; `src/app/api/tracks/route.ts` en `src/app/api/tracks/[id]/route.ts` laten schema-guard eerst draaien; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 16:05`; `musiq-user.md` versie bijgewerkt naar `wo 16:05`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Playback fix: /stream 502 fallback naar direct S3)

- Findings: Sommige tracks speelden niet af doordat `/api/tracks/[id]/stream` met 502 kon falen wanneer de disk-cache laag een fout gaf (bijv. cache write/read of cache path issues).
- Conclusions: Voeg een robuuste fallback toe: als cache-stream faalt, stream direct vanaf S3 (met Range-header doorgezet) zodat playback blijft werken.
- Actions: `src/app/api/tracks/[id]/stream/route.ts` uitgebreid met fallback pad naar `getPresignedUrl` + `fetch` proxy inclusief Range/Content-Range handling; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 16:11`; `musiq-user.md` versie bijgewerkt naar `wo 16:11`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Autoplay fix: next track startte op eindpositie)

- Findings: Bij automatisch door afspelen naar de volgende track nam de player soms de oude `currentTime` mee, waardoor de nieuwe track in de laatste seconden begon.
- Conclusions: Playback-positie alleen hervatten als exact dezelfde track opnieuw geladen wordt; bij trackwissel altijd vanaf 0 starten.
- Actions: `src/components/Player.tsx` uitgebreid met `lastLoadedTrackIdRef` en conditionele resume-logica zodat `resumeTime` alleen geldt voor dezelfde track-id; reset toegevoegd bij `!currentTrack`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 16:33`; `musiq-user.md` versie bijgewerkt naar `wo 16:33`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Lyric Studio style suggestion max 1000 chars)

- Findings: De AI style suggestion in Lyric Studio had nog geen harde outputlimiet in tekens.
- Conclusions: Een server-side cap op sanitize-niveau voorkomt te lange output ongeacht providergedrag en houdt de UI-respons consistent.
- Actions: `src/lib/lyrics-style-suggestion.ts` aangepast met expliciete promptregel `maximum 1000 characters` en harde truncatie naar 1000 tekens in `sanitizeStyleSuggestionResponse`; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 15:51`; `musiq-user.md` bijgewerkt met de 1000-char limiet; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-28 (App-naam hernoemd naar MelodIQ)

- Findings: De app-branding stond op meerdere plekken nog hardcoded als `Musiq` (UI labels, metadata, player status, settings placeholders en documentatie), waardoor de naamswijziging niet consistent was.
- Conclusions: Een gerichte hernoeming van zichtbare branding en package metadata naar `MelodIQ` geeft een consistente gebruikerservaring zonder technische storage-keys of eventnamen te migreren.
- Actions: `src/app/layout.tsx`, `src/app/manifest.ts`, `src/components/Header.tsx`, `src/components/Sidebar.tsx`, `src/app/login/page.tsx`, `src/components/Player.tsx`, `src/components/settings/WebhooksSection.tsx`, `src/components/settings/S3Section.tsx`, `package.json`, `package-lock.json`, `README.md` en `musiq-user.md` bijgewerkt met `MelodIQ` naming; versiestempel bijgewerkt naar `do 13:17` in `src/components/Sidebar.tsx` en `musiq-user.md`; build uitgevoerd met `npm run build` en volledig geslaagd (met bestaande Turbopack-warning over NFT trace), validated.

## 2026-05-28 (Cache state zichtbaar gemaakt in player)

- Findings: De player toonde alleen `cache` of `s3`, waardoor een cache-warmup of S3 fallback er hetzelfde uitzag als een gewone cache-hit.
- Conclusions: Door de stream-route een expliciete cache-state header te laten sturen en de player-badge die status te tonen, wordt direct duidelijk of audio uit cache kwam, nog aan het warmen was, of terugviel op S3.
- Actions: `src/lib/audio-cache.ts` uitgebreid met `cached` returndata; `src/app/api/tracks/[id]/stream/route.ts` stuurt nu `x-musiq-audio-cache-state` met `hit`, `miss` of `fallback`; `src/components/Player.tsx` toont cache-state in badge-title en fullscreen/player UI; `src/components/Sidebar.tsx` versie bijgewerkt naar `do 16:15`; `musiq-user.md` bijgewerkt met de cache-badge uitleg; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-30 (Correctie Default Workspace duplicatie en track synchronisatie)

- Findings: De client-side Zustand store gebruikte de hardcoded string `"workspace-default"` als ID voor de default workspace, terwijl de database de default workspace aanmaakt met een willekeurige UUID. Dit leidde tot dubbele default workspace mappen in de UI na database hydratatie en zorgde ervoor dat alle nummers uit de default workspace onterecht als "buiten de default workspace toegewezen" werden gezien, waardoor de tracklijsten leeg konden raken.
- Conclusions: De Zustand store moet de default workspace filteren en track synchronisatie dynamisch sturen op basis van de `isDefault` vlag of de daadwerkelijk actieve UUID van de default workspace, in plaats van een hardcoded string ID te verwachten.
- Actions: `src/lib/store.ts` aangepast: `withDefaultWorkspace` sluit nu de redundant hardcoded `DEFAULT_WORKSPACE_ID` uit in `otherWorkspaces` filter om duplicaten te voorkomen; `syncTracksToDefaultWorkspace` zoekt nu dynamisch de actieve default workspace via `isDefault` vlag op en gebruikt die dynamic ID voor track filtering en opslag; gevalideerd.