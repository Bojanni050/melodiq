# Plan 02 — Trait-historie, signalen en trait-staten (fase 2)

Spec: `.pipeline/to-spec-02-signalen-en-historie.md`.
Basis: fase 1 is gedeployed (`ed44cbd` op main) en het profiel is herbouwd.

## Slices

**Slice 1 — schema + pure kern**
1. `src/db/schema.ts`: `dnaTraitHistory` (`id`, `userId`, `profileId`, `traitKey`,
   `previousValue`, `value`, `direction`, `changedAt`) + indexen op
   `(userId, changedAt)` en `(profileId, traitKey)`; op `dnaTraits`:
   `firstSeenAt`, `lastChangedAt`, `lockedAt`.
2. `src/db/init.ts`: dezelfde DDL in `createTablesSql` + de kolommen in de
   alter-lijst, zodat bestaande installaties meelopen.
3. `drizzle-kit generate` → migratie in `drizzle/`.
4. `src/lib/dna/history.ts` (nieuw, puur): `diffTraits(previous, next)` →
   wijzigingen met richting en alleen echte verschillen; `applyLocks(previous,
   next)` → vergrendelde keys houden hun oude waarde.
5. `src/lib/dna/states.ts` (nieuw, puur): `traitState(trait, { history, now })`
   → `state` (dark/learning/sure/pulsing/locked), `trend`, en
   `signalCounters({ sources, feedback, calibrations })` voor de tellersregel.
6. Tests: `dna-history.test.ts`, `dna-states.test.ts` (tabelgedreven, met
   randen: geen vorige meting, identieke waarde, lock).

**Slice 2 — wiring in de repository**
7. `src/lib/dna/repository.ts`: binnen de bestaande transactie de oude traits
   lezen, `applyLocks` toepassen, historie wegschrijven en de tijdstempels
   zetten; `getDnaProfile` geeft historie + staten mee.
8. Tests op de pure functies met de repository-vorm als fixture (geen DB).

**Slice 3 — API + minimale UI**
9. `src/app/api/dna/route.ts`: `state`, `pulsing`, `trend`, `signals`,
   `lockedAt` per trait.
10. DNA-pagina: pulsing-stip, slot-icoon (klik = lock/unlock), tellersregel
    ("N songs · N edits · N calibrations").

## Teststrategie

Pure functies tabelgedreven met echte trait-vormen uit `dna_traits`; elke
assertie is een uitlegbare waarde. Geen snapshots. Randen expliciet: vorige
meting ontbreekt, waarde exact gelijk, richting bij daling, lock bij een
gewijzigde waarde.

## Verificatiecriteria

- `npx vitest run` (groen), `npx tsc --noEmit` (schoon), `npm run build` (exit 0),
  `npm run db:check-drift` (geen drift tussen `init.ts` en de migratieketen).
- Praktijkproef in de container: twee keer `scripts/rebuild-dna.ts` achter elkaar
  → de tweede run schrijft geen historie en laat `last_changed_at` staan.
- Lock-test in de container: trait vergrendelen, rebuild, waarde ongewijzigd.

## Commit-bericht (concept)

`feat(dna): trait-historie, staten en tellers (fase 2)`

## Teardown (goldfish, pre-build, vijf ronden)

1. **Zoom-out** — PASS: één nieuwe tabel plus drie kolommen, twee pure modules
   en één wiring-plek; het geheel past in de bestaande "wholesale replace per
   rebuild"-architectuur.
2. **Comprehension** — PASS: de spec zegt per artefact welke functie wat doet, en
   de staten zijn expliciet benoemd met hun drempels.
3. **Design critique** — PASS met één aanscherping die in de spec is verwerkt:
   de eerder voorgestelde `dna_signals`-tabel vervalt, want `dna_feedback_events`
   en `dna_calibration_answers` bestaan al en `sourceCount` dekt de songs. Dat
   scheelt een tabel die dezelfde waarheid op een tweede plek zou opslaan.
4. **Zoom-out na kritiek** — PASS: het schrappen van de signals-tabel raakt alleen
   slice 1 (kleiner), niet de vorm van de rest.
5. **Implementation readiness** — PASS: bestandsnamen, kolomnamen, drempels
   (pulsing < 7 dagen, learning < 0,5) en testnamen liggen vast.

Uitgesteld: fase 3 (calibratie op tekst) en fase 4 (persona's, seed, naam).
