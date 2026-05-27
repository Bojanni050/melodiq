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
- Conclusions: De knop centraliseren via `GenerateButton` houdt de UI-consistentie en loading-state op één plek beheersbaar.
- Actions: `src/components/studio/GenerateButton.tsx` uitgebreid met optionele `className`; `src/components/StudioForm.tsx` aangepast om `GenerateButton` te gebruiken en `isGenerating` als prop te accepteren; `src/app/page.tsx` aangepast om `generating` door te geven aan `StudioForm`; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Lyrics Studio linkerpanelen opgesplitst)

- Findings: De linker configuratiekolom in de Lyrics Studio pagina bleef een groot inline JSX-blok en hield de page-component onnodig lang.
- Conclusions: Extractie naar een dedicated control-panel component houdt state/orchestratie in de pagina en verplaatst presentatielogica naar een herbruikbare module zonder gedrag te wijzigen.
- Actions: Toegevoegd `src/components/lyrics-studio/LyricsControlPanel.tsx` met metadata-, structuur-, preset-, slider- en toolbar-secties; `src/app/lyrics-studio/page.tsx` opgeschoond en gekoppeld aan `LyricsControlPanel`; a11y verbeterd met labels op range-inputs; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Lyrics Studio rechterkolom verder uitgedund)

- Findings: De pagina bevatte nog een grote inline rechterkolom voor Song Flow en Style Suggestion, wat de page-component onnodig groot hield.
- Conclusions: De bestaande `LyricsStudioSidePanel` component in de pagina gebruiken verlaagt de JSX-omvang en houdt dezelfde UX-flow intact.
- Actions: `src/app/lyrics-studio/page.tsx` aangepast om de inline rechterkolom te vervangen door `LyricsStudioSidePanel`-props; tijdelijke import-regressie (`Flowchart`) gecorrigeerd; build opnieuw uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Settings constants en model-modal geëxtraheerd)

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
- Actions: `src/components/tracks/TrackCard.tsx` aangepast: nested submenu vervangen door gecentreerde overlay “Move to Workspace”, lijst met workspace-rows + clip-count, onderaan input met teller en `Create Workspace` knop; bestaande move/create-logica behouden; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-26 (Workspaces pagina aligned met Library workspace UX)

- Findings: De dedicated Workspaces-pagina week qua layout en gedrag af van het Workspaces-gedeelte op de Library-pagina.
- Conclusions: Eén consistente workspace-ervaring (zelfde headerstijl, view-toggle, create-flow, cards/list en open-workspace gedrag) verlaagt cognitieve load en maakt beheer voorspelbaarder.
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
- Actions: `src/lib/store.ts` uitgebreid met `parentWorkspaceId` en `createWorkspaceFolder(parentWorkspaceId, name)` plus cascade-delete van directe subfolders; `src/app/workspaces/page.tsx` aangepast naar root-overzicht + subfolder-sectie en subfolder-create in geopende hoofdfolder; `src/components/tracks/TrackCard.tsx` Move To Workspace dialog hiërarchisch gemaakt (hoofdfolder/subfolder labels en toewijzing); build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Studio workspace-subfolders + harde 1-level normalisatie)

- Findings: In Studio was subfolder-aanmaak nog niet beschikbaar in de workspace panel-flow, terwijl de gewenste structuur expliciet `workspace -> folder` is zonder extra nesting.
- Conclusions: Subfolder-creatie moet ook in Studio kunnen op geopende hoofdfolders, en de persisted workspace-data moet defensief genormaliseerd worden zodat oude of handmatig ingevoerde nested data automatisch naar maximaal 1 niveau wordt teruggebracht.
- Actions: `src/app/page.tsx` aangepast met subfolder create-flow (`+ Add Subfolder`) alleen voor geopende hoofdfolders, root-only workspace-overzicht, parent-terugknop bij child-weergave en subfolderlijst in de geopende hoofdfolder; `src/lib/store.ts` normalisatie in `withDefaultWorkspace` aangescherpt zodat alleen kinderen van root-workspaces een `parentWorkspaceId` behouden; `sonara-user.md` bijgewerkt met Studio-subfolder gedrag en versie; build uitgevoerd met `npm run build` en volledig geslaagd, validated.

## 2026-05-27 (Library upload van MP3/WAV met workspace-keuze en batch)

- Findings: De Library had nog geen directe importflow voor bestaande audiobestanden, waardoor users losse uploads extern moesten regelen en tracks daarna handmatig organiseren.
- Conclusions: Voeg een dedicated uploadflow toe op Library Songs view met multi-file support en workspace-selectie, plus een backend endpoint dat meerdere MP3/WAV-bestanden in één request accepteert.
- Actions: `src/app/api/tracks/route.ts` uitgebreid met `POST` multipart upload voor maximaal 20 bestanden tegelijk (MP3/WAV-validatie, S3-upload, track insert met `provider=upload`); `src/app/library/page.tsx` uitgebreid met uploadkaart (`Select MP3/WAV Files`), workspace-dropdown, upload statusmelding en directe workspace-toewijzing van nieuwe track IDs via store; `src/components/Sidebar.tsx` versie bijgewerkt naar `wo 03:18`; `sonara-user.md` bijgewerkt met uploadgebruik; build uitgevoerd met `npm run build` en volledig geslaagd, validated.
