# Wayfinder — Schrijf-DNA fase 1

| Stage | Resultaat | Gate | Reden |
|---|---|---|---|
| Intake | probleem: `words` = woordentelling + één LLM-cijfer, terwijl het tekstcorpus rijk is (1.980 teksten, 15 talen) | PASS | gemeten in de productie-DB, geen aanname |
| Define | `.pipeline/to-spec.md` met traitmatrix, niet-scope en acceptatiecriteria | PASS | Bo's drie beslissingen (dekking, per taal, keys behouden) staan er vast in |
| Economy gate | full-spec — meerdere nieuwe bestanden, meerdere sessies, volledig reversibel | PASS | geen schema-, provider- of UI-wijziging in deze fase |
| Plan | `.pipeline/plans/01-writing-dna.md` met stappen, bestanden, teststrategie, commit-concept | PASS | bestandsnamen en functiesignaturen liggen vast |
| Teardown | vijf ronden pre-build, twee aanscherpingen doorgevoerd (spectra blijven dark; signature words op documentfrequentie) | PASS | goldfish-lezing op spec + plan, geen code aanwezig |
| Build (slice 1) | `style-dna/types.ts` + `style-dna/features.ts` + 18 tests, eerst rood toen groen | PASS | `vitest run style-dna-features` 18/18 |
| Verify (slice 1) | volledige suite 409 tests groen (41 bestanden), `tsc --noEmit` schoon | PASS | echte output, geen aanname |
| Build (slice 2) | `style-dna/aggregate.ts` met per-taal-sets + `collectWritingSources`, 12 tests | PASS | `vitest run style-dna-aggregate` 12/12 |
| Verify (slice 2) | 424 tests in 42 bestanden groen, `tsc --noEmit` schoon, `npm run build` exit 0, praktijkproef over 400 tracks | PASS | echte output; `npm run lint` is pre-existent stuk (`next lint` weg in Next 16) |
| Commit | `feat(dna): schrijf-DNA …` op `feature/style-dna-words` | PASS | één feature per commit |

## Fase 1 — afgerond

Twaalf `words`-traits uit eigen teksten, per taal (`:<lang>` keysuffix, vanaf vijf
teksten) naast een overall-set, gewired in `recomputeDnaProfile`. Geen
schemawijziging nodig.

## Open (fase 2 en verder)

- Fase 2: `dna_signals`-ledger (bron: song/edit/calibration/rating/voice) plus
  trait-historie → pulsing, "changed this week", trend.
- Fase 3: calibratie verbreden (audio-duels voor length/density/chorus, en een
  tekst-duel voor de words-traits op het lyricscorpus).
- Fase 4: persona's (alter ego's), naam-generator, seed/nudges.
- Los: `npm run lint` repareren (repo-breed, niet van deze fase).
