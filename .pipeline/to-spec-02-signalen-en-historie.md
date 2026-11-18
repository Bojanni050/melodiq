# To-spec — Fase 2: trait-historie, signalen en trait-staten

## Intake

Na fase 1 heeft het profiel 12 `words`-traits (plus per-taal-sets), maar elke
rebuild overschrijft ze zonder spoor: er is geen historie, dus geen
"changed this week", geen pulsing en geen trend. De UI kan bovendien niets
zeggen over wáárop een trait rust — Melody Genie toont daar "31 traits fit from
0 songs, 0 edits and 2 calibrations".

Kernpunt uit de verkenning (`references/dna-feature-map.md` in de skill): het
voorstel daar was een nieuwe `dna_signals`-tabel. Bij het lezen van de code blijkt
dat **dubbel werk**: `dna_feedback_events` (verdicts: confirmed/disputed/more/less)
en `dna_calibration_answers` bestaan al, en het aantal bron-tracks per trait zit al
in `sourceCount`. Wat écht ontbreekt is historie (vergelijking met de vorige
meting) en het vastzetten van een trait door de gebruiker.

## Economy gate

rung: full-spec — schemawijziging op productie, meerdere bestanden, meerdere
sessies. Reversibel: de nieuwe tabellen/kolommen zijn additief en kunnen leeg
blijven zonder de bestaande pagina te breken.

## Beslissingen

1. **Geen nieuwe `dna_signals`-tabel.** De tellers ("N songs, N edits,
   N calibrations") worden afgeleid uit wat er al is: `sourceCount` per trait
   (songs), `dna_feedback_events` (edits/verdicts), `dna_calibration_answers`
   (calibrations). Eén nieuwe tabel alleen voor historie.
2. **`dna_trait_history`** — één rij per trait per meting waarin de waarde
   veranderde: `trait_key`, `previous_value`, `value`, `direction`
   (`up|down|same`), `changed_at`. Dit voedt pulsing en de trend.
3. **Traits krijgen tijdstempels en een slot**: `dna_traits.first_seen_at`,
   `last_changed_at`, `locked_at`. Een vergrendelde trait wordt bij een rebuild
   niet overschreven (de gebruiker heeft hem zelf vastgezet).
4. **Staten in de API**, niet in de datalaag: `dark` (geen rij), `learning`
   (confidence < 0,5), `sure`, `pulsing` (laatste wijziging < 7 dagen),
   `locked`. De UI vertaalt (zoals bij de keys afgesproken).
5. **Pulsing is een afgeleide**, geen kolom: `now - lastChangedAt < 7 dagen`.

## Scope

- `src/db/schema.ts` + `src/db/init.ts` + drizzle-migratie: `dna_trait_history`
  en de drie nieuwe kolommen op `dna_traits`.
- `src/lib/dna/history.ts` (nieuw, puur): oude snapshot vs. nieuwe traits →
  wijzigingen + richting; `applyLocks()` laat vergrendelde keys ongemoeid.
- `src/lib/dna/repository.ts`: historie schrijven binnen dezelfde transactie,
  locks respecteren, `first_seen_at`/`last_changed_at` beheren.
- `src/lib/dna/states.ts` (nieuw, puur): trait + historie + tellers → `state`,
  `pulsing`, `trend`, `signals { songs, edits, calibrations }`.
- `/api/dna` (route): de nieuwe velden meesturen.
- Minimale UI: pulsing-stip en slot-icoon op de traitkaart, tellersregel boven
  de lijst.

## Niet in scope

- Geen seed/gamificatie, geen persona's of alter ego's (fase 4).
- Geen calibratie-uitbreiding (fase 3) — de tellers lezen wat er al is.
- Geen aanpassing aan de confidence-formule zelf.

## Acceptatiecriteria

1. `history.ts` en `states.ts` zijn puur en hebben tests; een trait die van 40%
   naar 46% gaat levert precies één historie-rij met richting `up`.
2. Een tweede rebuild zonder cataloguswijziging schrijft **geen** historie-rijen
   en laat `last_changed_at` staan.
3. Een vergrendelde trait houdt na een rebuild zijn waarde, confidence en
   display; `locked_at` blijft.
4. `npm run test`, `npx tsc --noEmit` en `npm run build` slagen; de migratie
   staat in `drizzle/` én in `init.ts` (`db:check-drift` blijft groen).
5. Walkthrough-entry in `walkthrough2.md`.

## Risico's

- **Rijvolume**: 69 words-traits × historie per meting kan groeien. Mitigatie:
  alleen rijen bij een gewijzigde waarde, en de historie is per trait af te
  kappen (bewaar de laatste N).
- **Productie-schema**: additief, en de container-start draait `drizzle-kit push`,
  dus de eerste deploy past het toe. `init.ts` spiegelen zodat bestaande
  installaties het ook krijgen.
- **Locks vs. waarheid**: een vastgezette fout blijft staan. Mitigatie: de UI
  toont hem als "door jou vastgezet", en de lock is met één klik te lossen.
