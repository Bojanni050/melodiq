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
| Commit | nog niet — fase 1 is pas af na `aggregate.ts` + repository-wiring | — | één feature, één commit |

## Open

- `style-dna/aggregate.ts`: features → traits in `DnaTrait`-vorm, per taal
  (keysuffix `:nl`, `:en`, …) plus een `overall`-set; confidence volgens dezelfde
  coverage×agreement-regel als `dna/aggregate.ts`.
- Repository-wiring: de nieuwe traits in de bestaande snapshot opnemen.
- Daarna fase 2 (signalen-ledger + trait-historie) en fase 3 (calibratie op tekst).
