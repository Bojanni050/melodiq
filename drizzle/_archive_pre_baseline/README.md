# Archived pre-baseline migrations

These are the old numbered migrations (`0000`–`0015`) and their `meta/`
snapshots, kept here for history/reference only — **drizzle-kit no longer
reads anything in this folder.**

## Why this was archived

`npx drizzle-kit generate` had been broken for a while: `meta/0011_snapshot.json`
and `meta/0013_snapshot.json` both pointed to the same parent snapshot, a
collision. On top of that, several migration numbers had two different `.sql`
files (`0008_motionless_overlord.sql` / `0008_suno_sliders.sql`,
`0009_add_translated_lyrics.sql` / `0009_playlist_cover.sql`) with only one of
each pair ever registered in `_journal.json`, and snapshots were missing
entirely for migrations `0003`–`0006`, `0012`, `0014`, and `0015` — i.e. the
migration history had been drifting out of sync with the actual schema for a
long time, most likely from schema changes applied by hand (`ALTER TABLE`) or
via `drizzle-kit push` rather than `generate`, without ever regenerating a
matching snapshot.

Checked first: there is no `__drizzle_migrations` tracking table in the
database (no `drizzle` schema at all), which confirms `drizzle-kit migrate`
was never actually the mechanism used to apply schema changes here — the real
workflow has been `drizzle-kit push` (which diffs `schema.ts` directly against
the live database, independent of this folder) plus some manual SQL. That
made re-baselining safe: nothing in the live database needed to change, only
the *history* needed a fresh, consistent starting point.

## What replaced it

`drizzle/0000_<name>.sql` + `drizzle/meta/0000_snapshot.json` +
`drizzle/meta/_journal.json` were regenerated fresh from the current
`src/db/schema.ts`, as a single clean baseline. `drizzle-kit generate` now
works again and will produce normal incremental migrations from this point
forward. This baseline migration was never run against the existing dev
database (its tables already exist) — it only matters for provisioning a
brand-new database from scratch.
