# Plan 01 — Writing DNA uit eigen teksten (fase 1: dekking)

Rung: full-spec. Spec: `.pipeline/to-spec.md` (beslissingen Bo 2026-11-18:
dekking eerst, per taal, bestaande keys houden).

## Stappen

1. `src/lib/style-dna/types.ts` — `WritingFeatures`, `RhymeStats`, taalcode-type.
2. `src/lib/style-dna/features.ts` — puur: secties splitsen, lettergrepen tellen,
   rijmtail/rijmschema, interne + multisyllabische rijm, POV, tense, explicitness,
   contentwoorden, thema's. Onbekende taal → generieke fallback; te korte tekst → `null`.
3. `src/lib/style-dna/aggregate.ts` — `WritingFeatures[]` → per-taal traits in de
   vorm van `DnaTrait` (zelfde confidence-semantiek als `dna/aggregate.ts`,
   `words`-categorie), plus een `overall`-set. Bestaande keys: `rhyme_scheme`,
   `rhyme_density`, `internal_rhyme`, `multisyllabic_rhyme`, `line_syllables`,
   `pov`, `tense`, `explicitness`, `signature_words`, `themes`, `writing_languages`.
4. Tests: `src/lib/__tests__/style-dna-features.test.ts`,
   `style-dna-aggregate.test.ts` (test-first geschreven, eerst rood).
5. Bewijs: `npm run test`, `npx tsc --noEmit`, `npm run lint`.
6. Walkthrough-entry in `walkthrough2.md` (want `walkthrough.md` = 1.875 regels).

## Bestanden die geraakt worden

- nieuw: `src/lib/style-dna/{types,features,aggregate}.ts`
- nieuw: `src/lib/__tests__/style-dna-{features,aggregate}.test.ts`
- nieuw: `.pipeline/*` (spec, plan, wayfinder)
- geen wijziging in `src/lib/dna/*`, `src/db/*`, UI of providers in deze fase

## Teststrategie

Per functie een tabel met echte regels in en/nl/es/pt, plus expliciete
`null`-gevallen (lege tekst, alleen tags, onbekende taal). Geen snapshot-tests;
elke assertie is een uitlegbare waarde.

## Verificatiecriteria

1. Alle nieuwe tests groen, bestaande suite ongewijzigd groen.
2. `tsc --noEmit` geen nieuwe fouten.
3. Iedere functie is puur: geen imports uit `@/db`, `next/*`, `axios`, React.
4. Onbekende taal levert generieke resultaten of `null`, nooit een crash.

## Commit-bericht (concept)

`feat(dna): schrijf-DNA uit eigen teksten — rijm, cadans, POV, thema's per taal`

## Teardown (goldfish, pre-build, vijf ronden)

1. **Zoom-out** — PASS: het geheel hangt samen: één pure feature-extractor plus
   één aggregator die de bestaande traitvorm hergebruikt; geen schema-wijziging
   nodig omdat `dna_traits` al vrije keys met kind/value/confidence opslaat.
2. **Comprehension** — PASS: een buitenstaander kan uit de spec halen welke key
   uit welke functie komt; de traitmatrix is expliciet.
3. **Design critique** — PASS met twee aanscherpingen die in de spec zijn
   verwerkt: (a) semantische spectra blijven dark in plaats van lexicon-gegok,
   (b) `signature_words` wordt op **documentfrequentie** (aantal tracks met het
   woord) gebaseerd, niet op ruwe telling, anders winnen lange nummers.
4. **Zoom-out na kritiek** — PASS: de aanscherpingen raken alleen de inhoud van
   `features.ts`/`aggregate.ts`, niet de vorm; `dna/aggregate.ts` blijft
   onaangeroerd.
5. **Implementation readiness** — PASS: bestandsnamen, functiesignaturen,
   testnamen en de fallback-regels staan vast; niets hangt meer op een keuze
   tijdens het bouwen.

Uitgesteld naar latere fases (bewust): tekst-duels (fase 3), signalen-ledger en
trait-historie (fase 2), persona's/seed (fase 4).
