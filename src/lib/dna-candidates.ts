import { sql } from "drizzle-orm";

import { tracks } from "@/db/schema";
import type { AudioDna } from "@/lib/songs";

/**
 * Which tracks still need (part of) their auto Track DNA. Kept here — outside
 * the admin route — because it exists twice on purpose:
 *
 * - `hasMissingDnaFields` is the tolerant JS version (it also survives an
 *   `audio_dna` value that isn't valid JSON at all);
 * - `needsDnaWorkSql` is the same predicate in SQL, so a backfill batch doesn't
 *   pull every finished track's lyrics into memory just to decide it doesn't
 *   need work.
 *
 * They have to agree; `dna-candidates.test.ts` pins the JS side and the SQLite-
 * less SQL side against the same fixtures. Audio-only signals (tempo/key/
 * energy/loudness) come from DSP, atmosphere tags and the lyrics score from the
 * LLM — a track is a candidate when any of them is still empty.
 */
export function hasMissingDnaFields(row: {
  audioDna: string | null;
  lyrics: string | null;
  instrumental: boolean | null;
}): boolean {
  let existing: Partial<AudioDna> = {};
  if (row.audioDna) {
    try {
      existing = JSON.parse(row.audioDna) as Partial<AudioDna>;
    } catch {
      return true;
    }
  } else {
    return true;
  }

  const missingDsp = existing.tempo == null || existing.key == null || existing.energy == null || existing.loudness == null;
  const missingAtmosphere = (existing.atmosphereTags ?? []).length === 0;
  const missingLyricsScore =
    existing.lyricsScore == null && !row.instrumental && !!row.lyrics?.trim();

  return missingDsp || missingAtmosphere || missingLyricsScore;
}

/**
 * SQL mirror of hasMissingDnaFields(). `tracks.audioDna` is a JSON *text*
 * column, hence the casts.
 *
 * It is deliberately a *superset*: the route still runs the JS filter over the
 * (now small) batch, so a row selected here that turns out to be complete only
 * costs a comparison, while a row this query wrongly skips would lose work. Two
 * places where that shows:
 *
 * - a missing key or JSON null counts as missing (`jsonb_typeof` → 'null'),
 *   which is what `?? []` / `== null` mean in JS — a stray string or object
 *   counts as present, exactly like `.length !== 0`;
 * - the whitespace test spells out the characters `String.trim()` removes
 *   (space, tab, newline, CR, FF, VT); exotic Unicode whitespace is still
 *   caught by the JS filter downstream.
 *
 * A row whose `audio_dna` isn't valid JSON makes the cast throw — the caller
 * keeps its in-JS fallback for exactly that case.
 */
export const needsDnaWorkSql = sql`(
  ${tracks.audioDna} IS NULL
  OR (${tracks.audioDna})::jsonb ->> 'tempo' IS NULL
  OR (${tracks.audioDna})::jsonb ->> 'key' IS NULL
  OR (${tracks.audioDna})::jsonb ->> 'energy' IS NULL
  OR (${tracks.audioDna})::jsonb ->> 'loudness' IS NULL
  OR COALESCE(jsonb_typeof((${tracks.audioDna})::jsonb -> 'atmosphereTags'), 'null') = 'null'
  OR (
       jsonb_typeof((${tracks.audioDna})::jsonb -> 'atmosphereTags') = 'array'
       AND jsonb_array_length((${tracks.audioDna})::jsonb -> 'atmosphereTags') = 0
     )
  OR (
       (${tracks.audioDna})::jsonb ->> 'lyricsScore' IS NULL
       AND COALESCE(${tracks.instrumental}, false) = false
       AND ${tracks.lyrics} IS NOT NULL
       AND btrim(${tracks.lyrics}, E' \t\n\r\f\v') <> ''
     )
)`;
