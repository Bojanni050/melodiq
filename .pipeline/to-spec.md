# To-spec — Writing DNA uit eigen teksten (fase 1: dekking)

## Intake

Melody DNA meet op dit moment 18 traits; de categorie `words` bestaat in de
praktijk uit woordentelling plus een LLM-lyricsscore. Daardoor kan het profiel
niets zeggen over *hoe* Bo schrijft, terwijl de catalogus juist daar rijk is
(±2.070 tracks, ±1.980 met bruikbare lyrics, 15 talen) en de audio-kant dun is
(79 Advanced-DNA-tracks).

Uitkomst: deterministische schrijf-DNA per track, geaggregeerd tot traits in de
categorie `words`, per taal opgeslagen naast het bestaande profiel.

## Economy gate

rung: full-spec — meerdere nieuwe bestanden, meerdere sessies, maar volledig
reversibel (geen schema-wijziging, geen provider-calls, geen UI in fase 1).

## Beslissingen (Bo, 2026-11-18)

1. **Dekking eerst** — de ontbrekende `words`-traits, geen mechanismen (historie,
   ledger, calibratie-uitbreiding) in deze fase.
2. **Per taal** — rijm en cadans zijn taalgebonden; traits worden per taal
   geaggregeerd, met het bestaande veld `language` van de track als sleutel.
3. **Bestaande keys houden, UI vertaalt** — geen hernoeming naar Melody Genie's
   labels in de datalaag.

## Scope fase 1 (de `words`-traits die deterministisch kunnen)

| Nieuwe key | Waarde | Bron |
|---|---|---|
| `rhyme_scheme` | meest voorkomend schema per sectie, bv. `ABAB`, `AABB` | rijmtail per regel |
| `rhyme_density` | % regels dat rijmt met een andere regel | idem |
| `internal_rhyme` | % regels met rijm binnen de regel | idem |
| `multisyllabic_rhyme` | % rijmende paren waarvan de tail ≥2 lettergrepen telt | idem |
| `line_syllables` | gemiddelde lettergrepen per regel | lettergreepteller |
| `line_length_spread` | standaardafwijking van de regellengte | idem |
| `pov` | `first` \| `second` \| `third` \| `mixed` | persoonlijke voornaamwoorden |
| `tense` | `past` \| `present` \| `mixed` | werkwoordsmarkers (en/nl/es/pt; anders dark) |
| `explicitness` | 0–100% | scheldwoordenlijst per taal |
| `signature_words` | top-N kenmerkende woorden (frequentie boven taal-stopwoorddrempel) | woordfrequentie |
| `themes` | top-N thema's uit een keywordmap (love, night, street, nostalgia, …) | keywordmap |
| `writing_languages` | talen met ≥N bruikbare teksten | bestaand `language`-veld |

Semantische spectra (colloquial↔literary, literal↔imagery, serious↔playful,
cliché tolerance, slang) blijven in deze fase **dark** — geen gokken als trait.

## Niet in scope (fase 1)

- Geen `dna_signals`, geen trait-historie, geen pulsing/lock (fase 2).
- Geen calibratie-duels op tekst (fase 3).
- Geen persona's, seed, naam-generator (fase 4).
- Geen UI-wijziging: de bestaande traitkaarten en helix lezen de nieuwe keys al
  via `dna/present.ts` zodra ze in de snapshot staan.
- Geen wijziging aan `dna/aggregate.ts`: de nieuwe module levert traits in
  dezelfde vorm, zodat de repository ze kan opslaan.

## Acceptatiecriteria

1. `src/lib/style-dna/features.ts` is puur (geen DB, geen React, geen netwerk) en
   heeft tests in `src/lib/__tests__/style-dna-features.test.ts`.
2. Rijmschema, rijmdichtheid, interne rijm, multisyllabische rijm,
   lettergrepen, POV, tense, explicitness, signature words en thema's zijn
   gedekt voor minimaal en/nl/es/pt; onbekende taal → generieke fallback.
3. Ontbrekende of te korte teksten leveren `null` op, nooit een verzonnen waarde.
4. `npm run test`, `npx tsc --noEmit` en `npm run lint` slagen.
5. Walkthrough-entry in `walkthrough2.md` (want `walkthrough.md` > 1.000 regels).

## Risico's

- **Lettergrepen meten zonder woordenboek** is een benadering. Mitigatie: per
  taal een expliciete klinkerreeks-regel, tests met echte Nederlandstalige en
  Engelstalige regels, en de waarde blijft een gemiddelde (geen claim per woord).
- **Tense-detectie** is fragiel buiten en/nl: daar blijft de trait dark in plaats
  van fout.
- **Rijm op klank** werkt het best in talen met een ondiepe orthografie; voor
  Engels/Nederlands is het een benadering en dat staat zo in de UI-tekst.
