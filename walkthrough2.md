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
